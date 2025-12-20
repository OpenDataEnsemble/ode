#!/bin/bash
set -e

# Create synkronus_user and database if they don't exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create user if it doesn't exist
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'synkronus_user') THEN
            CREATE ROLE synkronus_user LOGIN PASSWORD 'dev_password_change_in_production';
        END IF;
    END
    \$\$;

    -- Grant privileges
    GRANT ALL PRIVILEGES ON DATABASE synkronus TO synkronus_user;
    
    -- Connect to synkronus database and grant schema privileges
    \c synkronus
    GRANT ALL ON SCHEMA public TO synkronus_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO synkronus_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO synkronus_user;
EOSQL

echo "Database initialization completed!"

