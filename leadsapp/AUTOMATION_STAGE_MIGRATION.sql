-- Add automation stage fields to leads table
-- Run this in Supabase SQL Editor

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS automation_stage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS automation_stage_updated_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS automation_error TEXT;

-- Create index for faster automation queries
CREATE INDEX IF NOT EXISTS idx_leads_automation_stage ON leads(automation_stage);
CREATE INDEX IF NOT EXISTS idx_leads_automation_stage_updated ON leads(automation_stage_updated_at);

-- Add comment for documentation
COMMENT ON COLUMN leads.automation_stage IS 'Automation progress: 0=Lead Collected, 1=Website Scraped, 2=AI Analysis Complete, -1=Error/Failed';
COMMENT ON COLUMN leads.automation_stage_updated_at IS 'Timestamp when automation stage was last updated';
COMMENT ON COLUMN leads.automation_error IS 'Error message if automation failed at current stage';
