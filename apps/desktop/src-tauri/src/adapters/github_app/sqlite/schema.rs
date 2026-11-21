use crate::error::{AppError, AppResult};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

pub(super) const CONTRACT: &str = "copilot-app-windows-x64-1.1.25-sqlite-v1";

pub(super) fn incompatible() -> AppError {
    crate::error::AppCompatibilityIssue::Schema.into()
}
pub(super) fn sql_error(_: rusqlite::Error) -> AppError {
    AppError::Config("Copilot App database operation failed or is busy; inspect synchronization status before retrying".into())
}

#[derive(Serialize)]
struct Column {
    name: String,
    kind: String,
    required: bool,
    primary: i64,
    default: Option<String>,
    #[serde(skip)]
    hidden: i64,
}

#[derive(Clone, Serialize)]
pub(super) struct Reference {
    pub table: String,
    pub column: String,
    pub action: String,
}

fn safe_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum Format {
    JsonWithLegacyColumns,
    JsonWithLegacyColumnsAndAccount,
    Basic,
    #[default]
    V1,
    VisionV2,
}
impl Format {
    pub(super) fn has_legacy_columns(self) -> bool {
        matches!(
            self,
            Self::JsonWithLegacyColumns | Self::JsonWithLegacyColumnsAndAccount
        )
    }
    pub(super) fn has_account(self) -> bool {
        self != Self::JsonWithLegacyColumns
    }
    pub(super) fn has_efforts(self) -> bool {
        matches!(self, Self::V1 | Self::VisionV2)
    }
    pub fn is_v1(&self) -> bool {
        *self == Self::V1
    }
}
pub(super) struct Inspected {
    pub fingerprint: String,
    pub format: Format,
    pub references: Vec<Reference>,
}

