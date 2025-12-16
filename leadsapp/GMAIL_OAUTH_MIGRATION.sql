-- Migration: Add Gmail OAuth integration tables
-- Date: December 15, 2025
-- Purpose: Store Gmail OAuth tokens and sync history for automatic email tracking

-- Create user_gmail_auth table for OAuth tokens
CREATE TABLE IF NOT EXISTS user_gmail_auth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL UNIQUE, -- The Gmail address being synced
  access_token TEXT, -- Current access token (expires in 1 hour)
  refresh_token TEXT NOT NULL, -- Long-lived refresh token
  token_expiry TIMESTAMPTZ, -- When access_token expires
  scope TEXT NOT NULL, -- Granted scopes
  gmail_sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create gmail_sync_log table for tracking sync history
CREATE TABLE IF NOT EXISTS gmail_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL CHECK (sync_type IN ('sent', 'inbox', 'both')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('running', 'completed', 'failed')),
  emails_processed INTEGER DEFAULT 0,
  leads_updated INTEGER DEFAULT 0,
  error_message TEXT,
  last_history_id TEXT, -- Gmail API history ID for incremental sync
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create gmail_message_cache table to avoid reprocessing same emails
CREATE TABLE IF NOT EXISTS gmail_message_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id TEXT NOT NULL UNIQUE, -- Gmail's unique message ID
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  thread_id TEXT, -- Gmail thread ID
  message_type TEXT CHECK (message_type IN ('sent', 'received')),
  subject TEXT,
  from_email TEXT,
  to_email TEXT,
  sent_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  followup_number INTEGER CHECK (followup_number IN (1, 2, 3)), -- If matched to followup
  status_updated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_gmail_sync_log_status ON gmail_sync_log(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmail_message_cache_lead_id ON gmail_message_cache(lead_id);
CREATE INDEX IF NOT EXISTS idx_gmail_message_cache_thread_id ON gmail_message_cache(thread_id);
CREATE INDEX IF NOT EXISTS idx_gmail_message_cache_sent_at ON gmail_message_cache(sent_at DESC);

-- Comments
COMMENT ON TABLE user_gmail_auth IS 'Stores Gmail OAuth tokens for automatic email sync';
COMMENT ON TABLE gmail_sync_log IS 'Tracks Gmail sync operations and their results';
COMMENT ON TABLE gmail_message_cache IS 'Prevents reprocessing of already-synced Gmail messages';
COMMENT ON COLUMN user_gmail_auth.refresh_token IS 'Long-lived token that never expires (unless revoked)';
COMMENT ON COLUMN gmail_sync_log.last_history_id IS 'Gmail history ID for incremental syncs (only fetch new emails)';
