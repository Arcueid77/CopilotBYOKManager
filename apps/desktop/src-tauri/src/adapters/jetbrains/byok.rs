//! Versioned projection of the dedicated BYOK namespace used by the official
//! language server. Authentication files and IDE Password Safe are never opened.
use crate::deployment::ownership::{self, TargetOwnership};
use crate::domain::{ApiProtocol, Connection, DeploymentBlocker};
use crate::error::{AppError, AppResult};
use crate::{fingerprint, safe_file, safe_io, transaction, validation};
use serde::de::{MapAccess, Visitor};
use serde::{Deserialize, Deserializer};
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::fmt;
use std::path::{Path, PathBuf};

pub(crate) mod existing;

const MAX_BYTES: u64 = 4 * 1024 * 1024;
const MAX_KEYS: usize = 2048;
const OWNER: &str = "copilotByokManagerInstallationOwnerId";
const CONNECTION: &str = "copilotByokManagerConnectionId";
const MANAGED: &str = "copilotByokManagerManaged";
const SCHEMA: &str = "copilotByokManagerSchemaVersion";
// Durable identity of the BYOK storage format, independent of plugin updates.
pub const SCHEMA_VERSION: &str = "jetbrains-byok-1.19-v1";

pub fn supported_version(version: &str) -> bool {
    let Some((release, distribution)) = version.split_once('-') else {
        return false;
    };
    let (build, classifier) = distribution
        .split_once('-')
        .map_or((distribution, None), |(build, tag)| (build, Some(tag)));
    super::super::version::release_number(release).is_some_and(|v| v >= [1, 13, 0])
        && build.len() == 3
        && !build.starts_with('0')
        && build.bytes().all(|b| b.is_ascii_digit())
        && matches!(
            classifier,
            None | Some(
                "windows-x64"
                    | "windows-arm64"
                    | "macos-x64"
                    | "macos-arm64"
                    | "linux-x64"
                    | "linux-arm64"
            )
        )
}

pub fn store_path() -> AppResult<PathBuf> {
    #[cfg(test)]
    if let Some(path) = TEST_PATH.with(|value| value.borrow().clone()) {
        return Ok(path);
    }
    #[cfg(feature = "local-e2e")]
    if crate::test_support::active() {
        return crate::platform::home_dir()
            .map(|home| path_at(&home, None, cfg!(windows)))
            .ok_or_else(|| invalid("JetBrains BYOK root is unavailable"));
    }
    let home =
        crate::platform::home_dir().ok_or_else(|| invalid("JetBrains BYOK root is unavailable"))?;
    let xdg = std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from);
    Ok(path_at(&home, xdg.as_deref(), cfg!(windows)))
}

fn path_at(home: &Path, xdg: Option<&Path>, windows: bool) -> PathBuf {
    let root = match xdg.filter(|path| path.is_absolute()) {
        Some(path) => path.to_path_buf(),
        None if windows => home.join("AppData/Local"),
        None => home.join(".config"),
    };
    root.join("github-copilot/byok.json")
}

pub fn observed_resources() -> AppResult<Vec<transaction::Resource>> {
    let path = store_path()?;
    safe_file::ensure_regular_or_missing(&path)?;
    Ok(vec![transaction::Resource::File(safe_io::resource_path(
        &path,
    )?)])
}

pub(super) fn publication_endpoint(
    connection: &Connection,
    has_key: bool,
) -> Result<String, (DeploymentBlocker, AppError)> {
    let endpoint = effective_endpoint(connection)
        .map_err(|error| (DeploymentBlocker::IncompatibleEndpoint, error))?;
    if !has_key {
        return Err((
            DeploymentBlocker::MissingProviderKey,
            AppError::Unsupported("Save a provider API key before publishing to JetBrains".into()),
        ));
    }
    Ok(endpoint)
}

