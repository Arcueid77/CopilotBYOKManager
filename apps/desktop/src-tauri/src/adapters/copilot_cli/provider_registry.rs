//! Public multi-provider registry. No client authentication stores are accessed.
use super::registry_schema::{self as schema, parse, text, MAX_BYTES, MAX_ENTRIES};
use crate::deployment::ownership::{self, TargetOwnership};
use crate::deployment::publication::ConfiguredSource;
use crate::domain::{ApiProtocol, Connection, ProviderKind};
use crate::error::{AppError, AppResult};
use crate::{fingerprint, safe_io, transaction, validation};
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};

pub(super) fn path() -> AppResult<PathBuf> {
    #[cfg(test)]
    if let Some(path) = TEST_PATH.with(|p| p.borrow().clone()) {
        return Ok(path);
    }
    crate::platform::home_dir()
        .map(|h| h.join(".copilot/providers.json"))
        .ok_or_else(|| AppError::Config("Cannot resolve Copilot configuration root".into()))
}

pub(super) fn resource() -> AppResult<transaction::Resource> {
    Ok(transaction::Resource::File(safe_io::resource_path(
        &path()?
    )?))
}

pub(super) fn ensure_default_root() -> AppResult<()> {
    if override_presence()?.into_iter().any(|v| v) {
        return Err(AppError::Unsupported("A custom COPILOT_HOME or COPILOT_PROVIDERS_CONFIG is set. This adapter currently supports the default ~/.copilot/providers.json path".into()));
    }
    Ok(())
}

pub(super) fn routing_fingerprint() -> AppResult<String> {
    // Registry bytes are fingerprinted as a Resource, including projected after
    // bytes. Only routing-root metadata belongs here, not the live before file.
    fingerprint::json("cli-routing-root-v2", &(path()?, override_presence()?))
}

pub(super) fn override_presence() -> AppResult<[bool; 2]> {
    #[cfg(test)]
    if test_active() {
        return Ok([false; 2]);
    }
    let inherited = [
        std::env::var_os("COPILOT_HOME").is_some(),
        std::env::var_os("COPILOT_PROVIDERS_CONFIG").is_some(),
    ];
    #[cfg(windows)]
    {
        let current = super::env_snapshot::routing_overrides()?;
        Ok([inherited[0] || current[0], inherited[1] || current[1]])
    }
    #[cfg(not(windows))]
    Ok(inherited)
}

pub(super) fn provider_name(owner: &str, connection: &str) -> AppResult<String> {
    Ok(format!(
        "cbm-{}",
        &fingerprint::json("cli-provider-name-v1", &(owner, connection))?[..24]
    ))
}

fn projection(root: &Map<String, Value>, provider: &str) -> AppResult<String> {
    fingerprint::json(
        schema::SCHEMA,
        &(
            root["providers"]
                .as_array()
                .unwrap()
                .iter()
                .find(|p| p["name"] == provider),
            root["models"]
                .as_array()
                .unwrap()
                .iter()
                .filter(|m| m["provider"] == provider)
                .collect::<Vec<_>>(),
        ),
    )
}

pub(super) fn observe(
    connections: &[Connection],
    owner: &str,
) -> AppResult<Option<Vec<ConfiguredSource>>> {
    ensure_default_root()?;
    observe_at(&path()?, connections, owner)
}

fn observe_at(
    path: &Path,
    connections: &[Connection],
    owner: &str,
) -> AppResult<Option<Vec<ConfiguredSource>>> {
    let root = parse(safe_io::read_optional(path, MAX_BYTES)?.as_deref())?;
    let providers = root["providers"].as_array().unwrap();
    let models = root["models"].as_array().unwrap();
    if providers.is_empty() && models.is_empty() {
        return Ok(None);
    }
    let mut sources = Vec::new();
    for provider in providers {
        let name = text(provider, "name")?;
        let known = connections
            .iter()
            .find(|c| provider_name(owner, &c.id).is_ok_and(|n| n == name));
        // Only display metadata leaves native memory, never the key, endpoint,
        // headers, arbitrary metadata or command-backed credentials.
        let label = known.map_or(name, |c| c.name.as_str());
        let mut label = label.to_owned();
        for key in ["apiKey", "bearerToken"] {
            label = crate::redact::redact_with_secret(
                &label,
                provider.get(key).and_then(Value::as_str),
            );
        }
        for value in provider
            .get("headers")
            .and_then(Value::as_object)
            .into_iter()
            .flat_map(|h| h.values())
        {
            label = crate::redact::redact_with_secret(&label, value.as_str());
        }
        sources.push(ConfiguredSource::new(
            &label,
            known.map(|c| c.id.as_str()),
            models.iter().filter(|m| m["provider"] == name).count(),
        )?);
    }
    Ok(Some(sources))
}

pub(super) fn prepare_owned(
    connection: &Connection,
    secret: Option<&str>,
    owner: &str,
    proofs: &[TargetOwnership],
    revoke: bool,
) -> AppResult<(transaction::PreparedWrite, Option<String>)> {
    ensure_default_root()?;
    prepare_at(&path()?, connection, secret, owner, proofs, revoke)
}

