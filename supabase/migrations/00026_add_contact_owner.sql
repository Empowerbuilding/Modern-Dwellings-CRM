-- Add owner_id column to contacts table
ALTER TABLE contacts
ADD COLUMN owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster owner lookups
CREATE INDEX idx_contacts_owner_id ON contacts(owner_id);

-- Comment for documentation
COMMENT ON COLUMN contacts.owner_id IS 'The CRM user who owns/is responsible for this contact';
