-- Migration: Add Gmail threading fields for proper reply threading
-- Date: December 16, 2025
-- Purpose: Store thread_id and message_id so follow-ups are sent as actual replies

-- Add threading columns to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT,
ADD COLUMN IF NOT EXISTS gmail_message_id TEXT;

-- Add index for thread lookups
CREATE INDEX IF NOT EXISTS idx_leads_gmail_thread_id ON leads(gmail_thread_id);

-- Comments
COMMENT ON COLUMN leads.gmail_thread_id IS 'Gmail thread ID of initial email conversation - used to send follow-ups as replies';
COMMENT ON COLUMN leads.gmail_message_id IS 'Gmail message ID of the most recent email - used for In-Reply-To header';

