//! Version 1: public IntelliJ idea-plugin descriptor inside a classic ZIP/JAR.
use super::invalid;
use crate::error::AppResult;
use quick_xml::events::Event;
use quick_xml::Reader;
use std::collections::BTreeMap;
use std::io::{Cursor, Read};

pub(super) const MAX_XML_BYTES: u64 = 256 * 1024;
const FIELDS: &[&[u8]] = &[b"id", b"name", b"vendor", b"version"];

pub(super) fn from_jar(bytes: &[u8]) -> AppResult<Option<Vec<u8>>> {
    // Bound the classic ZIP central directory before the archive library can
    // allocate one object per entry. ZIP64/multipart layouts are unsupported.
    let offset = bytes
        .windows(4)
        .rposition(|w| w == b"PK\x05\x06")
        .ok_or_else(|| invalid("Unsupported plugin JAR layout"))?;
    let tail = &bytes[offset..];
    if tail.len() < 22 {
        return Err(invalid("Truncated plugin JAR"));
    }
    let number = |at| u16::from_le_bytes([tail[at], tail[at + 1]]);
    if number(4) != 0
        || number(6) != 0
        || number(8) != number(10)
        || number(10) > 8192
        || tail.len() != 22 + usize::from(number(20))
    {
        return Err(invalid("Unsupported/bounded plugin JAR central directory"));
    }
    let size = u32::from_le_bytes(tail[12..16].try_into().unwrap()) as usize;
    let start = u32::from_le_bytes(tail[16..20].try_into().unwrap()) as usize;
    if size > 2 * 1024 * 1024 || start.checked_add(size) != Some(offset) {
        return Err(invalid("Unsupported plugin central directory bounds"));
    }
    let mut at = start;
    let mut descriptors = 0;
    for _ in 0..number(10) {
        if at.checked_add(46).is_none_or(|end| end > offset) || &bytes[at..at + 4] != b"PK\x01\x02"
        {
            return Err(invalid("Malformed plugin central directory"));
        }
        let field = |i| usize::from(u16::from_le_bytes([bytes[at + i], bytes[at + i + 1]]));
        let name_len = field(28);
        let end = at + 46 + name_len + field(30) + field(32);
        if end > offset {
            return Err(invalid("Truncated plugin central directory"));
        }
        if &bytes[at + 46..at + 46 + name_len] == b"META-INF/plugin.xml" {
            descriptors += 1;
        }
        at = end;
    }
    if at != offset || descriptors > 1 {
        return Err(invalid("Ambiguous plugin central directory"));
    }
    let mut archive =
        zip::ZipArchive::new(Cursor::new(bytes)).map_err(|_| invalid("Malformed plugin JAR"))?;
    if archive.len() > 8192 {
        return Err(invalid("Plugin JAR entry limit exceeded"));
    }
    if descriptors == 0 {
        return Ok(None);
    }
    let file = archive
        .by_name("META-INF/plugin.xml")
        .map_err(|_| invalid("Cannot read plugin descriptor"))?;
    if file.size() > MAX_XML_BYTES || file.is_dir() {
        return Err(invalid("Plugin XML exceeds its bounds"));
    }
    let mut xml = Vec::new();
    file.take(MAX_XML_BYTES + 1)
        .read_to_end(&mut xml)
        .map_err(|_| invalid("Corrupt plugin descriptor"))?;
    if xml.len() as u64 > MAX_XML_BYTES {
        return Err(invalid("Plugin XML exceeded its bound"));
    }
    Ok(Some(xml))
}

