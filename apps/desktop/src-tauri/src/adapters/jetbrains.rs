//! Public plugin discovery and versioned dedicated BYOK projection; never IDE auth.
pub mod byok;
mod descriptor;
#[cfg(test)]
mod tests;

use crate::domain::{ClientKind, ClientStatus, ClientTarget, Connection, DeploymentOperation};
use crate::error::{AppError, AppResult};
use crate::{fingerprint, safe_file, safe_io};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub const PLUGIN_ID: &str = "com.github.copilot";
pub const MANUAL_PROVIDER: &str = "This plugin version or endpoint is not supported by the automatic BYOK adapter. Update to a reviewed plugin version or use Copilot Chat > Manage Models. CopilotBYOKManager never reads client authentication or Password Safe.";
pub const SIGN_IN: &str = "In each listed JetBrains IDE, use Tools > GitHub Copilot > Login to GitHub and complete the official browser flow. Check the selected account in each IDE.";
const MAX_ENTRIES: usize = 128;
const MAX_PROFILES: usize = 32;
const MAX_JAR_BYTES: u64 = 64 * 1024 * 1024;
const MAX_SCAN_BYTES: u64 = 128 * 1024 * 1024;
const PRODUCTS: &[(&str, &str)] = &[
    ("IntelliJIdea", "IntelliJ IDEA"),
    ("IdeaIC", "IntelliJ IDEA Community"),
    ("PyCharmCE", "PyCharm Community"),
    ("PyCharm", "PyCharm"),
    ("WebStorm", "WebStorm"),
    ("GoLand", "GoLand"),
    ("CLion", "CLion"),
    ("Rider", "Rider"),
    ("PhpStorm", "PhpStorm"),
    ("RubyMine", "RubyMine"),
    ("DataGrip", "DataGrip"),
    ("RustRover", "RustRover"),
];

struct Observation {
    target: ClientTarget,
    digest: String,
}

fn roots() -> AppResult<(PathBuf, PathBuf)> {
    let config = crate::platform::config_dir()
        .ok_or_else(|| invalid("JetBrains configuration root is unavailable"))?
        .join("JetBrains");
    #[cfg(target_os = "linux")]
    let plugins = {
        #[cfg(feature = "local-e2e")]
        if crate::test_support::active() {
            return Ok((config.clone(), config));
        }
        dirs::data_dir()
            .ok_or_else(|| invalid("JetBrains plugin root is unavailable"))?
            .join("JetBrains")
    };
    #[cfg(not(target_os = "linux"))]
    let plugins = config.clone();
    Ok((config, plugins))
}

/// A read-only runbook, not an apply plan. No secret-store access, pending-plan
/// slot, executable path, or write capability is needed to view it.
#[tauri::command(rename_all = "camelCase")]
pub async fn get_jetbrains_setup_guide(
    state: tauri::State<'_, crate::commands::ManagedState>,
    connection_id: String,
    target_id: String,
) -> Result<DeploymentOperation, String> {
    if connection_id.len() > 512 || target_id.len() > 512 {
        return Err("Guide selection exceeds its bounds".into());
    }
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let connection = state
            .store()
            .and_then(|s| s.connection(&connection_id))
            .map_err(|e| crate::redact::redact_text(&e.to_string()))?;
        let target = discover_targets()
            .into_iter()
            .find(|t| t.id == target_id)
            .ok_or_else(|| "JetBrains profile changed; rescan before reviewing".to_string())?;
        Ok(preview(&connection, &target))
    })
    .await
    .map_err(|_| "JetBrains guide lookup failed".to_string())?
}

pub fn discover_targets() -> Vec<ClientTarget> {
    observe().into_iter().map(|o| o.target).collect()
}

fn observe() -> Vec<Observation> {
    match roots().and_then(|(config, plugins)| discover_at(&config, &plugins)) {
        Ok(found) if !found.is_empty() => found,
        Ok(_) => vec![placeholder(ClientStatus::NotInstalled,
            "No standard JetBrains Copilot plugin profile detected. Custom/portable IDE paths require manual setup.")],
        Err(_) => vec![placeholder(ClientStatus::Error,
            "JetBrains metadata scan was inaccessible, unsafe, or exceeded its bounds. No IDE settings were read or changed.")],
    }
}

