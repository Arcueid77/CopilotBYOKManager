//! Public installation metadata for the JSON formats the manager writes.
use super::version::release_number;
use crate::domain::{ClientKind, ClientStatus, ClientTarget};
use crate::safe_file;
use serde::Deserialize;
use std::{ffi::OsStr, path::Path};

fn available(target: &mut ClientTarget, observed: Option<String>, floor: [u32; 3], required: &str) {
    let supported = observed
        .as_deref()
        .and_then(release_number)
        .is_some_and(|v| v >= floor);
    if let Some(version) = observed {
        target.detail.push_str(&format!(" · {version}"));
    }
    if !supported {
        target.supports_write = false;
        target.status = ClientStatus::ReadOnly;
        target.diagnostic = Some(format!(
            "Automatic publication requires {required}. Check the installed client version."
        ));
    }
}

#[derive(Deserialize)]
struct Package {
    name: String,
    version: String,
}

fn cli_metadata(path: &Path) -> Option<String> {
    #[cfg(windows)]
    if path
        .extension()
        .is_some_and(|v| v.eq_ignore_ascii_case("exe"))
    {
        if let Ok(product) = crate::installer::identity::product(path) {
            if product.product == "GitHub Copilot CLI" {
                return Some(product.version);
            }
        }
    }
    let parent = path.parent()?;
    let mut manifests = vec![
        parent.join("package.json"),
        parent.join("node_modules/@github/copilot/package.json"),
    ];
    if parent.file_name() == Some(OsStr::new(".bin")) {
        if let Some(modules) = parent.parent() {
            manifests.push(modules.join("@github/copilot/package.json"));
        }
    }
    for file in manifests {
        let Ok(Some(bytes)) = safe_file::read_optional(&file, 128 * 1024) else {
            continue;
        };
        if let Ok(package) = serde_json::from_slice::<Package>(&bytes) {
            if package.name == "@github/copilot"
                || matches!(
                    package.name.as_str(),
                    "@github/copilot-win32-x64"
                        | "@github/copilot-win32-arm64"
                        | "@github/copilot-darwin-arm64"
                        | "@github/copilot-darwin-x64"
                        | "@github/copilot-linux-x64"
                        | "@github/copilot-linux-arm64"
                )
            {
                return Some(package.version);
            }
        }
    }
    None
}

fn cli_probe(path: &Path) -> Option<String> {
    // The native path came from discovery. Never run a Windows command wrapper.
    if cfg!(windows)
        && !path
            .extension()
            .is_some_and(|v| v.eq_ignore_ascii_case("exe"))
    {
        return None;
    }
    let output = crate::native_process::run_capture_bounded(
        path,
        &[OsStr::new("--no-auto-update"), OsStr::new("--version")],
        std::time::Duration::from_secs(8),
        8192,
    )
    .ok()?;
    if !output.status.success() || output.stdout_truncated || output.stderr_truncated {
        return None;
    }
    crate::installer::parse_cli_version(&output.stdout).ok()
}

#[cfg(windows)]
fn editor_version(insiders: bool) -> Option<String> {
    let exe = super::vscode_install::find_edition(Some(insiders))?;
    if let Ok(cli) = super::vscode_install::VsCodeCli::resolve(&exe) {
        return Some(cli.version);
    }
    let product = crate::installer::identity::product(&exe).ok()?;
    let expected = if insiders {
        "Visual Studio Code - Insiders"
    } else {
        "Visual Studio Code"
    };
    (product.product == expected).then_some(product.version)
}

