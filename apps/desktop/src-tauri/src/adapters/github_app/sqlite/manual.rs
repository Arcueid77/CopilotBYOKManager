//! One user-selected BYOK group. This resource can only delete its reviewed
//! preimage or restore those exact bytes during conditional rollback.
use super::{import, open_readonly, rows, schema, target::Target, write_transaction};
use crate::{
    deployment::publication::ConfiguredSource,
    error::{AppError, AppResult},
    fingerprint,
    transaction::{PreparedWrite, Resource},
};
use rusqlite::{params_from_iter, types::Value as SqlValue, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

pub(super) const BYOK_TYPES: &str = "('openai','custom','azure','anthropic')";
const MAX_SNAPSHOT: usize = 2 * 1024 * 1024;

pub(super) fn eligible_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 512
        && !id.chars().any(char::is_control)
        && !id
            .as_bytes()
            .get(..4)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case(b"cbm-"))
}

pub(super) fn selector(target: &Target, id: &str, source: &ConfiguredSource) -> AppResult<String> {
    fingerprint::json(
        "app-manual-provider-selection-v1",
        &(target, id, &source.name, source.model_count),
    )
}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ManualProvider {
    target: Target,
    provider_id: String,
    before_digest: String,
}

// These explicit columns belong to the reviewed schema. account_id is always
// NULL for an eligible row. No account, session or credential store is queried.
fn provider_columns(format: schema::Format) -> &'static str {
    if format.has_legacy_columns() {
        "id,name,type,settings_json,created_at,updated_at,base_url,wire_api,azure_api_version,auth_kind,headers_json"
    } else {
        "id,name,type,settings_json,created_at,updated_at"
    }
}

fn model_columns(format: schema::Format) -> String {
    let mut columns = String::from("id,provider_id,model_id,wire_model,display_name,max_prompt_tokens,max_output_tokens,wire_api_override,created_at,updated_at");
    if format.has_efforts() {
        columns.push_str(",supported_reasoning_efforts");
    }
    if format == schema::Format::VisionV2 {
        columns.push_str(",supports_vision");
    }
    columns
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Snapshot {
    provider: Vec<Value>,
    models: Vec<Vec<Value>>,
}

impl Snapshot {
    fn read(db: &Connection, id: &str, format: schema::Format) -> AppResult<Option<Self>> {
        if !eligible_id(id) {
            return Err(AppError::PlanChanged);
        }
        if !rows::provider_present(db, id)? {
            return Ok(None);
        }
        let account = if format.has_account() {
            "AND account_id IS NULL"
        } else {
            ""
        };
        let columns = provider_columns(format);
        let sql = format!("SELECT json_array({columns}) FROM model_providers WHERE id=?1 AND type IN {BYOK_TYPES} {account}");
        let raw: String = db
            .query_row(&sql, [id], |row| row.get(0))
            .optional()
            .map_err(schema::sql_error)?
            .ok_or(AppError::PlanChanged)?;
        let mut size = raw.len();
        let provider = parse_row(&raw)?;
        if provider.first().and_then(Value::as_str) != Some(id) {
            return Err(AppError::PlanChanged);
        }
        let sql = format!("SELECT json_array({}) FROM provider_models WHERE provider_id=?1 ORDER BY id COLLATE BINARY LIMIT 257", model_columns(format));
        let mut statement = db.prepare(&sql).map_err(schema::sql_error)?;
        let mut result = statement.query([id]).map_err(schema::sql_error)?;
        let mut models = Vec::new();
        while let Some(row) = result.next().map_err(schema::sql_error)? {
            let raw: String = row.get(0).map_err(schema::sql_error)?;
            size += raw.len();
            if models.len() == 256 || size > MAX_SNAPSHOT {
                return Err(schema::incompatible());
            }
            let model = parse_row(&raw)?;
            if model.get(1).and_then(Value::as_str) != Some(id) {
                return Err(AppError::PlanChanged);
            }
            models.push(model);
        }
        Ok(Some(Self { provider, models }))
    }

    fn bytes(&self) -> AppResult<Vec<u8>> {
        let bytes = serde_json::to_vec(self).map_err(|_| schema::incompatible())?;
        if bytes.len() > MAX_SNAPSHOT {
            return Err(schema::incompatible());
        }
        Ok(bytes)
    }

    fn restore(&self, db: &Connection, format: schema::Format) -> AppResult<()> {
        insert(
            db,
            "model_providers",
            provider_columns(format),
            &self.provider,
        )?;
        let columns = model_columns(format);
        for model in &self.models {
            insert(db, "provider_models", &columns, model)?;
        }
        Ok(())
    }
}

fn parse_row(raw: &str) -> AppResult<Vec<Value>> {
    let values: Vec<Value> = serde_json::from_str(raw).map_err(|_| schema::incompatible())?;
    if values
        .iter()
        .any(|v| !(v.is_null() || v.is_i64() || v.as_str().is_some_and(|s| s.len() <= 65536)))
    {
        return Err(schema::incompatible());
    }
    Ok(values)
}

fn insert(db: &Connection, table: &str, columns: &str, values: &[Value]) -> AppResult<()> {
    let params = values
        .iter()
        .map(|v| match v {
            Value::Null => Ok(SqlValue::Null),
            Value::String(s) => Ok(SqlValue::Text(s.clone())),
            n => n
                .as_i64()
                .map(SqlValue::Integer)
                .ok_or_else(schema::incompatible),
        })
        .collect::<AppResult<Vec<_>>>()?;
    let placeholders = vec!["?"; params.len()].join(",");
    let sql = format!("INSERT OR ABORT INTO {table} ({columns}) VALUES ({placeholders})");
    db.execute(&sql, params_from_iter(params))
        .map_err(schema::sql_error)?;
    Ok(())
}

fn digest(bytes: &[u8]) -> String {
    fingerprint::bytes("app-manual-provider-undo-v1", Some(bytes))
}

pub(crate) fn review(
    target: &Target,
    selection: &str,
) -> AppResult<(ManualProvider, Option<String>)> {
    if selection.len() != 64 || !selection.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(AppError::PlanChanged);
    }
    let _guard = target.verify()?;
    let db = open_readonly(&target.database)?;
    target.check_schema(&db)?;
    let (id, source) = import::provider_catalog(&db, target, &BTreeMap::new())?
        .into_iter()
        .find(|(_, source)| source.manual_deletion_id.as_deref() == Some(selection))
        .ok_or(AppError::PlanChanged)?;
    let snapshot = Snapshot::read(&db, &id, target.format)?.ok_or(AppError::PlanChanged)?;
    let name = snapshot.provider[1]
        .as_str()
        .ok_or_else(schema::incompatible)?;
    let name = if crate::provider_import::public_text(name, 512) {
        name
    } else {
        ""
    };
    let current = ConfiguredSource::new(name, None, snapshot.models.len())?;
    if current.name != source.name || current.model_count != source.model_count {
        return Err(AppError::PlanChanged);
    }
    let settings = snapshot.provider[3]
        .as_str()
        .and_then(|s| serde_json::from_str::<Value>(s).ok());
    let origin = settings
        .as_ref()
        .and_then(|s| s.get("baseUrl"))
        .and_then(Value::as_str)
        .or_else(|| snapshot.provider.get(6).and_then(Value::as_str))
        .and_then(|raw| url::Url::parse(raw).ok())
        .filter(|url| matches!(url.scheme(), "http" | "https") && url.has_host())
        .map(|url| url.origin().ascii_serialization())
        .filter(|value| crate::provider_import::public_text(value, 512));
    let before = snapshot.bytes()?;
    let resource = ManualProvider {
        target: target.clone(),
        provider_id: id,
        before_digest: digest(&before),
    };
    Ok((resource, origin))
}

