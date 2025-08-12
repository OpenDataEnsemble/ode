-- +goose Up
-- SQL in this section is executed when the migration is applied

-- Add geolocation column to observations table
ALTER TABLE observations ADD COLUMN geolocation JSONB;

-- Create index for geolocation queries (PostgreSQL specific)
-- This enables efficient spatial queries on the geolocation data
CREATE INDEX IF NOT EXISTS idx_observations_geolocation ON observations USING GIN (geolocation);

-- Create index for latitude/longitude queries (for range queries)
-- This enables efficient queries like "find observations within a bounding box"
CREATE INDEX IF NOT EXISTS idx_observations_geolocation_coords ON observations 
    ((geolocation->>'latitude'), (geolocation->>'longitude')) 
    WHERE geolocation IS NOT NULL;

-- +goose Down
-- SQL in this section is executed when the migration is rolled back

-- Remove indexes
DROP INDEX IF EXISTS idx_observations_geolocation_coords;
DROP INDEX IF EXISTS idx_observations_geolocation;

-- Remove geolocation column
ALTER TABLE observations DROP COLUMN IF EXISTS geolocation;
