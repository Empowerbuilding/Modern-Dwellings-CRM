-- ============================================
-- Add Facebook Lead ID field for Lead Ads attribution
-- ============================================

-- Add fb_lead_id to store the Facebook Lead Ads lead ID
-- This is used for CAPI attribution and deduplication
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fb_lead_id TEXT;

-- Create index for lookups by fb_lead_id
CREATE INDEX IF NOT EXISTS idx_contacts_fb_lead_id ON contacts(fb_lead_id) WHERE fb_lead_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN contacts.fb_lead_id IS 'Facebook Lead Ads lead ID (leadgen_id) for CAPI attribution';