impl ManualProvider {
    pub(crate) fn deletion(&self) -> AppResult<PreparedWrite> {
        let before = self
            .read()?
            .filter(|bytes| self.matches(bytes))
            .ok_or(AppError::PlanChanged)?;
        Ok(PreparedWrite {
            resource: Resource::AppManualProvider(Box::new(self.clone())),
            before: Some(before),
            after: None,
            restore_mode: None,
            write_mode: None,
        })
    }
    pub(crate) fn key(&self) -> String {
        format!(
            "app-manual-provider:{}:{}:{}",
            self.target.database.display(),
            self.target.identity,
            self.before_digest
        )
    }

    pub(crate) fn matches(&self, bytes: &[u8]) -> bool {
        eligible_id(&self.provider_id)
            && bytes.len() <= MAX_SNAPSHOT
            && digest(bytes) == self.before_digest
    }

    pub(crate) fn read(&self) -> AppResult<Option<Vec<u8>>> {
        let _guard = self.target.verify()?;
        let db = open_readonly(&self.target.database)?;
        self.target.check_schema(&db)?;
        Snapshot::read(&db, &self.provider_id, self.target.format)?
            .map(|s| s.bytes())
            .transpose()
    }

    pub(crate) fn write(
        &self,
        expected: Option<&[u8]>,
        after: Option<&[u8]>,
        authorize: impl Fn() -> AppResult<()>,
    ) -> AppResult<()> {
        let bytes = match (expected, after) {
            (Some(bytes), None) | (None, Some(bytes)) if self.matches(bytes) => bytes,
            _ => return Err(AppError::PlanChanged),
        };
        let snapshot: Snapshot =
            serde_json::from_slice(bytes).map_err(|_| schema::incompatible())?;
        if snapshot.provider.first().and_then(Value::as_str) != Some(&self.provider_id)
            || snapshot
                .models
                .iter()
                .any(|m| m.get(1).and_then(Value::as_str) != Some(&self.provider_id))
        {
            return Err(AppError::PlanChanged);
        }
        write_transaction(&self.target, authorize, |db, format| {
            let current = || {
                Snapshot::read(db, &self.provider_id, format)?
                    .map(|s| s.bytes())
                    .transpose()
            };
            if current()?.as_deref() != expected {
                return Err(AppError::PlanChanged);
            }
            if after.is_some() {
                snapshot.restore(db, format)?;
            } else {
                // The reviewed FK cascades only into this provider's model rows.
                // Reference guards abort any effect on an external table.
                let changed_before = db.total_changes();
                db.execute(
                    "DELETE FROM model_providers WHERE id=?1",
                    [&self.provider_id],
                )
                .map_err(|error| match &error {
                    rusqlite::Error::SqliteFailure(e, _)
                        if matches!(
                            e.extended_code,
                            rusqlite::ffi::SQLITE_CONSTRAINT_TRIGGER
                                | rusqlite::ffi::SQLITE_CONSTRAINT_FOREIGNKEY
                        ) =>
                    {
                        AppError::AppProviderReferenced
                    }
                    _ => schema::sql_error(error),
                })?;
                if db.total_changes() - changed_before != 1 + snapshot.models.len() as u64 {
                    return Err(AppError::PlanChanged);
                }
            }
            if current()?.as_deref() != after {
                return Err(AppError::PlanChanged);
            }
            Ok(())
        })
    }
}
