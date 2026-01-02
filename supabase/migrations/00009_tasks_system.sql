-- Task management system
-- Creates tasks table with relationships to contacts, deals, companies, and users

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Relationships (all optional - task can be standalone)
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Task details
  title TEXT NOT NULL,
  description TEXT,

  -- Task classification
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  task_type TEXT NOT NULL DEFAULT 'to_do' CHECK (task_type IN ('to_do', 'call', 'email', 'meeting', 'follow_up')),

  -- Due date and time
  due_date DATE,
  due_time TIME,
  reminder_at TIMESTAMPTZ,

  -- Status
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id ON tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id ON tasks(deal_id);
CREATE INDEX IF NOT EXISTS idx_tasks_company_id ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);

-- Composite index for filtering incomplete tasks by due date
CREATE INDEX IF NOT EXISTS idx_tasks_incomplete_due ON tasks(completed, due_date) WHERE completed = false;

-- Updated at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- All authenticated users can read all tasks
CREATE POLICY "Users can view all tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can create tasks
CREATE POLICY "Users can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Users can update any task (for reassignment, completion, etc.)
CREATE POLICY "Users can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Users can delete any task
CREATE POLICY "Users can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (true);
