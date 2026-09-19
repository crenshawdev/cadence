/// Coverage of a normalized declaration over an unchanged observed path.
/// Exact files cover only themselves. Directory roots also cover descendants
/// at a component boundary, including the root itself for overlap ordering.
pub fn covers(files: &[String], directories: &[String], path: &str) -> bool {
    files.iter().any(|file| file == path)
        || directories.iter().any(|root| {
            path == root
                || path
                    .strip_prefix(root)
                    .is_some_and(|suffix| suffix.starts_with('/'))
        })
}
