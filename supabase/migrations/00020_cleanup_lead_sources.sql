-- ============================================
-- Remove unused lead sources and update constraint
-- ============================================

-- First, migrate any existing contacts with removed sources to 'other'
UPDATE contacts
SET lead_source = 'other', updated_at = NOW()
WHERE lead_source IN (
  'facebook',
  'facebook_ad',
  'google',
  'website',
  'contact_form',
  'cold',
  'repeat'
);

-- Drop the existing constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_lead_source_check;

-- Add the updated constraint with only valid lead sources
ALTER TABLE contacts ADD CONSTRAINT contacts_lead_source_check
  CHECK (lead_source IN (
    'facebook_lead_ad',
    'referral',
    'cost_calc',
    'guide_download',
    'empower_website',
    'barnhaus_contact',
    'barnhaus_store_contact',
    'shopify_order',
    'calendar_booking',
    'other'
  ));

-- Also backfill calendar_booking contacts to consumer type
UPDATE contacts
SET client_type = 'consumer', updated_at = NOW()
WHERE lead_source = 'calendar_booking'
AND client_type IS NULL;
