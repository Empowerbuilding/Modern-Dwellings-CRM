-- ============================================
-- Add lifecycle_stage for funnel tracking
-- and fb_events_sent for Facebook deduplication
-- ============================================

-- Add lifecycle_stage column to contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'subscriber'
CHECK (lifecycle_stage IN ('subscriber', 'lead', 'mql', 'sql', 'customer'));

-- Add fb_events_sent column to track Facebook events sent
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS fb_events_sent JSONB DEFAULT '{}';

-- Add index for filtering by lifecycle_stage
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_stage ON contacts(lifecycle_stage);

-- Add comment for documentation
COMMENT ON COLUMN contacts.lifecycle_stage IS 'Funnel stage: subscriber -> lead -> mql -> sql -> customer';
COMMENT ON COLUMN contacts.fb_events_sent IS 'Track Facebook events sent for deduplication, e.g. {"lead": "2026-01-03T12:00:00Z"}';
