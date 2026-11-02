use super::schema::sql_error;
use crate::{
    domain::{ApiProtocol, Connection as Provider, ProviderKind},
    error::{AppError, AppResult},
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ProviderRow {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub settings: String,
    pub created: String,
    pub updated: String,
}
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct ModelRow {
    pub id: String,
    pub provider: String,
    pub model: String,
    pub wire: Option<String>,
    pub name: String,
    pub prompt: Option<i64>,
    pub output: Option<i64>,
    pub api: Option<String>,
    pub created: String,
    pub updated: String,
    pub efforts: Option<String>,
}
#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub(super) struct Projection {
    pub provider: ProviderRow,
    pub models: Vec<ModelRow>,
}

fn invalid() -> AppError {
    AppError::Config("Invalid or externally modified Copilot App provider projection".into())
}
pub(super) fn provider_id(owner: &str, connection: &str) -> AppResult<String> {
    Ok(format!(
        "cbm-{}",
        &crate::fingerprint::json("copilot-app-provider-v1", &(owner, connection))?[..40]
    ))
}
fn model_id(provider: &str, model: &str) -> AppResult<String> {
    Ok(format!(
        "{provider}-m-{}",
        &crate::fingerprint::json("copilot-app-model-v1", &model)?[..32]
    ))
}
pub(super) fn valid_provider_id(value: &str) -> bool {
    value.len() == 44
        && value.starts_with("cbm-")
        && value[4..]
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}

impl Projection {
    pub fn bytes(&self) -> AppResult<Vec<u8>> {
        serde_json::to_vec(self).map_err(|_| invalid())
    }
    pub fn decode(bytes: &[u8]) -> AppResult<Self> {
        if bytes.len() > 2 * 1024 * 1024 {
            return Err(invalid());
        }
        let value: Self = serde_json::from_slice(bytes).map_err(|_| invalid())?;
        value.validate()?;
        Ok(value)
    }
    fn validate(&self) -> AppResult<()> {
        if !valid_provider_id(&self.provider.id)
            || self.provider.name.len() > 512
            || self.provider.settings.len() > 65536
            || self.provider.kind != "openai"
            || self.models.len() > 256
        {
            return Err(invalid());
        }
        if self.provider.created.len() > 64 || self.provider.updated.len() > 64 {
            return Err(invalid());
        }
        let mut ids = HashSet::new();
        let mut models = HashSet::new();
        for row in &self.models {
            if row.provider != self.provider.id
                || row.id != model_id(&row.provider, &row.model)?
                || row.model.is_empty()
                || row.model.len() > 512
                || row.name.len() > 512
                || row.wire.as_ref().is_some_and(|v| v.len() > 512)
                || row.created.len() > 64
                || row.updated.len() > 64
                || row.efforts.as_ref().is_some_and(|v| v.len() > 8192)
                || row
                    .api
                    .as_deref()
                    .is_some_and(|v| !["completions", "responses"].contains(&v))
                || row.prompt.is_some_and(|v| v <= 0)
                || row.output.is_some_and(|v| v <= 0)
                || !ids.insert(&row.id)
                || !models.insert(&row.model)
            {
                return Err(invalid());
            }
        }
        Ok(())
    }
}

pub(super) fn exists(db: &Connection, id: &str) -> AppResult<bool> {
    db.query_row(
        "SELECT EXISTS(SELECT 1 FROM model_providers WHERE id=?1)",
        [id],
        |r| r.get(0),
    )
    .map_err(sql_error)
}
pub(super) fn foreign_models(db: &Connection, id: &str) -> AppResult<i64> {
    let prefix = format!("{id}-m-");
    db.query_row(
        "SELECT count(*) FROM provider_models WHERE provider_id=?1 AND substr(id,1,?2)<>?3",
        params![id, prefix.len() as i64, prefix],
        |r| r.get(0),
    )
    .map_err(sql_error)
}