/// Mirror the reviewed resolver without making a request. A terminal URL must
/// survive its rewriting exactly; bases must be a host root or an explicit /vN.
/// Otherwise an arbitrary route could silently acquire /v1 or change protocol.
pub fn effective_endpoint(connection: &Connection) -> AppResult<String> {
    let url =
        url::Url::parse(&connection.base_url).map_err(|_| invalid("Invalid JetBrains endpoint"))?;
    if url.query().is_some() {
        return Err(AppError::Unsupported("JetBrains 1.19 custom endpoints cannot faithfully project an endpoint query string. Use a query-free compatible endpoint; no configuration was written".into()));
    }
    let input = connection.base_url.trim().trim_end_matches('/');
    let terminal = [
        "/v1/messages",
        "/chat/completions",
        "/responses",
        "/messages",
    ]
    .into_iter()
    .find(|suffix| input.ends_with(suffix));
    let mut base = terminal.map_or(input, |suffix| &input[..input.len() - suffix.len()]);
    let version = base.rsplit_once('/').filter(|(_, last)| {
        last.strip_prefix('v')
            .is_some_and(|digits| !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()))
    });
    let route = match connection.protocol {
        ApiProtocol::ChatCompletions => "/chat/completions",
        ApiProtocol::Responses => "/responses",
        ApiProtocol::Messages => "/v1/messages",
    };
    let effective = if connection.protocol == ApiProtocol::Messages {
        if let Some((prefix, _)) = version {
            base = prefix;
        }
        format!("{base}{route}")
    } else if version.is_some() {
        format!("{base}{route}")
    } else {
        format!("{base}/v1{route}")
    };
    let path = url.path().trim_end_matches('/');
    let compatible = if terminal.is_some() {
        effective == input
    } else if path.is_empty() {
        true // The root explicitly uses the plugin's documented /v1 default.
    } else {
        version
            .is_some_and(|(_, last)| connection.protocol != ApiProtocol::Messages || last == "v1")
    };
    if !compatible {
        return Err(AppError::Unsupported("The reviewed JetBrains BYOK runtime would rewrite this endpoint to a different route. Use a host root, a compatible versioned base, or the full inference URL matching the selected protocol; no configuration was written".into()));
    }
    Ok(effective)
}

fn provider_name(owner: &str, connection: &str) -> AppResult<String> {
    Ok(format!(
        "CopilotBYOKManager-{}",
        &fingerprint::json("jetbrains-provider-v1", &(owner, connection))?[..32]
    ))
}

fn keys(provider: &str) -> [String; 3] {
    [
        format!("{provider}-api-key"),
        format!("{provider}-provider-config"),
        format!("{provider}-models-config"),
    ]
}

/// A JSON object visitor rejecting duplicate keys at *every* level. JSON's usual
/// last-wins behavior would make ownership and the plugin's interpretation ambiguous.
struct Unique(Value);
impl<'de> Deserialize<'de> for Unique {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct UniqueVisitor;
        impl<'de> Visitor<'de> for UniqueVisitor {
            type Value = Unique;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("bounded JSON without duplicate keys")
            }
            fn visit_map<A: MapAccess<'de>>(self, mut access: A) -> Result<Unique, A::Error> {
                let mut map = Map::new();
                while let Some((key, value)) = access.next_entry::<String, Unique>()? {
                    if map.len() >= MAX_KEYS || key.len() > 512 || map.contains_key(&key) {
                        return Err(serde::de::Error::custom("unsupported object"));
                    }
                    map.insert(key, value.0);
                }
                Ok(Unique(Value::Object(map)))
            }
            fn visit_seq<A: serde::de::SeqAccess<'de>>(
                self,
                mut access: A,
            ) -> Result<Unique, A::Error> {
                let mut values = Vec::new();
                while let Some(value) = access.next_element::<Unique>()? {
                    if values.len() >= MAX_KEYS {
                        return Err(serde::de::Error::custom("unsupported array"));
                    }
                    values.push(value.0);
                }
                Ok(Unique(Value::Array(values)))
            }
            fn visit_bool<E: serde::de::Error>(self, value: bool) -> Result<Unique, E> {
                Ok(Unique(Value::Bool(value)))
            }
            fn visit_i64<E: serde::de::Error>(self, value: i64) -> Result<Unique, E> {
                Ok(Unique(json!(value)))
            }
            fn visit_u64<E: serde::de::Error>(self, value: u64) -> Result<Unique, E> {
                Ok(Unique(json!(value)))
            }
            fn visit_f64<E: serde::de::Error>(self, value: f64) -> Result<Unique, E> {
                serde_json::Number::from_f64(value)
                    .map(|n| Unique(Value::Number(n)))
                    .ok_or_else(|| E::custom("invalid number"))
            }
            fn visit_str<E: serde::de::Error>(self, value: &str) -> Result<Unique, E> {
                if value.len() > 64 * 1024 {
                    return Err(E::custom("oversized string"));
                }
                Ok(Unique(Value::String(value.into())))
            }
            fn visit_none<E: serde::de::Error>(self) -> Result<Unique, E> {
                Ok(Unique(Value::Null))
            }
            fn visit_unit<E: serde::de::Error>(self) -> Result<Unique, E> {
                Ok(Unique(Value::Null))
            }
        }
        deserializer.deserialize_any(UniqueVisitor)
    }
}

