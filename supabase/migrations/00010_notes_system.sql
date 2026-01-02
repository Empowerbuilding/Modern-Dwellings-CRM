-- ============================================
-- Segmented Notes System
-- Replaces single notes TEXT field with proper note records
-- ============================================

CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Can be linked to any/multiple entities
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,

  -- Note content
  content TEXT NOT NULL,

  -- Author tracking
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notes_contact_id ON notes(contact_id);
CREATE INDEX idx_notes_deal_id ON notes(deal_id);
CREATE INDEX idx_notes_company_id ON notes(company_id);
CREATE INDEX idx_notes_task_id ON notes(task_id);
CREATE INDEX idx_notes_created_by ON notes(created_by);
CREATE INDEX idx_notes_created_at ON notes(created_at DESC);

-- RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view all notes
CREATE POLICY "Users can view all notes"
  ON notes FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create notes
CREATE POLICY "Users can create notes"
  ON notes FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update their own notes
CREATE POLICY "Users can update own notes"
  ON notes FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Users can delete their own notes
CREATE POLICY "Users can delete own notes"
  ON notes FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Updated at trigger
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- NOTE: Keep the existing notes TEXT field on contacts/deals/companies for now
-- We can migrate existing notes data later and then remove the field
