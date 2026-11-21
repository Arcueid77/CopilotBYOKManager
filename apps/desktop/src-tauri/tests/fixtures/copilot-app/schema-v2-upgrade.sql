-- Official Windows x64 Copilot App 1.4.3, migration 206 (sanitized schema fixture).
ALTER TABLE provider_models ADD COLUMN supports_vision INTEGER NOT NULL DEFAULT 0 CHECK (supports_vision IN (0, 1));
