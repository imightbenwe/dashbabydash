-- Add email sending settings columns to user_gmail_auth table
-- Run this in Supabase SQL Editor

ALTER TABLE user_gmail_auth 
ADD COLUMN IF NOT EXISTS emails_per_hour INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS sending_schedule TEXT DEFAULT 'around_clock',
ADD COLUMN IF NOT EXISTS sending_timezone TEXT DEFAULT 'America/New_York';

-- Add comment for documentation
COMMENT ON COLUMN user_gmail_auth.emails_per_hour IS 'Maximum emails to send per hour (rate limit)';
COMMENT ON COLUMN user_gmail_auth.sending_schedule IS 'When to send emails: business, extended, or around_clock';
COMMENT ON COLUMN user_gmail_auth.sending_timezone IS 'Timezone for business hours calculations';
