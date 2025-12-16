-- =====================================================
-- Phase 2: Enhanced Email Queue Migration
-- =====================================================
-- Run this in Supabase SQL Editor AFTER EMAIL_QUEUE_MIGRATION.sql
-- This adds retry logic, audit trails, and safety mechanisms.
-- =====================================================

-- =====================================================
-- 2.1. Enhanced Queue Table Columns
-- =====================================================

-- Add retry_count: how many times we've tried to send this email
ALTER TABLE email_send_queue 
ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

-- Add next_retry_at: when to retry (NULL = don't retry, use for gating retries)
-- IMPORTANT: We do NOT add a 'retry' status. Instead, failed emails with next_retry_at set
-- will be picked up again. This avoids complexity of multiple retry states.
ALTER TABLE email_send_queue 
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Add sending_started_at: when we started trying to send (for stuck job detection)
ALTER TABLE email_send_queue 
ADD COLUMN IF NOT EXISTS sending_started_at TIMESTAMPTZ;

-- Add idempotency_key: unique key to prevent duplicate sends even across crashes
ALTER TABLE email_send_queue 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64);

-- Add provider_message_id: Gmail's message ID after successful send (for tracking)
ALTER TABLE email_send_queue 
ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);

-- Update status check constraint to allow 'failed' emails to be retried
-- (We keep status simple: approved -> sending -> sent/failed)
-- Re-create the constraint if needed
ALTER TABLE email_send_queue 
DROP CONSTRAINT IF EXISTS email_send_queue_status_check;

ALTER TABLE email_send_queue 
ADD CONSTRAINT email_send_queue_status_check 
CHECK (status IN ('approved', 'sending', 'sent', 'failed'));

-- Index for retry processing
CREATE INDEX IF NOT EXISTS idx_email_queue_retry 
ON email_send_queue(status, next_retry_at) 
WHERE status = 'failed' AND next_retry_at IS NOT NULL;

-- Index for stuck job detection
CREATE INDEX IF NOT EXISTS idx_email_queue_stuck 
ON email_send_queue(status, sending_started_at) 
WHERE status = 'sending';

-- =====================================================
-- 2.2. Audit Trail: email_send_attempts
-- =====================================================

CREATE TABLE IF NOT EXISTS email_send_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES email_send_queue(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'success', 'failed', 'timeout')),
  provider_message_id VARCHAR(255),
  error_message TEXT,
  error_code VARCHAR(50),
  response_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick lookup by queue item
CREATE INDEX IF NOT EXISTS idx_send_attempts_queue ON email_send_attempts(queue_id);

-- Index for looking up attempts by lead
CREATE INDEX IF NOT EXISTS idx_send_attempts_lead ON email_send_attempts(lead_id);

-- =====================================================
-- 2.3. Batch Claim Function: claim_next_emails
-- =====================================================
-- Claims multiple emails atomically for batch processing
-- Uses FOR UPDATE SKIP LOCKED to handle concurrent workers

CREATE OR REPLACE FUNCTION claim_next_emails(
  max_scheduled TIMESTAMPTZ,
  batch_size INTEGER DEFAULT 5
)
RETURNS SETOF email_send_queue AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id FROM email_send_queue
    WHERE (
      -- Normal approved emails ready to send
      (status = 'approved' AND scheduled_for <= max_scheduled)
      OR
      -- Failed emails ready for retry
      (status = 'failed' AND next_retry_at IS NOT NULL AND next_retry_at <= max_scheduled)
    )
    ORDER BY 
      -- Prioritize retries that have been waiting longest
      CASE WHEN status = 'failed' THEN 0 ELSE 1 END,
      scheduled_for ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE email_send_queue eq
  SET 
    status = 'sending',
    sending_started_at = NOW(),
    -- Clear retry gate since we're processing now
    next_retry_at = NULL
  FROM claimed c
  WHERE eq.id = c.id
  RETURNING eq.*;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2.4. Watchdog Function: recover_stuck_emails
-- =====================================================
-- Recovers emails that got stuck in 'sending' state (crashed worker)
-- Call this periodically (every 5 min) to clean up

CREATE OR REPLACE FUNCTION recover_stuck_emails(
  stuck_threshold_minutes INTEGER DEFAULT 10
)
RETURNS TABLE (
  recovered_count INTEGER,
  recovered_ids UUID[]
) AS $$
DECLARE
  threshold TIMESTAMPTZ;
  recovered UUID[];
