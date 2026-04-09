-- +goose Up
ALTER TABLE sync_version
    ADD COLUMN IF NOT EXISTS repository_generation BIGINT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_reset_by VARCHAR(255);

UPDATE sync_version SET repository_generation = 1 WHERE repository_generation IS NULL;

-- +goose Down
ALTER TABLE sync_version
    DROP COLUMN IF EXISTS last_reset_by,
    DROP COLUMN IF EXISTS last_reset_at,
    DROP COLUMN IF EXISTS repository_generation;
