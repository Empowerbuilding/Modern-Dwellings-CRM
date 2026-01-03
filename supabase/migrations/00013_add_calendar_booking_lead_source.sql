-- ============================================
-- Add calendar_booking lead source
-- ============================================

-- Drop the existing constraint on contacts.lead_source
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_lead_source_check;

-- Fix any existing rows with invalid lead_source values
UPDATE contacts
SET lead_source = 'website'
WHERE lead_source IS NOT NULL
  AND lead_source NOT IN (
    'facebook', 'facebook_ad', 'google', 'referral', 'website',
    'contact_form', 'cost_calc', 'cold', 'repeat', 'guide_download',
    'empower_website', 'barnhaus_contact', 'calendar_booking', 'other'
  );

-- Add the updated constraint with calendar_booking
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
    'calendar_booking',
    'other'
  ));
