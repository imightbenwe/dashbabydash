-- Migration: Add privacy_policy source type to raw_data_sources table
-- Date: 2025-12-11
-- Purpose: Allow storing privacy policy content separately (for email extraction only, not AI analysis)

-- Drop the existing constraint
ALTER TABLE raw_data_sources 
DROP CONSTRAINT IF EXISTS raw_data_sources_source_type_check;

-- Add the new constraint with privacy_policy included
ALTER TABLE raw_data_sources 
ADD CONSTRAINT raw_data_sources_source_type_check 
CHECK (source_type IN ('instagram', 'website', 'substack', 'threads', 'privacy_policy', 'other'));

-- Done! Privacy policy content will now:
-- 1. Be stored with 'privacy_policy' source_type
-- 2. Show with a yellow "Privacy Policy" label in the UI
-- 3. Be EXCLUDED from AI analysis (only used for email extraction)
