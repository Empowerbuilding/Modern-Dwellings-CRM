-- ============================================
-- Add logo_url to meeting_types for scheduler branding
-- ============================================

ALTER TABLE meeting_types ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN meeting_types.logo_url IS 'URL to logo image displayed on booking page';