fn placeholder(status: ClientStatus, detail: &str) -> Observation {
    Observation {
        target: ClientTarget {
            id: "jetbrains:local".into(),
            kind: ClientKind::JetBrainsCopilot,
            name: "JetBrains GitHub Copilot".into(),
            detail: detail.into(),
            path: None,
            detected: false,
            supports_write: false,
            status,
            diagnostic: None,
        },
        digest: detail.into(),
    }
}

// Only known standard product/version directories are considered. Neither
// arbitrary filesystem recursion nor options/authentication databases are used.
fn discover_at(config: &Path, plugins: &Path) -> AppResult<Vec<Observation>> {
    let mut profiles = Vec::new();
    for name in children(config, MAX_ENTRIES)? {
        if let Some((product, version)) = product_version(&name) {
            profiles.push((name.clone(), format!("{product} {version}")));
        }
    }
    if profiles.len() > MAX_PROFILES {
        return Err(invalid("Too many JetBrains profiles"));
    }
    profiles.sort();
    let mut budget = MAX_SCAN_BYTES;
    let mut result = Vec::new();
    for (name, label) in profiles {
        let path = config.join(&name);
        let plugin_path = if config == plugins {
            path.join("plugins")
        } else {
            plugins.join(&name)
        };
        let id = format!(
            "jetbrains:{}",
            digest_bytes(path.to_string_lossy().as_bytes())
        );
        let mut target = ClientTarget {
            id, kind: ClientKind::JetBrainsCopilot, name: format!("{label} · Copilot"),
            detail: "Standard IDE profile found; GitHub Copilot plugin is missing. Install it from Settings > Plugins > Marketplace, then restart if requested.".into(),
            path: Some(path.to_string_lossy().into_owned()), detected: false,
            supports_write: false, status: ClientStatus::NotInstalled, diagnostic: None,
        };
        let digest = match inspect_profile(&path, &plugin_path, &mut budget) {
            Ok(Some((version, disabled, digest))) => {
                target.detected = !disabled;
                target.supports_write = !disabled && byok::supported_version(&version);
                target.status = if target.supports_write {
                    ClientStatus::Available
                } else {
                    ClientStatus::ReadOnly
                };
                target.detail = if disabled {
                    format!("GitHub Copilot {version} is installed but disabled in this profile. Enable it in Settings > Plugins; restart if requested.")
                } else {
                    format!("GitHub Copilot {version} metadata found. {} IDE installation, running state and account are not verified.", if target.supports_write { "Automatic shared BYOK configuration is available; restart IDEs after deployment to refresh model pickers." } else { "Automatic writes are disabled for this unreviewed schema/version." })
                };
                target.diagnostic = Some("Standard paths may be stale. Custom idea.config.path / idea.plugins.path and portable installs are not scanned. Descriptor identity is not a binary signature verification. BYOK is shared by IDEs using the same runtime configuration root; it is not per-profile login state.".into());
                digest
            }
            Ok(None) => "plugin-missing".into(),
            Err(_) => {
                target.status = ClientStatus::Error;
                target.detail = "Plugin metadata is unsafe, inaccessible, malformed, ambiguous, or outside the supported schema/bounds. Review the plugin in this IDE; no configuration was changed.".into();
                "metadata-error".into()
            }
        };
        result.push(Observation { target, digest });
    }
    Ok(result)
}

