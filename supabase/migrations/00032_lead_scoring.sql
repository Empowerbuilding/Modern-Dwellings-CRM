-- Add lead scoring columns to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score TEXT CHECK (lead_score IN ('hot', 'medium', 'cold'));
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score_reason TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN contacts.lead_score IS 'Deterministic lead score: hot, medium, or cold';
COMMENT ON COLUMN contacts.lead_score_reason IS 'Short explanation of why this score was assigned';
COMMENT ON COLUMN contacts.lead_score_updated_at IS 'When the score was last calculated';
