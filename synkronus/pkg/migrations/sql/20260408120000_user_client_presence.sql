-- +goose Up
CREATE TABLE IF NOT EXISTS user_client_presence (
    username VARCHAR(255) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
    client_id TEXT NOT NULL DEFAULT '',
    last_seen_at TIMESTAMPTZ NOT NULL,
    last_data_version BIGINT NULL,
    app_bundle_version TEXT NULL,
    last_ode_version TEXT NULL,
    PRIMARY KEY (username, client_id)
);

CREATE INDEX IF NOT EXISTS idx_user_client_presence_username ON user_client_presence(username);
CREATE INDEX IF NOT EXISTS idx_user_client_presence_last_seen ON user_client_presence(username, last_seen_at DESC);

-- +goose Down
DROP TABLE IF EXISTS user_client_presence;