pub(super) fn inspect(db: &Connection) -> AppResult<Inspected> {
    let expected = [
        (
            "model_providers",
            vec![
                ("id", "TEXT", true, 1),
                ("name", "TEXT", true, 0),
                ("created_at", "TEXT", true, 0),
                ("updated_at", "TEXT", true, 0),
                ("type", "TEXT", true, 0),
                ("settings_json", "TEXT", true, 0),
                ("account_id", "TEXT", false, 0),
            ],
        ),
        (
            "provider_models",
            vec![
                ("id", "TEXT", true, 1),
                ("provider_id", "TEXT", true, 0),
                ("model_id", "TEXT", true, 0),
                ("wire_model", "TEXT", false, 0),
                ("display_name", "TEXT", true, 0),
                ("max_prompt_tokens", "INTEGER", false, 0),
                ("max_output_tokens", "INTEGER", false, 0),
                ("wire_api_override", "TEXT", false, 0),
                ("created_at", "TEXT", true, 0),
                ("updated_at", "TEXT", true, 0),
                ("supported_reasoning_efforts", "TEXT", false, 0),
            ],
        ),
    ];
    let mut canonical = Vec::new();
    let mut format = Format::V1;
    for (table, fields) in expected {
        let mut statement = db.prepare("SELECT name,type,\"notnull\",pk,dflt_value,hidden FROM pragma_table_xinfo(?1) ORDER BY cid LIMIT 32").map_err(sql_error)?;
        let mut columns = statement
            .query_map([table], |row| {
                Ok(Column {
                    name: row.get(0)?,
                    kind: row.get(1)?,
                    required: row.get::<_, i64>(2)? != 0,
                    primary: row.get(3)?,
                    default: row.get(4)?,
                    hidden: row.get(5)?,
                })
            })
            .map_err(sql_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(sql_error)?;
        if columns.iter().any(|column| column.hidden != 0) {
            return Err(incompatible());
        }
        if table == "model_providers" && columns.get(2).is_some_and(|c| c.name == "base_url") {
            let legacy = [
                ("base_url", true, None),
                ("wire_api", true, Some("'completions'")),
                ("azure_api_version", false, None),
                ("auth_kind", true, Some("'api_key'")),
                ("headers_json", true, Some("'{}'")),
            ];
            if !columns.get(2..7).is_some_and(|found| {
                found
                    .iter()
                    .zip(legacy)
                    .all(|(c, (name, required, default))| {
                        c.name == name
                            && c.kind.eq_ignore_ascii_case("TEXT")
                            && c.required == required
                            && c.primary == 0
                            && c.default.as_deref() == default
                    })
            }) {
                return Err(incompatible());
            }
            columns.drain(2..7);
            format = if columns.last().is_some_and(|c| c.name == "account_id") {
                Format::JsonWithLegacyColumnsAndAccount
            } else {
                Format::JsonWithLegacyColumns
            };
        }
        if table == "provider_models"
            && format == Format::V1
            && columns.last().is_some_and(|c| {
                c.name == "supports_vision"
                    && c.kind.eq_ignore_ascii_case("INTEGER")
                    && c.required
                    && c.primary == 0
                    && c.default.as_deref() == Some("0")
            })
        {
            // Migration 206 adds this field. Keep the physical ownership identifier
            // compatible with v1, and bind the format separately in plans and consent.
            format = Format::VisionV2;
            columns.pop();
        }
        if table == "provider_models"
            && format == Format::V1
            && columns.len() + 1 == fields.len()
            && columns.last().is_some_and(|c| c.name == "updated_at")
        {
            // Compare the real columns below; use the v1 shape only for the
            // durable resource identifier originally generated by v0.2.3.
            format = Format::Basic;
        }
        let basic = table == "provider_models" && !format.has_efforts();
        let without_account = table == "model_providers" && !format.has_account();
        let expected_fields = if basic || without_account {
            &fields[..fields.len() - 1]
        } else {
            &fields
        };
        if columns.len() != expected_fields.len()
            || columns.iter().zip(expected_fields.iter().copied()).any(
                |(c, (name, kind, required, pk))| {
                    c.name != name
                        || c.kind.to_ascii_uppercase() != kind
                        || c.required != required
                        || c.primary != pk
                },
            )
        {
            return Err(incompatible());
        }
        for column in &columns {
            let expected_default = match column.name.as_str() {
                "created_at" | "updated_at" => Some("strftime('%y-%m-%dt%h:%m:%fz','now')"),
                "type" => Some("'openai'"),
                "settings_json" => Some("'{}'"),
                _ => None,
            };
            let actual = column.default.as_ref().map(|s| {
                s.chars()
                    .filter(|c| !c.is_ascii_whitespace())
                    .collect::<String>()
                    .to_ascii_lowercase()
            });
            if actual.as_deref() != expected_default {
                return Err(incompatible());
            }
        }
        let schema: String = db.query_row("SELECT sql FROM sqlite_schema WHERE type='table' AND name=?1 AND length(sql)<=16384", [table], |r|r.get(0)).map_err(sql_error)?;
        let normalized = schema
            .chars()
            .filter(|c| !c.is_ascii_whitespace() && *c != '"')
            .collect::<String>()
            .to_ascii_lowercase();
        if table == "model_providers"
            && format.has_legacy_columns()
            && (!normalized.contains("check(wire_apiin('completions','responses'))")
                || !normalized.contains("check(auth_kindin('api_key','bearer_token','none'))"))
        {
            return Err(incompatible());
        }
        if table == "provider_models" {
            if !normalized.contains(
                "check(wire_api_overrideisnullorwire_api_overridein('completions','responses'))",
            ) || (format == Format::VisionV2
                && !normalized.contains("check(supports_visionin(0,1))"))
            {
                return Err(incompatible());
            }
            let mut stmt = db.prepare("SELECT name FROM pragma_index_list(?1) WHERE \"unique\"=1 AND origin='u' AND partial=0 LIMIT 8").map_err(sql_error)?;
            let indexes = stmt
                .query_map([table], |r| r.get::<_, String>(0))
                .map_err(sql_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(sql_error)?;
            if indexes.len() != 1 {
                return Err(incompatible());
            }
            let mut stmt = db
                .prepare("SELECT name FROM pragma_index_info(?1) ORDER BY seqno LIMIT 8")
                .map_err(sql_error)?;
            let fields = stmt
                .query_map([&indexes[0]], |r| r.get::<_, String>(0))
                .map_err(sql_error)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(sql_error)?;
            if fields != ["provider_id", "model_id"] {
                return Err(incompatible());
            }
        }
        let triggers: i64 = db
            .query_row(
                "SELECT count(*) FROM sqlite_schema WHERE type='trigger' AND tbl_name=?1",
                [table],
                |r| r.get(0),
            )
            .map_err(sql_error)?;
        if triggers != 0 {
            return Err(incompatible());
        }
        let mut stmt = db.prepare("SELECT \"table\",\"from\",\"to\",on_delete,on_update FROM pragma_foreign_key_list(?1) LIMIT 8").map_err(sql_error)?;
        let keys = stmt
            .query_map([table], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, String>(4)?,
                ))
            })
            .map_err(sql_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(sql_error)?;
        let wanted = if table == "model_providers" {
            ("accounts", "account_id", "id", "CASCADE", "NO ACTION")
        } else {
            (
                "model_providers",
                "provider_id",
                "id",
                "CASCADE",
                "NO ACTION",
            )
        };
        if without_account {
            if !keys.is_empty() {
                return Err(incompatible());
            }
            columns.push(Column {
                name: "account_id".into(),
                hidden: 0,
                kind: "TEXT".into(),
                required: false,
                primary: 0,
                default: None,
            });
        } else if keys.len() != 1
            || keys[0]
                != (
                    wanted.0.into(),
                    wanted.1.into(),
                    wanted.2.into(),
                    wanted.3.into(),
                    wanted.4.into(),
                )
        {
            return Err(incompatible());
        }
        if basic {
            columns.push(Column {
                name: "supported_reasoning_efforts".into(),
                hidden: 0,
                kind: "TEXT".into(),
                required: false,
                primary: 0,
                default: None,
            });
        }
        canonical.push((table, columns));
    }
    // Schema metadata only. Never select values from these referencing tables.
    let mut stmt = db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name LIMIT 257").map_err(sql_error)?;
    let tables = stmt
        .query_map([], |r| r.get::<_, String>(0))
        .map_err(sql_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(sql_error)?;
    if tables.len() > 256 {
        return Err(incompatible());
    }
    let mut references = Vec::new();
    for table in tables {
        if table == "model_providers" || table == "provider_models" {
            continue;
        }
        let mut stmt = db.prepare("SELECT \"table\",\"from\",\"to\",on_delete FROM pragma_foreign_key_list(?1) LIMIT 65").map_err(sql_error)?;
        let values = stmt
            .query_map([&table], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                ))
            })
            .map_err(sql_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(sql_error)?;
        if values.len() > 64 {
            return Err(incompatible());
        }
        for (parent, column, to, action) in values {
            if parent != "model_providers" && parent != "provider_models" {
                continue;
            }
            if !safe_identifier(&table)
                || !safe_identifier(&column)
                || to != "id"
                || ![
                    "CASCADE",
                    "SET NULL",
                    "SET DEFAULT",
                    "RESTRICT",
                    "NO ACTION",
                ]
                .contains(&action.as_str())
            {
                return Err(incompatible());
            }
            references.push(Reference {
                table: table.clone(),
                column,
                action,
            });
            if references.len() > 128 {
                return Err(incompatible());
            }
        }
    }
    let fingerprint = crate::fingerprint::json(CONTRACT, &(canonical, &references))?;
    Ok(Inspected {
        fingerprint,
        format,
        references,
    })
}

pub(super) fn guard_references(db: &Connection, references: &[Reference]) -> AppResult<()> {
    for (index, reference) in references.iter().enumerate() {
        if ["CASCADE", "SET NULL", "SET DEFAULT"].contains(&reference.action.as_str()) {
            // TEMP guards make SQLite's own FK action abort before it changes an unrelated row.
            // No reference value or session/account content is returned to the manager.
            for operation in [
                format!("UPDATE OF \"{}\"", reference.column),
                "DELETE".into(),
            ] {
                let name = format!(
                    "cbm_reference_guard_{index}_{}",
                    if operation == "DELETE" {
                        "delete"
                    } else {
                        "update"
                    }
                );
                db.execute_batch(&format!("CREATE TEMP TRIGGER \"{name}\" BEFORE {operation} ON main.\"{}\" BEGIN SELECT RAISE(ABORT,'Referenced Copilot App configuration must be resolved in App'); END;",reference.table)).map_err(sql_error)?;
            }
        }
    }
    Ok(())
}