pub(super) fn read(db: &Connection, id: &str) -> AppResult<Option<Projection>> {
    if !valid_provider_id(id) {
        return Err(invalid());
    }
    if !exists(db, id)? {
        return Ok(None);
    }
    let linked: bool = db
        .query_row(
            "SELECT account_id IS NOT NULL FROM model_providers WHERE id=?1",
            [id],
            |r| r.get(0),
        )
        .map_err(sql_error)?;
    if linked {
        return Err(invalid());
    }
    let provider = db.query_row("SELECT id,CASE WHEN length(CAST(name AS BLOB))<=512 THEN name END,type,CASE WHEN length(CAST(settings_json AS BLOB))<=65536 THEN settings_json END,CASE WHEN length(created_at)<=64 THEN created_at END,CASE WHEN length(updated_at)<=64 THEN updated_at END FROM model_providers WHERE id=?1",[id],|r|Ok(ProviderRow{id:r.get(0)?,name:r.get(1)?,kind:r.get(2)?,settings:r.get(3)?,created:r.get(4)?,updated:r.get(5)?})).map_err(sql_error)?;
    let prefix = format!("{id}-m-");
    let mut stmt=db.prepare("SELECT id,provider_id,CASE WHEN length(CAST(model_id AS BLOB))<=512 THEN model_id END,CASE WHEN length(CAST(wire_model AS BLOB))<=512 THEN wire_model END,CASE WHEN length(CAST(display_name AS BLOB))<=512 THEN display_name END,max_prompt_tokens,max_output_tokens,wire_api_override,CASE WHEN length(created_at)<=64 THEN created_at END,CASE WHEN length(updated_at)<=64 THEN updated_at END,CASE WHEN length(supported_reasoning_efforts)<=8192 THEN supported_reasoning_efforts END FROM provider_models WHERE provider_id=?1 AND substr(id,1,?2)=?3 ORDER BY id LIMIT 257").map_err(sql_error)?;
    let oversized: bool = db.query_row("SELECT EXISTS(SELECT 1 FROM provider_models WHERE provider_id=?1 AND substr(id,1,?2)=?3 AND (length(CAST(id AS BLOB))>80 OR length(CAST(wire_model AS BLOB))>512 OR length(CAST(wire_api_override AS BLOB))>16 OR length(CAST(supported_reasoning_efforts AS BLOB))>8192))",params![id,prefix.len() as i64,prefix],|r|r.get(0)).map_err(sql_error)?;
    if oversized {
        return Err(invalid());
    }
    let models = stmt
        .query_map(params![id, prefix.len() as i64, prefix], |r| {
            Ok(ModelRow {
                id: r.get(0)?,
                provider: r.get(1)?,
                model: r.get(2)?,
                wire: r.get(3)?,
                name: r.get(4)?,
                prompt: r.get(5)?,
                output: r.get(6)?,
                api: r.get(7)?,
                created: r.get(8)?,
                updated: r.get(9)?,
                efforts: r.get(10)?,
            })
        })
        .map_err(sql_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(sql_error)?;
    let value = Projection { provider, models };
    value.validate()?;
    Ok(Some(value))
}

pub(super) fn desired(
    connection: &Provider,
    secret: Option<&str>,
    id: &str,
    before: Option<&Projection>,
) -> AppResult<Projection> {
    if !matches!(
        connection.provider_kind,
        ProviderKind::Openai | ProviderKind::Local | ProviderKind::Custom
    ) || connection.protocol == ApiProtocol::Messages
    {
        return Err(AppError::Unsupported("This reviewed Copilot App SQLite contract supports OpenAI-compatible Chat Completions and Responses providers".into()));
    }
    crate::validation::validate_connection(connection)?;
    crate::validation::validate_api_key(secret)?;
    let mut headers = BTreeMap::new();
    for (name, value) in &connection.headers {
        if name.eq_ignore_ascii_case("authorization") {
            if value.trim() != "Bearer ${apiKey}" {
                return Err(AppError::Unsupported("Copilot App synchronization requires the reviewed Bearer Authorization credential route".into()));
            }
            continue;
        }
        if value.contains("${apiKey}") {
            return Err(AppError::Unsupported(
                "Provider-key placeholders are supported only in the reviewed Authorization header"
                    .into(),
            ));
        }
        headers.insert(name.clone(), value.clone());
    }
    if let Some(key) = secret {
        if !key.is_empty() {
            headers.insert("Authorization".into(), format!("Bearer {key}"));
        }
    }
    let api = match connection.protocol {
        ApiProtocol::ChatCompletions => "completions",
        ApiProtocol::Responses => "responses",
        ApiProtocol::Messages => unreachable!(),
    };
    let settings=serde_json::json!({"authKind":"none","baseUrl":connection.base_url,"headersJson":serde_json::to_string(&headers).map_err(|_|invalid())?,"wireApi":api}).to_string();
    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true);
    let mut provider = ProviderRow {
        id: id.into(),
        name: connection.name.clone(),
        kind: "openai".into(),
        settings,
        created: before.map_or_else(|| now.clone(), |b| b.provider.created.clone()),
        updated: now.clone(),
    };
    if let Some(old) = before {
        if old.provider.name == provider.name
            && old.provider.kind == provider.kind
            && old.provider.settings == provider.settings
        {
            provider.updated = old.provider.updated.clone();
        }
    }
    let mut models = Vec::new();
    for model in connection.models.iter().filter(|m| m.enabled) {
        let id = model_id(id, &model.model_id)?;
        let old = before.and_then(|p| p.models.iter().find(|r| r.id == id));
        let mut row = ModelRow {
            id,
            provider: provider.id.clone(),
            model: model.model_id.clone(),
            wire: Some(model.model_id.clone()),
            name: model.name.clone(),
            prompt: model.capabilities.context_window.map(|v| v as i64),
            output: model.capabilities.max_output_tokens.map(|v| v as i64),
            api: None,
            created: old.map_or_else(|| now.clone(), |v| v.created.clone()),
            updated: now.clone(),
            efforts: None,
        };
        if let Some(old) = old {
            let mut comparison = row.clone();
            comparison.updated = old.updated.clone();
            if &comparison == old {
                row.updated = old.updated.clone();
            }
        }
        models.push(row);
    }
    models.sort_by(|a, b| a.id.cmp(&b.id));
    let value = Projection { provider, models };
    value.validate()?;
    Ok(value)
}

