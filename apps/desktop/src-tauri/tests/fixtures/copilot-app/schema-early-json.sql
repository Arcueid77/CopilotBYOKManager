-- Sanitized JSON-with-legacy-columns layout from the published Windows App.
CREATE TABLE model_providers (
    id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, base_url TEXT NOT NULL,
    wire_api TEXT NOT NULL DEFAULT 'completions' CHECK (wire_api IN ('completions','responses')),
    azure_api_version TEXT,
    auth_kind TEXT NOT NULL DEFAULT 'api_key' CHECK (auth_kind IN ('api_key','bearer_token','none')),
    headers_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    type TEXT NOT NULL DEFAULT 'openai', settings_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE provider_models (
    id TEXT PRIMARY KEY NOT NULL, provider_id TEXT NOT NULL REFERENCES model_providers(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL, wire_model TEXT, display_name TEXT NOT NULL,
    max_prompt_tokens INTEGER, max_output_tokens INTEGER,
    wire_api_override TEXT CHECK (wire_api_override IS NULL OR wire_api_override IN ('completions','responses')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (provider_id, model_id)
);
CREATE TABLE sessions(id TEXT PRIMARY KEY NOT NULL, provider_id TEXT REFERENCES model_providers(id) ON DELETE SET NULL);
INSERT INTO model_providers(id,name,base_url) VALUES ('manual','Fixture','https://manual.invalid');
