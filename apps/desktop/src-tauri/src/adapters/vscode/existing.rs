use super::{parse_groups, CONNECTION_ID_FIELD, MANAGED_MARKER, OWNER_ID_FIELD};
use crate::error::{AppError, AppResult};
use crate::provider_import::repeats_private;
use crate::provider_management::{Entry, FieldKind, Removal};
use serde_json::Value;
use std::path::Path;

pub(crate) fn read(path: &Path, bytes: &[u8]) -> AppResult<(Value, Vec<Entry>)> {
    let text = std::str::from_utf8(bytes)
        .map_err(|_| AppError::Unsupported("Unsupported VS Code configuration encoding".into()))?;
    if !text.trim().is_empty()
        && crate::adapters::bounded_json::check_json(bytes).is_err()
        && crate::adapters::bounded_json::check_json5(text).is_err()
    {
        return Err(AppError::Unsupported(
            "Ambiguous VS Code provider configuration".into(),
        ));
    }
    let groups = parse_groups(path, bytes)?;
    if groups.len() > 256 {
        return Err(crate::provider_import::too_large());
    }
    let mut entries = Vec::new();
    for (index, group) in groups
        .iter()
        .enumerate()
        .filter(|(_, g)| g["vendor"] == "customendpoint")
    {
        let models = group["models"]
            .as_array()
            .filter(|v| v.len() <= 256)
            .ok_or_else(|| AppError::Unsupported("Unsupported VS Code endpoint group".into()))?;
        let private_group =
            |s: &str| repeats_private(s, group["apiKey"].as_str(), group.get("requestHeaders"));
        let private_model = |model: &Value, s: &str| {
            repeats_private(s, model["apiKey"].as_str(), model.get("requestHeaders"))
        };
        let private =
            |s: &str| private_group(s) || models.iter().any(|model| private_model(model, s));
        let mut entry = Entry::new(
            group["name"].as_str().unwrap_or("Custom Endpoint"),
            models.len(),
            private,
        );
        let prefix = format!("/{index}");
        entry.field(
            FieldKind::Name,
            format!("{prefix}/name"),
            &group["name"],
            None,
            private,
        );
        entry.field(
            FieldKind::Endpoint,
            format!("{prefix}/url"),
            &group["url"],
            None,
            private,
        );
        for (i, model) in models.iter().enumerate() {
            let label = model["id"].as_str();
            let path = format!("{prefix}/models/{i}");
            let private = |s: &str| private_group(s) || private_model(model, s);
            entry.field(
                FieldKind::ModelName,
                format!("{path}/name"),
                &model["name"],
                label,
                private,
            );
            entry.field(
                FieldKind::ModelEndpoint,
                format!("{path}/url"),
                &model["url"],
                label,
                private,
            );
        }
        entry.remove(Removal::Row { array: "", index });
        if group[MANAGED_MARKER] == true {
            entry.set_marked_binding(&group[OWNER_ID_FIELD], &group[CONNECTION_ID_FIELD]);
        }
        entries.push(entry);
    }
    Ok((Value::Array(groups), entries))
}
