use super::{catalog, Candidate, Catalog};
use crate::adapters::{copilot_cli, github_app, jetbrains, vscode};
use crate::domain::{ClientKind, ClientStatus, ClientTarget, Connection};
use crate::error::{AppCompatibilityIssue, AppError, AppResult};
use serde::Serialize;
use std::{
    collections::{BTreeMap, BTreeSet},
    path::PathBuf,
};

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum IssueKind {
    Unavailable,
    Unsupported,
    CloseApp,
    Permissions,
    Skipped,
    Limit,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Issue {
    pub kind: IssueKind,
    pub app: ClientKind,
    pub source_ids: Vec<String>,
}

#[derive(PartialEq, Eq, PartialOrd, Ord)]
enum Source {
    VsCode(PathBuf),
    JetBrains(PathBuf),
    Cli,
    App,
}
impl Source {
    fn read(&self, collect_keys: bool) -> AppResult<Catalog> {
        match self {
            Self::VsCode(path) => vscode::import_catalog(path, collect_keys),
            Self::JetBrains(path) => jetbrains::byok::import_catalog(path, collect_keys),
            Self::Cli => copilot_cli::import_catalog(collect_keys),
            Self::App => github_app::sqlite::import::read(
                &github_app::sqlite::target::review()?,
                collect_keys,
            ),
        }
    }
}

pub(super) struct Scanned {
    pub candidates: Vec<Candidate>,
    pub issues: Vec<Issue>,
}

pub(super) fn scan(
    ids: Option<&[String]>,
    existing: &[Connection],
    collect_keys: bool,
) -> AppResult<Scanned> {
    let mut candidates = catalog::Candidates::default();
    let issues = read_catalogs(ids, collect_keys, |catalog, source_ids| {
        candidates.include(catalog, source_ids)
    })?;
    Ok(Scanned {
        candidates: candidates.finish(existing),
        issues,
    })
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Availability {
    target_ids: BTreeSet<String>,
    batch: bool,
}

pub(super) fn availability(existing: &[Connection]) -> AppResult<Availability> {
    compare_sources(existing, |visit| read_catalogs(None, false, visit))
}

type CatalogVisitor<'a> = dyn FnMut(Catalog, &[String]) -> AppResult<()> + 'a;

pub(super) fn compare_sources(
    existing: &[Connection],
    read: impl FnOnce(&mut CatalogVisitor<'_>) -> AppResult<Vec<Issue>>,
) -> AppResult<Availability> {
    let mut result = Availability::default();
    let saved = catalog::SavedProviders::new(existing);
    let mut batch = Some(catalog::Candidates::default());
    read(&mut |catalog, source_ids| {
        if saved.has_savable_changes(&catalog) {
            result.target_ids.extend(source_ids.iter().cloned());
        }
        if let Some(candidates) = &mut batch {
            if candidates.include(catalog, source_ids).is_err() {
                batch = None;
            }
        }
        Ok(())
    })?;
    result.batch = batch.is_some_and(|candidates| candidates.has_selectable(&saved));
    Ok(result)
}

fn read_catalogs(
    ids: Option<&[String]>,
    collect_keys: bool,
    mut visit: impl FnMut(Catalog, &[String]) -> AppResult<()>,
) -> AppResult<Vec<Issue>> {
    let input = ids.unwrap_or_default();
    if ids.is_some()
        && (input.is_empty()
            || input.len() > 160
            || input
                .iter()
                .any(|id| id.is_empty() || id.len() > 512 || id.chars().any(char::is_control)))
    {
        return Err(AppError::InvalidInput(
            "Invalid import source selection".into(),
        ));
    }
    let requested: BTreeSet<_> = input.iter().cloned().collect();
    if requested.len() != input.len() {
        return Err(AppError::InvalidInput("Duplicate import sources".into()));
    }
    let all = ids.is_none();
    let family = |prefix: &str| all || requested.iter().any(|id| id.starts_with(prefix));
    let mut targets = Vec::new();
    let mut issues = Vec::new();
    if family("vscode:") {
        match vscode::discover_targets() {
            Ok(found) => targets.extend(found),
            Err(_) => issues.push(Issue {
                kind: IssueKind::Unavailable,
                app: ClientKind::VsCodeCopilot,
                source_ids: vec![],
            }),
        }
    }
    if family("jetbrains:") {
        targets.extend(jetbrains::discover_plugin_metadata());
    }
    if family("copilot-cli:") {
        targets.push(copilot_cli::discover_target());
    }
    if family("github-copilot-app:") {
        targets.push(github_app::discover_target());
    }
    if targets.len() > 160 {
        return Err(catalog::limit());
    }
    if !all
        && !requested
            .iter()
            .all(|id| targets.iter().any(|t| &t.id == id))
    {
        return Err(AppError::PlanChanged);
    }
    let mut sources = BTreeMap::<Source, (ClientKind, Vec<String>)>::new();
    for target in targets
        .into_iter()
        .filter(|t| all || requested.contains(&t.id))
    {
        if !target.detected {
            if !all || target.status == ClientStatus::Error {
                issues.push(Issue {
                    kind: IssueKind::Unavailable,
                    app: target.kind,
                    source_ids: vec![target.id],
                });
            }
            continue;
        }
        let source = source_for(&target);
        if let Some(source) = source {
            sources
                .entry(source)
                .or_insert_with(|| (target.kind, vec![]))
                .1
                .push(target.id);
        } else {
            issues.push(Issue {
                kind: IssueKind::Unsupported,
                app: target.kind,
                source_ids: vec![target.id],
            });
        }
    }
    let mut file_budget = 64 * 1024 * 1024u64;
    for (source, (app, mut source_ids)) in sources {
        source_ids.sort();
        if let Source::VsCode(path) | Source::JetBrains(path) = &source {
            if let Ok(stat) = std::fs::symlink_metadata(path) {
                if stat.len() > file_budget {
                    issues.push(Issue {
                        kind: IssueKind::Limit,
                        app,
                        source_ids,
                    });
                    continue;
                }
                file_budget -= stat.len();
            }
        }
        let kind = match source.read(collect_keys) {
            Ok(catalog) => {
                let skipped = catalog.skipped > 0;
                visit(catalog, &source_ids)?;
                skipped.then_some(IssueKind::Skipped)
            }
            Err(AppError::AppRunning | AppError::AppExitUnverified) => Some(IssueKind::CloseApp),
            Err(AppError::ProviderImportLimit) => Some(IssueKind::Limit),
            Err(AppError::UnsafeAppPermissions) => Some(IssueKind::Permissions),
            Err(
                AppError::Unsupported(_)
                | AppError::AppCompatibility(
                    AppCompatibilityIssue::Schema
                    | AppCompatibilityIssue::Platform
                    | AppCompatibilityIssue::Identity
                    | AppCompatibilityIssue::Version,
                ),
            ) => Some(IssueKind::Unsupported),
            Err(_) => Some(IssueKind::Unavailable),
        };
        if let Some(kind) = kind {
            issues.push(Issue {
                kind,
                app,
                source_ids,
            });
        }
    }
    Ok(issues)
}

fn source_for(target: &ClientTarget) -> Option<Source> {
    match target.kind {
        ClientKind::VsCodeCopilot => target
            .path
            .as_ref()
            .map(|p| Source::VsCode(PathBuf::from(p))),
        ClientKind::JetBrainsCopilot if target.supports_write => {
            jetbrains::byok::store_path().ok().map(Source::JetBrains)
        }
        ClientKind::JetBrainsCopilot => None,
        ClientKind::CopilotCli => Some(Source::Cli),
        ClientKind::GithubCopilotApp => Some(Source::App),
    }
}
