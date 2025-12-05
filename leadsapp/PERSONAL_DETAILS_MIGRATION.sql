-- Migration: Add Personal Details Columns to Leads Table
-- Date: December 4, 2025
-- Description: Adds columns to store personal information extracted from Instagram captions

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS personal_location TEXT,
ADD COLUMN IF NOT EXISTS personal_hobbies TEXT[],
ADD COLUMN IF NOT EXISTS personal_pets TEXT[],
ADD COLUMN IF NOT EXISTS personal_struggles TEXT[],
ADD COLUMN IF NOT EXISTS personal_mentions TEXT[];

-- Verify the migration
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'leads' 
AND column_name LIKE 'personal_%';
