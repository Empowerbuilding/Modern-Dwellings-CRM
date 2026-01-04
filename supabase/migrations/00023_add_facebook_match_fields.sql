-- ============================================
-- Add Facebook match quality fields for CAPI
-- ============================================

-- Add fbp (Facebook browser pixel ID)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS fbp TEXT;

-- Add client IP address (captured at form submission)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS client_ip_address TEXT;

-- Add client user agent (captured at form submission)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS client_user_agent TEXT;

-- Add comments for documentation
COMMENT ON COLUMN contacts.fbp IS 'Facebook browser pixel ID (_fbp cookie) for CAPI match quality';
COMMENT ON COLUMN contacts.client_ip_address IS 'Client IP address captured at lead submission for CAPI';
COMMENT ON COLUMN contacts.client_user_agent IS 'Client user agent captured at lead submission for CAPI';
