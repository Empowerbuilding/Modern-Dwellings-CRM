-- ============================================
-- Simplify Pipeline: Remove B2B, Keep Consumer Stages Only
-- ============================================

-- Step 1: Migrate existing deals to new stages
-- Old B2C stages: qualified, concept, design, engineering, complete, lost
-- Old B2B stages: qualified, proposal, active, complete, lost
-- New stages: new_lead, contacted, consultation_scheduled, consultation_complete,
--             proposal_sent, contract_signed, in_construction, completed, lost

-- Map old stages to new stages:
-- qualified -> new_lead (starting point)
-- concept/design/engineering -> contract_signed (these were "won" categories)
-- proposal -> proposal_sent
-- active -> in_construction
-- complete -> completed
-- lost -> lost

UPDATE deals SET stage = 'new_lead' WHERE stage = 'qualified';
UPDATE deals SET stage = 'contract_signed' WHERE stage IN ('concept', 'design', 'engineering');
UPDATE deals SET stage = 'proposal_sent' WHERE stage = 'proposal';
UPDATE deals SET stage = 'in_construction' WHERE stage = 'active';
UPDATE deals SET stage = 'completed' WHERE stage = 'complete';
-- lost stays as lost

-- Step 2: Drop the old stage constraint and add new one
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_stage_check;

ALTER TABLE deals ADD CONSTRAINT deals_stage_check
  CHECK (stage IN (
    'new_lead',
    'contacted',
    'consultation_scheduled',
    'consultation_complete',
    'proposal_sent',
    'contract_signed',
    'in_construction',
    'completed',
    'lost'
  ));

-- Step 3: Drop the sales_type column (no longer needed)
ALTER TABLE deals DROP COLUMN IF EXISTS sales_type;

-- Step 4: Update the default stage for new deals
ALTER TABLE deals ALTER COLUMN stage SET DEFAULT 'new_lead';
