# Database Migration for Campaign Tracking

Run these SQL commands in your Supabase SQL Editor:

## 1. Create Campaigns Table

```sql
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  search_query TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Stats
  total_fetched INTEGER DEFAULT 0,
  total_dismissed INTEGER DEFAULT 0,
  total_converted INTEGER DEFAULT 0,
  
  -- Metadata
  last_search_at TIMESTAMP WITH TIME ZONE,
  notes TEXT
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_search_query ON campaigns(search_query);
```

## 2. Create Dismissed Leads Table

```sql
CREATE TABLE IF NOT EXISTS dismissed_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  
  -- Place data from Google Places
  place_id TEXT NOT NULL,
  place_name TEXT NOT NULL,
  website TEXT,
  address TEXT,
  phone TEXT,
  
  -- Dismissal info
  dismissed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reason TEXT,
  
  UNIQUE(user_id, place_id)
);

CREATE INDEX idx_dismissed_leads_user_id ON dismissed_leads(user_id);
CREATE INDEX idx_dismissed_leads_campaign_id ON dismissed_leads(campaign_id);
CREATE INDEX idx_dismissed_leads_place_id ON dismissed_leads(place_id);
```

## 3. Create Helper Functions

```sql
-- Function to increment dismissed count
CREATE OR REPLACE FUNCTION increment_campaign_dismissed(campaign_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE campaigns
  SET total_dismissed = total_dismissed + 1,
      updated_at = NOW()
  WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment converted count
CREATE OR REPLACE FUNCTION increment_campaign_converted(campaign_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE campaigns
  SET total_converted = total_converted + 1,
      updated_at = NOW()
  WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql;
```

## 4. Enable Row Level Security

```sql
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE dismissed_leads ENABLE ROW LEVEL SECURITY;

-- Campaigns policies
CREATE POLICY "Users can view their own campaigns"
  ON campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns"
  ON campaigns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
  ON campaigns FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
  ON campaigns FOR DELETE
  USING (auth.uid() = user_id);

-- Dismissed leads policies
CREATE POLICY "Users can view their own dismissed leads"
  ON dismissed_leads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own dismissed leads"
  ON dismissed_leads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own dismissed leads"
  ON dismissed_leads FOR DELETE
  USING (auth.uid() = user_id);
```

## Notes

- **Campaigns** track each search query/location combination with statistics
- **Dismissed Leads** store places you've explicitly rejected
- The system will automatically create/update campaigns as you search
- Dismissed leads are linked to campaigns for full tracking
- Total results estimate: Google Places API doesn't provide this, so we track what we've fetched
