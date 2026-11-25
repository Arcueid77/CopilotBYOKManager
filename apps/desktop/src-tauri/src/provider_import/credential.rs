//! Static provider credentials are compared locally and materialized only for an approved save.
//! This module accepts literals from the adapter's reviewed provider fields.
use serde::Serialize;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum KeyStatus {
    Available,
    Conflict,
}

#[derive(Clone, Default)]
pub(super) enum Credential {
    #[default]
    Absent,
    Key {
        fingerprint: String,
        material: Option<String>,
    },
    Conflict,
}

impl std::fmt::Debug for Credential {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.status().fmt(f)
    }
}

impl PartialEq for Credential {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (
                Self::Key {
                    fingerprint: left, ..
                },
                Self::Key {
                    fingerprint: right, ..
                },
            ) => left == right,
            _ => self.status() == other.status(),
        }
    }
}
impl Eq for Credential {}

impl Credential {
    pub fn observe(key: Option<&str>, collect: bool) -> Self {
        let Some(value) = key.and_then(literal) else {
            return Self::Absent;
        };
        Self::Key {
            fingerprint: crate::fingerprint::bytes(
                "provider-import-credential-v1",
                Some(value.as_bytes()),
            ),
            material: collect.then(|| value.to_owned()),
        }
    }

    pub fn merge(&mut self, incoming: Self) {
        if incoming.status().is_none() || *self == incoming {
            return;
        }
        *self = if self.status().is_none() {
            incoming
        } else {
            Self::Conflict
        };
    }

    pub fn status(&self) -> Option<KeyStatus> {
        match self {
            Self::Absent => None,
            Self::Key { .. } => Some(KeyStatus::Available),
            Self::Conflict => Some(KeyStatus::Conflict),
        }
    }

    pub fn material(&self) -> Option<&str> {
        match self {
            Self::Key { material, .. } => material.as_deref(),
            _ => None,
        }
    }
}

fn literal(value: &str) -> Option<&str> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > 64 * 1024
        || value
            .chars()
            .any(|ch| ch.is_whitespace() || ch.is_control())
        || value.starts_with(['$', '<', '%'])
        || value.contains("${")
    {
        return None;
    }
    let lower = value.to_ascii_lowercase();
    (!["ghp_", "gho_", "ghu_", "ghs_", "ghr_", "github_pat_"]
        .iter()
        .any(|prefix| lower.starts_with(prefix)))
    .then_some(value)
}

pub(crate) fn bearer_key(header: &str) -> Option<&str> {
    let (scheme, value) = header.trim().split_once(' ')?;
    scheme
        .eq_ignore_ascii_case("bearer")
        .then_some(value.trim())
}
