-- +goose Up
-- SQL in this section is executed when the migration is applied

-- First, drop any foreign key constraints that reference the observations table
-- (Note: Add any actual foreign key constraints that reference observations.id here)

-- Drop the primary key constraint on id
ALTER TABLE observations DROP CONSTRAINT observations_pkey;

-- Make observation_id the new primary key
ALTER TABLE observations ADD PRIMARY KEY (observation_id);

-- Drop the id column
ALTER TABLE observations DROP COLUMN id;

-- +goose Down
-- SQL in this section is used to revert the migration

-- Add back the id column
ALTER TABLE observations ADD COLUMN id UUID DEFAULT uuid_generate_v4();

-- Make id the primary key again
ALTER TABLE observations ADD PRIMARY KEY (id);

-- Recreate the unique constraint on observation_id
ALTER TABLE observations ADD CONSTRAINT observations_observation_id_key UNIQUE (observation_id);
