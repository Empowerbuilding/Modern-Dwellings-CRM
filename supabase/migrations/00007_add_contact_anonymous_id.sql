-- ============================================
-- Add anonymous_id to contacts table
-- Links website visitors to their contact record
-- ============================================

-- Add anonymous_id column to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS anonymous_id TEXT;

-- Add index for looking up contacts by anonymous_id
CREATE INDEX IF NOT EXISTS idx_contacts_anonymous_id ON contacts(anonymous_id);
