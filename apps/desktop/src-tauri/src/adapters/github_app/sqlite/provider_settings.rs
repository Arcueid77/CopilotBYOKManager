//! Early JSON-format App releases mirror part of settings_json in required columns.
use super::{rows::ProviderRow, schema::sql_error};
use crate::{deployment::ownership, error::AppResult};
use rusqlite::{params, Connection};
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Settings {
    auth_kind: String,
    base_url: String,
    headers_json: String,
    wire_api: String,
}

impl Settings {
    fn parse(row: &ProviderRow) -> AppResult<Self> {
        let settings: Self =
            serde_json::from_str(&row.settings).map_err(|_| ownership::conflict())?;
        if settings.auth_kind != "none"
            || !matches!(settings.wire_api.as_str(), "completions" | "responses")
        {
            return Err(ownership::conflict());
        }
        Ok(settings)
    }
}

pub(super) fn check_mirrors(db: &Connection, row: &ProviderRow) -> AppResult<()> {
    let s = Settings::parse(row)?;
    let matches: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM model_providers WHERE id=?1 AND base_url=?2 AND wire_api=?3
         AND azure_api_version IS NULL AND auth_kind=?4 AND headers_json=?5)",
        params![row.id, s.base_url, s.wire_api, s.auth_kind, s.headers_json], |r| r.get(0)
    ).map_err(sql_error)?;
    if !matches {
        return Err(ownership::conflict());
    }
    Ok(())
}

pub(super) fn write_mirrors(db: &Connection, row: &ProviderRow, existing: bool) -> AppResult<()> {
    let s = Settings::parse(row)?;
    let sql = if existing {
        "UPDATE model_providers SET name=?2,type=?3,settings_json=?4,created_at=?5,updated_at=?6,
         base_url=?7,wire_api=?8,auth_kind=?9,headers_json=?10 WHERE id=?1 AND azure_api_version IS NULL"
    } else {
        "INSERT INTO model_providers(id,name,type,settings_json,created_at,updated_at,base_url,wire_api,
         auth_kind,headers_json) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)"
    };
    db.execute(
        sql,
        params![
            row.id,
            row.name,
            row.kind,
            row.settings,
            row.created,
            row.updated,
            s.base_url,
            s.wire_api,
            s.auth_kind,
            s.headers_json
        ],
    )
    .map_err(sql_error)?;
    Ok(())
}
