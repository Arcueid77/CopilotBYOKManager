//! Current public configuration. Observations never grant write authority or
//! claim model selection, authentication, or a successful provider request.
use crate::domain::{ClientKind, ClientTarget, Connection};
use crate::{adapters, error::AppResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfiguredSource {
    pub connection_id: Option<String>,
    pub name: String,
    pub model_count: u32,
}

impl ConfiguredSource {
    pub(crate) fn new(
        name: &str,
        connection_id: Option<&str>,
        model_count: usize,
    ) -> AppResult<Self> {
        if name.len() > 512 || model_count > 256 || name.chars().any(char::is_control) {
            return Err(crate::error::AppError::Config(
                "Unsupported provider display metadata".into(),
            ));
        }
        Ok(Self {
            name: crate::redact::redact_text(name),
            connection_id: connection_id
                .filter(|id| {
                    id.len() <= 160 && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
                })
                .map(str::to_owned),
            model_count: model_count as u32,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConfigurationState {
    Available,
    Unavailable,
    Unsupported,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientConfiguration {
    pub target_id: String,
    pub state: ConfigurationState,
    pub sources: Vec<ConfiguredSource>,
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

pub fn observe(targets: &[ClientTarget], connections: &[Connection]) -> Vec<ClientConfiguration> {
    // Read shared catalogs once. Audit/ownership fingerprints are not current state.
    let mut catalogs: HashMap<(ClientKind, String), AppResult<Vec<ConfiguredSource>>> =
        HashMap::new();
    targets
        .iter()
        .map(|target| {
            let mut result = ClientConfiguration {
                target_id: target.id.clone(),
                state: ConfigurationState::Unsupported,
                sources: Vec::new(),
            };
            if !target.detected || !target.supports_write {
                return result;
            }
            let path = match target.kind {
                ClientKind::VsCodeCopilot => target.path.clone(),
                ClientKind::JetBrainsCopilot => adapters::jetbrains::byok::store_path()
                    .ok()
                    .map(|p| p.to_string_lossy().into_owned()),
                ClientKind::CopilotCli => Some("user-environment".into()),
                ClientKind::GithubCopilotApp => None,
            };
            result.state = ConfigurationState::Unavailable;
            if let Some(path) = path {
                let sources = catalogs
                    .entry((target.kind, path.clone()))
                    .or_insert_with(|| match target.kind {
                        ClientKind::VsCodeCopilot => {
                            adapters::vscode::observe_current(Path::new(&path))
                        }
                        ClientKind::JetBrainsCopilot => {
                            adapters::jetbrains::byok::observe_current(Path::new(&path))
                        }
                        ClientKind::CopilotCli => {
                            adapters::copilot_cli::observe_current(connections)
                        }
                        ClientKind::GithubCopilotApp => unreachable!(),
                    });
                if let Ok(sources) = sources {
                    result.sources = sources.clone();
                    for source in &mut result.sources {
                        if !connections.iter().any(|connection| {
                            source.connection_id.as_deref() == Some(connection.id.as_str())
                        }) {
                            source.connection_id = None;
                        }
                    }
                    result.state = ConfigurationState::Available;
                }
            }
            result
        })
        .collect()
}

#[cfg(test)]
mod tests;
