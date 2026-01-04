-- ============================================
-- Add unsubscribe tracking fields to contacts
-- ============================================

-- Add unsubscribed boolean field (defaults to false)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS unsubscribed BOOLEAN DEFAULT FALSE NOT NULL;

-- Add unsubscribed_at timestamp (null when subscribed)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

-- Create index for quickly filtering subscribed contacts
CREATE INDEX IF NOT EXISTS idx_contacts_unsubscribed ON contacts(unsubscribed) WHERE unsubscribed = FALSE;

-- Add comment for documentation
COMMENT ON COLUMN contacts.unsubscribed IS 'Whether the contact has opted out of marketing emails';
COMMENT ON COLUMN contacts.unsubscribed_at IS 'Timestamp when the contact unsubscribed';
