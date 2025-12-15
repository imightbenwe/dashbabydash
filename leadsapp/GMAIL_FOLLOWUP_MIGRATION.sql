-- Migration: Add automated Gmail follow-up tracking fields
-- Date: December 12, 2025
-- Purpose: Track automated follow-up emails sent via Gmail

-- Add follow-up tracking columns to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS followup_1_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS followup_2_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS followup_3_sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS initial_email_subject TEXT;

-- Add index for querying leads that need follow-ups
CREATE INDEX IF NOT EXISTS idx_leads_date_contacted ON leads(date_contacted);
CREATE INDEX IF NOT EXISTS idx_leads_followup_1 ON leads(followup_1_sent_at);
CREATE INDEX IF NOT EXISTS idx_leads_followup_2 ON leads(followup_2_sent_at);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- Update generated_emails table to support more follow-up types
ALTER TABLE generated_emails 
DROP CONSTRAINT IF EXISTS generated_emails_email_type_check;

ALTER TABLE generated_emails 
ADD CONSTRAINT generated_emails_email_type_check 
CHECK (email_type IN ('initial', 'follow_up_1', 'follow_up_2', 'follow_up_3', 'auto_followup_1', 'auto_followup_2', 'auto_followup_3', 'response'));

-- Comment documentation
COMMENT ON COLUMN leads.followup_1_sent_at IS 'Timestamp when first automated follow-up (3 days) was sent via Gmail';
COMMENT ON COLUMN leads.followup_2_sent_at IS 'Timestamp when second automated follow-up (5-7 days) was sent via Gmail';
COMMENT ON COLUMN leads.followup_3_sent_at IS 'Timestamp when third automated follow-up (7-10 days) was sent via Gmail';
COMMENT ON COLUMN leads.initial_email_subject IS 'Subject line of the initial email for threading follow-ups';
