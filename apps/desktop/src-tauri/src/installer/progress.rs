//! WinGet terminal progress v1 (reviewed upstream bc1e9ff8, 2026-10-23).
//! Only phases and bounded numeric counters leave this parser; raw output is discarded.
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum InstallPhase {
    Preparing,
    Downloading,
    Installing,
    Verifying,
    Cancelling,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    pub phase: InstallPhase,
    pub downloaded_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub elapsed_seconds: u64,
}
impl InstallProgress {
    #[cfg(any(windows, test))]
    pub fn new(phase: InstallPhase) -> Self {
        Self {
            phase,
            downloaded_bytes: None,
            total_bytes: None,
            elapsed_seconds: 0,
        }
    }
}

#[cfg(any(windows, test))]
pub(super) struct Parser {
    pub progress: InstallProgress,
    expected_url: &'static str,
    frame: Vec<u8>,
    escape: u8,
    oversized: bool,
}

#[cfg(any(windows, test))]
impl Parser {
    pub fn new(expected_url: &'static str) -> Self {
        Self {
            progress: InstallProgress::new(InstallPhase::Preparing),
            expected_url,
            frame: Vec::new(),
            escape: 0,
            oversized: false,
        }
    }
    pub fn feed(&mut self, chunk: &[u8]) {
        for &b in chunk {
            match self.escape {
                1 => {
                    self.escape = match b {
                        b'[' => 2,
                        b']' => 3,
                        _ => 0,
                    };
                    continue;
                }
                2 => {
                    if (0x40..=0x7e).contains(&b) {
                        self.escape = 0;
                    }
                    continue;
                }
                3 => {
                    if b == 7 {
                        self.escape = 0;
                    } else if b == 27 {
                        self.escape = 4;
                    }
                    continue;
                }
                4 => {
                    self.escape = if b == b'\\' { 0 } else { 3 };
                    continue;
                }
                _ => {}
            }
            match b {
                27 => self.escape = 1,
                b'\r' | b'\n' => {
                    self.finish_frame();
                    self.frame.clear();
                    self.oversized = false;
                }
                8 => {
                    self.frame.pop();
                }
                0..=31 => {}
                _ if self.frame.len() < 8192 && !self.oversized => self.frame.push(b),
                _ => {
                    self.oversized = true;
                    self.frame.clear();
                }
            }
        }
        // ConPTY can deliver the current frame without a trailing CR. Numeric
        // parsing requires the final complete unit and retries on the next chunk.
        self.finish_frame();
    }
    fn finish_frame(&mut self) {
        if self.oversized {
            return;
        }
        let text = String::from_utf8_lossy(&self.frame);
        if !self.expected_url.is_empty() && text.contains(self.expected_url) {
            self.progress = InstallProgress::new(InstallPhase::Downloading);
        }
        if self.progress.phase != InstallPhase::Downloading {
            return;
        }
        // Reviewed en-US and zh-CN output. Unknown languages retain download
        // information until the backend announces post-process verification.
        if [
            "Successfully verified installer hash",
            "Starting package install",
            "Extracting archive",
            "已成功验证安装程序哈希",
            "正在启动程序包安装",
            "正在提取存档",
            "正在解压缩存档",
        ]
        .iter()
        .any(|message| text.contains(message))
        {
            self.progress.phase = InstallPhase::Installing;
            return;
        }
        let words: Vec<_> = text.split_whitespace().rev().take(5).collect();
        if words.len() != 5 || words[2] != "/" {
            return;
        }
        if let (Some(current), Some(total)) = (bytes(words[4], words[3]), bytes(words[1], words[0]))
        {
            if total > 0 && current <= total {
                self.progress.downloaded_bytes = Some(current);
                self.progress.total_bytes = Some(total);
            }
        }
    }
}

#[cfg(any(windows, test))]
fn bytes(amount: &str, unit: &str) -> Option<u64> {
    let multiplier = match unit {
        "B" => 1u64,
        "KB" => 1 << 10,
        "MB" => 1 << 20,
        "GB" => 1 << 30,
        _ => return None,
    };
    let (whole, fraction) = amount.split_once('.').unwrap_or((amount, ""));
    if whole.is_empty()
        || whole.len() > 6
        || fraction.len() > 3
        || !whole
            .bytes()
            .chain(fraction.bytes())
            .all(|b| b.is_ascii_digit())
    {
        return None;
    }
    let whole = whole.parse::<u64>().ok()?.checked_mul(multiplier)?;
    let fractional = if fraction.is_empty() {
        0
    } else {
        fraction.parse::<u64>().ok()?.checked_mul(multiplier)? / 10u64.pow(fraction.len() as u32)
    };
    whole
        .checked_add(fractional)
        .filter(|value| *value <= 16 * 1024 * 1024 * 1024)
}

#[cfg(test)]
mod tests {
    use super::*;
    const URL: &str = "https://example.test/fixture.zip";
    #[test]
    fn reviewed_terminal_fixture_crosses_download_and_install_stages() {
        let fixture = include_bytes!("../../tests/fixtures/installer/winget-terminal-v1.txt");
        let mut p = Parser::new(URL);
        for chunk in fixture.chunks(7) {
            p.feed(chunk);
        }
        assert_eq!(p.progress.downloaded_bytes, Some(4 * 1024 * 1024));
        assert_eq!(p.progress.total_bytes, Some(10 * 1024 * 1024));
        assert_eq!(p.progress.phase, InstallPhase::Installing);
    }
    #[test]
    fn source_refresh_is_not_package_progress_and_split_ansi_frames_are_supported() {
        let mut p = Parser::new(URL);
        p.feed(b"  1.0 MB / 2.0 MB\r");
        assert_eq!(p.progress.phase, InstallPhase::Preparing);
        p.feed(format!("Downloading {URL}\r\n").as_bytes());
        for chunk in [
            b"\x1b[32".as_slice(),
            b"m  ###  2.00 M",
            b"B / 10.0 MB\x1b[0m\r",
        ] {
            p.feed(chunk);
        }
        assert_eq!(p.progress.downloaded_bytes, Some(2 * 1024 * 1024));
        assert_eq!(p.progress.total_bytes, Some(10 * 1024 * 1024));
        p.feed(b"Successfully verified installer hash\r\n");
        assert_eq!(p.progress.phase, InstallPhase::Installing);
        p.feed(b"100%\r");
        assert_eq!(p.progress.phase, InstallPhase::Installing);
    }
    #[test]
    fn unknown_malformed_oversized_and_secret_output_never_become_progress_payloads() {
        let mut p = Parser::new(URL);
        p.feed(format!("Downloading {URL}\n").as_bytes());
        for frame in [
            "secret-fixture",
            "1 GB / 2 MB",
            "NaN MB / 9 MB",
            "1234567 MB / 9 MB",
            "1 MB / 0 B",
        ] {
            p.feed(format!("{frame}\r").as_bytes());
        }
        p.feed(&vec![b'x'; 9000]);
        p.feed(b"1 MB / 2 MB\r");
        assert_eq!(p.progress.downloaded_bytes, None);
        assert!(!serde_json::to_string(&p.progress)
            .unwrap()
            .contains("secret-fixture"));
        p.feed(b"\x1b]9;4;1;99\x07\r  512 KB / 1.00 MB\r");
        assert_eq!(p.progress.downloaded_bytes, Some(512 * 1024));
    }
}
