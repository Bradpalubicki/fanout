-- Add code_verifier column to oauth_state for Twitter/X PKCE support
ALTER TABLE oauth_state ADD COLUMN IF NOT EXISTS code_verifier TEXT;
