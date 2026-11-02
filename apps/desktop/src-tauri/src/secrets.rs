use crate::error::{AppError, AppResult};
use keyring::{Entry, Error as KeyringError};

const SERVICE: &str = "io.github.avalonero.copilotbyokmanager.connections";

#[cfg(test)]
thread_local! {static TEST_CREDENTIALS:std::cell::RefCell<Option<std::collections::BTreeMap<String,String>>>=const{std::cell::RefCell::new(None)};}

#[cfg(test)]
pub(crate) fn with_fake_credentials<T>(task: impl FnOnce() -> T) -> T {
    struct Reset(Option<std::collections::BTreeMap<String, String>>);
    impl Drop for Reset {
        fn drop(&mut self) {
            TEST_CREDENTIALS.with(|value| {
                value.replace(self.0.take());
            });
        }
    }
    let previous =
        TEST_CREDENTIALS.with(|value| value.replace(Some(std::collections::BTreeMap::new())));
    let _reset = Reset(previous);
    task()
}

fn entry(secret_ref: &str) -> AppResult<Entry> {
    Entry::new(SERVICE, secret_ref).map_err(|error| AppError::Secret(error.to_string()))
}

pub fn set(secret_ref: &str, value: &str) -> AppResult<()> {
    #[cfg(test)]
    if TEST_CREDENTIALS
        .with(|values| {
            values
                .borrow_mut()
                .as_mut()
                .map(|values| values.insert(secret_ref.into(), value.into()))
        })
        .is_some()
    {
        return Ok(());
    }
    #[cfg(feature = "local-e2e")]
    if crate::test_support::active() {
        return crate::test_support::credential(secret_ref, Some(Some(value))).map(|_| ());
    }

    if value.contains(['\r', '\n']) {
        return Err(AppError::InvalidInput(
            "API keys must not contain newlines".to_string(),
        ));
    }
    entry(secret_ref)?
        .set_password(value)
        .map_err(|error| AppError::Secret(error.to_string()))
}

pub fn get(secret_ref: &str) -> AppResult<Option<String>> {
    #[cfg(test)]
    if let Some(value) = TEST_CREDENTIALS.with(|values| {
        values
            .borrow()
            .as_ref()
            .map(|values| values.get(secret_ref).cloned())
    }) {
        return Ok(value);
    }
    #[cfg(feature = "local-e2e")]
    if crate::test_support::active() {
        return crate::test_support::credential(secret_ref, None);
    }

    match entry(secret_ref)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(AppError::Secret(error.to_string())),
    }
}

pub fn observe(connection_id: &str) -> crate::domain::CredentialObservation {
    use crate::domain::{CredentialObservation, CredentialState};
    let state = match get(&format!("connection:{connection_id}")) {
        Ok(Some(_)) => CredentialState::Stored,
        Ok(None) => CredentialState::Missing,
        Err(_) => CredentialState::Unavailable,
    };
    CredentialObservation { state }
}

pub fn delete(secret_ref: &str) -> AppResult<()> {
    #[cfg(test)]
    if TEST_CREDENTIALS
        .with(|values| {
            values
                .borrow_mut()
                .as_mut()
                .map(|values| values.remove(secret_ref))
        })
        .is_some()
    {
        return Ok(());
    }
    #[cfg(feature = "local-e2e")]
    if crate::test_support::active() {
        return crate::test_support::credential(secret_ref, Some(None)).map(|_| ());
    }

    match entry(secret_ref)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(AppError::Secret(error.to_string())),
    }
}
