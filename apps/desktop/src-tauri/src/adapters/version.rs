/// Parse a stable major.minor.patch release. Package classifiers are parsed by
/// the adapter that owns them.
pub(super) fn release_number(text: &str) -> Option<[u32; 3]> {
    if text.len() > 32 {
        return None;
    }
    let mut parts = text.split('.');
    let mut version = [0; 3];
    for number in &mut version {
        let part = parts.next()?;
        if part.is_empty()
            || (part.len() > 1 && part.starts_with('0'))
            || !part.bytes().all(|b| b.is_ascii_digit())
        {
            return None;
        }
        *number = part.parse().ok()?;
    }
    parts.next().is_none().then_some(version)
}
