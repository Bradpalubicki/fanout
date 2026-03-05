-- Agency override column on oauth_state
ALTER TABLE oauth_state ADD COLUMN IF NOT EXISTS agency_override boolean DEFAULT false;
