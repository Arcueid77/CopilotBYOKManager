use super::{keys, parse, provider_name, CONNECTION, MANAGED, OWNER, SCHEMA, SCHEMA_VERSION};
use crate::error::{AppError, AppResult};
use crate::provider_import::repeats_private;
use crate::provider_management::{pointer_key, Entry, FieldKind, Removal};
use serde_json::Value;

pub(crate) fn read(bytes: &[u8]) -> AppResult<(Value, Vec<Entry>)> {
    let root = parse(Some(bytes))?;
    let mut entries = Vec::new();
    for (key, config) in &root {
        let Some(provider) = key.strip_suffix("-provider-config") else {
            continue;
        };
        let [api_key, config_key, models_key] = keys(provider);
        let models = root
            .get(&models_key)
            .and_then(Value::as_object)
            .filter(|v| v.len() <= 256)
            .ok_or_else(|| AppError::Unsupported("Unsupported JetBrains model catalog".into()))?;
        let private_provider = |s: &str| {
            repeats_private(
                s,
                root.get(&api_key).and_then(Value::as_str),
                config.get("requestHeaders"),
            )
        };
        let private_model = |id: &str, model: &Value, s: &str| {
            repeats_private(
                s,
                root.get(&format!("{provider}-{id}-api-key"))
                    .and_then(Value::as_str),
                model["modelCapabilities"].get("requestHeaders"),
            )
        };
        let private = |s: &str| {
            private_provider(s) || models.iter().any(|(id, model)| private_model(id, model, s))
        };
        let mut entry = Entry::new(
            config["groupName"].as_str().unwrap_or(provider),
            models.len(),
            private,
        );
        entry.field(
            FieldKind::Name,
            format!("/{}/groupName", pointer_key(&config_key)),
            &config["groupName"],
            None,
            private,
        );
        for (id, model) in models {
            let path = format!("/{}/{}", pointer_key(&models_key), pointer_key(id));
            let private = |s: &str| private_provider(s) || private_model(id, model, s);
            entry.field(
                FieldKind::ModelName,
                format!("{path}/modelCapabilities/name"),
                &model["modelCapabilities"]["name"],
                Some(id),
                private,
            );
            entry.field(
                FieldKind::ModelEndpoint,
                format!("{path}/deploymentUrl"),
                &model["deploymentUrl"],
                Some(id),
                private,
            );
            let model_key = format!("{provider}-{id}-api-key");
            if root.contains_key(&model_key)
                && !root.contains_key(&format!("{provider}-{id}-provider-config"))
            {
                entry.remove(Removal::Key(model_key));
            }
        }
        for key in [api_key, config_key, models_key] {
            entry.remove(Removal::Key(key));
        }
        if config[MANAGED] == true
            && config[SCHEMA] == SCHEMA_VERSION
            && config[OWNER]
                .as_str()
                .zip(config[CONNECTION].as_str())
                .is_some_and(|(owner, connection)| {
                    provider_name(owner, connection).is_ok_and(|name| name == provider)
                })
        {
            entry.set_marked_binding(&config[OWNER], &config[CONNECTION]);
        }
        entries.push(entry);
        if entries.len() > 256 {
            return Err(crate::provider_import::too_large());
        }
    }
    Ok((Value::Object(root), entries))
}
