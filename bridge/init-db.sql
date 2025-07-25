-- Database initialization for Anvil Todo Demo Test
-- This script sets up the necessary database structure for Anvil apps

-- Create the main database (already created by POSTGRES_DB)
-- CREATE DATABASE anvil_test;

-- Connect to the database
\c anvil_test;

-- Create extensions that Anvil might need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Grant all privileges to anvil_user
GRANT ALL PRIVILEGES ON DATABASE anvil_test TO anvil_user;
GRANT ALL ON SCHEMA public TO anvil_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anvil_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anvil_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anvil_user;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Anvil test database initialized successfully';
END $$; 