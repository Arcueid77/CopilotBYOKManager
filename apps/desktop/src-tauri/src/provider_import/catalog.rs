use super::credential::{Credential, KeyStatus};
use crate::domain::{ApiProtocol, Connection, ModelCapabilities, ModelSpec, ProviderKind};
use crate::error::{AppError, AppResult};
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use url::Url;
use uuid::Uuid;

const MAX_CANDIDATES: usize = 256;
const MAX_MODELS: usize = 128;
const MAX_OBSERVATIONS: usize = 8192;

pub(super) fn limit() -> AppError {
    AppError::ProviderImportLimit
}

pub(crate) fn protocol(value: Option<&str>) -> Option<ApiProtocol> {
    match value {
        None | Some("completions" | "chat-completions" | "chatCompletions") => {
            Some(ApiProtocol::ChatCompletions)
        }
        Some("responses") => Some(ApiProtocol::Responses),
        Some("messages") => Some(ApiProtocol::Messages),
        _ => None,
    }
}

pub(crate) fn public_text(text: &str, max: usize) -> bool {
    if text.len() > max {
        return false;
    }
    let lower = text.to_ascii_lowercase();
    !text.trim().is_empty()
        && !text.chars().any(char::is_control)
        && crate::redact::redact_text(text) == text
        && !text.contains("${")
        && ![
            "github_pat_",
            "ghp_",
            "gho_",
            "ghu_",
            "ghs_",
            "ghr_",
            "sk-proj-",
            "sk-ant-",
        ]
        .iter()
        .any(|s| lower.contains(s))
        && !lower
            .split(['/', ':', ' ', '='])
            .any(|part| part.starts_with("sk-") && part.len() > 14)
}

/// Only portable endpoint metadata can enter a preview. Query credentials, user
/// info and fragments are never shortened into a different, valid-looking route.
pub(crate) fn endpoint(raw: &str, protocol: ApiProtocol) -> Option<String> {
    let raw = raw.trim();
    if !public_text(raw, 2048) || raw.contains('\\') {
        return None;
    }
    crate::validation::validate_endpoint(raw).ok()?;
    let mut url = Url::parse(raw).ok()?;
    if url.query().is_some() {
        let mut pairs = url.query_pairs();
        let (key, version) = pairs.next()?;
        let date = version.strip_suffix("-preview").unwrap_or(&version);
        if key != "api-version"
            || date.len() != 10
            || !date.bytes().enumerate().all(|(i, b)| {
                if matches!(i, 4 | 7) {
                    b == b'-'
                } else {
                    b.is_ascii_digit()
                }
            })
            || pairs.next().is_some()
        {
            return None;
        }
    }
    let suffix = match protocol {
        ApiProtocol::ChatCompletions => "/chat/completions",
        ApiProtocol::Responses => "/responses",
        ApiProtocol::Messages => "/messages",
    };
    let path = url.path().trim_end_matches('/');
    let base = path.strip_suffix(suffix).filter(|prefix| {
        prefix
            .rsplit('/')
            .next()
            .and_then(|s| s.strip_prefix('v'))
            .is_some_and(|digits| !digits.is_empty() && digits.bytes().all(|b| b.is_ascii_digit()))
    });
    let path = base.unwrap_or(path).to_owned();
    url.set_path(&path);
    Some(url.to_string().trim_end_matches('/').to_owned())
}

