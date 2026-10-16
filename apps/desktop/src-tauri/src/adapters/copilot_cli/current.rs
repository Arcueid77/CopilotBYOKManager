//! Read configured public routing metadata, without executing a shell or
//! returning keys, headers, endpoint values, or historical publication data.
use super::*;
use crate::deployment::publication::ConfiguredSource;

const FIELDS: &[&str] = &[
    "COPILOT_PROVIDER_TYPE",
    "COPILOT_PROVIDER_BASE_URL",
    "COPILOT_PROVIDER_WIRE_API",
    "COPILOT_MODEL",
    "COPILOT_PROVIDER_MODEL_ID",
    "COPILOT_PROVIDER_WIRE_MODEL",
];

fn unknown() -> AppError {
    AppError::Config("Cannot read current CLI provider configuration".into())
}

pub(super) fn observe(connections: &[Connection]) -> AppResult<Vec<ConfiguredSource>> {
    provider_registry::ensure_environment_is_effective()?;
    from_values(&values()?, connections)
}

fn from_values(
    values: &BTreeMap<String, String>,
    connections: &[Connection],
) -> AppResult<Vec<ConfiguredSource>> {
    let Some(kind) = values
        .get("COPILOT_PROVIDER_TYPE")
        .filter(|v| !v.is_empty())
    else {
        return Ok(Vec::new());
    };
    let label = match kind.as_str() {
        "openai" => "OpenAI-compatible",
        "anthropic" => "Anthropic",
        "azure" => "Azure",
        _ => return Err(unknown()),
    };
    let model = values
        .get("COPILOT_PROVIDER_MODEL_ID")
        .filter(|v| !v.is_empty())
        .ok_or_else(unknown)?;
    if model.len() > 512 {
        return Err(unknown());
    }
    let matches = connections
        .iter()
        .filter(|connection| {
            super::desired_environment(connection, None).is_ok_and(|desired| {
                FIELDS.iter().all(|field| {
                    desired.get(*field).and_then(Option::as_deref).unwrap_or("")
                        == values.get(*field).map(String::as_str).unwrap_or("")
                })
            })
        })
        .collect::<Vec<_>>();
    let (name, id) = if matches.len() == 1 {
        (matches[0].name.as_str(), Some(matches[0].id.as_str()))
    } else {
        (label, None)
    };
    Ok(vec![ConfiguredSource::new(name, id, 1)?])
}

#[cfg(windows)]
fn values() -> AppResult<BTreeMap<String, String>> {
    let snapshot = super::env_snapshot::native_snapshot()?;
    FIELDS
        .iter()
        .filter_map(|field| {
            snapshot
                .get(*field)
                .and_then(Option::as_ref)
                .map(|raw| (field, raw))
        })
        .map(|(field, raw)| Ok(((*field).to_owned(), decode(raw.value_type, &raw.bytes)?)))
        .collect()
}

#[cfg(any(windows, test))]
pub(super) fn decode(kind: u32, bytes: &[u8]) -> AppResult<String> {
    if kind != 1 || bytes.len() > 4096 || !bytes.len().is_multiple_of(2) {
        return Err(unknown());
    }
    let mut units = bytes
        .chunks_exact(2)
        .map(|b| u16::from_le_bytes([b[0], b[1]]))
        .collect::<Vec<_>>();
    if units.last() == Some(&0) {
        units.pop();
    }
    let value = String::from_utf16(&units).map_err(|_| unknown())?;
    if value.chars().any(char::is_control) {
        return Err(unknown());
    }
    Ok(value)
}

#[cfg(unix)]
fn values() -> AppResult<BTreeMap<String, String>> {
    let home = crate::platform::home_dir().ok_or_else(unknown)?;
    let bytes = crate::safe_io::read_optional(&super::unix_paths(&home)[0], 1024 * 1024)?;
    parse_shell(bytes.as_deref().unwrap_or_default())
}

#[cfg(any(unix, test))]
fn parse_shell(bytes: &[u8]) -> AppResult<BTreeMap<String, String>> {
    let text = std::str::from_utf8(bytes).map_err(|_| unknown())?;
    let mut values = BTreeMap::new();
    for line in text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
    {
        if let Some(name) = line.strip_prefix("unset ") {
            if !super::MANAGED_VARIABLES.contains(&name) {
                return Err(unknown());
            }
            values.remove(name);
            continue;
        }
        let (name, value) = line
            .strip_prefix("export ")
            .and_then(|v| v.split_once('='))
            .ok_or_else(unknown)?;
        if !super::MANAGED_VARIABLES.contains(&name) {
            return Err(unknown());
        }
        if FIELDS.contains(&name) {
            let quoted = value
                .strip_prefix('\'')
                .and_then(|v| v.strip_suffix('\''))
                .ok_or_else(unknown)?;
            if quoted.split("'\"'\"'").any(|v| v.contains('\'')) {
                return Err(unknown());
            }
            let value = quoted.replace("'\"'\"'", "'");
            if value.len() > 2048 || value.chars().any(char::is_control) {
                return Err(unknown());
            }
            values.insert(name.into(), value);
        }
    }
    Ok(values)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn current_values_follow_manual_changes_without_history_or_secret_output() {
        let connection = super::super::tests::connection();
        let mut values = desired_environment(&connection, Some("synthetic-secret"))
            .unwrap()
            .into_iter()
            .filter_map(|(k, v)| v.map(|v| (k, v)))
            .collect::<BTreeMap<_, _>>();
        let first = from_values(&values, std::slice::from_ref(&connection)).unwrap();
        assert_eq!(
            first[0].connection_id.as_deref(),
            Some(connection.id.as_str())
        );
        values.insert("COPILOT_PROVIDER_MODEL_ID".into(), "user-edited".into());
        let edited = from_values(&values, &[connection]).unwrap();
        assert_eq!(edited[0].model_count, 1);
        assert!(edited[0].connection_id.is_none());
        assert!(!serde_json::to_string(&edited)
            .unwrap()
            .contains("synthetic-secret"));
        values.remove("COPILOT_PROVIDER_TYPE");
        assert!(from_values(&values, &[]).unwrap().is_empty());
    }
    #[test]
    fn bounded_decoding_and_shell_observation_never_execute_or_guess() {
        assert!(decode(2, &[0, 0]).is_err());
        assert!(decode(1, &[1]).is_err());
        assert!(parse_shell(b"source /tmp/unknown").is_err());
        assert!(parse_shell(b"export COPILOT_MODEL=$(command)").is_err());
        let values = parse_shell(b"export COPILOT_PROVIDER_TYPE='openai'\nexport COPILOT_MODEL='model'\nunset COPILOT_MODEL\nexport COPILOT_PROVIDER_API_KEY='synthetic-secret'\n").unwrap();
        assert_eq!(values.len(), 1);
        assert_eq!(values["COPILOT_PROVIDER_TYPE"], "openai");
    }
}
