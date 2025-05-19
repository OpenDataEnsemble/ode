-- +goose Up
-- SQL in this section is executed when the migration is applied

-- Enable UUID extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- +goose Down
-- SQL in this section is executed when the migration is rolled back
DROP INDEX IF EXISTS idx_users_username;
DROP TABLE IF EXISTS users;
