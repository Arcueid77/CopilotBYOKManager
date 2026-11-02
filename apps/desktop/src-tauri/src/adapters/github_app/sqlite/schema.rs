use crate::error::{AppError, AppResult};
use rusqlite::Connection;
use serde::Serialize;

pub(super) const CONTRACT: &str = "copilot-app-windows-x64-1.1.25-sqlite-v1";

pub(super) fn incompatible() -> AppError {
    AppError::Unsupported(
        "Unsupported Copilot App database schema; use manual configuration".into(),
    )
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

pub(super) fn inspect(db: &Connection) -> AppResult<(String, Vec<Reference>)> {
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
    for (table, fields) in expected {
        let mut statement = db.prepare("SELECT name,type,\"notnull\",pk,dflt_value FROM pragma_table_info(?1) ORDER BY cid LIMIT 32").map_err(sql_error)?;
        let columns = statement
            .query_map([table], |row| {
                Ok(Column {
                    name: row.get(0)?,
                    kind: row.get(1)?,
                    required: row.get::<_, i64>(2)? != 0,
                    primary: row.get(3)?,
                    default: row.get(4)?,
                })
            })
            .map_err(sql_error)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(sql_error)?;
        if columns.len() != fields.len()
            || columns
                .iter()
                .zip(fields)
                .any(|(c, (name, kind, required, pk))| {
                    c.name != name
                        || c.kind.to_ascii_uppercase() != kind
                        || c.required != required
                        || c.primary != pk
                })
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
        if table == "provider_models" {
            let normalized = schema
                .chars()
                .filter(|c| !c.is_ascii_whitespace() && *c != '"')
                .collect::<String>()
                .to_ascii_lowercase();
            if !normalized.contains(
                "check(wire_api_overrideisnullorwire_api_overridein('completions','responses'))",
            ) {
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
        if keys.len() != 1
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
    Ok((fingerprint, references))
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
