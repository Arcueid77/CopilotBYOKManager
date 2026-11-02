use crate::{
    adapters::github_app::sqlite::target::Target,
    domain::Connection,
    error::{AppError, AppResult},
    fingerprint,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, BTreeSet},
    path::{Path, PathBuf},
};

pub const RISK_VERSION: u32 = 1;
pub const MAX_SELECTED: usize = 16;
const MAX_BYTES: u64 = 128 * 1024;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Consent {
    pub version: u32,
    pub enabled: bool,
    pub owner_id: String,
    pub target: Option<Target>,
    pub scopes: BTreeMap<String, String>,
    pub recovery_ids: BTreeSet<String>,
    pub risk_version: u32,
    pub granted_at: Option<DateTime<Utc>>,
    pub nonce: String,
}
impl Consent {
    pub fn disabled(owner: &str) -> Self {
        Self {
            version: 1,
            enabled: false,
            owner_id: owner.into(),
            target: None,
            scopes: BTreeMap::new(),
            recovery_ids: BTreeSet::new(),
            risk_version: RISK_VERSION,
            granted_at: None,
            nonce: String::new(),
        }
    }
    pub fn revision(&self) -> AppResult<String> {
        fingerprint::json("copilot-app-consent-v1", self)
    }
    pub fn validate(&self, owner: &str) -> AppResult<()> {
        if self.version != 1
            || self.risk_version != RISK_VERSION
            || owner.is_empty()
            || owner.len() > 160
            || self.owner_id != owner
            || self.scopes.len() > MAX_SELECTED
            || self.recovery_ids.len() > 512
            || self.nonce.len() > 64
            || self.granted_at.is_some_and(|v| v > Utc::now())
        {
            return Err(invalid());
        }
        if self.enabled
            && (self.target.is_none()
                || self.scopes.is_empty()
                || self.granted_at.is_none()
                || uuid::Uuid::parse_str(&self.nonce).is_err())
        {
            return Err(invalid());
        }
        for (id, hash) in &self.scopes {
            crate::validation::validate_connection_id(id)?;
            if hash.len() != 64
                || !hash.bytes().all(|b| b.is_ascii_hexdigit())
                || !self.recovery_ids.contains(id)
            {
                return Err(invalid());
            }
        }
        for id in &self.recovery_ids {
            crate::validation::validate_connection_id(id)?;
        }
        if let Some(target) = &self.target {
            if target.version != crate::adapters::github_app::sqlite::target::VERSION
                || target.schema.len() != 64
                || !target.schema.bytes().all(|b| b.is_ascii_hexdigit())
                || target.identity.is_empty()
                || target.identity.len() > 256
                || !target.database.is_absolute()
                || target.database.as_os_str().len() > 8192
                || target.binary.as_os_str().len() > 8192
            {
                return Err(invalid());
            }
        }
        Ok(())
    }
    pub fn approve(&self, connection: &Connection, target: &Target) -> AppResult<()> {
        if !self.enabled
            || self.target.as_ref() != Some(target)
            || self.scopes.get(&connection.id) != Some(&destination(connection)?)
        {
            return Err(AppError::Unsupported(
                "Review Copilot App sync consent for the selected provider and destination".into(),
            ));
        }
        Ok(())
    }
}
pub fn destination(connection: &Connection) -> AppResult<String> {
    fingerprint::json(
        "app-sync-destination-v1",
        &(
            &connection.provider_kind,
            &connection.protocol,
            &connection.base_url,
            &connection.headers,
            &connection.secret_ref,
            connection.has_secret,
        ),
    )
}
fn invalid() -> AppError {
    AppError::Unsupported("Copilot App sync consent is invalid or belongs to another installation; automatic writes are stopped".into())
}

pub struct Store {
    path: PathBuf,
    owner: String,
    bytes: Option<Vec<u8>>,
    value: Option<Consent>,
    error: Option<String>,
}
impl Store {
    pub fn open(state_path: &Path, owner: &str) -> Self {
        let path = state_path.with_file_name("app-sync.json");
        if !state_path.is_absolute() {
            return Self {
                path,
                owner: owner.into(),
                bytes: None,
                value: None,
                error: Some("App sync requires an available absolute state path".into()),
            };
        }
        match crate::safe_file::read_optional(&path, MAX_BYTES) {
            Ok(bytes) => {
                let value = bytes
                    .as_ref()
                    .map(|data| serde_json::from_slice::<Consent>(data).map_err(|_| invalid()))
                    .transpose()
                    .and_then(|v| {
                        let value = v.unwrap_or_else(|| Consent::disabled(owner));
                        value.validate(owner)?;
                        Ok(value)
                    });
                match value {
                    Ok(value) => Self {
                        path,
                        owner: owner.into(),
                        bytes,
                        value: Some(value),
                        error: None,
                    },
                    Err(e) => Self {
                        path,
                        owner: owner.into(),
                        bytes,
                        value: None,
                        error: Some(e.to_string()),
                    },
                }
            }
            Err(_) => Self {
                path,
                owner: owner.into(),
                bytes: None,
                value: None,
                error: Some(
                    "Cannot read Copilot App sync consent; the original file is retained".into(),
                ),
            },
        }
    }
    pub fn snapshot(&self) -> AppResult<Consent> {
        self.check_current()?;
        self.value.clone().ok_or_else(|| {
            AppError::Config(
                self.error
                    .clone()
                    .unwrap_or_else(|| "Copilot App consent unavailable".into()),
            )
        })
    }
    pub fn check_current(&self) -> AppResult<()> {
        if self.error.is_some() {
            return Err(invalid());
        }
        if crate::safe_file::read_optional(&self.path, MAX_BYTES)? != self.bytes {
            return Err(AppError::Config(
                "Copilot App sync consent changed externally; restart and review it before writing"
                    .into(),
            ));
        }
        Ok(())
    }
    pub fn save(&mut self, value: Consent) -> AppResult<()> {
        self.check_current()?;
        value.validate(&self.owner)?;
        let _lease =
            crate::safe_io::Lease::acquire(&self.path.with_file_name("app-sync-setting.lock"))?;
        let bytes = serde_json::to_vec(&value).map_err(|_| invalid())?;
        if bytes.len() as u64 > MAX_BYTES {
            return Err(invalid());
        }
        crate::safe_file::atomic_write_private_if(&self.path, &bytes, self.bytes.as_deref())?;
        self.bytes = Some(bytes);
        self.value = Some(value);
        Ok(())
    }
    pub fn disable(&mut self) -> AppResult<()> {
        let mut value = self.snapshot()?;
        value.enabled = false;
        value.nonce = uuid::Uuid::new_v4().to_string();
        self.save(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn missing_consent_is_disabled_and_unknown_or_external_records_are_preserved() {
        let root = tempfile::tempdir().unwrap();
        let state = root.path().join("state.json");
        let mut store = Store::open(&state, "owner");
        assert!(!store.snapshot().unwrap().enabled);
        assert!(!root.path().join("app-sync.json").exists());
        store.disable().unwrap();
        assert!(!Store::open(&state, "owner").snapshot().unwrap().enabled);
        let path = root.path().join("app-sync.json");
        crate::safe_file::atomic_write_private(&path, b"{\"version\":999}").unwrap();
        assert!(store.disable().is_err());
        assert!(Store::open(&state, "owner").snapshot().is_err());
        assert_eq!(std::fs::read(path).unwrap(), b"{\"version\":999}");
    }
}