fn inspect_profile(
    config: &Path,
    plugins: &Path,
    budget: &mut u64,
) -> AppResult<Option<(String, bool, String)>> {
    let disabled_path = config.join("disabled_plugins.txt");
    let disabled_bytes = read_public(&disabled_path, 64 * 1024)?.unwrap_or_default();
    let disabled_text = std::str::from_utf8(&disabled_bytes)
        .map_err(|_| invalid("Unsupported disabled-plugin list"))?;
    let disabled = disabled_text
        .lines()
        .any(|line| line.trim().trim_start_matches('\u{feff}') == PLUGIN_ID);
    let mut descriptors = Vec::new();
    for name in children(plugins, MAX_ENTRIES)? {
        if !name.to_ascii_lowercase().contains("copilot") {
            continue;
        }
        let plugin = plugins.join(name);
        let loose = plugin.join("META-INF/plugin.xml");
        if let Some(bytes) = read_public(&loose, descriptor::MAX_XML_BYTES)? {
            if let Some(version) = descriptor::parse(&bytes)? {
                descriptors.push((version, digest_bytes(&bytes)));
            }
        }
        // Current official distributions include more than 32 dependency JARs.
        // The descriptor is in the public plugin JAR, not every dependency. Bound
        // directory entries, but do not read/hash dozens of unrelated libraries.
        for jar in children(&plugin.join("lib"), 128)? {
            if !jar.ends_with(".jar")
                || !(jar.starts_with("github-copilot-intellij-")
                    || jar == "github-copilot-intellij.jar"
                    || jar == "copilot.jar")
            {
                continue;
            }
            let path = plugin.join("lib").join(jar);
            safe_file::ensure_regular_or_missing(&path)?;
            let size = fs::symlink_metadata(&path)
                .map_err(|e| AppError::io(&path, e))?
                .len();
            if size > MAX_JAR_BYTES || size > *budget {
                return Err(invalid("Plugin scan byte budget exceeded"));
            }
            let bytes = read_public(&path, size)?
                .ok_or_else(|| invalid("Plugin disappeared during discovery"))?;
            *budget -= bytes.len() as u64;
            if let Some(xml) = descriptor::from_jar(&bytes)? {
                if let Some(version) = descriptor::parse(&xml)? {
                    descriptors.push((version, digest_bytes(&xml)));
                }
            }
        }
    }
    if descriptors.len() > 1 {
        return Err(invalid("Multiple Copilot plugin descriptors found"));
    }
    Ok(descriptors.pop().map(|(version, digest)| {
        (
            version,
            disabled,
            digest_bytes(
                format!(
                    "jetbrains-plugin-v1:{digest}:{}",
                    digest_bytes(&disabled_bytes)
                )
                .as_bytes(),
            ),
        )
    }))
}

fn children(path: &Path, limit: usize) -> AppResult<Vec<String>> {
    // Checking a nonexistent sentinel checks every directory ancestor without
    // following junctions or treating an existing directory as a regular file.
    safe_file::ensure_regular_or_missing(&path.join(".copilot-byok-manager-discovery-sentinel"))?;
    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(AppError::io(path, e)),
    };
    let mut names = Vec::new();
    for entry in entries.take(limit + 1) {
        let entry = entry.map_err(|e| AppError::io(path, e))?;
        let name = entry
            .file_name()
            .into_string()
            .map_err(|_| invalid("Unsupported plugin filename"))?;
        if name.len() > 256 {
            return Err(invalid("Plugin filename too long"));
        }
        names.push(name);
    }
    if names.len() > limit {
        return Err(invalid("Plugin discovery entry limit exceeded"));
    }
    names.sort();
    Ok(names)
}

fn product_version(name: &str) -> Option<(&'static str, &str)> {
    PRODUCTS.iter().find_map(|(prefix, product)| {
        let version = name.strip_prefix(prefix)?;
        (version.len() >= 6
            && version.len() <= 24
            && version.contains('.')
            && version.bytes().all(|b| b.is_ascii_digit() || b == b'.'))
        .then_some((*product, version))
    })
}

pub fn target_fingerprint(target: &ClientTarget) -> AppResult<String> {
    current_observations()?
        .into_iter()
        .find(|o| o.target.id == target.id)
        .map(|o| fingerprint::json("jetbrains-observation-v1", &(o.target, o.digest)))
        .ok_or_else(|| invalid("JetBrains profile changed; preview again"))?
}

fn current_observations() -> AppResult<Vec<Observation>> {
    #[cfg(test)]
    if let Some(roots) = TEST_ROOTS.with(|value| value.borrow().clone()) {
        return discover_at(&roots.0, &roots.1);
    }
    Ok(observe())
}

pub fn ensure_writable(target: &ClientTarget) -> AppResult<()> {
    let observation = current_observations()?
        .into_iter()
        .find(|o| o.target.id == target.id)
        .ok_or(AppError::PlanChanged)?;
    if !observation.target.supports_write {
        return Err(AppError::Unsupported(MANUAL_PROVIDER.into()));
    }
    if fingerprint::json("jetbrains-target-v1", &observation.target)?
        != fingerprint::json("jetbrains-target-v1", target)?
    {
        return Err(AppError::PlanChanged);
    }
    Ok(())
}

