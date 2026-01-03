-- ============================================
-- Add missing lead sources (shopify_order, barnhaus_store_contact)
-- ============================================

-- Drop the existing constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_lead_source_check;

-- Add the updated constraint with all lead sources from lib/types.ts
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
    'barnhaus_store_contact',
    'shopify_order',
    'calendar_booking',
    'other'
  ));
