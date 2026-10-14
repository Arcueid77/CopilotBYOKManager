const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
test("first-release build, app and package identities are consistent", () => {
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  const tauri = JSON.parse(read("apps/desktop/src-tauri/tauri.conf.json"));
  assert.equal(pkg.name, "copilot-byok-manager");
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.packages[""].name, pkg.name);
  assert.equal(tauri.productName, "CopilotBYOKManager");
  assert.equal(tauri.app.windows[0].title, tauri.productName);
  assert.equal(tauri.identifier, "io.github.avalonero.copilotbyokmanager");
  assert.match(read("apps/desktop/src-tauri/Cargo.toml"), /name = "copilot-byok-manager"/);
  assert.match(read("apps/desktop/src-tauri/Cargo.toml"), /name = "copilot_byok_manager_lib"/);
  assert.match(read("apps/desktop/src-tauri/src/main.rs"), /copilot_byok_manager_lib::run/);
});
test("native stores and owned projections use the dedicated product namespace", () => {
  const native = "apps/desktop/src-tauri/src/";
  for (const file of ["state.rs", "account.rs", "github_auth.rs", "usage_db.rs"]) {
    assert.match(read(native + file), /\.join\("CopilotBYOKManager"\)/, file);
  }
  assert.match(read(native + "secrets.rs"), /"io\.github\.avalonero\.copilotbyokmanager\.connections"/);
  for (const file of ["adapters/vscode.rs", "adapters/jetbrains/byok.rs"]) {
    assert.match(read(native + file), /copilotByokManagerManaged/);
    assert.match(read(native + file), /copilotByokManagerInstallationOwnerId/);
  }
  assert.match(read(native + "adapters/copilot_cli.rs"), /COPILOT_BYOK_MANAGER_COPILOT_OWNER_ID/);
  assert.match(read(native + "resources/mod.rs"), /copilot-byok-manager-/);
  assert.match(read(native + "usage/importer.rs"), /CopilotBYOKManager\/usage-inbox/);
});
