-- Migration: Add Personal Story Hook and Audience Pain Points
-- Date: December 5, 2025
-- Description: Adds columns for first-person narrative hooks, audience pain point analysis, and specific post topics

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS personal_story_hook TEXT,
ADD COLUMN IF NOT EXISTS audience_pain_points TEXT[],
ADD COLUMN IF NOT EXISTS specific_post_topics JSONB;

-- Verify the migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name IN ('personal_story_hook', 'audience_pain_points', 'specific_post_topics');