fn prepare_at(
    path: &Path,
    connection: &Connection,
    secret: Option<&str>,
    owner: &str,
    proofs: &[TargetOwnership],
    revoke: bool,
) -> AppResult<(transaction::PreparedWrite, Option<String>)> {
    validation::validate_connection(connection)?;
    validation::validate_api_key(secret)?;
    let before = safe_io::read_optional(path, MAX_BYTES)?;
    let original = parse(before.as_deref())?;
    let mut root = original.clone();
    let provider = provider_name(owner, &connection.id)?;
    let resource = transaction::Resource::File(safe_io::resource_path(path)?);
    if revoke {
        ownership::verify_binding(
            proofs,
            owner,
            &connection.id,
            &ownership::resource_id(&resource),
        )?;
    }
    // Names are stable installation/connection-scoped live markers. Publication
    // needs confirmation, not historical ownership; revocation needs both.
    let provider_index = remove_group(&mut root, "providers", "name", &provider);
    let model_index = remove_group(&mut root, "models", "provider", &provider);
    let enabled = connection
        .models
        .iter()
        .filter(|m| m.enabled)
        .collect::<Vec<_>>();
    let mut claim = None;
    if !revoke && !enabled.is_empty() {
        if secret.is_none()
            && (connection.has_secret
                || connection.headers.values().any(|v| v.contains("${apiKey}")))
        {
            return Err(AppError::Config(
                "Provider API key is unavailable; restore it before publishing".into(),
            ));
        }
        if enabled
            .iter()
            .any(|m| m.capabilities.tool_calling == Some(false))
        {
            return Err(AppError::Unsupported("Copilot CLI requires tool-calling models; disable incompatible models before publishing".into()));
        }
        let kind = match (connection.protocol, connection.provider_kind) {
            (ApiProtocol::Messages, _) => "anthropic",
            (_, ProviderKind::Azure) => "azure",
            _ => "openai",
        };
        let mut entry = json!({"name": provider, "type": kind, "baseUrl": connection.base_url});
        if kind != "anthropic" {
            entry["wireApi"] = json!(if connection.protocol == ApiProtocol::Responses {
                "responses"
            } else {
                "completions"
            });
        }
        if let Some(secret) = secret.filter(|s| !s.is_empty()) {
            entry["apiKey"] = json!(secret);
        }
        let mut headers = Map::new();
        for (key, value) in &connection.headers {
            headers.insert(
                key.clone(),
                json!(value.replace("${apiKey}", secret.unwrap_or_default())),
            );
        }
        if !headers.is_empty() {
            entry["headers"] = Value::Object(headers);
        }
        root.get_mut("providers")
            .unwrap()
            .as_array_mut()
            .unwrap()
            .insert(provider_index, entry);
        let mut entries = Vec::new();
        for model in enabled {
            let mut entry = json!({"id": model.model_id, "provider": provider, "modelId": model.model_id, "wireModel": model.model_id, "name": format!("{} · {}", connection.name, model.name)});
            if let Some(tokens) = model.capabilities.context_window {
                entry["maxContextWindowTokens"] = json!(tokens);
            }
            if let Some(tokens) = model.capabilities.max_output_tokens {
                entry["maxOutputTokens"] = json!(tokens);
            }
            let mut supports = Map::new();
            if let Some(vision) = model.capabilities.vision {
                supports.insert("vision".into(), json!(vision));
            }
            if let Some(tool_calls) = model.capabilities.tool_calling {
                supports.insert("toolCalls".into(), json!(tool_calls));
            }
            if !supports.is_empty() {
                entry["capabilities"] = json!({"supports": supports});
            }
            entries.push(entry);
        }
        root.get_mut("models")
            .unwrap()
            .as_array_mut()
            .unwrap()
            .splice(model_index..model_index, entries);
        claim = Some(projection(&root, &provider)?);
    }
    if ["providers", "models"]
        .iter()
        .any(|k| root[*k].as_array().unwrap().len() > MAX_ENTRIES)
    {
        return Err(schema::unsupported());
    }
    let after = if original == root {
        before.clone()
    } else {
        let mut bytes = serde_json::to_vec_pretty(&root).map_err(|_| schema::unsupported())?;
        bytes.push(b'\n');
        parse(Some(&bytes))?;
        Some(bytes)
    };
    let mut write = transaction::PreparedWrite::file(path, after, false)?;
    if write.before != before {
        return Err(AppError::PlanChanged);
    }
    #[cfg(unix)]
    {
        // A byte no-op cannot repair permissions through the byte-based journal.
        // Refuse to attest a public credential file as a successful private write.
        if claim.is_some()
            && !write.changed()
            && write.restore_mode.is_some_and(|mode| mode & 0o077 != 0)
        {
            return Err(AppError::Config("providers.json is readable by other users; restrict its permissions to 600 before publishing".into()));
        }
        write.write_mode = Some(0o600);
    }
    write.before = before;
    Ok((write, claim))
}

fn remove_group(root: &mut Map<String, Value>, array: &str, key: &str, provider: &str) -> usize {
    let values = root.get_mut(array).unwrap().as_array_mut().unwrap();
    let index = values
        .iter()
        .position(|v| v[key] == provider)
        .unwrap_or(values.len());
    values.retain(|v| v[key] != provider);
    index
}

#[cfg(test)]
thread_local! { static TEST_PATH: std::cell::RefCell<Option<PathBuf>> = const { std::cell::RefCell::new(None) }; }

#[cfg(test)]
pub(super) fn test_active() -> bool {
    TEST_PATH.with(|p| p.borrow().is_some())
}

#[cfg(test)]
pub(crate) fn with_test_path<T>(path: &Path, f: impl FnOnce() -> T) -> T {
    struct Reset(Option<PathBuf>);
    impl Drop for Reset {
        fn drop(&mut self) {
            TEST_PATH.with(|p| *p.borrow_mut() = self.0.take());
        }
    }
    let _reset = Reset(TEST_PATH.with(|p| p.replace(Some(path.to_path_buf()))));
    f()
}

#[cfg(test)]
#[path = "registry_tests.rs"]
mod tests;