pub fn preview(connection: &Connection, target: &ClientTarget) -> DeploymentOperation {
    let mut changes = vec![
        format!("IDE/profile: {}", target.name),
        format!("Connection: {}", connection.name),
        format!("Endpoint: {}", connection.base_url),
        format!(
            "Protocol: {} (check the provider's compatibility in this IDE)",
            connection.protocol.as_str()
        ),
    ];
    changes.extend(
        connection
            .models
            .iter()
            .filter(|m| m.enabled)
            .map(|m| format!("Enable model: {}", m.model_id)),
    );
    let compatibility = byok::compatibility(connection);
    let supported = target.detected && target.supports_write && compatibility.is_ok();
    if supported {
        if let Ok(endpoint) = byok::effective_endpoint(connection) {
            changes.push(format!("Effective inference endpoint: {endpoint}"));
        }
        changes.extend([
            "Write the dedicated shared runtime byok.json: provider, protocol, enabled models, capabilities and request headers".into(),
            "Materialize only this Connection's own provider key in the native BYOK file; never return it to the frontend or copy GitHub login credentials".into(),
            "Preserve every unmanaged provider; deduplicate the shared physical write across IDE profiles".into(),
            "Restart IDEs after applying to refresh cached model pickers; choose an enabled model in Copilot Chat".into(),
        ]);
    } else {
        changes
            .push("No automatic write is planned for this incompatible target/Connection".into());
    }
    DeploymentOperation {
        id: Uuid::new_v4().to_string(),
        target_id: target.id.clone(),
        target_kind: ClientKind::JetBrainsCopilot,
        title: format!("Configure {} in {}", connection.name, target.name),
        description: if supported {
            "Automatically deploy the selected BYOK catalog using the reviewed JetBrains 1.19 storage schema. This changes models/providers, not GitHub authentication or the currently open Chat's selected model.".into()
        } else if target.detected {
            compatibility
                .err()
                .map(|e| e.to_string())
                .unwrap_or_else(|| MANUAL_PROVIDER.into())
        } else {
            target.detail.clone()
        },
        changes,
        supported,
        requires_restart: supported,
    }
}

pub fn preview_revocation(connection: &Connection, target: &ClientTarget) -> DeploymentOperation {
    let mut operation = preview(connection, target);
    operation.supported = target.detected && target.supports_write;
    operation.requires_restart = operation.supported;
    operation.title = format!("Revoke owned BYOK configuration in {}", target.name);
    operation.description = "Remove only configuration with a matching durable owner/Connection/projection proof. Current endpoint compatibility and provider key are not required for removal.".into();
    operation.changes = vec!["Recheck the reviewed plugin schema and dedicated BYOK file; preserve all unmanaged providers".into()];
    operation
}

fn invalid(message: &str) -> AppError {
    AppError::InvalidInput(message.into())
}
fn read_public(path: &Path, limit: u64) -> AppResult<Option<Vec<u8>>> {
    safe_file::ensure_regular_or_missing(path)?;
    let bytes = safe_io::read_optional(path, limit)?;
    safe_file::ensure_regular_or_missing(path)?;
    Ok(bytes)
}
fn digest_bytes(bytes: &[u8]) -> String {
    fingerprint::bytes("jetbrains-public-metadata-v1", Some(bytes))
}

#[cfg(test)]
thread_local! { static TEST_ROOTS: std::cell::RefCell<Option<(PathBuf, PathBuf)>> = const { std::cell::RefCell::new(None) }; }
#[cfg(test)]
fn with_test_roots<T>(root: &Path, f: impl FnOnce() -> T) -> T {
    struct Restore(Option<(PathBuf, PathBuf)>);
    impl Drop for Restore {
        fn drop(&mut self) {
            TEST_ROOTS.with(|value| *value.borrow_mut() = self.0.take());
        }
    }
    let _restore =
        Restore(TEST_ROOTS.with(|value| value.replace(Some((root.into(), root.into())))));
    f()
}
