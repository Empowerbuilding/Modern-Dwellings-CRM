-- Add 'marketing' to deal_type check constraint

-- Drop the existing constraint
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_deal_type_check;

-- Add the new constraint with 'marketing' included
ALTER TABLE deals ADD CONSTRAINT deals_deal_type_check
  CHECK (deal_type IN ('custom_design', 'builder_design', 'engineering', 'software_fees', 'referral', 'budget_builder', 'marketing'));
