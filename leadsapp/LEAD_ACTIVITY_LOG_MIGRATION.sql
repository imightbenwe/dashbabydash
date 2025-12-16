-- Lead Activity Log Migration
-- Run this in Supabase SQL Editor

-- Table: lead_activity_log
-- Stores all activity/changes made to leads for audit trail
CREATE TABLE IF NOT EXISTS lead_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  
  -- What happened
  action_type TEXT NOT NULL CHECK (action_type IN (
    'status_change',
    'field_update', 
    'email_sent',
    'email_received',
    'email_bounced',
    'followup_detected',
    'analysis_run',
    'lead_created',
    'lead_scraped',
    'note_added'
  )),
  
  -- Who/what made the change
  source TEXT NOT NULL CHECK (source IN (
    'user',           -- Manual change via UI
    'gmail_sync',     -- Gmail integration
    'automation',     -- Background automation
    'ai_agent',       -- GitHub Copilot or AI assistant
    'api',            -- Direct API call
    'system'          -- System/migration
  )),
  
  -- Details of the change
  field_name TEXT,           -- Which field was changed (for field_update)
  old_value TEXT,            -- Previous value
  new_value TEXT,            -- New value
  description TEXT,          -- Human-readable description
  metadata JSONB,            -- Any additional data (email subject, etc.)
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_activity_log_lead_id ON lead_activity_log(lead_id);
CREATE INDEX idx_activity_log_created_at ON lead_activity_log(created_at DESC);
CREATE INDEX idx_activity_log_action_type ON lead_activity_log(action_type);

-- RLS Policy
ALTER TABLE lead_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated users" ON lead_activity_log
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON lead_activity_log TO authenticated;
GRANT ALL ON lead_activity_log TO service_role;
