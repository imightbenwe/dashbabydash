-- Migration: Add last_touch_date column to leads table
-- Date: December 13, 2025
-- Purpose: Track when we last touched base with a lead (for any follow-up or communication)

-- Add last_touch_date column if it doesn't exist
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS last_touch_date TIMESTAMPTZ;

-- Add index for querying by last touch date
CREATE INDEX IF NOT EXISTS idx_leads_last_touch_date ON leads(last_touch_date);

-- Backfill last_touch_date with the most recent follow-up timestamp for existing leads
UPDATE leads
SET last_touch_date = GREATEST(
  COALESCE(followup_1_sent_at, '1970-01-01'::timestamptz),
  COALESCE(followup_2_sent_at, '1970-01-01'::timestamptz),
  COALESCE(followup_3_sent_at, '1970-01-01'::timestamptz),
  COALESCE(date_contacted, '1970-01-01'::timestamptz)
)
WHERE last_touch_date IS NULL
  AND (followup_1_sent_at IS NOT NULL 
    OR followup_2_sent_at IS NOT NULL 
    OR followup_3_sent_at IS NOT NULL 
    OR date_contacted IS NOT NULL);

-- Comment documentation
COMMENT ON COLUMN leads.last_touch_date IS 'Timestamp of last communication/follow-up sent to this lead';