pub(super) fn parse(bytes: &[u8]) -> AppResult<Option<String>> {
    if bytes.len() as u64 > MAX_XML_BYTES || std::str::from_utf8(bytes).is_err() {
        return Err(invalid("Unsupported plugin XML encoding or size"));
    }
    let mut reader = Reader::from_reader(bytes);
    let mut stack = Vec::<Vec<u8>>::new();
    let mut values = BTreeMap::<Vec<u8>, String>::new();
    let mut root_seen = false;
    for _ in 0..32768 {
        match reader
            .read_event()
            .map_err(|_| invalid("Malformed plugin XML"))?
        {
            Event::Start(e) => {
                let name = e.name().as_ref().to_vec();
                if stack.is_empty() {
                    if root_seen || name != b"idea-plugin" {
                        return Err(invalid("Unsupported plugin descriptor root"));
                    }
                    root_seen = true;
                } else if stack.len() == 1 && FIELDS.contains(&name.as_slice()) {
                    if values.insert(name.clone(), String::new()).is_some() {
                        return Err(invalid("Duplicate plugin descriptor field"));
                    }
                } else if stack.len() == 2 && FIELDS.contains(&stack[1].as_slice()) {
                    return Err(invalid("Nested plugin identity is unsupported"));
                }
                stack.push(name);
                if stack.len() > 32 {
                    return Err(invalid("Plugin XML depth limit exceeded"));
                }
            }
            Event::End(_) => {
                stack
                    .pop()
                    .ok_or_else(|| invalid("Malformed plugin XML structure"))?;
            }
            Event::Empty(e)
                if stack.is_empty()
                    || (stack.len() == 1 && FIELDS.contains(&e.name().as_ref()))
                    || (stack.len() == 2 && FIELDS.contains(&stack[1].as_slice())) =>
            {
                return Err(invalid(
                    "Empty/nested plugin root or identity field is unsupported",
                ));
            }
            Event::Text(e) if stack.is_empty() => {
                if !e
                    .decode()
                    .map_err(|_| invalid("Malformed plugin XML text"))?
                    .trim()
                    .is_empty()
                {
                    return Err(invalid("Text outside plugin descriptor root"));
                }
            }
            Event::CData(_) | Event::GeneralRef(_) if stack.is_empty() => {
                return Err(invalid("Content outside plugin descriptor root"));
            }
            Event::Decl(e) => {
                if !stack.is_empty()
                    || e.encoding()
                        .transpose()
                        .map_err(|_| invalid("Malformed XML declaration"))?
                        .is_some_and(|encoding| !encoding.eq_ignore_ascii_case(b"UTF-8"))
                {
                    return Err(invalid("Only UTF-8 plugin XML is supported"));
                }
            }
            Event::Text(e) if stack.len() == 2 && FIELDS.contains(&stack[1].as_slice()) => {
                let text = e
                    .decode()
                    .map_err(|_| invalid("Unsupported plugin XML text"))?;
                let value = values
                    .get_mut(&stack[1])
                    .ok_or_else(|| invalid("Missing plugin field"))?;
                value.push_str(&text);
                if value.len() > 256 {
                    return Err(invalid("Plugin identity field too long"));
                }
            }
            Event::CData(e) if stack.len() == 2 && FIELDS.contains(&stack[1].as_slice()) => {
                let text = e
                    .decode()
                    .map_err(|_| invalid("Unsupported plugin XML text"))?;
                let value = values
                    .get_mut(&stack[1])
                    .ok_or_else(|| invalid("Missing plugin field"))?;
                value.push_str(&text);
                if value.len() > 256 {
                    return Err(invalid("Plugin identity field too long"));
                }
            }
            Event::GeneralRef(e) => {
                let name = e.decode().map_err(|_| invalid("Malformed plugin entity"))?;
                let ch = match name.as_ref() {
                    "amp" => '&',
                    "lt" => '<',
                    "gt" => '>',
                    "quot" => '"',
                    "apos" => '\'',
                    _ => e
                        .resolve_char_ref()
                        .map_err(|_| invalid("Malformed plugin character reference"))?
                        .ok_or_else(|| invalid("Plugin XML custom entities are unsupported"))?,
                };
                if stack.len() == 2 && FIELDS.contains(&stack[1].as_slice()) {
                    let value = values
                        .get_mut(&stack[1])
                        .ok_or_else(|| invalid("Missing plugin field"))?;
                    value.push(ch);
                    if value.len() > 256 {
                        return Err(invalid("Plugin identity field too long"));
                    }
                }
            }
            Event::DocType(_) => return Err(invalid("Plugin XML document types are unsupported")),
            Event::Eof => {
                if !root_seen || !stack.is_empty() {
                    return Err(invalid("Incomplete plugin descriptor"));
                }
                let value = |key: &[u8]| values.get(key).map(|v| v.trim()).unwrap_or("");
                if value(b"id") != super::PLUGIN_ID {
                    return Ok(None);
                }
                let version = value(b"version");
                if value(b"vendor") != "GitHub"
                    || value(b"name").is_empty()
                    || version.is_empty()
                    || version.len() > 128
                    || !version
                        .bytes()
                        .all(|b| b.is_ascii_alphanumeric() || b".-+_".contains(&b))
                {
                    return Err(invalid("Unsupported Copilot plugin identity/version"));
                }
                return Ok(Some(version.into()));
            }
            _ => {}
        }
    }
    Err(invalid("Plugin XML event limit exceeded"))
}
