use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeSet;

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum FieldKind {
    Name,
    Endpoint,
    ModelName,
    ModelEndpoint,
}

impl FieldKind {
    fn is_endpoint(self) -> bool {
        matches!(self, Self::Endpoint | Self::ModelEndpoint)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Field {
    kind: FieldKind,
    value: String,
    model: Option<String>,
    #[serde(skip)]
    pointer: String,
}

/// These addresses are computed from the parsed, allowlisted adapter document.
/// The frontend can select a listed field, but cannot provide a JSON pointer.
pub(crate) enum Removal {
    Row { array: &'static str, index: usize },
    Key(String),
}

#[derive(PartialEq, Eq)]
pub(crate) enum Binding {
    Marked { owner: String, connection: String },
    Cli(String),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Entry {
    name: String,
    model_count: usize,
    fields: Vec<Field>,
    #[serde(skip)]
    removals: Vec<Removal>,
    #[serde(skip)]
    pub binding: Option<Binding>,
}

impl Entry {
    pub fn new(name: &str, model_count: usize, private: impl Fn(&str) -> bool) -> Self {
        let safe = crate::provider_import::public_text(name, 512) && !private(name);
        Self {
            name: if safe { name.to_owned() } else { String::new() },
            model_count,
            fields: vec![],
            removals: vec![],
            binding: None,
        }
    }

    pub fn field(
        &mut self,
        kind: FieldKind,
        pointer: String,
        value: &Value,
        model: Option<&str>,
        private: impl Fn(&str) -> bool,
    ) {
        let Some(value) = value.as_str() else { return };
        if !safe_value(kind, value) || private(value) {
            return;
        }
        self.fields.push(Field {
            kind,
            value: value.to_owned(),
            model: model
                .filter(|model| crate::provider_import::public_text(model, 320) && !private(model))
                .map(str::to_owned),
            pointer,
        });
    }

    pub fn remove(&mut self, field: Removal) {
        self.removals.push(field);
    }

    pub fn set_marked_binding(&mut self, owner: &Value, connection: &Value) {
        if let (Some(owner), Some(connection)) = (owner.as_str(), connection.as_str()) {
            self.binding = Some(Binding::Marked {
                owner: owner.into(),
                connection: connection.into(),
            });
        }
    }

    pub fn mutate(&self, root: &mut Value, change: &Change) -> AppResult<()> {
        match change {
            Change::Edit { fields } => self.edit(root, fields),
            Change::Delete => {
                for removal in &self.removals {
                    match removal {
                        Removal::Row { array, index } => {
                            let rows = root
                                .pointer_mut(array)
                                .and_then(Value::as_array_mut)
                                .filter(|rows| *index < rows.len())
                                .ok_or(AppError::PlanChanged)?;
                            rows.remove(*index);
                        }
                        Removal::Key(key) => {
                            root.as_object_mut()
                                .ok_or(AppError::PlanChanged)?
                                .remove(key);
                        }
                    }
                }
                Ok(())
            }
        }
    }

    fn edit(&self, root: &mut Value, fields: &[FieldChange]) -> AppResult<()> {
        if fields.is_empty() || fields.len() > self.fields.len() {
            return Err(invalid());
        }
        let mut edited = BTreeSet::new();
        for change in fields {
            let field = self.fields.get(change.index).ok_or_else(invalid)?;
            let value = change.value.trim();
            if !edited.insert(change.index) || !safe_value(field.kind, value) {
                return Err(invalid());
            }
            let current = root
                .pointer_mut(&field.pointer)
                .ok_or(AppError::PlanChanged)?;
            *current = Value::String(value.to_owned());
        }
        Ok(())
    }
}

fn safe_value(kind: FieldKind, value: &str) -> bool {
    if kind.is_endpoint() {
        crate::provider_import::portable_endpoint(
            value,
            crate::domain::ApiProtocol::ChatCompletions,
        )
        .is_some()
    } else {
        crate::provider_import::public_text(value, 512)
    }
}

fn invalid() -> AppError {
    AppError::InvalidInput("Invalid provider configuration edit".into())
}

#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub(crate) enum Change {
    Edit { fields: Vec<FieldChange> },
    Delete,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct FieldChange {
    index: usize,
    value: String,
}

pub(crate) fn pointer_key(key: &str) -> String {
    key.replace('~', "~0").replace('/', "~1")
}
