export type Lead = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  status: 'new' | 'analysis_done' | 'pdf_sent' | 'follow_up_1' | 'follow_up_2' | 'closed' | 'lost';
  persona_score: 'high' | 'medium' | 'low' | null;
  next_action: string | null;
  created_at: string;
  updated_at: string;
};

export type RawDataSource = {
  id: string;
  lead_id: string;
  source_type: 'instagram' | 'website' | 'substack' | 'threads' | 'other';
  file_name: string | null;
  raw_content: any; // JSONB
  uploaded_at: string;
};

export type AIAnalysis = {
  id: string;
  lead_id: string;
  llm_provider: 'openai' | 'gemini';
  analysis_type: string;
  tone_keywords: string[];
  story_arc: string | null;
  key_triggers: string[];
  full_response: any; // JSONB
  created_at: string;
};

export type GeneratedEmail = {
  id: string;
  lead_id: string;
  email_type: 'initial' | 'follow_up_1' | 'follow_up_2' | 'response';
  subject: string | null;
  body: string;
  llm_provider: string;
  sent_at: string | null;
  created_at: string;
};

export type AnalysisResult = {
  toneKeywords: string[];
  storyArc: string;
  keyTriggers: string[];
  emailDraft: string;
  emailSubject: string;
};
