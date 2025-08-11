-- +goose Up
-- SQL in this section is executed when the migration is applied

-- Create attachment_operations table to track attachment changes for version-based sync
CREATE TABLE IF NOT EXISTS attachment_operations (
    id SERIAL PRIMARY KEY,
    attachment_id VARCHAR(255) NOT NULL,
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    client_id VARCHAR(255), -- NULL for operations affecting all clients
    version BIGINT NOT NULL,
    size INTEGER, -- NULL for delete operations
    content_type VARCHAR(255), -- NULL for delete operations
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_attachment_operations_version ON attachment_operations(version);
CREATE INDEX IF NOT EXISTS idx_attachment_operations_client ON attachment_operations(client_id);
CREATE INDEX IF NOT EXISTS idx_attachment_operations_attachment_id ON attachment_operations(attachment_id);
CREATE INDEX IF NOT EXISTS idx_attachment_operations_version_client ON attachment_operations(version, client_id);

-- Create function to auto-increment version for attachment operations
CREATE OR REPLACE FUNCTION increment_attachment_sync_version() RETURNS TRIGGER AS 'BEGIN UPDATE sync_version SET current_version = current_version + 1, updated_at = NOW() WHERE id = 1; NEW.version = (SELECT current_version FROM sync_version WHERE id = 1); NEW.created_at = NOW(); RETURN NEW; END;' LANGUAGE plpgsql;

-- Create trigger to auto-increment version on insert
CREATE TRIGGER attachment_operations_version_trigger
    BEFORE INSERT ON attachment_operations
    FOR EACH ROW
    EXECUTE FUNCTION increment_attachment_sync_version();

-- +goose Down
-- SQL in this section is executed when the migration is rolled back

DROP TRIGGER IF EXISTS attachment_operations_version_trigger ON attachment_operations;
DROP FUNCTION IF EXISTS increment_attachment_sync_version();
DROP INDEX IF EXISTS idx_attachment_operations_version_client;
DROP INDEX IF EXISTS idx_attachment_operations_attachment_id;
DROP INDEX IF EXISTS idx_attachment_operations_client;
DROP INDEX IF EXISTS idx_attachment_operations_version;
DROP TABLE IF EXISTS attachment_operations;
