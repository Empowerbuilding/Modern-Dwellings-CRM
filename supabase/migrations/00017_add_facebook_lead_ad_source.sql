-- ============================================
-- Add facebook_lead_ad lead source for Facebook Lead Ads via n8n
-- ============================================

-- Drop the existing constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_lead_source_check;

-- Add the updated constraint with facebook_lead_ad
ALTER TABLE contacts ADD CONSTRAINT contacts_lead_source_check
  CHECK (lead_source IN (
    'facebook',
    'facebook_ad',
    'facebook_lead_ad',
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