/// Discard public-looking fields that repeat a literal from the same parsed
/// configuration. Keep those values out of display metadata.
pub(crate) fn repeats_private(value: &str, literal: Option<&str>, headers: Option<&Value>) -> bool {
    let matches = |secret: &str| {
        let secret = secret.trim();
        !secret.is_empty()
            && !secret.contains("${")
            && (value.contains(secret)
                || secret.split_once(' ').is_some_and(|(scheme, token)| {
                    (scheme.eq_ignore_ascii_case("Bearer") || scheme.eq_ignore_ascii_case("Basic"))
                        && !token.is_empty()
                        && value.contains(token)
                }))
    };
    literal.is_some_and(matches)
        || headers
            .and_then(Value::as_object)
            .is_some_and(|h| h.values().filter_map(Value::as_str).any(matches))
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportModel {
    pub model_id: String,
    pub name: String,
    pub capabilities: ModelCapabilities,
}
impl ImportModel {
    pub(crate) fn to_spec(&self) -> ModelSpec {
        ModelSpec {
            id: Uuid::new_v4().to_string(),
            model_id: self.model_id.clone(),
            name: self.name.clone(),
            enabled: true,
            capabilities: self.capabilities.clone(),
        }
    }
}

pub(crate) struct ModelFields<'a> {
    pub provider: &'a str,
    pub endpoint: &'a str,
    pub protocol: Option<ApiProtocol>,
    pub kind: Option<ProviderKind>,
    pub id: &'a str,
    pub name: &'a str,
    pub api_key: Option<&'a str>,
    pub caps: ModelCapabilities,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Provider {
    pub name: String,
    pub base_url: String,
    pub protocol: ApiProtocol,
    pub kind: ProviderKind,
    pub models: Vec<ImportModel>,
}

#[derive(Default)]
pub(crate) struct Catalog {
    pub(super) providers: BTreeMap<String, Provider>,
    credentials: BTreeMap<String, Credential>,
    pub(crate) skipped: usize,
    seen: usize,
    collect_keys: bool,
}

fn route_key(base: &str, protocol: ApiProtocol, kind: ProviderKind) -> String {
    format!(
        "{} {} {base}",
        protocol.as_str(),
        if kind == ProviderKind::Azure {
            "azure"
        } else {
            "standard"
        }
    )
}
pub(crate) fn existing_key(connection: &Connection) -> Option<String> {
    endpoint(&connection.base_url, connection.protocol)
        .map(|base| route_key(&base, connection.protocol, connection.provider_kind))
}

impl Catalog {
    pub fn for_scan(collect_keys: bool) -> Self {
        Self {
            collect_keys,
            ..Self::default()
        }
    }

    pub(crate) fn add(
        &mut self,
        row: ModelFields<'_>,
        private: impl Fn(&str) -> bool,
    ) -> AppResult<()> {
        self.seen += 1;
        if self.seen > MAX_OBSERVATIONS {
            return Err(limit());
        }
        let Some(protocol) = row.protocol else {
            self.skipped += 1;
            return Ok(());
        };
        let private = |value: &str| private(value) || repeats_private(value, row.api_key, None);
        let id = row.id.trim();
        let Some(url) = endpoint(row.endpoint, protocol).filter(|_| !private(row.endpoint)) else {
            self.skipped += 1;
            return Ok(());
        };
        if !public_text(id, 320) || private(id) {
            self.skipped += 1;
            return Ok(());
        }
        let host = Url::parse(&url).expect("validated URL");
        let name = row.provider.trim();
        let name = if public_text(name, 160) && !private(name) && !name.starts_with("cbm-") {
            name
        } else {
            host.host_str().unwrap_or("Provider")
        };
        let model_name = row.name.trim();
        let label = if public_text(model_name, 240) && !private(model_name) {
            model_name
        } else {
            id
        };
        if label.len() > 240 {
            self.skipped += 1;
            return Ok(());
        }
        let mut capabilities = row.caps;
        capabilities.context_window = capabilities
            .context_window
            .filter(|n| (1..=32_000_000).contains(n));
        capabilities.max_output_tokens = capabilities
            .max_output_tokens
            .filter(|n| (1..=32_000_000).contains(n));
        let model = ImportModel {
            model_id: id.into(),
            name: label.into(),
            capabilities,
        };
        let kind = row.kind.unwrap_or(match protocol {
            ApiProtocol::Messages => ProviderKind::Anthropic,
            _ if host.scheme() == "http" => ProviderKind::Local,
            _ => ProviderKind::Openai,
        });
        let key = route_key(&url, protocol, kind);
        let credential = Credential::observe(row.api_key, self.collect_keys);
        if credential.status().is_some() {
            self.credentials
                .entry(key.clone())
                .or_default()
                .merge(credential);
        }
        let provider = self.providers.entry(key).or_insert_with(|| Provider {
            name: name.into(),
            base_url: url,
            protocol,
            kind,
            models: vec![],
        });
        add_model(provider, &model)?;
        if self.providers.len() > MAX_CANDIDATES {
            return Err(limit());
        }
        Ok(())
    }
}

fn add_model(provider: &mut Provider, model: &ImportModel) -> AppResult<()> {
    if let Some(old) = provider
        .models
        .iter_mut()
        .find(|m| m.model_id.eq_ignore_ascii_case(&model.model_id))
    {
        let a = &mut old.capabilities;
        let b = &model.capabilities;
        if a.tool_calling != b.tool_calling {
            a.tool_calling = None;
        }
        if a.vision != b.vision {
            a.vision = None;
        }
        if a.reasoning != b.reasoning {
            a.reasoning = None;
        }
        if a.context_window != b.context_window {
            a.context_window = None;
        }
        if a.max_output_tokens != b.max_output_tokens {
            a.max_output_tokens = None;
        }
    } else {
        if provider.models.len() >= MAX_MODELS {
            return Err(limit());
        }
        provider.models.push(model.clone());
    }
    Ok(())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum Action {
    Create,
    Extend,
    FillKey,
    Saved,
    Ambiguous,
    Full,
}
impl Action {
    pub(super) fn selectable(self) -> bool {
        matches!(self, Self::Create | Self::Extend | Self::FillKey)
    }
}

pub(super) struct SavedProviders<'a>(BTreeMap<String, Vec<&'a Connection>>);

impl<'a> SavedProviders<'a> {
    pub fn new(connections: &'a [Connection]) -> Self {
        let mut routes = BTreeMap::<String, Vec<&Connection>>::new();
        for connection in connections {
            if let Some(key) = existing_key(connection) {
                routes.entry(key).or_default().push(connection);
            }
        }
        Self(routes)
    }

    fn classify(
        &self,
        key: &str,
        provider: &Provider,
        key_status: Option<KeyStatus>,
    ) -> (Action, usize, Option<&str>, Option<KeyStatus>) {
        match self.0.get(key).map(Vec::as_slice).unwrap_or_default() {
            [] => (Action::Create, provider.models.len(), None, key_status),
            [existing] => {
                let key_status = if existing.has_secret {
                    None
                } else {
                    key_status
                };
                let new_models = provider
                    .models
                    .iter()
                    .filter(|model| {
                        !existing
                            .models
                            .iter()
                            .any(|saved| saved.model_id.eq_ignore_ascii_case(&model.model_id))
                    })
                    .count();
                let action = if new_models > 0 && new_models + existing.models.len() <= MAX_MODELS {
                    Action::Extend
                } else if key_status == Some(KeyStatus::Available) {
                    Action::FillKey
                } else if new_models == 0 {
                    Action::Saved
                } else {
                    Action::Full
                };
                (action, new_models, Some(&existing.id), key_status)
            }
            _ => (Action::Ambiguous, 0, None, None),
        }
    }

    pub fn has_savable_changes(&self, catalog: &Catalog) -> bool {
        catalog.providers.iter().any(|(key, provider)| {
            self.classify(
                key,
                provider,
                catalog.credentials.get(key).and_then(Credential::status),
            )
            .0
            .selectable()
        })
    }
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Candidate {
    pub id: String,
    #[serde(flatten)]
    pub provider: Provider,
    pub source_ids: BTreeSet<String>,
    pub action: Action,
    pub new_models: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub key_status: Option<KeyStatus>,
    #[serde(skip)]
    pub existing_id: Option<String>,
    #[serde(skip)]
    credential: Credential,
}

impl Candidate {
    pub(crate) fn key_material(&self) -> Option<&str> {
        self.credential.material()
    }

    pub(super) fn drop_key_material(&mut self) {
        if let Credential::Key { material, .. } = &mut self.credential {
            *material = None;
        }
    }
}

#[derive(Default)]
pub(super) struct Candidates {
    rows: BTreeMap<String, Candidate>,
    count: usize,
}
impl Candidates {
    pub fn include(&mut self, mut catalog: Catalog, source_ids: &[String]) -> AppResult<()> {
        self.count += catalog.seen;
        if self.count > MAX_OBSERVATIONS {
            return Err(limit());
        }
        for (key, incoming) in catalog.providers {
            let credential = catalog.credentials.remove(&key).unwrap_or_default();
            if let Some(row) = self.rows.get_mut(&key) {
                row.source_ids.extend(source_ids.iter().cloned());
                row.credential.merge(credential);
                for model in &incoming.models {
                    add_model(&mut row.provider, model)?;
                }
                if Url::parse(&row.provider.base_url)
                    .ok()
                    .and_then(|u| u.host_str().map(str::to_owned))
                    .as_deref()
                    == Some(row.provider.name.as_str())
                {
                    row.provider.name = incoming.name;
                }
            } else {
                if self.rows.len() >= MAX_CANDIDATES {
                    return Err(limit());
                }
                let id = crate::fingerprint::json("provider-import-route-v1", &key)?;
                self.rows.insert(
                    key,
                    Candidate {
                        id,
                        provider: incoming,
                        source_ids: source_ids.iter().cloned().collect(),
                        action: Action::Create,
                        new_models: 0,
                        key_status: None,
                        existing_id: None,
                        credential,
                    },
                );
            }
        }
        Ok(())
    }
    pub fn finish(self, existing: &[Connection]) -> Vec<Candidate> {
        let saved = SavedProviders::new(existing);
        let mut result: Vec<_> = self
            .rows
            .into_iter()
            .map(|(key, mut row)| {
                let (action, new_models, existing_id, key_status) =
                    saved.classify(&key, &row.provider, row.credential.status());
                row.action = action;
                row.new_models = new_models;
                row.existing_id = existing_id.map(str::to_owned);
                row.key_status = key_status;
                if key_status.is_none() {
                    row.credential = Credential::Absent;
                }
                row
            })
            .collect();
        result.sort_by(|a, b| {
            a.provider
                .name
                .to_lowercase()
                .cmp(&b.provider.name.to_lowercase())
                .then_with(|| a.id.cmp(&b.id))
        });
        result
    }

    pub fn has_selectable(&self, saved: &SavedProviders<'_>) -> bool {
        self.rows.iter().any(|(key, row)| {
            saved
                .classify(key, &row.provider, row.credential.status())
                .0
                .selectable()
        })
    }
}
