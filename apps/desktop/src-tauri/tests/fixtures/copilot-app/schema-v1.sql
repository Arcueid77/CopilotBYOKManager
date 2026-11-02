-- Sanitized configuration schema from the verified official Windows x64 v1.1.25 binary.
-- Installer SHA256 6ca31b9003dceefd434a62d5b58b59e44a07b6083d1628ef5a137039e64b130e.
-- github.exe SHA256 1c741981f9b450a17401ab4a8f44bcc556d42bb6a43561c4c9305c39a997e97f.
-- The accounts/session tables below contain synthetic test-only fields, not live data.
PRAGMA foreign_keys = ON;
CREATE TABLE accounts (id TEXT PRIMARY KEY NOT NULL);
CREATE TABLE model_providers (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    type TEXT NOT NULL DEFAULT 'openai',
    settings_json TEXT NOT NULL DEFAULT '{}',
    account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE TABLE provider_models (
    id TEXT PRIMARY KEY NOT NULL,
    provider_id TEXT NOT NULL REFERENCES model_providers(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    wire_model TEXT,
    display_name TEXT NOT NULL,
    max_prompt_tokens INTEGER,
    max_output_tokens INTEGER,
    wire_api_override TEXT CHECK (wire_api_override IS NULL OR wire_api_override IN ('completions', 'responses')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    supported_reasoning_efforts TEXT,
    UNIQUE (provider_id, model_id)
);
CREATE INDEX idx_provider_models_provider ON provider_models(provider_id);
CREATE TABLE sessions (
    id TEXT PRIMARY KEY NOT NULL,
    provider_id TEXT REFERENCES model_providers(id) ON DELETE SET NULL,
    fixture_private_payload TEXT
);