BEGIN
  threshold := NOW() - (stuck_threshold_minutes || ' minutes')::INTERVAL;
  
  -- Find and recover stuck emails
  WITH recovered_rows AS (
    UPDATE email_send_queue
    SET 
      status = 'failed',
      error_message = 'Recovered from stuck sending state (timeout after ' || stuck_threshold_minutes || ' minutes)',
      retry_count = retry_count + 1,
      next_retry_at = CASE 
        WHEN retry_count < 3 THEN NOW() + ((retry_count + 1) * INTERVAL '5 minutes')
        ELSE NULL  -- Give up after 3 retries
      END,
      sending_started_at = NULL
    WHERE status = 'sending'
      AND sending_started_at < threshold
    RETURNING id
  )
  SELECT ARRAY_AGG(id) INTO recovered FROM recovered_rows;
  
  RETURN QUERY SELECT 
    COALESCE(ARRAY_LENGTH(recovered, 1), 0)::INTEGER,
    COALESCE(recovered, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2.5. Mark Email Sent Function
-- =====================================================
-- Helper to mark an email as successfully sent with all metadata

CREATE OR REPLACE FUNCTION mark_email_sent(
  p_queue_id UUID,
  p_provider_message_id VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE email_send_queue
  SET 
    status = 'sent',
    sent_at = NOW(),
    provider_message_id = p_provider_message_id,
    sending_started_at = NULL,
    next_retry_at = NULL
  WHERE id = p_queue_id
    AND status = 'sending';  -- Only if still in sending state
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2.6. Mark Email Failed Function
-- =====================================================
-- Helper to mark an email as failed with retry scheduling

CREATE OR REPLACE FUNCTION mark_email_failed(
  p_queue_id UUID,
  p_error_message TEXT,
  p_should_retry BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN AS $$
DECLARE
  current_retry_count INTEGER;
  updated_count INTEGER;
BEGIN
  -- Get current retry count
  SELECT retry_count INTO current_retry_count
  FROM email_send_queue WHERE id = p_queue_id;
  
  UPDATE email_send_queue
  SET 
    status = 'failed',
    error_message = p_error_message,
    sending_started_at = NULL,
    retry_count = retry_count + 1,
    next_retry_at = CASE 
      -- Only retry if requested and under limit (3 retries max)
      WHEN p_should_retry AND current_retry_count < 3 
        THEN NOW() + ((current_retry_count + 1) * INTERVAL '5 minutes')
      ELSE NULL  -- No more retries
    END
  WHERE id = p_queue_id
    AND status = 'sending';
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2.7. Trigger: Sync Email Address Changes
-- =====================================================
-- When a lead's email changes, update any pending queue items

CREATE OR REPLACE FUNCTION sync_queue_email_on_lead_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Only act if email actually changed
  IF OLD.email IS DISTINCT FROM NEW.email AND NEW.email IS NOT NULL THEN
    UPDATE email_send_queue
    SET to_email = NEW.email
    WHERE lead_id = NEW.id
      AND status IN ('approved', 'sending');
    
    -- Log this change if any rows were updated
    IF FOUND THEN
      INSERT INTO lead_activity_log (lead_id, activity_type, description, metadata)
      VALUES (
        NEW.id,
        'queue_email_updated',
        'Pending email address updated from ' || COALESCE(OLD.email, 'null') || ' to ' || NEW.email,
        jsonb_build_object('old_email', OLD.email, 'new_email', NEW.email)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger (drop first if exists)
DROP TRIGGER IF EXISTS trigger_sync_queue_email ON leads;

CREATE TRIGGER trigger_sync_queue_email
AFTER UPDATE OF email ON leads
FOR EACH ROW
EXECUTE FUNCTION sync_queue_email_on_lead_update();

-- =====================================================
-- 2.8. View: Enhanced Queue Status
-- =====================================================
-- Drop and recreate the view with new columns

DROP VIEW IF EXISTS email_queue_status;

CREATE VIEW email_queue_status AS
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
  q.error_message,
  q.retry_count,
  q.next_retry_at,
  q.sending_started_at,
  q.provider_message_id,
  -- Computed fields
  CASE 
    WHEN q.status = 'sending' AND q.sending_started_at < NOW() - INTERVAL '10 minutes'
    THEN TRUE ELSE FALSE 
  END as is_stuck,
  CASE 
    WHEN q.status = 'failed' AND q.next_retry_at IS NOT NULL
    THEN TRUE ELSE FALSE 
  END as will_retry
FROM email_send_queue q
JOIN leads l ON l.id = q.lead_id
ORDER BY 
  CASE q.status 
    WHEN 'sending' THEN 1 
    WHEN 'approved' THEN 2 
    WHEN 'failed' THEN 3 
    ELSE 4 
  END,
  q.scheduled_for ASC;

-- =====================================================
-- Done! Run this migration after EMAIL_QUEUE_MIGRATION.sql
-- =====================================================
