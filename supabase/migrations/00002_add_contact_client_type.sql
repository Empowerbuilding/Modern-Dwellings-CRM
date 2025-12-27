-- Add client_type column to contacts table
-- Used for standalone contacts (without a company)
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS client_type TEXT
CHECK (client_type IN ('builder', 'consumer', 'subcontractor', 'engineer', 'architect'));

-- Create index for filtering by client_type
CREATE INDEX IF NOT EXISTS idx_contacts_client_type ON contacts(client_type);
