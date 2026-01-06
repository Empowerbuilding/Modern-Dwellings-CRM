-- Backfill deals for existing MQL contacts that don't have a deal yet
-- Consumer contacts go to B2C pipeline, all others go to B2B pipeline

-- Insert deals for MQL contacts without existing deals
INSERT INTO deals (contact_id, company_id, title, stage, sales_type)
SELECT
  c.id as contact_id,
  c.company_id,
  c.first_name || ' ' || c.last_name || ' - ' || COALESCE(
    CASE c.lead_source
      WHEN 'facebook_lead_ad' THEN 'Facebook Lead Ad'
      WHEN 'referral' THEN 'Referral'
      WHEN 'cost_calc' THEN 'Cost Calculator'
      WHEN 'guide_download' THEN 'Guide Download'
      WHEN 'empower_website' THEN 'Empower Website'
      WHEN 'barnhaus_contact' THEN 'Barnhaus Contact'
      WHEN 'barnhaus_store_contact' THEN 'Barnhaus Store'
      WHEN 'shopify_order' THEN 'Shopify Order'
      WHEN 'calendar_booking' THEN 'Calendar Booking'
      WHEN 'other' THEN 'Other'
      ELSE c.lead_source
    END,
    'Lead'
  ) as title,
  'qualified' as stage,
  CASE WHEN c.client_type = 'consumer' THEN 'b2c' ELSE 'b2b' END as sales_type
FROM contacts c
WHERE c.lifecycle_stage = 'mql'
  AND NOT EXISTS (
    SELECT 1 FROM deals d WHERE d.contact_id = c.id
  );

-- Log activities for the newly created deals
INSERT INTO activities (contact_id, deal_id, activity_type, title, description, metadata)
SELECT
  d.contact_id,
  d.id as deal_id,
  'deal_created' as activity_type,
  'Deal auto-created: ' || d.title as title,
  'Deal automatically created via migration backfill for existing MQL contact' as description,
  jsonb_build_object(
    'sales_type', d.sales_type,
    'auto_created', true,
    'trigger', 'migration_backfill'
  ) as metadata
FROM deals d
JOIN contacts c ON c.id = d.contact_id
WHERE c.lifecycle_stage = 'mql'
  AND d.created_at >= NOW() - INTERVAL '1 minute';  -- Only for deals just created
