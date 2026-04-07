-- migrate:up

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Business data: students, admissions, marks, fees, workflow events
CREATE SCHEMA IF NOT EXISTS app;

-- Platform primitives: tenants, users, roles, config, workflow definitions
CREATE SCHEMA IF NOT EXISTS platform;

-- migrate:down

DROP SCHEMA IF EXISTS app CASCADE;
DROP SCHEMA IF EXISTS platform CASCADE;
DROP EXTENSION IF EXISTS pgcrypto;
