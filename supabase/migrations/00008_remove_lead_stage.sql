-- ============================================
-- Remove 'lead' stage from pipeline
-- Pipelines now start with 'qualified'
-- ============================================

-- Update any existing deals with 'lead' stage to 'qualified'
UPDATE deals SET stage = 'qualified' WHERE stage = 'lead';

-- Drop the old constraint and add new one without 'lead'
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;
ALTER TABLE deals ADD CONSTRAINT deals_stage_check
  CHECK (stage IN ('qualified', 'concept', 'design', 'engineering', 'proposal', 'active', 'complete', 'lost'));

-- Update the default value
ALTER TABLE deals ALTER COLUMN stage SET DEFAULT 'qualified';
