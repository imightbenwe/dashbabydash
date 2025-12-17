-- Add columns to track skipped follow-ups (removed from queue by user)
-- Run this in Supabase SQL Editor

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS followup_1_skipped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS followup_2_skipped BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS followup_3_skipped BOOLEAN DEFAULT FALSE;

-- Add comment for documentation
COMMENT ON COLUMN leads.followup_1_skipped IS 'True if user manually removed FU1 from queue (skipped, not sent)';
COMMENT ON COLUMN leads.followup_2_skipped IS 'True if user manually removed FU2 from queue (skipped, not sent)';
COMMENT ON COLUMN leads.followup_3_skipped IS 'True if user manually removed FU3 from queue (skipped, not sent)';
