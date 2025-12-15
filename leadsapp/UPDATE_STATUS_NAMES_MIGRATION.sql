-- Migration: Update Status Names to Match Automated Follow-up Flow
-- Date: December 12, 2025
-- Purpose: Rename status values to accurately reflect the new automated Gmail follow-up system

-- Step 1: Update existing data to new status names
UPDATE leads SET status = 'followup_1_sent' WHERE status = 'email_2_sent';
UPDATE leads SET status = 'followup_2_sent' WHERE status = 'email_3_sent';

-- Step 2: Update the constraint to include new status names
ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads 
ADD CONSTRAINT leads_status_check 
CHECK (status IN (
  'lead_collected',
  'email_1_sent',           -- Initial email sent
  'followup_1_sent',        -- First automated follow-up sent (replaces email_2_sent)
  'followup_2_sent',        -- Second automated follow-up sent (replaces email_3_sent)
  'followup_3_sent',        -- Third/final automated follow-up sent (new)
  'replied_not_fit',        -- Lead replied but not interested
  'replied_interested',     -- Lead replied and interested
  'call_booked',            -- Call scheduled
  'call_done_thinking',     -- Call completed, lead thinking
  'won',                    -- Deal won
  'lost',                   -- Deal lost
  'site_live'               -- Site launched
));

-- Step 3: Add comment for clarity
COMMENT ON COLUMN leads.status IS 'Current stage in the lead funnel. email_1_sent = initial email, followup_X_sent = automated follow-ups';
