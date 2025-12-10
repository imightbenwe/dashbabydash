-- Create dismissed_leads table
CREATE TABLE IF NOT EXISTS dismissed_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id UUID,
  place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  website TEXT,
  address TEXT,
  phone TEXT,
  reason TEXT,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, place_id)
);

-- Add new columns to dismissed_leads if they don't exist
ALTER TABLE dismissed_leads ADD COLUMN IF NOT EXISTS search_query TEXT;
ALTER TABLE dismissed_leads ADD COLUMN IF NOT EXISTS search_location TEXT;
ALTER TABLE dismissed_leads ADD COLUMN IF NOT EXISTS search_date TIMESTAMPTZ;

-- Create open_leads table (for all results shown to user)
CREATE TABLE IF NOT EXISTS open_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id UUID,
  place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  website TEXT,
  address TEXT,
  phone TEXT,
  rating DECIMAL,
  user_rating_count INTEGER,
  google_maps_uri TEXT,
  first_shown_at TIMESTAMPTZ DEFAULT NOW(),
  last_shown_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, place_id)
);

-- Add new columns to open_leads if they don't exist
ALTER TABLE open_leads ADD COLUMN IF NOT EXISTS search_query TEXT;
ALTER TABLE open_leads ADD COLUMN IF NOT EXISTS search_location TEXT;
ALTER TABLE open_leads ADD COLUMN IF NOT EXISTS search_date TIMESTAMPTZ DEFAULT NOW();

-- Create promoted_leads table (for leads that were converted)
CREATE TABLE IF NOT EXISTS promoted_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  campaign_id UUID,
  place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  website TEXT,
  address TEXT,
  phone TEXT,
  rating DECIMAL,
  user_rating_count INTEGER,
  google_maps_uri TEXT,
  promoted_at TIMESTAMPTZ DEFAULT NOW(),
  lead_id UUID,
  UNIQUE(user_id, place_id)
);

-- Add new columns to promoted_leads if they don't exist
ALTER TABLE promoted_leads ADD COLUMN IF NOT EXISTS search_query TEXT;
ALTER TABLE promoted_leads ADD COLUMN IF NOT EXISTS search_location TEXT;
ALTER TABLE promoted_leads ADD COLUMN IF NOT EXISTS search_date TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_dismissed_leads_user_id ON dismissed_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_leads_campaign_id ON dismissed_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dismissed_leads_place_id ON dismissed_leads(place_id);

CREATE INDEX IF NOT EXISTS idx_open_leads_user_id ON open_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_open_leads_campaign_id ON open_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_open_leads_place_id ON open_leads(place_id);

CREATE INDEX IF NOT EXISTS idx_promoted_leads_user_id ON promoted_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_promoted_leads_campaign_id ON promoted_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_promoted_leads_place_id ON promoted_leads(place_id);

-- Create function to increment campaign dismissed count
CREATE OR REPLACE FUNCTION increment_campaign_dismissed(campaign_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE campaigns
  SET total_dismissed = COALESCE(total_dismissed, 0) + 1
  WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security
ALTER TABLE dismissed_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE open_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE promoted_leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all for authenticated users" ON dismissed_leads;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON open_leads;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON promoted_leads;

-- Create policies
CREATE POLICY "Allow all for authenticated users" ON dismissed_leads
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow all for authenticated users" ON open_leads
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow all for authenticated users" ON promoted_leads
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');
