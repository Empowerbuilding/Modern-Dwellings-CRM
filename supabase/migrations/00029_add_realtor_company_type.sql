-- ============================================
-- Add 'realtor' to company type enum
-- ============================================

-- Update companies table type constraint
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_type_check;

ALTER TABLE companies ADD CONSTRAINT companies_type_check
  CHECK (type IN ('builder', 'consumer', 'subcontractor', 'engineer', 'architect', 'realtor'));

-- Update contacts table client_type constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_client_type_check;

ALTER TABLE contacts ADD CONSTRAINT contacts_client_type_check
  CHECK (client_type IN ('builder', 'consumer', 'subcontractor', 'engineer', 'architect', 'realtor'));
