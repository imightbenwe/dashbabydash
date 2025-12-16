-- Email Queue Table for Manual Approval System
-- Run this in Supabase SQL Editor

-- Table to store approved emails waiting to be sent
CREATE TABLE IF NOT EXISTS email_send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  email_type VARCHAR(20) NOT NULL CHECK (email_type IN ('initial', 'followup_1', 'followup_2', 'followup_3')),
  to_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'sending', 'sent', 'failed')),
  approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL: Prevent duplicate emails
-- Only ONE pending/approved email per lead per type at a time
-- This is a partial unique index (not inline constraint)
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_email 
  ON email_send_queue(lead_id, email_type) 
  WHERE status IN ('approved', 'sending');

-- Index for fast queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled 
  ON email_send_queue(status, scheduled_for) 
  WHERE status = 'approved';

-- Index for checking duplicates
CREATE INDEX IF NOT EXISTS idx_email_queue_lead_type 
  ON email_send_queue(lead_id, email_type);

-- Function to check if we can queue an email (prevents duplicates)
CREATE OR REPLACE FUNCTION can_queue_email(p_lead_id UUID, p_email_type VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  existing_count INTEGER;
BEGIN
  -- Check if there's already a pending/approved/sending email of this type for this lead
  SELECT COUNT(*) INTO existing_count
  FROM email_send_queue
  WHERE lead_id = p_lead_id 
    AND email_type = p_email_type 
    AND status IN ('approved', 'sending');
  
  RETURN existing_count = 0;
END;
$$ LANGUAGE plpgsql;

-- View to see the current queue status
CREATE OR REPLACE VIEW email_queue_status AS
SELECT 
  q.id,
  q.lead_id,
  l.name as lead_name,
  l.email as lead_email,
  l.company,
  q.email_type,
  q.subject,
  q.scheduled_for,
  q.status,
  q.approved_at,
  q.sent_at,
  q.error_message
FROM email_send_queue q
JOIN leads l ON l.id = q.lead_id
ORDER BY q.scheduled_for ASC;

-- CRITICAL: Atomic claim function to prevent race conditions
-- This function claims ONE email atomically - if two processes call it simultaneously,
-- each gets a DIFFERENT email (or one gets nothing)
CREATE OR REPLACE FUNCTION claim_next_email(max_scheduled TIMESTAMPTZ)
RETURNS SETOF email_send_queue AS $$
BEGIN
  RETURN QUERY
  UPDATE email_send_queue
  SET status = 'sending'
  WHERE id = (
    SELECT id FROM email_send_queue
    WHERE status = 'approved'
      AND scheduled_for <= max_scheduled
    ORDER BY scheduled_for ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED  -- This is the magic: skip rows already being processed
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;
