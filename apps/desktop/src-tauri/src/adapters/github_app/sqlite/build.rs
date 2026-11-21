use crate::error::{AppCompatibilityIssue as Issue, AppResult};
use std::{fs::File, path::Path};

pub fn supported(version: &str) -> bool {
    crate::adapters::version::release_number(version).is_some()
}

#[cfg(any(all(windows, target_arch = "x86_64"), test))]
fn check(product: &str, version: &str, publisher: &str, x64: bool) -> AppResult<()> {
    if product != "GitHub Copilot" || publisher != "GitHub, Inc." || !x64 {
        return Err(Issue::Identity.into());
    }
    if !supported(version) {
        return Err(Issue::Version.into());
    }
    Ok(())
}

#[cfg(all(windows, target_arch = "x86_64"))]
pub(in crate::adapters::github_app) fn verify(path: &Path) -> AppResult<(String, File)> {
    use crate::installer::identity;
    use std::io::{Read, Seek, SeekFrom};
    use std::os::windows::fs::OpenOptionsExt;
    crate::safe_file::ensure_regular_or_missing(path).map_err(|_| Issue::Identity)?;
    // Deny replacement and writes while reading the PE, version resource and
    // Authenticode signer. The writer retains this handle through commit.
    let mut file = File::options()
        .read(true)
        .share_mode(1)
        .custom_flags(0x00200000)
        .open(path)
        .map_err(|_| Issue::Identity)?;
    let len = file.metadata().map_err(|_| Issue::Identity)?.len();
    if !(256..=2 * 1024 * 1024 * 1024).contains(&len) {
        return Err(Issue::Identity.into());
    }
    let mut dos = [0u8; 64];
    file.read_exact(&mut dos).map_err(|_| Issue::Identity)?;
    let offset = u32::from_le_bytes(dos[60..64].try_into().unwrap()) as u64;
    if &dos[..2] != b"MZ" || offset < 64 || offset + 26 > len {
        return Err(Issue::Identity.into());
    }
    file.seek(SeekFrom::Start(offset))
        .map_err(|_| Issue::Identity)?;
    let mut pe = [0u8; 26];
    file.read_exact(&mut pe).map_err(|_| Issue::Identity)?;
    let x64 = &pe[..6] == b"PE\0\0\x64\x86" && u16::from_le_bytes([pe[24], pe[25]]) == 0x20b;
    let product = identity::product(path).map_err(|_| Issue::Identity)?;
    let publisher = identity::trusted_publisher(path).map_err(|_| Issue::Identity)?;
    check(&product.product, &product.version, &publisher, x64)?;
    Ok((product.version, file))
}

#[cfg(not(all(windows, target_arch = "x86_64")))]
pub(in crate::adapters::github_app) fn verify(_: &Path) -> AppResult<(String, File)> {
    Err(Issue::Platform.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_identifiable_stable_official_x64_builds_can_review_the_store() {
        for v in ["1.0.5", "1.0.13", "1.1.25", "1.4.3", "2.0.0"] {
            assert!(check("GitHub Copilot", v, "GitHub, Inc.", true).is_ok());
        }
        for v in ["1.1", "1.4.3-beta", "1.01.25", "1.4.3.0", "1.4.4294967296"] {
            assert!(check("GitHub Copilot", v, "GitHub, Inc.", true).is_err());
        }
        assert!(check("Other product", "1.4.3", "GitHub, Inc.", true).is_err());
        assert!(check("GitHub Copilot", "1.4.3", "Other publisher", true).is_err());
        assert!(check("GitHub Copilot", "1.4.3", "GitHub, Inc.", false).is_err());
    }
}
