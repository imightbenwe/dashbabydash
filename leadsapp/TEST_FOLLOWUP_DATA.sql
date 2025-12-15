-- Quick Test Setup for Follow-up Timeline
-- Run this AFTER running GMAIL_FOLLOWUP_MIGRATION.sql
-- This will set up some test data so you can see the timeline in action

-- Step 1: Find a few leads to use as test data
-- (You can replace the names with actual leads from your database)

-- Example: Set up "Astrid" as if initial email was sent 4 days ago (ready for FU1)
UPDATE leads 
SET 
  status = 'email_1_sent',
  date_contacted = NOW() - INTERVAL '4 days',
  initial_email_subject = 'Quick note after seeing your work'
WHERE name = 'Astrid';

-- Example: Set up "Jen" as if initial email was sent 1 day ago (not ready yet)
UPDATE leads 
SET 
  status = 'email_1_sent',
  date_contacted = NOW() - INTERVAL '1 day',
  initial_email_subject = 'Quick note after seeing your work'
WHERE name = 'Jen';

-- Example: Set up "Alison" with FU1 sent 6 days ago (ready for FU2)
UPDATE leads 
SET 
  status = 'email_1_sent',
  date_contacted = NOW() - INTERVAL '10 days',
  initial_email_subject = 'Quick note after seeing your work',
  followup_1_sent_at = NOW() - INTERVAL '6 days'
WHERE name = 'Alison';

-- Example: Set up "Tyke" with all follow-ups complete
UPDATE leads 
SET 
  status = 'email_1_sent',
  date_contacted = NOW() - INTERVAL '20 days',
  initial_email_subject = 'Quick note after seeing your work',
  followup_1_sent_at = NOW() - INTERVAL '17 days',
  followup_2_sent_at = NOW() - INTERVAL '10 days',
  followup_3_sent_at = NOW() - INTERVAL '3 days'
WHERE name = 'Tyke';

-- Verify the changes
SELECT 
  name, 
  status, 
  date_contacted,
  followup_1_sent_at,
  followup_2_sent_at,
  followup_3_sent_at
FROM leads 
WHERE status = 'email_1_sent'
ORDER BY date_contacted DESC;
