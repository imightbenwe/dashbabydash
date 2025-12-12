-- Fix automation stages for manually contacted leads
-- Run this in Supabase SQL Editor to mark all "Email 1 Sent" leads as automation complete

UPDATE leads 
SET 
  automation_stage = 2,
  automation_stage_updated_at = NOW()
WHERE 
  status IN ('email_1_sent', 'email_2_sent', 'responded', 'meeting_scheduled', 'closed_won', 'closed_lost')
  AND automation_stage NOT IN (2, -1);

-- This will:
-- 1. Move all manually contacted leads to stage 2 (Analyzed - final stage)
-- 2. Remove them from the "Queued" filter
-- 3. Stop automation from trying to process them
