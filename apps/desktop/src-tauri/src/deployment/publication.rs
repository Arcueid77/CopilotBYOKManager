//! Public, owned model-source observations. Publication is not model selection,
//! authentication, a running client, or a successful provider request.
use super::ownership::TargetOwnership;
use crate::domain::{ClientKind, ClientTarget};
use crate::{adapters, error::AppResult};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;

pub(crate) struct CatalogEvidence {
    pub resource_id: String,
    pub sources: BTreeMap<String, (String, u32)>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PublicationState {
    Published,
    Changed,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishedSource {
    pub target_id: String,
    pub connection_id: String,
    pub state: PublicationState,
    pub model_count: Option<u32>,
    pub published_at: DateTime<Utc>,
}

pub fn selection_notice(kind: ClientKind) -> &'static str {
    match kind {
        ClientKind::VsCodeCopilot => "请到客户端的模型选择器中选用刚发布的模型。",
        ClientKind::JetBrainsCopilot => {
            "重启相关 IDE 后，请到客户端的模型选择器中选用刚发布的模型。"
        }
        ClientKind::CopilotCli => {
            "CLI 用户环境路由已替换，首选模型写入 COPILOT_MODEL；请新开终端并重启 CLI 会话。"
        }
        ClientKind::GithubCopilotApp => {
            "没有已审核的自动写入接口，请在 App 内手动添加供应商并选择模型。"
        }
    }
}

pub fn observe(
    targets: &[ClientTarget],
    proofs: &[TargetOwnership],
    owner: &str,
    read_only: bool,
) -> Vec<PublishedSource> {
    // Shared VS Code profiles / JetBrains runtimes are read once per physical
    // catalog. No credential-store access, model-selection cache or IDE XML.
    let mut catalogs: HashMap<(ClientKind, String), AppResult<CatalogEvidence>> = HashMap::new();
    proofs
        .iter()
        .map(|proof| {
            let observed = targets.iter().find(|target| {
                target.id == proof.target_id
                    && target.kind == proof.target_kind
                    && target.detected
                    && target.supports_write
            });
            let evidence = if read_only || proof.owner_id != owner {
                None
            } else if let Some(target) = observed {
                match target.kind {
                    ClientKind::VsCodeCopilot | ClientKind::JetBrainsCopilot => {
                        let path = match target.kind {
                            ClientKind::VsCodeCopilot => target.path.clone(),
                            _ => adapters::jetbrains::byok::store_path()
                                .ok()
                                .map(|p| p.to_string_lossy().into_owned()),
                        };
                        path.and_then(|path| {
                            let catalog = catalogs
                                .entry((target.kind, path.clone()))
                                .or_insert_with(|| match target.kind {
                                    ClientKind::VsCodeCopilot => {
                                        adapters::vscode::observe_owned(Path::new(&path), owner)
                                    }
                                    _ => adapters::jetbrains::byok::observe_owned(
                                        Path::new(&path),
                                        owner,
                                    ),
                                });
                            catalog.as_ref().ok().map(|catalog| {
                                catalog
                                    .sources
                                    .get(&proof.connection_id)
                                    .filter(|(hash, _)| {
                                        catalog.resource_id == proof.resource_id
                                            && *hash == proof.projection_fingerprint
                                    })
                                    .map(|(_, count)| *count)
                            })
                        })
                    }
                    ClientKind::CopilotCli => super::fingerprint_target(target).ok().map(|live| {
                        (proof.resource_id == super::ownership::cli_resource_id()
                            && live == proof.target_fingerprint)
                            .then_some(1)
                    }),
                    ClientKind::GithubCopilotApp => None,
                }
            } else {
                None
            };
            let (state, model_count) = match evidence {
                Some(Some(count)) => (PublicationState::Published, Some(count)),
                Some(None) => (PublicationState::Changed, None),
                None => (PublicationState::Unavailable, None),
            };
            PublishedSource {
                target_id: proof.target_id.clone(),
                connection_id: proof.connection_id.clone(),
                state,
                model_count,
                published_at: proof.deployed_at,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests;
