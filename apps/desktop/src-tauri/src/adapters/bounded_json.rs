//! Reject ambiguous or unbounded JSON before rewriting a client configuration.
use serde::de::{DeserializeSeed, MapAccess, SeqAccess, Visitor};
use serde::Deserializer;
use std::{collections::HashSet, fmt};

pub(super) fn check_json(bytes: &[u8]) -> Result<(), serde_json::Error> {
    let mut deserializer = serde_json::Deserializer::from_slice(bytes);
    Checked(0).deserialize(&mut deserializer)?;
    deserializer.end()
}

pub(super) fn check_json5(text: &str) -> Result<(), json5::Error> {
    let mut deserializer = json5::Deserializer::from_str(text)?;
    Checked(0).deserialize(&mut deserializer)
}

// First reject duplicate keys and bound nesting. Value's arbitrary_precision
// parsing in the second pass must preserve foreign metadata without rounding.
struct Checked(usize);
impl<'de> DeserializeSeed<'de> for Checked {
    type Value = ();
    fn deserialize<D: Deserializer<'de>>(self, d: D) -> Result<(), D::Error> {
        if self.0 > 32 {
            return Err(serde::de::Error::custom("excessive nesting"));
        }
        d.deserialize_any(self)
    }
}
impl<'de> Visitor<'de> for Checked {
    type Value = ();
    fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str("bounded unambiguous JSON")
    }
    fn visit_map<A: MapAccess<'de>>(self, mut a: A) -> Result<(), A::Error> {
        let mut keys = HashSet::new();
        while let Some(key) = a.next_key::<String>()? {
            if keys.len() >= 2048 || key.len() > 512 || !keys.insert(key) {
                return Err(serde::de::Error::custom("unsupported object"));
            }
            a.next_value_seed(Checked(self.0 + 1))?;
        }
        Ok(())
    }
    fn visit_seq<A: SeqAccess<'de>>(self, mut a: A) -> Result<(), A::Error> {
        let mut count = 0;
        while a.next_element_seed(Checked(self.0 + 1))?.is_some() {
            count += 1;
            if count > 2048 {
                return Err(serde::de::Error::custom("oversized array"));
            }
        }
        Ok(())
    }
    fn visit_str<E: serde::de::Error>(self, s: &str) -> Result<(), E> {
        if s.len() > 64 * 1024 {
            Err(E::custom("oversized string"))
        } else {
            Ok(())
        }
    }
    fn visit_bool<E: serde::de::Error>(self, _: bool) -> Result<(), E> {
        Ok(())
    }
    fn visit_i64<E: serde::de::Error>(self, _: i64) -> Result<(), E> {
        Ok(())
    }
    fn visit_u64<E: serde::de::Error>(self, _: u64) -> Result<(), E> {
        Ok(())
    }
    fn visit_f64<E: serde::de::Error>(self, _: f64) -> Result<(), E> {
        Ok(())
    }
    fn visit_unit<E: serde::de::Error>(self) -> Result<(), E> {
        Ok(())
    }
}