#[cfg(not(windows))]
fn editor_version(insiders: bool) -> Option<String> {
    use std::path::PathBuf;
    #[cfg(feature = "local-e2e")]
    if crate::test_support::active() {
        return crate::test_support::executable("code").map(|_| "1.137.0".into());
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Product {
        application_name: String,
        version: Option<String>,
    }
    let name = if insiders { "code-insiders" } else { "code" };
    let mut roots = Vec::new();
    #[cfg(target_os = "macos")]
    {
        let bundle = if insiders {
            "Visual Studio Code - Insiders.app"
        } else {
            "Visual Studio Code.app"
        };
        roots.push(
            PathBuf::from("/Applications")
                .join(bundle)
                .join("Contents/Resources/app"),
        );
        if let Some(home) = crate::platform::home_dir() {
            roots.push(
                home.join("Applications")
                    .join(bundle)
                    .join("Contents/Resources/app"),
            );
        }
    }
    #[cfg(not(target_os = "macos"))]
    roots.push(PathBuf::from("/usr/share").join(name).join("resources/app"));
    if let Some(launcher) = crate::native_process::resolve_on_path(&[name]) {
        if let Some(top) = launcher.parent().and_then(Path::parent) {
            roots.extend([top.to_owned(), top.join("resources/app")]);
        }
    }
    roots.into_iter().find_map(|root| {
        let bytes =
            safe_file::read_optional(&root.join("product.json"), 2 * 1024 * 1024).ok()??;
        let product: Product = serde_json::from_slice(&bytes).ok()?;
        if product.application_name != name {
            return None;
        }
        product.version.or_else(|| {
            let bytes =
                safe_file::read_optional(&root.join("package.json"), 2 * 1024 * 1024).ok()??;
            serde_json::from_slice::<Package>(&bytes)
                .ok()
                .map(|p| p.version)
        })
    })
}

pub(crate) fn qualify(targets: &mut [ClientTarget], selected: &[String]) {
    let mut editors = std::collections::BTreeMap::new();
    for target in targets
        .iter_mut()
        .filter(|t| t.detected && t.supports_write)
    {
        match target.kind {
            ClientKind::VsCodeCopilot => {
                let insiders = target.id.starts_with("vscode:insiders:");
                let observed = editors
                    .entry(insiders)
                    .or_insert_with(|| editor_version(insiders));
                let version = observed
                    .as_deref()
                    .map(|v| v.strip_suffix("-insider").unwrap_or(v).to_owned());
                if insiders {
                    available(
                        target,
                        version,
                        [1, 121, 0],
                        "VS Code Insiders 1.121 or newer",
                    );
                } else {
                    available(target, version, [1, 122, 0], "VS Code 1.122 or newer");
                }
            }
            ClientKind::CopilotCli => {
                if let Err(error) = super::copilot_cli::check_publication_root() {
                    target.supports_write = false;
                    target.status = ClientStatus::ReadOnly;
                    target.diagnostic = Some(crate::redact::redact_text(&error.to_string()));
                    continue;
                }
                let Some(path) = target.path.as_deref().map(Path::new) else {
                    continue;
                };
                let mut version = cli_metadata(path);
                if version.is_none() {
                    if !selected.contains(&target.id) {
                        target
                            .detail
                            .push_str(" · version checked during publication review");
                        continue;
                    }
                    version = cli_probe(path);
                }
                available(
                    target,
                    version,
                    [1, 0, 83],
                    "Copilot CLI 1.0.83 or newer for providers.json",
                );
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn target() -> ClientTarget {
        ClientTarget {
            id: "test".into(),
            kind: ClientKind::CopilotCli,
            name: "Fixture".into(),
            detail: String::new(),
            path: None,
            detected: true,
            supports_write: true,
            status: ClientStatus::Available,
            diagnostic: None,
        }
    }
    #[test]
    fn the_published_registry_boundary_distinguishes_installed_from_writable() {
        for (version, writable) in [
            (Some("1.0.82"), false),
            (Some("1.0.83"), true),
            (Some("1.0.114"), true),
            (None, false),
        ] {
            let mut target = target();
            available(
                &mut target,
                version.map(str::to_owned),
                [1, 0, 83],
                "Copilot CLI 1.0.83 or newer",
            );
            assert!(target.detected);
            assert_eq!(target.supports_write, writable);
        }
    }
    #[test]
    fn npm_launcher_metadata_must_belong_to_the_official_package() {
        let temp = tempfile::tempdir().unwrap();
        let launcher = temp.path().join("copilot.cmd");
        let manifest = temp.path().join("package.json");
        std::fs::write(&manifest, r#"{"name":"unrelated","version":"9.0.0"}"#).unwrap();
        assert!(cli_metadata(&launcher).is_none());
        std::fs::write(manifest, r#"{"name":"@github/copilot","version":"1.0.83"}"#).unwrap();
        assert_eq!(cli_metadata(&launcher).as_deref(), Some("1.0.83"));
    }
}
