[CmdletBinding()]
param(
  [ValidateSet('dry-run', 'draft', 'publish')][string]$Mode = 'dry-run',
  [string]$OutputDirectory = 'target/platform-assets/windows'
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if (-not $IsWindows -or [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') {
  throw 'Windows x64 with PowerShell 7 is required.'
}
Push-Location (Join-Path $PSScriptRoot '..')
try {
  node scripts/check-release-version.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Version validation failed.' }
  $releaseVersion = (Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
  $releaseSha = (git rev-parse HEAD).Trim()
  $sourceDirty = [bool](git status --porcelain --untracked-files=normal)
  if ($env:GITHUB_ACTIONS -eq 'true' -and $sourceDirty) { throw 'CI package source must be clean.' }
  if ($env:RELEASE_SHA -and $env:RELEASE_SHA -ne $releaseSha) { throw 'Source SHA changed.' }
  $releaseOutput = [IO.Path]::GetFullPath($OutputDirectory, (Get-Location).Path)
  if ((Test-Path -LiteralPath $releaseOutput) -and (Get-ChildItem -LiteralPath $releaseOutput -Force)) {
    throw 'Choose an empty output directory; existing artifacts are never overwritten.'
  }
  npm run build -- --ci --target x86_64-pc-windows-msvc --bundles nsis -- --locked
  if ($LASTEXITCODE -ne 0) { throw 'Tauri NSIS build failed.' }
  $binary = 'target/x86_64-pc-windows-msvc/release/copilot-byok-manager.exe'
  $installer = "target/x86_64-pc-windows-msvc/release/bundle/nsis/CopilotBYOKManager_${releaseVersion}_x64-setup.exe"
  foreach ($file in @($binary, $installer)) {
    $info = Get-Item -LiteralPath $file
    if ($info.Length -le 0 -or $info.VersionInfo.ProductVersion -ne $releaseVersion) { throw 'Package version or size mismatch.' }
    if ((Get-AuthenticodeSignature -LiteralPath $file).Status -ne 'NotSigned') { throw 'Unexpected signing state; v0.1 pipeline requires an explicitly unsigned Windows build.' }
  }
  $env:COPILOT_BYOK_MANAGER_PACKAGE_BINARY = [IO.Path]::GetFullPath((Join-Path (Get-Location) $binary))
  node --input-type=module -e "import {assertWindowsGuiApplication} from './scripts/release-artifacts.mjs'; assertWindowsGuiApplication(process.env.COPILOT_BYOK_MANAGER_PACKAGE_BINARY);"
  if ($LASTEXITCODE -ne 0) { throw 'Application x64/GUI subsystem validation failed.' }
  if ((git rev-parse HEAD).Trim() -ne $releaseSha) { throw 'Source commit changed during the build.' }
  if (-not $sourceDirty -and [bool](git status --porcelain --untracked-files=normal)) { throw 'Source became dirty during the build.' }
  New-Item -ItemType Directory -Path $releaseOutput -Force | Out-Null
  $setupName = "CopilotBYOKManager-v${releaseVersion}-windows-x64-setup.exe"
  $zipName = "CopilotBYOKManager-v${releaseVersion}-windows-x64-standalone.zip"
  Copy-Item -LiteralPath $installer -Destination (Join-Path $releaseOutput $setupName)
  Compress-Archive -LiteralPath $binary, 'LICENSE', 'docs/standalone-notice.txt' -DestinationPath (Join-Path $releaseOutput $zipName)
  # NSIS itself uses a 32-bit bootstrapper; the verified application payload is x64.
  $files = @($setupName, $zipName) | ForEach-Object {
    $itemPath = Join-Path $releaseOutput $_
    @{ name = $_; size = (Get-Item -LiteralPath $itemPath).Length; sha256 = (Get-FileHash -LiteralPath $itemPath -Algorithm SHA256).Hash.ToLowerInvariant() }
  }
  $metadata = @{
    schema = 1; version = $releaseVersion; commit = $releaseSha; sourceDirty = $sourceDirty
    mode = $Mode; platform = 'windows'; architecture = 'x64'; signature = 'unsigned'; notarization = 'not-applicable'
    product = 'CopilotBYOKManager'; identifier = 'io.github.avalonero.copilotbyokmanager'; executable = 'copilot-byok-manager'
    files = @($files); node = (node --version); rust = (rustc --version)
  }
  $metadata | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $releaseOutput 'platform.json') -Encoding utf8NoBOM
  Write-Output "Windows x64 packages verified: $releaseOutput"
} finally {
  Remove-Item Env:\COPILOT_BYOK_MANAGER_PACKAGE_BINARY -ErrorAction SilentlyContinue
  Pop-Location
}
