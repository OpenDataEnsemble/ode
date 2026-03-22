-- +goose Up
-- Optional root-level observation metadata for sync and exports.

ALTER TABLE observations ADD COLUMN IF NOT EXISTS author TEXT;
ALTER TABLE observations ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE observations ADD COLUMN IF NOT EXISTS tags TEXT[];

COMMENT ON COLUMN observations.author IS 'Optional client-reported author or creator identifier';
COMMENT ON COLUMN observations.device_id IS 'Optional client device identifier';
COMMENT ON COLUMN observations.tags IS 'Optional list of string tags (e.g. for workflows or data cleaning)';

-- +goose Down

ALTER TABLE observations DROP COLUMN IF EXISTS tags;
ALTER TABLE observations DROP COLUMN IF EXISTS device_id;
ALTER TABLE observations DROP COLUMN IF EXISTS author;
