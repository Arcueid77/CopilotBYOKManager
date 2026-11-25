use super::{provider_registry, registry_schema};
use crate::error::AppResult;
use crate::provider_import::repeats_private;
use crate::provider_management::{Binding, Entry, FieldKind, Removal};
use serde_json::Value;
use std::path::PathBuf;

pub(crate) fn path() -> AppResult<PathBuf> {
    provider_registry::ensure_default_root()?;
    provider_registry::path()
}

pub(crate) fn matches_binding(provider: &str, owner: &str, connection: &str) -> bool {
    provider_registry::provider_name(owner, connection).is_ok_and(|name| name == provider)
}

pub(crate) fn read(bytes: &[u8]) -> AppResult<(Value, Vec<Entry>)> {
    let root = registry_schema::parse(Some(bytes))?;
    let providers = root["providers"].as_array().expect("parsed provider array");
    let models = root["models"].as_array().expect("parsed model array");
    let mut entries = Vec::new();
    for (index, provider) in providers.iter().enumerate() {
        let name = registry_schema::text(provider, "name")?;
        let models = models
            .iter()
            .enumerate()
            .filter(|(_, model)| model["provider"] == name);
        let private = |s: &str| {
            repeats_private(s, provider["apiKey"].as_str(), provider.get("headers"))
                || repeats_private(s, provider["bearerToken"].as_str(), None)
        };
        let mut entry = Entry::new(name, models.clone().count(), private);
        entry.field(
            FieldKind::Endpoint,
            format!("/providers/{index}/baseUrl"),
            &provider["baseUrl"],
            None,
            private,
        );
        entry.remove(Removal::Row {
            array: "/providers",
            index,
        });
        for (index, model) in models.rev() {
            entry.field(
                FieldKind::ModelName,
                format!("/models/{index}/name"),
                &model["name"],
                model["id"].as_str(),
                private,
            );
            entry.remove(Removal::Row {
                array: "/models",
                index,
            });
        }
        entry.binding = Some(Binding::Cli(name.to_owned()));
        entries.push(entry);
    }
    Ok((Value::Object(root), entries))
}
