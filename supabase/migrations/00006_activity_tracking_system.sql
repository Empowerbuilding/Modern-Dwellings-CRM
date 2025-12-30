-- ============================================
-- Activity Tracking System Migration
-- Replaces task-oriented activities with event tracking
-- ============================================

-- Drop existing activities table and recreate with new schema
-- Note: This will lose existing activities data. If you need to preserve it,
-- rename the old table first: ALTER TABLE activities RENAME TO activities_legacy;

DROP TRIGGER IF EXISTS update_activities_updated_at ON activities;
DROP POLICY IF EXISTS "Allow all on activities" ON activities;
DROP TABLE IF EXISTS activities;

-- Create new activities table for event/interaction tracking
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'page_view',
    'form_submit',
    'email_sent',
    'sms_sent',
    'call',
    'note',
    'stage_change',
    'deal_created',
    'contact_created'
  )),
  title TEXT NOT NULL,
  description TEXT,
  metadata JSONB,
  anonymous_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for common query patterns
CREATE INDEX idx_activities_contact_id ON activities(contact_id);
CREATE INDEX idx_activities_deal_id ON activities(deal_id);
CREATE INDEX idx_activities_company_id ON activities(company_id);
CREATE INDEX idx_activities_user_id ON activities(user_id);
CREATE INDEX idx_activities_anonymous_id ON activities(anonymous_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_activities_activity_type ON activities(activity_type);

-- Composite index for anonymous linking queries
CREATE INDEX idx_activities_anon_contact ON activities(anonymous_id, contact_id)
  WHERE anonymous_id IS NOT NULL;

-- Enable RLS
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all authenticated users to view and create activities
-- In a multi-tenant system, you'd restrict this to the user's tenant
CREATE POLICY "Allow all on activities"
  ON activities
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comment on table and columns for documentation
COMMENT ON TABLE activities IS 'Tracks all contact and deal interactions including page views, form submissions, communications, and status changes';
COMMENT ON COLUMN activities.activity_type IS 'Type of activity: page_view, form_submit, email_sent, sms_sent, call, note, stage_change, deal_created, contact_created';
COMMENT ON COLUMN activities.metadata IS 'Flexible JSON data like page URL, email subject, old/new stage values, etc.';
COMMENT ON COLUMN activities.anonymous_id IS 'Identifier for tracking anonymous visitors before form submission';
