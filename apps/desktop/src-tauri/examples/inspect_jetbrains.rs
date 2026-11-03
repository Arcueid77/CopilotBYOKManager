//! Operator-invoked, read-only public plugin metadata diagnosis. Never opens BYOK or authentication files.
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let observed = copilot_byok_manager_lib::adapters::jetbrains::discover_targets()
        .into_iter()
        .map(|target| {
            serde_json::json!({
                "target": target.name,
                "detected": target.detected,
                "automatic": target.supports_write,
                "status": target.status,
                "reason": target.detail
            })
        })
        .collect::<Vec<_>>();
    println!("{}", serde_json::to_string_pretty(&observed)?);
    Ok(())
}
