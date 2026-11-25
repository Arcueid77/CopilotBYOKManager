//! Registry v1: reviewed against the official CLI 1.0.101 distribution.
//! Validate before editing; retain foreign entries and exact JSON numbers.
use crate::error::{AppError, AppResult};
use serde_json::{Map, Value};
use std::collections::HashSet;

pub(super) const MAX_BYTES: u64 = 1024 * 1024;
pub(super) const MAX_ENTRIES: usize = 256;
pub(super) const SCHEMA: &str = "copilot-cli-registry-1.0.101-v1";

pub(super) fn unsupported() -> AppError {
    AppError::Unsupported("Unsupported Copilot providers.json schema; check the provider and model arrays in the CLI configuration".into())
}

pub(super) fn text<'a>(v: &'a Value, key: &str) -> AppResult<&'a str> {
    v.get(key)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty() && s.len() <= 512 && !s.chars().any(char::is_control))
        .ok_or_else(unsupported)
}

pub(super) fn parse(bytes: Option<&[u8]>) -> AppResult<Map<String, Value>> {
    let mut root = match bytes {
        None => Map::new(),
        Some(bytes) => {
            if bytes.len() as u64 > MAX_BYTES {
                return Err(unsupported());
            }
            crate::adapters::bounded_json::check_json(bytes).map_err(|_| unsupported())?;
            let Value::Object(root) = serde_json::from_slice(bytes).map_err(|_| unsupported())?
            else {
                return Err(unsupported());
            };
            root
        }
    };
    if root
        .keys()
        .any(|k| !matches!(k.as_str(), "providers" | "models" | "$schema"))
    {
        return Err(unsupported());
    }
    for key in ["providers", "models"] {
        let v = root.entry(key).or_insert_with(|| Value::Array(Vec::new()));
        if v.as_array().is_none_or(|a| a.len() > MAX_ENTRIES) {
            return Err(unsupported());
        }
    }
    let mut providers = HashSet::new();
    for provider in root["providers"].as_array().unwrap() {
        let name = text(provider, "name")?;
        if name.contains('/') || !providers.insert(name) {
            return Err(unsupported());
        }
        text(provider, "baseUrl")?;
        if provider
            .get("type")
            .is_some_and(|t| !matches!(t.as_str(), Some("openai" | "anthropic" | "azure")))
        {
            return Err(unsupported());
        }
        if provider
            .get("wireApi")
            .is_some_and(|t| !matches!(t.as_str(), Some("completions" | "responses")))
        {
            return Err(unsupported());
        }
    }
    let mut models = HashSet::new();
    for model in root["models"].as_array().unwrap() {
        let provider = text(model, "provider")?;
        let id = text(model, "id")?;
        if !providers.contains(provider) || !models.insert((provider, id)) {
            return Err(unsupported());
        }
    }
    Ok(root)
}
