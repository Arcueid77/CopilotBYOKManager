//! Native-only scoped projections. Snapshots contain only this manager's owned rows.
mod rows;
mod schema;
mod security;
pub(crate) mod target;
#[cfg(all(test, windows))]
mod test_permissions;

use crate::{
    deployment::ownership::{self, TargetOwnership},
    domain::Connection as Provider,
    error::{AppError, AppResult},
};
use rusqlite::{limits::Limit, Connection, OpenFlags};
use serde::{Deserialize, Serialize};
use target::Target;
#[cfg(test)]
thread_local! {static FAIL_ACK:std::cell::Cell<bool>=const {std::cell::Cell::new(false)};}

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppResource {
    pub target: Target,
    pub provider_id: String,
    pub owner_id: String,
    pub connection_id: String,
    pub consent_revision: String,
    pub revoke: bool,
}

pub(crate) fn open_readonly(path: &std::path::Path) -> AppResult<Connection> {
    target::no_pending_wal(path)?;
    let mut uri = url::Url::from_file_path(path).map_err(|_| AppError::PlanChanged)?;
    uri.set_query(Some("mode=ro&immutable=1"));
    let db = Connection::open_with_flags(
        uri.as_str(),
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(schema::sql_error)?;
    configure(&db)?;
    Ok(db)
}
fn configure(db: &Connection) -> AppResult<()> {
    db.busy_timeout(std::time::Duration::from_millis(750))
        .map_err(schema::sql_error)?;
    db.set_limit(Limit::SQLITE_LIMIT_LENGTH, 1024 * 1024)
        .map_err(schema::sql_error)?;
    db.set_limit(Limit::SQLITE_LIMIT_SQL_LENGTH, 65536)
        .map_err(schema::sql_error)?;
    db.set_limit(Limit::SQLITE_LIMIT_ATTACHED, 0)
        .map_err(schema::sql_error)?;
    db.set_limit(Limit::SQLITE_LIMIT_VARIABLE_NUMBER, 32)
        .map_err(schema::sql_error)?;
    db.execute_batch("PRAGMA trusted_schema=OFF; PRAGMA foreign_keys=ON;")
        .map_err(schema::sql_error)?;
    Ok(())
}

impl AppResource {
    pub fn key(&self) -> String {
        let value = format!(
            "app-sqlite:{}:{}:{}:{}:{}:{}",
            self.target.database.display(),
            self.target.identity,
            self.target.schema,
            self.target.version,
            self.target.binary.display(),
            self.provider_id
        );
        #[cfg(windows)]
        {
            value.to_lowercase()
        }
        #[cfg(not(windows))]
        {
            value
        }
    }
    pub fn read(&self) -> AppResult<Option<Vec<u8>>> {
        if !rows::valid_provider_id(&self.provider_id)
            || self.provider_id != rows::provider_id(&self.owner_id, &self.connection_id)?
        {
            return Err(AppError::PlanChanged);
        }
        let _guard = self.target.verify()?;
        let db = open_readonly(&self.target.database)?;
        let (schema, _) = schema::inspect(&db)?;
        if schema != self.target.schema {
            return Err(AppError::PlanChanged);
        }
        rows::read(&db, &self.provider_id)?
            .map(|p| p.bytes())
            .transpose()
    }
    pub fn removed_models(
        &self,
        before: Option<&[u8]>,
        after: Option<&[u8]>,
    ) -> AppResult<Vec<String>> {
        let before = before.map(rows::Projection::decode).transpose()?;
        let after = after.map(rows::Projection::decode).transpose()?;
        Ok(rows::removed(before.as_ref(), after.as_ref()))
    }
    pub fn write(
        &self,
        expected: Option<&[u8]>,
        after: Option<&[u8]>,
        allow_removal: bool,
        authorize: impl Fn() -> AppResult<()>,
    ) -> AppResult<()> {
        if self.provider_id != rows::provider_id(&self.owner_id, &self.connection_id)? {
            return Err(AppError::PlanChanged);
        }
        let _guard = self.target.verify()?;
        let before = expected.map(rows::Projection::decode).transpose()?;
        let desired = after.map(rows::Projection::decode).transpose()?;
        if !allow_removal && !rows::removed(before.as_ref(), desired.as_ref()).is_empty() {
            return Err(AppError::Unsupported(
                "Review removed models after selecting another model in Copilot App".into(),
            ));
        }
        let mut db = Connection::open_with_flags(
            &self.target.database,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )
        .map_err(schema::sql_error)?;
        configure(&db)?;
        let transaction = db
            .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
            .map_err(schema::sql_error)?;
        let (schema, references) = schema::inspect(&transaction)?;
        if schema != self.target.schema {
            return Err(AppError::PlanChanged);
        }
        schema::guard_references(&transaction, &references)?;
        let current = rows::read(&transaction, &self.provider_id)?
            .map(|p| p.bytes())
            .transpose()?;
        if current.as_deref() != expected {
            return Err(AppError::PlanChanged);
        }
        authorize()?;
        rows::write(
            &transaction,
            &self.provider_id,
            before.as_ref(),
            desired.as_ref(),
        )?;
        let written = rows::read(&transaction, &self.provider_id)?
            .map(|p| p.bytes())
            .transpose()?;
        if written.as_deref() != after {
            return Err(AppError::Config(
                "Copilot App owned-row verification failed".into(),
            ));
        }
        target::ensure_closed(&self.target.binary)?;
        if security::path_identity(&self.target.database)? != self.target.identity {
            return Err(AppError::PlanChanged);
        }
        // Recheck sidecar ACLs and consent immediately before the transaction commits.
        let _final_guard = security::open_guard(&self.target.database)?;
        authorize()?;
        transaction.commit().map_err(|_| {
            AppError::Config("Copilot App commit outcome requires read-only reconciliation".into())
        })?;
        #[cfg(test)]
        if FAIL_ACK.with(|flag| flag.replace(false)) {
            return Err(AppError::Config(
                "Injected interruption after App commit".into(),
            ));
        }
        Ok(())
    }
}

pub fn resource(
    target: &Target,
    owner: &str,
    connection: &str,
    consent_revision: String,
    revoke: bool,
) -> AppResult<AppResource> {
    Ok(AppResource {
        target: target.clone(),
        provider_id: rows::provider_id(owner, connection)?,
        owner_id: owner.into(),
        connection_id: connection.into(),
        consent_revision,
        revoke,
    })
}

pub fn prepare(
    connection: &Provider,
    secret: Option<&str>,
    owner: &str,
    records: &[TargetOwnership],
    target: &Target,
    consent_revision: String,
    revoke: bool,
) -> AppResult<(crate::transaction::PreparedWrite, Option<String>)> {
    if !revoke && connection.has_secret && secret.is_none() {
        return Err(AppError::Secret(
            "The selected provider key is unavailable in the manager credential store".into(),
        ));
    }
    let app_resource = resource(target, owner, &connection.id, consent_revision, revoke)?;
    let physical = crate::transaction::Resource::AppSqlite(Box::new(app_resource.clone()));
    let resource_id = ownership::resource_id(&physical);
    let _guard = target.verify()?;
    let db = open_readonly(&target.database)?;
    if schema::inspect(&db)?.0 != target.schema {
        return Err(AppError::PlanChanged);
    }
    let has_row = rows::exists(&db, &app_resource.provider_id)?;
    let proof = records.iter().find(|r| {
        r.target_kind == crate::domain::ClientKind::GithubCopilotApp
            && r.target_id == crate::app_sync::TARGET_ID
            && r.owner_id == owner
            && r.connection_id == connection.id
            && r.resource_id == resource_id
    });
    if has_row && proof.is_none() {
        return Err(ownership::conflict());
    }
    if revoke && proof.is_none() {
        return Err(ownership::conflict());
    }
    let before = if has_row { app_resource.read()? } else { None };
    if let Some(proof) = proof {
        if !has_row && !revoke {
            return Err(ownership::conflict());
        }
        if has_row
            && crate::fingerprint::bytes("app-owned-rows-v1", before.as_deref())
                != proof.projection_fingerprint
        {
            return Err(ownership::conflict());
        }
    }
    let before_rows = before
        .as_deref()
        .map(rows::Projection::decode)
        .transpose()?;
    let after = if revoke {
        None
    } else {
        Some(
            rows::desired(
                connection,
                secret,
                &app_resource.provider_id,
                before_rows.as_ref(),
            )?
            .bytes()?,
        )
    };
    if let Some(bytes) = &after {
        rows::check_collisions(&db, &rows::Projection::decode(bytes)?)?;
    }
    let projection = after
        .as_deref()
        .map(|bytes| crate::fingerprint::bytes("app-owned-rows-v1", Some(bytes)));
    Ok((
        crate::transaction::PreparedWrite {
            resource: physical,
            before,
            after,
            restore_mode: None,
            write_mode: None,
        },
        projection,
    ))
}

pub fn observed_source(resource: &AppResource) -> AppResult<Option<(String, usize)>> {
    use rusqlite::OptionalExtension;
    let _guard = resource.target.verify()?;
    if resource.provider_id != rows::provider_id(&resource.owner_id, &resource.connection_id)? {
        return Err(AppError::PlanChanged);
    }
    let db = open_readonly(&resource.target.database)?;
    if schema::inspect(&db)?.0 != resource.target.schema {
        return Err(AppError::PlanChanged);
    }
    let name:Option<String>=db.query_row("SELECT CASE WHEN length(CAST(name AS BLOB))<=512 THEN name END FROM model_providers WHERE id=?1",[&resource.provider_id],|r|r.get(0)).optional().map_err(schema::sql_error)?;
    name.map(|name| {
        let count: i64 = db
            .query_row(
                "SELECT count(*) FROM provider_models WHERE provider_id=?1 AND substr(id,1,?2)=?3",
                rusqlite::params![
                    resource.provider_id,
                    resource.provider_id.len() as i64 + 3,
                    format!("{}-m-", resource.provider_id)
                ],
                |r| r.get(0),
            )
            .map_err(schema::sql_error)?;
        if count > 256 || name.chars().any(char::is_control) {
            return Err(AppError::Unsupported(
                "Unsupported App provider display metadata".into(),
            ));
        }
        Ok((name, count as usize))
    })
    .transpose()
}

pub fn validate_input(connection: &Provider) -> AppResult<()> {
    let mut candidate = connection.clone();
    candidate.has_secret = false;
    rows::desired(
        &candidate,
        None,
        &rows::provider_id("preview", &connection.id)?,
        None,
    )
    .map(|_| ())
}

pub fn check_owned(
    target: &Target,
    owner: &str,
    connection: &str,
    records: &[TargetOwnership],
) -> AppResult<()> {
    let resource = resource(target, owner, connection, "0".repeat(64), false)?;
    let id = ownership::resource_id(&crate::transaction::Resource::AppSqlite(Box::new(
        resource.clone(),
    )));
    let proof = records.iter().find(|r| {
        r.target_kind == crate::domain::ClientKind::GithubCopilotApp
            && r.target_id == crate::app_sync::TARGET_ID
            && r.owner_id == owner
            && r.connection_id == connection
            && r.resource_id == id
    });
    let bytes = resource.read()?;
    match (proof, bytes) {
        (None, None) => Ok(()),
        (Some(proof), Some(bytes))
            if proof.projection_fingerprint
                == crate::fingerprint::bytes("app-owned-rows-v1", Some(&bytes)) =>
        {
            Ok(())
        }
        _ => Err(ownership::conflict()),
    }
}

#[cfg(test)]
pub(crate) mod tests;
