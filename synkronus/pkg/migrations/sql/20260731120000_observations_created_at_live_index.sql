-- +goose Up
CREATE INDEX IF NOT EXISTS idx_observations_created_at_live
    ON observations (created_at)
    WHERE deleted = false;

-- +goose Down
DROP INDEX IF EXISTS idx_observations_created_at_live;
