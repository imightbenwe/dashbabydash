-- Create blacklisted_domains table
CREATE TABLE IF NOT EXISTS blacklisted_domains (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  domain VARCHAR(255) NOT NULL UNIQUE,
  reason TEXT,
  blacklisted_by VARCHAR(255),
  blacklisted_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster domain lookups
CREATE INDEX idx_blacklisted_domains_domain ON blacklisted_domains(domain);

-- Add blacklist_reason column to leads table to track why a lead was blacklisted
ALTER TABLE leads ADD COLUMN IF NOT EXISTS blacklist_reason TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT FALSE;

-- Function to check if a domain is blacklisted
CREATE OR REPLACE FUNCTION is_domain_blacklisted(check_domain TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM blacklisted_domains 
    WHERE domain = LOWER(check_domain)
  );
END;
$$ LANGUAGE plpgsql;

-- Update existing leads with salvajeretreat.com to Lost status
UPDATE leads 
SET 
  status = 'lost',
  is_blacklisted = TRUE,
  blacklist_reason = 'Domain salvajeretreat.com is blacklisted - email address was incorrectly associated with multiple leads'
WHERE 
  email ILIKE '%@salvajeretreat.com' 
  OR website ILIKE '%salvajeretreat.com%';

-- Insert initial blacklisted domain
INSERT INTO blacklisted_domains (domain, reason, blacklisted_by)
VALUES (
  'salvajeretreat.com',
  'Email address incorrectly associated with multiple leads. Business owner confirmed they do not know these people.',
  'system'
)
ON CONFLICT (domain) DO NOTHING;
