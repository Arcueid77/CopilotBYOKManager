//! Read-only release check for an extracted official Copilot App executable.
use copilot_byok_manager_lib::adapters::github_app;
use std::{env, path::PathBuf};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let paths: Vec<_> = env::args_os().skip(1).map(PathBuf::from).collect();
    if paths.is_empty() {
        return Err("Pass the path to an extracted Copilot App executable".into());
    }
    for path in paths {
        println!(
            "GitHub Copilot x64 {}",
            github_app::verified_sync_build(&path)?
        );
    }
    Ok(())
}
