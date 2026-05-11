-- migrate:up

-- Short-lived OTP sessions used for email-based 2FA on login
CREATE TABLE platform.otp_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES platform.users(id) ON DELETE CASCADE,
  code_hash   text        NOT NULL,      -- SHA-256 hex of the 6-digit code
  expires_at  timestamptz NOT NULL,
  used        boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX otp_sessions_user_idx ON platform.otp_sessions (user_id);
-- Auto-clean: sessions expire after 10 minutes, clean up daily
CREATE INDEX otp_sessions_expires_idx ON platform.otp_sessions (expires_at);

-- migrate:down
DROP TABLE IF EXISTS platform.otp_sessions;