pub(super) fn removed(before: Option<&Projection>, after: Option<&Projection>) -> Vec<String> {
    before
        .into_iter()
        .flat_map(|p| &p.models)
        .filter(|old| !after.is_some_and(|p| p.models.iter().any(|row| row.id == old.id)))
        .map(|row| row.model.clone())
        .collect()
}

pub(super) fn check_collisions(db: &Connection, value: &Projection) -> AppResult<()> {
    for model in &value.models {
        let provider:Option<String>=db.query_row("SELECT CASE WHEN length(provider_id)<=160 THEN provider_id ELSE '' END FROM provider_models WHERE id=?1",[&model.id],|r|r.get(0)).optional().map_err(sql_error)?;
        let other:Option<String>=db.query_row("SELECT CASE WHEN length(id)<=80 THEN id ELSE '' END FROM provider_models WHERE provider_id=?1 AND model_id=?2",params![model.provider,model.model],|r|r.get(0)).optional().map_err(sql_error)?;
        if provider.as_ref().is_some_and(|id| id != &model.provider)
            || other.as_ref().is_some_and(|id| id != &model.id)
        {
            return Err(crate::deployment::ownership::conflict());
        }
    }
    Ok(())
}

pub(super) fn write(
    db: &Connection,
    id: &str,
    before: Option<&Projection>,
    after: Option<&Projection>,
) -> AppResult<()> {
    if let Some(value) = after {
        value.validate()?;
        if value.provider.id != id {
            return Err(invalid());
        }
    }
    for old in before.into_iter().flat_map(|p| &p.models) {
        if !after.is_some_and(|p| p.models.iter().any(|m| m.id == old.id)) {
            db.execute(
                "DELETE FROM provider_models WHERE id=?1 AND provider_id=?2",
                params![old.id, id],
            )
            .map_err(sql_error)?;
        }
    }
    match after {
        None => {
            if foreign_models(db, id)? != 0 {
                return Err(AppError::Config("Unmanaged models reference this provider; resolve them in Copilot App before revocation".into()));
            }
            db.execute("DELETE FROM model_providers WHERE id=?1", [id])
                .map_err(sql_error)?;
        }
        Some(value) => {
            let p = &value.provider;
            if before.is_some() {
                db.execute("UPDATE model_providers SET name=?2,type=?3,settings_json=?4,created_at=?5,updated_at=?6 WHERE id=?1 AND account_id IS NULL",params![p.id,p.name,p.kind,p.settings,p.created,p.updated]).map_err(sql_error)?;
            } else {
                db.execute("INSERT INTO model_providers(id,name,type,settings_json,account_id,created_at,updated_at) VALUES(?1,?2,?3,?4,NULL,?5,?6)",params![p.id,p.name,p.kind,p.settings,p.created,p.updated]).map_err(sql_error)?;
            }
            for model in &value.models {
                let old = before.and_then(|p| p.models.iter().find(|m| m.id == model.id));
                if old == Some(model) {
                    continue;
                }
                if old.is_some() {
                    db.execute("UPDATE provider_models SET model_id=?3,wire_model=?4,display_name=?5,max_prompt_tokens=?6,max_output_tokens=?7,wire_api_override=?8,created_at=?9,updated_at=?10,supported_reasoning_efforts=?11 WHERE id=?1 AND provider_id=?2",params![model.id,id,model.model,model.wire,model.name,model.prompt,model.output,model.api,model.created,model.updated,model.efforts]).map_err(sql_error)?;
                } else {
                    db.execute("INSERT INTO provider_models(id,provider_id,model_id,wire_model,display_name,max_prompt_tokens,max_output_tokens,wire_api_override,created_at,updated_at,supported_reasoning_efforts) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)",params![model.id,id,model.model,model.wire,model.name,model.prompt,model.output,model.api,model.created,model.updated,model.efforts]).map_err(sql_error)?;
                }
            }
        }
    }
    Ok(())
}
