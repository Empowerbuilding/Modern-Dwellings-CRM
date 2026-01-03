-- ============================================
-- Meeting Scheduler System
-- HubSpot-style bookable meeting links
-- ============================================

-- ============================================
-- 1. Calendar Integrations (Google OAuth tokens)
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  email_address TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  calendar_id TEXT DEFAULT 'primary',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Indexes
CREATE INDEX idx_calendar_integrations_user_id ON calendar_integrations(user_id);

-- RLS
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;

-- Users can only see their own calendar integrations
CREATE POLICY "Users can view own calendar integrations"
  ON calendar_integrations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can only insert their own calendar integrations
CREATE POLICY "Users can insert own calendar integrations"
  ON calendar_integrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own calendar integrations
CREATE POLICY "Users can update own calendar integrations"
  ON calendar_integrations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can only delete their own calendar integrations
CREATE POLICY "Users can delete own calendar integrations"
  ON calendar_integrations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Updated at trigger
CREATE TRIGGER update_calendar_integrations_updated_at
  BEFORE UPDATE ON calendar_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 2. Meeting Types (Bookable meeting links)
-- ============================================

CREATE TABLE IF NOT EXISTS meeting_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_before INTEGER DEFAULT 0,
  buffer_after INTEGER DEFAULT 15,
  availability_start TIME DEFAULT '08:00',
  availability_end TIME DEFAULT '17:00',
  available_days INTEGER[] DEFAULT '{1,2,3,4,5}',
  timezone TEXT DEFAULT 'America/Chicago',
  max_days_ahead INTEGER DEFAULT 60,
  min_notice_hours INTEGER DEFAULT 4,
  is_active BOOLEAN DEFAULT true,
  location_type TEXT DEFAULT 'phone' CHECK (location_type IN ('google_meet', 'phone', 'in_person', 'custom')),
  custom_location TEXT,
  custom_fields JSONB DEFAULT '[]',
  confirmation_message TEXT,
  brand_color TEXT DEFAULT '#2d3748',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_meeting_types_user_id ON meeting_types(user_id);
CREATE INDEX idx_meeting_types_slug ON meeting_types(slug);
CREATE INDEX idx_meeting_types_is_active ON meeting_types(is_active);

-- RLS
ALTER TABLE meeting_types ENABLE ROW LEVEL SECURITY;

-- Anyone can view active meeting types (for public booking page)
CREATE POLICY "Anyone can view active meeting types"
  ON meeting_types FOR SELECT
  USING (is_active = true);

-- Users can view all their own meeting types (including inactive)
CREATE POLICY "Users can view own meeting types"
  ON meeting_types FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own meeting types
CREATE POLICY "Users can insert own meeting types"
  ON meeting_types FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own meeting types
CREATE POLICY "Users can update own meeting types"
  ON meeting_types FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own meeting types
CREATE POLICY "Users can delete own meeting types"
  ON meeting_types FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Updated at trigger
CREATE TRIGGER update_meeting_types_updated_at
  BEFORE UPDATE ON meeting_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 3. Scheduled Meetings (Booked appointments)
-- ============================================

CREATE TABLE IF NOT EXISTS scheduled_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_type_id UUID REFERENCES meeting_types(id) ON DELETE SET NULL,
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  guest_first_name TEXT NOT NULL,
  guest_last_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  guest_notes TEXT,
  custom_field_responses JSONB DEFAULT '{}',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL,
  google_event_id TEXT,
  google_meet_link TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')),
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  rescheduled_from UUID REFERENCES scheduled_meetings(id),
  anonymous_id TEXT,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scheduled_meetings_meeting_type_id ON scheduled_meetings(meeting_type_id);
CREATE INDEX idx_scheduled_meetings_host_user_id ON scheduled_meetings(host_user_id);
CREATE INDEX idx_scheduled_meetings_contact_id ON scheduled_meetings(contact_id);
CREATE INDEX idx_scheduled_meetings_status ON scheduled_meetings(status);
CREATE INDEX idx_scheduled_meetings_start_time ON scheduled_meetings(start_time);
CREATE INDEX idx_scheduled_meetings_anonymous_id ON scheduled_meetings(anonymous_id);
CREATE INDEX idx_scheduled_meetings_guest_email ON scheduled_meetings(guest_email);

-- RLS
ALTER TABLE scheduled_meetings ENABLE ROW LEVEL SECURITY;

-- Users can view meetings where they are the host
CREATE POLICY "Users can view own hosted meetings"
  ON scheduled_meetings FOR SELECT
  TO authenticated
  USING (host_user_id = auth.uid());

-- Anyone can insert (for public booking) - will use service role for actual inserts
CREATE POLICY "Anyone can book meetings"
  ON scheduled_meetings FOR INSERT
  WITH CHECK (true);

-- Users can update their own hosted meetings
CREATE POLICY "Users can update own hosted meetings"
  ON scheduled_meetings FOR UPDATE
  TO authenticated
  USING (host_user_id = auth.uid())
  WITH CHECK (host_user_id = auth.uid());

-- Users can delete their own hosted meetings
CREATE POLICY "Users can delete own hosted meetings"
  ON scheduled_meetings FOR DELETE
  TO authenticated
  USING (host_user_id = auth.uid());

-- Updated at trigger
CREATE TRIGGER update_scheduled_meetings_updated_at
  BEFORE UPDATE ON scheduled_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 4. Update activities table activity_type CHECK constraint
-- ============================================

-- Drop existing constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;

-- Add new constraint with meeting types
ALTER TABLE activities ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type IN (
    'page_view',
    'form_submit',
    'email_open',
    'email_click',
    'contact_created',
    'deal_created',
    'deal_stage_changed',
    'note_added',
    'task_created',
    'task_completed',
    'meeting_scheduled',
    'meeting_cancelled'
  ));


-- ============================================
-- 5. Seed test meeting type for Larry Madison
-- ============================================

-- Ensure Larry's user exists
INSERT INTO users (id, email, name, role) VALUES
  ('22222222-2222-2222-2222-222222222222', 'larry@barnhaussteelbuilders.com', 'Larry Madison', 'sales')
ON CONFLICT (email) DO NOTHING;

INSERT INTO meeting_types (
  user_id,
  slug,
  title,
  description,
  duration_minutes,
  buffer_before,
  buffer_after,
  availability_start,
  availability_end,
  available_days,
  timezone,
  max_days_ahead,
  min_notice_hours,
  is_active,
  location_type,
  custom_fields,
  confirmation_message,
  brand_color
) VALUES (
  '22222222-2222-2222-2222-222222222222',
  'larry-30min',
  '30 Minute Consultation',
  'Schedule a call to discuss your steel building project with Larry.',
  30,
  0,
  15,
  '08:00',
  '17:00',
  '{1,2,3,4,5}',
  'America/Chicago',
  60,
  4,
  true,
  'phone',
  '[
    {
      "id": "preferred_sqft",
      "label": "Preferred Square Footage",
      "type": "text",
      "required": true,
      "placeholder": "e.g., 2,500 sq ft"
    },
    {
      "id": "budget_range",
      "label": "Target Budget Range",
      "type": "select",
      "required": true,
      "options": [
        "Under $100k",
        "$100k-$250k",
        "$250k-$500k",
        "Over $500k"
      ]
    }
  ]',
  'Thank you for scheduling a consultation! Larry will call you at the scheduled time to discuss your steel building project.',
  '#2d3748'
) ON CONFLICT (slug) DO NOTHING;
