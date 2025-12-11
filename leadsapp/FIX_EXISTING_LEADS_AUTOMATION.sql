-- Fix existing leads that were incorrectly set to automation_stage = 0
-- This script sets automation_stage = 2 (completed) for leads that are already contacted

-- Update all leads that are NOT in "lead_collected" status
-- These leads have already been worked on, so mark automation as complete
UPDATE leads
SET 
  automation_stage = 2,
  automation_stage_updated_at = NOW(),
  automation_error = NULL
WHERE 
  status != 'lead_collected'
  AND automation_stage = 0;

-- Optionally, you can also update leads without a website to stage -1 (error)
-- so they don't stay in the queue forever
UPDATE leads
SET 
  automation_stage = -1,
  automation_error = 'No website URL to scrape',
  automation_stage_updated_at = NOW()
WHERE 
  website IS NULL
  AND automation_stage = 0
  AND status = 'lead_collected';
