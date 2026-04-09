-- migrate:up

-- Password reset tokens table (Prompt 19)
-- Stores sha256 hashes of single-use reset tokens (raw token is never stored).
CREATE TABLE platform.password_reset_tokens (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
  token_hash  text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  used        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX prt_user_id_idx    ON platform.password_reset_tokens (user_id);
CREATE INDEX prt_token_hash_idx ON platform.password_reset_tokens (token_hash);

-- Allow amis_app to read/write (needed if we ever query via the app role).
-- Auth endpoints use the superuser pool, but grant for completeness.
GRANT SELECT, INSERT, UPDATE ON platform.password_reset_tokens TO amis_app;

-- migrate:down

DROP TABLE IF EXISTS platform.password_reset_tokens;
