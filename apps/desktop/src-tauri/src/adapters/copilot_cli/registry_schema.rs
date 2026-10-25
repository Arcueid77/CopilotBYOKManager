//! Registry v1: reviewed against the official CLI 1.0.101 distribution.
//! Validate before editing; retain foreign entries and exact JSON numbers.
use crate::error::{AppError, AppResult};
use serde::de::{DeserializeSeed, MapAccess, SeqAccess, Visitor};
use serde::Deserializer;
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::fmt;

pub(super) const MAX_BYTES: u64 = 1024 * 1024;
pub(super) const MAX_ENTRIES: usize = 256;
pub(super) const SCHEMA: &str = "copilot-cli-registry-1.0.101-v1";

pub(super) fn unsupported() -> AppError {
    AppError::Unsupported("Unsupported Copilot providers.json schema; check the provider and model arrays in the CLI configuration".into())
}

// First reject duplicate keys and bound nesting. Value's arbitrary_precision
// parsing in the second pass must preserve foreign metadata without rounding.
struct Checked(usize);
impl<'de> DeserializeSeed<'de> for Checked {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        if self.0 > 32 {
            return Err(serde::de::Error::custom("excessive nesting"));
        }
        d.deserialize_any(self)
    }
}
impl<'de> Visitor<'de> for Checked {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("bounded unambiguous JSON")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut a: A) -> Result<(), A::Error> {
        let mut keys = HashSet::new();
        while let Some(key) = a.next_key::<String>()? {
            if keys.len() >= 2048 || key.len() > 512 || !keys.insert(key) {
                return Err(serde::de::Error::custom("unsupported object"));
            }
            a.next_value_seed(Checked(self.0 + 1))?;
        }
        Ok(())
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<(), A::Error> {
        let mut count = 0;
        while a.next_element_seed(Checked(self.0 + 1))?.is_some() {
            count += 1;
            if count > 2048 {
                return Err(serde::de::Error::custom("oversized array"));
            }
        }
        Ok(())
    }
    fn visit_str<E: serde::de::Error>(self, s: &str) -> Result<(), E> {
        if s.len() > 64 * 1024 {
            Err(E::custom("oversized string"))
        } else {
            Ok(())
        }
    }
    fn visit_bool<E: serde::de::Error>(self, _: bool) -> Result<(), E> {
        Ok(())
    }
    fn visit_i64<E: serde::de::Error>(self, _: i64) -> Result<(), E> {
        Ok(())
    }
    fn visit_u64<E: serde::de::Error>(self, _: u64) -> Result<(), E> {
        Ok(())
    }
    fn visit_f64<E: serde::de::Error>(self, _: f64) -> Result<(), E> {
        Ok(())
    }
    fn visit_unit<E: serde::de::Error>(self) -> Result<(), E> {
        Ok(())
    }
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
            let mut d = serde_json::Deserializer::from_slice(bytes);
            Checked(0).deserialize(&mut d).map_err(|_| unsupported())?;
            d.end().map_err(|_| unsupported())?;
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
