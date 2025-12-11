-- PersonaAI Database Schema for Supabase

-- Table: leads
-- Stores all prospect/lead information
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  profile_picture TEXT,
  website TEXT,
  instagram TEXT,
  facebook TEXT,
  substack TEXT,
  threads TEXT,
  linkedin TEXT,
  status TEXT DEFAULT 'lead_collected' CHECK (status IN ('lead_collected', 'email_1_sent', 'email_2_sent', 'email_3_sent', 'replied_not_fit', 'replied_interested', 'call_booked', 'call_done_thinking', 'won', 'lost', 'site_live')),
  persona_score TEXT CHECK (persona_score IN ('high', 'medium', 'low')),
  next_action TEXT,
  
  -- Cold email personalization fields
  mutual_connection_name TEXT,
  specific_hook_story TEXT,
  problem_statement TEXT,
  case_study_reference TEXT,
  
  -- Instagram engagement analytics
  top_commenter_username TEXT,
  top_commenter_profile_pic TEXT,
  engagement_avg_likes DECIMAL,
  engagement_avg_comments DECIMAL,
  engagement_avg_views DECIMAL,
  total_posts_analyzed INTEGER,
  most_engaging_topic TEXT,
  recent_post_date TIMESTAMPTZ,
  
  -- Personal details from Instagram captions
  personal_location TEXT,
  personal_hobbies TEXT[], -- Array of hobbies
  personal_pets TEXT[], -- Array of pet mentions
  personal_struggles TEXT[], -- Array of struggles/challenges
  personal_mentions TEXT[], -- Array of personal story moments
  personal_story_hook TEXT, -- First-person narrative hook for emails
  audience_pain_points TEXT[], -- Pain points from audience comments
  specific_post_topics JSONB, -- Array of {topic, engagement, timestamp} for email subjects
  
  -- Workflow tracking
  date_contacted TIMESTAMPTZ,
  last_touch_date TIMESTAMPTZ,
  pdf_sent_date TIMESTAMPTZ,
  site_live_date TIMESTAMPTZ,
  pdf_url TEXT,
  mockup_site_url TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: raw_data_sources
-- Stores all uploaded raw data for each lead
CREATE TABLE raw_data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('instagram', 'website', 'substack', 'threads', 'privacy_policy', 'other')),
  file_name TEXT,
  raw_content JSONB NOT NULL, -- Stores JSON or text as JSONB
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: ai_analyses
-- Stores AI-generated persona analyses
CREATE TABLE ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  llm_provider TEXT NOT NULL CHECK (llm_provider IN ('openai', 'gemini')),
  analysis_type TEXT DEFAULT 'persona_profile',
  
  -- Persona analysis fields
  tone_keywords TEXT[], -- Array of tone descriptors
  story_arc TEXT,
  key_triggers TEXT[], -- Array of pain points/triggers
  
  -- Raw LLM response
  full_response JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: generated_emails
-- Stores AI-generated email drafts
CREATE TABLE generated_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  email_type TEXT CHECK (email_type IN ('initial', 'follow_up_1', 'follow_up_2', 'response')),
  subject TEXT,
  body TEXT NOT NULL,
  llm_provider TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_raw_data_lead_id ON raw_data_sources(lead_id);
CREATE INDEX idx_ai_analyses_lead_id ON ai_analyses(lead_id);
CREATE INDEX idx_generated_emails_lead_id ON generated_emails(lead_id);

-- Row Level Security (RLS) Policies
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_emails ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to access all data (adjust based on your auth requirements)
CREATE POLICY "Allow all for authenticated users" ON leads
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow all for authenticated users" ON raw_data_sources
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow all for authenticated users" ON ai_analyses
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

CREATE POLICY "Allow all for authenticated users" ON generated_emails
  FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on leads table
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
