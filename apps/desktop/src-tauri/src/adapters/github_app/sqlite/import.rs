//! Read-only provider metadata for observation and extraction. Keep SELECT lists narrow:
//! Select only the reviewed static provider Authorization header alongside metadata.
//! Account-linked providers, session data and other headers stay outside the query.
use super::{open_readonly, schema, target::Target};
use crate::deployment::publication::ConfiguredSource;
use crate::domain::{ApiProtocol, ModelCapabilities, ProviderKind};
use crate::error::AppResult;
use crate::provider_import::{bearer_key, protocol, Catalog, ModelFields};
use std::collections::BTreeMap;

pub(crate) fn observed_catalog(
    target: &Target,
    owned: &BTreeMap<String, String>,
) -> AppResult<Vec<ConfiguredSource>> {
    let _guard = target.verify()?;
    let db = open_readonly(&target.database)?;
    let inspected = target.check_schema(&db)?;
    let account_scope = if inspected.format.has_account() {
        "p.account_id IS NULL"
    } else {
        "1"
    };
    let sql = format!(
        "SELECT p.id,p.name,m.id IS NOT NULL
        FROM model_providers p LEFT JOIN provider_models m ON m.provider_id=p.id
        WHERE {account_scope} AND p.type IN ('openai','custom','azure','anthropic')
        ORDER BY p.id,m.id LIMIT 2049"
    );
    let mut statement = db.prepare(&sql).map_err(schema::sql_error)?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, bool>(2)?,
            ))
        })
        .map_err(schema::sql_error)?;
    let mut providers = BTreeMap::new();
    for (index, row) in rows.enumerate() {
        let (id, name, has_model) = row.map_err(schema::sql_error)?;
        if index >= 2048 || id.len() > 512 {
            return Err(crate::provider_import::too_large());
        }
        let (_, count) = providers.entry(id).or_insert_with(|| {
            let display = if crate::provider_import::public_text(&name, 512) {
                name
            } else {
                String::new()
            };
            (display, 0usize)
        });
        *count += usize::from(has_model);
        if providers.len() > 256 {
            return Err(crate::provider_import::too_large());
        }
    }
    providers
        .into_iter()
        .map(|(id, (name, count))| {
            ConfiguredSource::new(&name, owned.get(&id).map(String::as_str), count)
        })
        .collect()
}

pub(crate) fn read(target: &Target, collect_keys: bool) -> AppResult<Catalog> {
    let _guard = target.verify()?;
    let db = open_readonly(&target.database)?;
    let inspected = target.check_schema(&db)?;
    let account_scope = if inspected.format.has_account() {
        "p.account_id IS NULL"
    } else {
        "1"
    };
    let vision = if inspected.format == schema::Format::VisionV2 {
        "m.supports_vision"
    } else {
        "NULL"
    };
    let mirrors = if inspected.format.has_legacy_columns() {
        "AND p.base_url=json_extract(p.settings_json,'$.baseUrl')
         AND p.wire_api=json_extract(p.settings_json,'$.wireApi')
         AND p.auth_kind='none' AND p.headers_json=json_extract(p.settings_json,'$.headersJson')"
    } else {
        ""
    };
    let sql = format!("SELECT p.name,p.type,
        CASE WHEN length(p.settings_json)<=65536 AND json_valid(p.settings_json) THEN json_extract(p.settings_json,'$.baseUrl') END,
        CASE WHEN length(p.settings_json)<=65536 AND json_valid(p.settings_json) THEN json_extract(p.settings_json,'$.wireApi') END,
        m.model_id,m.wire_model,m.display_name,m.max_prompt_tokens,m.max_output_tokens,m.wire_api_override,{vision},
        CASE WHEN p.type IN ('openai','custom','azure','anthropic') AND length(p.settings_json)<=65536 AND json_valid(p.settings_json) THEN
          CASE WHEN json_extract(p.settings_json,'$.authKind')='none' AND json_type(p.settings_json,'$.headersJson')='text' {mirrors} THEN
            (SELECT CASE WHEN count(*)=1 AND max(lower(key))='authorization' AND max(type)='text' THEN max(value) END
             FROM json_each(CASE WHEN json_valid(json_extract(p.settings_json,'$.headersJson'))
                               THEN json_extract(p.settings_json,'$.headersJson') ELSE '{{}}' END)
             WHERE lower(key) IN ('authorization','api-key','x-api-key'))
          END
        END
        FROM model_providers p LEFT JOIN provider_models m ON m.provider_id=p.id
        WHERE {account_scope} ORDER BY p.id,m.id LIMIT 2049");
    let mut statement = db.prepare(&sql).map_err(schema::sql_error)?;
    let mut rows = statement.query([]).map_err(schema::sql_error)?;
    let mut result = Catalog::for_scan(collect_keys);
    let mut count = 0;
    while let Some(row) = rows.next().map_err(schema::sql_error)? {
        count += 1;
        if count > 2048 {
            return Err(crate::provider_import::too_large());
        }
        let field = |n| {
            row.get_ref(n)
                .ok()
                .and_then(|v| v.as_str().ok())
                .unwrap_or_default()
        };
        let kind = field(1);
        let wire = match kind {
            "openai" | "custom" | "azure" => {
                let override_api = field(9);
                let api = if override_api.is_empty() {
                    field(3)
                } else {
                    override_api
                };
                protocol((!api.is_empty()).then_some(api))
            }
            "anthropic" => Some(ApiProtocol::Messages),
            _ => None,
        };
        let model = if field(5).is_empty() {
            field(4)
        } else {
            field(5)
        };
        result.add(
            ModelFields {
                provider: field(0),
                endpoint: field(2),
                protocol: wire,
                kind: (kind == "azure").then_some(ProviderKind::Azure),
                id: model,
                name: field(6),
                api_key: bearer_key(field(11)),
                caps: ModelCapabilities {
                    context_window: row
                        .get::<_, i64>(7)
                        .ok()
                        .and_then(|n| u64::try_from(n).ok()),
                    max_output_tokens: row
                        .get::<_, i64>(8)
                        .ok()
                        .and_then(|n| u64::try_from(n).ok()),
                    vision: row.get::<_, i64>(10).ok().and_then(|v| match v {
                        0 => Some(false),
                        1 => Some(true),
                        _ => None,
                    }),
                    ..Default::default()
                },
            },
            |_| false,
        )?;
    }
    Ok(result)
}
