-- KeyNest auth + vault (D1)

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_keys (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    alias TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT 'openai',
    base_url TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'unknown',
    balance REAL,
    currency TEXT,
    last_checked TEXT,
    models_json TEXT NOT NULL DEFAULT '[]',
    models_updated_at TEXT,
    tags_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, token),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vault_keys_user ON vault_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_vault_keys_user_provider ON vault_keys(user_id, provider);

CREATE TABLE IF NOT EXISTS balance_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    key_id TEXT NOT NULL,
    balance REAL,
    currency TEXT,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (key_id) REFERENCES vault_keys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_key ON balance_snapshots(user_id, key_id);
