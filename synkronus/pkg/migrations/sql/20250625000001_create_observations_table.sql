-- +goose Up
-- SQL in this section is executed when the migration is applied

-- Create observations table with version-based sync support
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    observation_id VARCHAR(255) UNIQUE NOT NULL,
    form_type VARCHAR(255) NOT NULL,
    form_version VARCHAR(50) NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    synced_at TIMESTAMP WITH TIME ZONE,
    deleted BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 1
);

-- Create sync_version table to track global database version
CREATE TABLE IF NOT EXISTS sync_version (
    id INTEGER PRIMARY KEY DEFAULT 1,
    current_version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial sync version
INSERT INTO sync_version (id, current_version) VALUES (1, 1) ON CONFLICT (id) DO NOTHING;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_observations_observation_id ON observations(observation_id);
CREATE INDEX IF NOT EXISTS idx_observations_form_type ON observations(form_type);
CREATE INDEX IF NOT EXISTS idx_observations_version ON observations(version);
CREATE INDEX IF NOT EXISTS idx_observations_deleted ON observations(deleted);
CREATE INDEX IF NOT EXISTS idx_observations_updated_at ON observations(updated_at);

-- Create function to auto-increment version on changes
CREATE OR REPLACE FUNCTION increment_sync_version()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment the global sync version
    UPDATE sync_version SET 
        current_version = current_version + 1,
        updated_at = NOW()
    WHERE id = 1;
    
    -- Set the version on the record
    NEW.version = (SELECT current_version FROM sync_version WHERE id = 1);
    NEW.updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to auto-increment version on insert/update
CREATE TRIGGER observations_version_trigger
    BEFORE INSERT OR UPDATE ON observations
    FOR EACH ROW
    EXECUTE FUNCTION increment_sync_version();

-- +goose Down
-- SQL in this section is executed when the migration is rolled back

DROP TRIGGER IF EXISTS observations_version_trigger ON observations;
DROP FUNCTION IF EXISTS increment_sync_version();
DROP INDEX IF EXISTS idx_observations_updated_at;
DROP INDEX IF EXISTS idx_observations_deleted;
DROP INDEX IF EXISTS idx_observations_version;
DROP INDEX IF EXISTS idx_observations_form_type;
DROP INDEX IF EXISTS idx_observations_observation_id;
DROP TABLE IF EXISTS sync_version;
DROP TABLE IF EXISTS observations;