fn parse(bytes: Option<&[u8]>) -> AppResult<Map<String, Value>> {
    let Some(bytes) = bytes else {
        return Ok(Map::new());
    };
    if bytes.len() as u64 > MAX_BYTES {
        return Err(invalid("JetBrains BYOK configuration exceeds its bound"));
    }
    let _checked = serde_json::from_slice::<Unique>(bytes)
        .map_err(|_| invalid("JetBrains BYOK configuration has an unsupported or ambiguous JSON schema; no values are included in diagnostics"))?;
    // Parse again with Value's arbitrary-precision number handling. The visitor
    // above validates uniqueness only; it must not round an unknown user's number.
    let value: Value =
        serde_json::from_slice(bytes).map_err(|_| invalid("Unsupported JetBrains BYOK JSON"))?;
    fn bounded_depth(value: &Value, depth: usize) -> bool {
        if depth > 32 {
            return false;
        }
        match value {
            Value::Object(map) => map.values().all(|v| bounded_depth(v, depth + 1)),
            Value::Array(values) => values.iter().all(|v| bounded_depth(v, depth + 1)),
            _ => true,
        }
    }
    if !bounded_depth(&value, 0) {
        return Err(invalid("JetBrains BYOK JSON nesting exceeds its bound"));
    }
    let Value::Object(map) = value else {
        return Err(invalid("JetBrains BYOK configuration must be an object"));
    };
    if !map.is_empty()
        && !map.keys().any(|key| {
            ["-api-key", "-provider-config", "-models-config"]
                .iter()
                .any(|suffix| key.ends_with(suffix))
        })
    {
        return Err(invalid("Unrecognized JetBrains BYOK store format"));
    }
    for (key, config) in &map {
        if let Some(provider) = key.strip_suffix("-provider-config") {
            if !config.is_object()
                || !map.get(&keys(provider)[2]).is_some_and(Value::is_object)
                || config
                    .get(SCHEMA)
                    .is_some_and(|v| v.as_str() != Some(SCHEMA_VERSION))
            {
                return Err(invalid(
                    "Unsupported JetBrains BYOK provider configuration format",
                ));
            }
        }
        if key.ends_with("-models-config") && !config.is_object() {
            return Err(invalid("Unsupported JetBrains BYOK model catalog format"));
        }
    }
    Ok(map)
}

pub(super) fn check_namespace(path: &Path) -> AppResult<()> {
    parse(safe_io::read_optional(path, MAX_BYTES)?.as_deref()).map(|_| ())
}

fn projection(map: &Map<String, Value>, owned: &[String; 3]) -> AppResult<String> {
    let values = owned
        .iter()
        .map(|key| (key, map.get(key)))
        .collect::<BTreeMap<_, _>>();
    fingerprint::json("jetbrains-owned-provider-v1", &values)
}

pub(crate) fn observe_current(
    path: &Path,
) -> AppResult<Vec<crate::deployment::publication::ConfiguredSource>> {
    use crate::deployment::publication::ConfiguredSource;
    let map = parse(safe_io::read_optional(path, MAX_BYTES)?.as_deref())?;
    let mut sources = Vec::new();
    for (key, config) in &map {
        let Some(provider) = key.strip_suffix("-provider-config") else {
            continue;
        };
        let owned = keys(provider);
        let models = map
            .get(&owned[2])
            .and_then(Value::as_object)
            .ok_or_else(|| invalid("Unsupported provider model catalog"))?;
        if let Some(schema) = config.get(SCHEMA).and_then(Value::as_str) {
            if schema != SCHEMA_VERSION {
                return Err(invalid("Unsupported provider metadata schema"));
            }
        }
        let name = config
            .get("groupName")
            .and_then(Value::as_str)
            .unwrap_or(provider);
        let name =
            crate::redact::redact_with_secret(name, map.get(&owned[0]).and_then(Value::as_str));
        sources.push(ConfiguredSource::new(
            &name,
            config.get(CONNECTION).and_then(Value::as_str),
            models.len(),
        )?);
        if sources.len() > 256 {
            return Err(invalid("Too many provider groups"));
        }
    }
    Ok(sources)
}

