-- Update lead sources to new values for construction builder workflow
-- New lead sources: cost_calculator, pdf_download, contact_form, facebook_ad, phone_call, email, other

-- First, drop the old constraint if it exists
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_lead_source_check;

-- Migrate existing values to new lead sources
UPDATE contacts SET lead_source = 'cost_calculator' WHERE lead_source IN ('cost_calc');
UPDATE contacts SET lead_source = 'pdf_download' WHERE lead_source IN ('guide_download');
UPDATE contacts SET lead_source = 'contact_form' WHERE lead_source IN ('barnhaus_contact', 'barnhaus_store_contact', 'empower_website');
UPDATE contacts SET lead_source = 'facebook_ad' WHERE lead_source IN ('facebook_lead_ad');
UPDATE contacts SET lead_source = 'phone_call' WHERE lead_source IN ('direct_phone_call');
UPDATE contacts SET lead_source = 'other' WHERE lead_source IN ('referral', 'shopify_order', 'calendar_booking') OR lead_source NOT IN ('cost_calculator', 'pdf_download', 'contact_form', 'facebook_ad', 'phone_call', 'email', 'other');

-- Add the new constraint
ALTER TABLE contacts ADD CONSTRAINT contacts_lead_source_check
  CHECK (lead_source IN ('cost_calculator', 'pdf_download', 'contact_form', 'facebook_ad', 'phone_call', 'email', 'other'));
