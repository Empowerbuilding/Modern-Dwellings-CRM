-- Add Trestle reverse phone enrichment columns
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS trestle_line_type text,
  ADD COLUMN IF NOT EXISTS trestle_carrier text,
  ADD COLUMN IF NOT EXISTS trestle_is_prepaid boolean,
  ADD COLUMN IF NOT EXISTS trestle_is_commercial boolean,
  ADD COLUMN IF NOT EXISTS trestle_owner_name text,
  ADD COLUMN IF NOT EXISTS trestle_owner_type text,
  ADD COLUMN IF NOT EXISTS trestle_owner_age_range text,
  ADD COLUMN IF NOT EXISTS trestle_owner_gender text,
  ADD COLUMN IF NOT EXISTS trestle_address text,
  ADD COLUMN IF NOT EXISTS trestle_city text,
  ADD COLUMN IF NOT EXISTS trestle_state text,
  ADD COLUMN IF NOT EXISTS trestle_zip text,
  ADD COLUMN IF NOT EXISTS trestle_emails text[],
  ADD COLUMN IF NOT EXISTS trestle_enriched_at timestamptz;
