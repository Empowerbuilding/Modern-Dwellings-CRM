-- ============================================
-- Add direct_phone_call lead source
-- ============================================

-- Drop the existing constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_lead_source_check;

-- Add the updated constraint with direct_phone_call
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
    'direct_phone_call',
    'other'
  ));
