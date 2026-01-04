-- ============================================
-- Backfill client_type = 'consumer' for existing contacts
-- with consumer-oriented lead sources
-- ============================================

UPDATE contacts
SET client_type = 'consumer', updated_at = NOW()
WHERE lead_source IN (
  'cost_calc',
  'facebook_lead_ad',
  'shopify_order',
  'barnhaus_store_contact',
  'guide_download',
  'barnhaus_contact'
)
AND client_type IS NULL;
