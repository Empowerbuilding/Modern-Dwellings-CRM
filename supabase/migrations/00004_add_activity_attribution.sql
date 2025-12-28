-- ============================================
-- Activity User Attribution
-- Tracks which user created each activity
-- ============================================

-- Add created_by_id to activities
ALTER TABLE activities
ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_activities_created_by_id ON activities(created_by_id);