pub fn prepare_owned(
    connection: &Connection,
    secret: Option<&str>,
    owner: &str,
    proofs: &[TargetOwnership],
    revoke: bool,
) -> AppResult<(transaction::PreparedWrite, Option<String>)> {
    prepare_at(&store_path()?, connection, secret, owner, proofs, revoke)
}

pub(crate) fn import_catalog(
    path: &Path,
    collect_keys: bool,
) -> AppResult<crate::provider_import::Catalog> {
    use crate::provider_import::{protocol, repeats_private, Catalog, ModelFields};
    let map = parse(safe_io::read_optional(path, MAX_BYTES)?.as_deref())?;
    let mut catalog = Catalog::for_scan(collect_keys);
    for (key, config) in &map {
        let Some(id) = key.strip_suffix("-provider-config") else {
            continue;
        };
        let fields = keys(id);
        let models = map
            .get(&fields[2])
            .and_then(Value::as_object)
            .ok_or_else(|| invalid("Unsupported provider catalog"))?;
        if models.is_empty() {
            catalog.skipped += 1;
        }
        for (model_id, model) in models {
            if model["isRegistered"].as_bool() == Some(false) {
                continue;
            }
            let caps = &model["modelCapabilities"];
            let wire = match config.get("apiType") {
                None => protocol(None),
                Some(v) => v.as_str().and_then(|s| protocol(Some(s))),
            };
            let model_key = format!("{id}-{model_id}-api-key");
            catalog.add(
                ModelFields {
                    provider: config["groupName"].as_str().unwrap_or(id),
                    endpoint: model["deploymentUrl"].as_str().unwrap_or_default(),
                    protocol: wire,
                    kind: None,
                    id: model_id,
                    name: caps["name"].as_str().unwrap_or_default(),
                    api_key: map
                        .get(&model_key)
                        .or_else(|| map.get(&fields[0]))
                        .and_then(Value::as_str),
                    caps: crate::domain::ModelCapabilities {
                        tool_calling: caps["toolCalling"].as_bool(),
                        vision: caps["vision"].as_bool(),
                        reasoning: caps["thinking"].as_bool(),
                        context_window: caps["maxInputTokens"].as_u64(),
                        max_output_tokens: caps["maxOutputTokens"].as_u64(),
                    },
                },
                |s| {
                    repeats_private(
                        s,
                        map.get(&fields[0]).and_then(Value::as_str),
                        caps.get("requestHeaders"),
                    ) || repeats_private(s, map.get(&model_key).and_then(Value::as_str), None)
                },
            )?;
        }
    }
    Ok(catalog)
}

