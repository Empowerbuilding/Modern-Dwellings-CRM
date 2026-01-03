-- ============================================
-- Facebook Integrations table
-- Stores Facebook OAuth tokens and page connections
-- ============================================

CREATE TABLE IF NOT EXISTS facebook_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT,
  page_name TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  permissions TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_facebook_integrations_user_id ON facebook_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_facebook_integrations_is_active ON facebook_integrations(is_active);

-- Add comments for documentation
COMMENT ON TABLE facebook_integrations IS 'Stores Facebook OAuth tokens and page connections for lead retrieval';
COMMENT ON COLUMN facebook_integrations.page_id IS 'Facebook Page ID connected for lead retrieval';
COMMENT ON COLUMN facebook_integrations.page_name IS 'Display name of the connected Facebook Page';
COMMENT ON COLUMN facebook_integrations.access_token IS 'Long-lived Facebook access token';
COMMENT ON COLUMN facebook_integrations.permissions IS 'Array of granted Facebook permissions';
