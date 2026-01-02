-- ============================================
-- Migrate Existing Notes from TEXT Fields
-- Moves legacy notes from contacts/deals/companies tables to the new notes table
-- ============================================

-- Migrate existing contact notes to the notes table
INSERT INTO notes (contact_id, content, created_at, updated_at)
SELECT
  id as contact_id,
  notes as content,
  COALESCE(updated_at, created_at, now()) as created_at,
  COALESCE(updated_at, created_at, now()) as updated_at
FROM contacts
WHERE notes IS NOT NULL
  AND notes != ''
  AND NOT EXISTS (
    -- Don't duplicate if already migrated
    SELECT 1 FROM notes n
    WHERE n.contact_id = contacts.id
    AND n.content = contacts.notes
  );

-- Migrate existing deal notes to the notes table
INSERT INTO notes (deal_id, content, created_at, updated_at)
SELECT
  id as deal_id,
  notes as content,
  COALESCE(updated_at, created_at, now()) as created_at,
  COALESCE(updated_at, created_at, now()) as updated_at
FROM deals
WHERE notes IS NOT NULL
  AND notes != ''
  AND NOT EXISTS (
    SELECT 1 FROM notes n
    WHERE n.deal_id = deals.id
    AND n.content = deals.notes
  );

-- Migrate existing company notes to the notes table
INSERT INTO notes (company_id, content, created_at, updated_at)
SELECT
  id as company_id,
  notes as content,
  COALESCE(updated_at, created_at, now()) as created_at,
  COALESCE(updated_at, created_at, now()) as updated_at
FROM companies
WHERE notes IS NOT NULL
  AND notes != ''
  AND NOT EXISTS (
    SELECT 1 FROM notes n
    WHERE n.company_id = companies.id
    AND n.content = companies.notes
  );

-- NOTE: The old TEXT notes fields are preserved for backward compatibility.
-- Once you've verified the migration is successful and updated any forms
-- that reference the old field, you can remove them with:
--
-- ALTER TABLE contacts DROP COLUMN notes;
-- ALTER TABLE deals DROP COLUMN notes;
-- ALTER TABLE companies DROP COLUMN notes;