pub(super) fn prepare_at(
    path: &Path,
    connection: &Connection,
    secret: Option<&str>,
    owner: &str,
    proofs: &[TargetOwnership],
    revoke: bool,
) -> AppResult<(transaction::PreparedWrite, Option<String>)> {
    validation::validate_connection(connection)?;
    validation::validate_api_key(secret)?;
    let secret = secret.filter(|value| !value.trim().is_empty());
    if !revoke {
        publication_endpoint(connection, secret.is_some()).map_err(|(_, error)| error)?;
    }
    safe_file::ensure_regular_or_missing(path)?;
    let before = safe_io::read_optional(path, MAX_BYTES)?;
    let original = parse(before.as_deref())?;
    let provider = provider_name(owner, &connection.id)?;
    let owned = keys(&provider);
    let resource = transaction::Resource::File(safe_io::resource_path(path)?);
    let resource_id = ownership::resource_id(&resource);
    // A managed connection appearing under another name/owner is never adopted.
    for (name, config) in &original {
        if name.ends_with("-provider-config")
            && config.get(CONNECTION).and_then(Value::as_str) == Some(&connection.id)
            && name != &owned[1]
        {
            return Err(ownership::conflict());
        }
    }
    let present = owned
        .iter()
        .filter(|key| original.contains_key(*key))
        .count();
    if present != 0 {
        let config = original.get(&owned[1]).ok_or_else(ownership::conflict)?;
        if present != 3
            || config.get(OWNER).and_then(Value::as_str) != Some(owner)
            || config.get(CONNECTION).and_then(Value::as_str) != Some(&connection.id)
            || config.get(MANAGED).and_then(Value::as_bool) != Some(true)
            || config.get(SCHEMA).and_then(Value::as_str) != Some(SCHEMA_VERSION)
        {
            return Err(ownership::conflict());
        }
        ownership::verify_binding(proofs, owner, &connection.id, &resource_id)?;
    }
    // Per-model keys for our provider would override our provider key upstream.
    if original
        .keys()
        .any(|key| key.starts_with(&format!("{provider}-")) && !owned.contains(key))
    {
        return Err(ownership::conflict());
    }
    let mut desired = original.clone();
    for key in &owned {
        desired.remove(key);
    }
    let after_projection = if revoke {
        None
    } else {
        let secret = secret.filter(|s| !s.is_empty()).ok_or_else(|| {
            invalid("JetBrains provider key is unavailable; no configuration was written")
        })?;
        let protocol = match connection.protocol {
            ApiProtocol::ChatCompletions => "chatCompletions",
            ApiProtocol::Responses => "responses",
            ApiProtocol::Messages => "messages",
        };
        desired.insert(owned[0].clone(), json!(secret));
        desired.insert(
            owned[1].clone(),
            json!({ "groupName":connection.name, "apiType":protocol,
            MANAGED:true, OWNER:owner, CONNECTION:connection.id, SCHEMA:SCHEMA_VERSION }),
        );
        let headers = connection
            .headers
            .iter()
            .map(|(name, value)| (name.clone(), value.replace("${apiKey}", secret)))
            .collect::<BTreeMap<_, _>>();
        let mut models = Map::new();
        for model in connection.enabled_models() {
            let mut capabilities = Map::new();
            capabilities.insert("name".into(), json!(model.name));
            capabilities.insert(
                "toolCalling".into(),
                json!(model.capabilities.tool_calling.unwrap_or(true)),
            );
            capabilities.insert(
                "vision".into(),
                json!(model.capabilities.vision.unwrap_or(false)),
            );
            for (key, value) in [
                ("maxInputTokens", model.capabilities.context_window),
                ("maxOutputTokens", model.capabilities.max_output_tokens),
            ] {
                if let Some(value) = value {
                    capabilities.insert(key.into(), json!(value));
                }
            }
            if let Some(value) = model.capabilities.reasoning {
                capabilities.insert("thinking".into(), json!(value));
            }
            if !headers.is_empty() {
                capabilities.insert("requestHeaders".into(), json!(headers));
            }
            models.insert(model.model_id.clone(), json!({"deploymentUrl":connection.base_url, "isRegistered":true, "isCustomModel":true, "modelCapabilities":capabilities}));
        }
        desired.insert(owned[2].clone(), Value::Object(models));
        Some(projection(&desired, &owned)?)
    };
    let after = if desired == original {
        before.clone()
    } else if desired.is_empty() {
        None
    } else {
        let mut bytes = serde_json::to_vec_pretty(&desired)
            .map_err(|_| invalid("Cannot render JetBrains BYOK configuration"))?;
        bytes.push(b'\n');
        if bytes.len() as u64 > MAX_BYTES {
            return Err(invalid(
                "Projected JetBrains BYOK configuration exceeds its bound",
            ));
        }
        Some(bytes)
    };
    safe_file::ensure_regular_or_missing(path)?;
    let write = transaction::PreparedWrite::file(path, after, false)?;
    if write.before != before {
        return Err(AppError::PlanChanged);
    }
    Ok((write, after_projection))
}

fn invalid(message: &str) -> AppError {
    AppError::InvalidInput(message.into())
}

#[cfg(test)]
thread_local! { static TEST_PATH: std::cell::RefCell<Option<PathBuf>> = const { std::cell::RefCell::new(None) }; }
#[cfg(test)]
pub(super) fn with_test_path<T>(path: &Path, f: impl FnOnce() -> T) -> T {
    struct Restore(Option<PathBuf>);
    impl Drop for Restore {
        fn drop(&mut self) {
            TEST_PATH.with(|value| *value.borrow_mut() = self.0.take());
        }
    }
    let _restore = Restore(TEST_PATH.with(|value| value.replace(Some(path.into()))));
    f()
}

#[cfg(test)]
#[path = "byok_tests.rs"]
mod tests;
