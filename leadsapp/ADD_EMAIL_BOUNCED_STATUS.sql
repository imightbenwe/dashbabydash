-- Add "email_bounced" status to the leads table constraint
-- Run this in Supabase SQL Editor after UPDATE_STATUS_NAMES_MIGRATION.sql

-- Drop the existing constraint
ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_status_check;

-- Add the constraint back with the new status
ALTER TABLE leads
ADD CONSTRAINT leads_status_check 
CHECK (status IN (
  'lead_collected',
  'email_1_sent',
  'email_bounced',
  'followup_1_sent',
  'followup_2_sent',
  'followup_3_sent',
  'replied_not_fit',
  'replied_interested',
  'call_booked',
  'call_done_thinking',
  'won',
  'lost',
  'site_live'
));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'leads'::regclass 
AND conname = 'leads_status_check';
