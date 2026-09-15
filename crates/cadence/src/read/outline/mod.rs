mod rust;
mod javascript;
mod markdown;
mod json;
mod c;

use super::{model::Unit, source};
use std::path::Path;

pub fn units(path: &Path, content: &str) -> Vec<Unit> {
    match path.extension().and_then(|extension| extension.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "rs" => rust::units(content),
        "js" | "mjs" | "cjs" | "jsx" => javascript::units(content),
        "md" | "markdown" => markdown::units(content),
        "json" => json::units(content),
        "c" | "h" => c::units(content),
        _ => source::fallback(path, content),
    }
}
