-- ============================================
-- Update Deal Types for Construction Builder Workflow
-- ============================================

-- Step 1: Migrate existing deal types to new values
-- Map old types to most appropriate new types:
-- custom_design, builder_design -> new_construction (primary build work)
-- engineering -> new_construction (structural work)
-- remodel-related work -> remodel
-- addition-related work -> addition
-- software_fees, referral, budget_builder, marketing -> NULL (clear these)

UPDATE deals SET deal_type = 'new_construction'
WHERE deal_type IN ('custom_design', 'builder_design', 'engineering');

UPDATE deals SET deal_type = NULL
WHERE deal_type IN ('software_fees', 'referral', 'budget_builder', 'marketing');

-- Step 2: Drop the old constraint and add new one
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_deal_type_check;

ALTER TABLE deals ADD CONSTRAINT deals_deal_type_check
  CHECK (deal_type IN ('new_construction', 'remodel', 'addition'));
