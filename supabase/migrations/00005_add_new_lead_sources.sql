-- ============================================
-- Add new lead source options
-- ============================================

-- Drop the existing constraint on contacts.lead_source
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_lead_source_check;

-- Add the updated constraint with all lead sources
ALTER TABLE contacts ADD CONSTRAINT contacts_lead_source_check
  CHECK (lead_source IN (
    'facebook',
    'facebook_ad',
    'google',
    'referral',
    'website',
    'contact_form',
    'cost_calc',
    'cold',
    'repeat',
    'guide_download',
    'empower_website',
    'barnhaus_contact',
    'other'
  ));
