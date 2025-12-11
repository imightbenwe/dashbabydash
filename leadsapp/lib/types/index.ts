/**
 * Comprehensive Type Definitions for LeadsApp
 * Replaces all 'any' types with proper TypeScript interfaces
 */

// ============================================================================
// LEAD TYPES
// ============================================================================

export type LeadStatus = 
  | 'lead_collected' 
  | 'email_1_sent' 
  | 'email_2_sent' 
  | 'email_3_sent' 
  | 'replied_not_fit' 
  | 'replied_interested' 
  | 'call_booked' 
  | 'call_done_thinking' 
  | 'won' 
  | 'lost' 
  | 'site_live';

export type PersonaScore = 'high' | 'medium' | 'low';

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  profile_picture: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  substack: string | null;
  threads: string | null;
  linkedin: string | null;
  status: LeadStatus;
  persona_score: PersonaScore | null;
  next_action: string | null;
  
  // Cold email personalization fields
  mutual_connection_name: string | null;
  specific_hook_story: string | null;
  problem_statement: string | null;
  case_study_reference: string | null;
  
  // Instagram engagement analytics
  top_commenter_username: string | null;
  top_commenter_profile_pic: string | null;
  engagement_avg_likes: number | null;
  engagement_avg_comments: number | null;
  engagement_avg_views: number | null;
  total_posts_analyzed: number | null;
  most_engaging_topic: string | null;
  recent_post_date: string | null;
  
  // Personal details
  personal_location: string | null;
  personal_hobbies: string[] | null;
  personal_pets: string[] | null;
  personal_struggles: string[] | null;
  personal_mentions: string[] | null;
  personal_story_hook: string | null;
  audience_pain_points: string[] | null;
  specific_post_topics: PostTopic[] | null;
  
  // Workflow tracking
  date_contacted: string | null;
  last_touch_date: string | null;
  pdf_sent_date: string | null;
  site_live_date: string | null;
  pdf_url: string | null;
  mockup_site_url: string | null;
  
  created_at: string;
  updated_at: string;
}

export interface PostTopic {
  topic: string;
  engagement: number;
  timestamp: string;
}

// ============================================================================
// DATA SOURCE TYPES
// ============================================================================

export type SourceType = 'instagram' | 'website' | 'substack' | 'threads' | 'privacy_policy' | 'other';

export interface RawDataSource {
  id: string;
  lead_id: string;
  source_type: SourceType;
  file_name: string | null;
  raw_content: InstagramData | WebsiteData | Record<string, unknown>;
  uploaded_at: string;
}

export interface InstagramData {
  posts?: InstagramPost[];
  [key: string]: unknown;
}

export interface WebsiteData {
  text: string;
  [key: string]: unknown;
}

// ============================================================================
// INSTAGRAM TYPES
// ============================================================================

export interface InstagramPost {
  id: string;
  caption: string;
  ownerUsername: string;
  latestComments: InstagramComment[];
  likesCount: number;
  commentsCount: number;
  videoViewCount?: number;
  timestamp: string;
  type?: string;
}

export interface InstagramComment {
  ownerUsername: string;
  text: string;
  timestamp: string;
  likesCount: number;
  owner?: {
    profile_pic_url?: string;
  };
}

export interface InstagramAnalytics {
  topCommenterUsername: string | null;
  topCommenterProfilePic: string | null;
  topCommenterCommentCount: number;
  engagementAvgLikes: number;
  engagementAvgComments: number;
  engagementAvgViews: number;
  totalPostsAnalyzed: number;
  mostEngagingTopic: string | null;
  mostEngagingPost: {
    caption: string;
    likesCount: number;
    commentsCount: number;
    timestamp: string;
  } | null;
  recentPostDate: string | null;
  commenterInsights: CommenterInsight[];
  contentPatterns: {
    averageEngagementRate: number;
    topicsByEngagement: Array<{ topic: string; avgLikes: number }>;
  };
  personalDetails: {
    location: string | null;
    hobbies: string[];
    pets: string[];
    struggles: string[];
    personalMentions: string[];
  };
  personalStoryHook: string | null;
  audiencePainPoints: string[];
  specificPostTopics: Array<{
    topic: string;
    engagement: number;
    timestamp: string;
  }>;
}

export interface CommenterInsight {
  username: string;
  commentCount: number;
  profilePic: string;
}

// ============================================================================
// AI ANALYSIS TYPES
// ============================================================================

export type LLMProvider = 'openai' | 'gemini';

export interface AIAnalysis {
  id: string;
  lead_id: string;
  llm_provider: LLMProvider;
  analysis_type: string;
  tone_keywords: string[];
  story_arc: string | null;
  key_triggers: string[];
  full_response: GeminiAnalysisResponse | OpenAIAnalysisResponse;
  created_at: string;
}

export interface GeminiAnalysisResponse {
  firstNameGuess?: string;
  topCommenter?: string;
  topCommenterProfilePic?: string;
  specificAchievement?: string;
  specificHookStory?: string;
  toneKeywords?: string[];
  storyArc?: string;
  keyTriggers?: string[];
  emailOpening?: string;
  engagementInsights?: string;
  insights?: string;
  _instagramAnalytics?: InstagramAnalytics;
  [key: string]: unknown;
}

export interface OpenAIAnalysisResponse {
  firstNameGuess?: string;
  topCommenter?: string;
  topCommenterProfilePic?: string;
  specificAchievement?: string;
  specificHookStory?: string;
  toneKeywords?: string[];
  storyArc?: string;
  keyTriggers?: string[];
  emailOpening?: string;
  emailSubject?: string;
  emailBody?: string;
  engagementInsights?: string;
  insights?: string;
  _instagramAnalytics?: InstagramAnalytics;
  [key: string]: unknown;
}

export interface AnalysisResult {
  leadId: string;
  firstNameGuess?: string;
  toneKeywords: string[];
  storyArc: string;
  keyTriggers: string[];
  emailDraft?: string;
  emailSubject?: string;
  email?: GeneratedEmail;
  geminiAnalysis?: GeminiAnalysisResponse;
  openaiAnalysis?: OpenAIAnalysisResponse;
  topCommenter?: string;
  topCommenterProfilePic?: string;
  specificAchievement?: string;
  specificHookStory?: string;
  emailOpening?: string;
}

// ============================================================================
// EMAIL TYPES
// ============================================================================

export type EmailType = 'initial' | 'follow_up_1' | 'follow_up_2' | 'response';

export interface GeneratedEmail {
  id: string;
  lead_id: string;
  email_type: EmailType;
  subject: string | null;
  body: string;
  llm_provider: string;
  sent_at: string | null;
  created_at: string;
}

// ============================================================================
// GOOGLE PLACES TYPES
// ============================================================================

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  website: string;
  phone: string;
  rating: number;
  reviewCount: number;
  googleMapsUrl: string;
  businessStatus: string;
  types: string[];
}

export interface PlacesSearchParams {
  query: string;
  location: string;
  maxResults: number;
  minReviews: number;
  maxReviews: number;
  pageToken?: string;
}

export interface PlacesSearchResponse {
  places: PlaceResult[];
  nextPageToken?: string;
  cached?: boolean;
  cacheAge?: number;
}

export interface OpenLead {
  id: string;
  user_id: string;
  campaign_id: string | null;
  place_id: string;
  place_name: string;
  website: string;
  address: string;
  phone: string | null;
  search_query: string;
  search_location: string;
  created_at: string;
}

export interface DismissedLead {
  id: string;
  user_id: string;
  campaign_id: string | null;
  place_id: string;
  place_name: string;
  website: string;
  address: string;
  phone: string | null;
  reason: string | null;
  search_query: string;
  search_location: string;
  dismissed_at: string;
}

export interface PromotedLead {
  id: string;
  user_id: string;
  campaign_id: string | null;
  place_id: string;
  lead_id: string;
  place_name: string;
  website: string;
  promoted_at: string;
}

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

// ============================================================================
// SCRAPER TYPES
// ============================================================================

export interface ScrapedWebsite {
  url: string;
  title: string;
  description: string;
  content: string;
  emails: string[];
  phones: string[];
  socialLinks: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    twitter?: string;
  };
  colorScheme?: {
    primary: string;
    secondary: string;
    accent: string;
  };
  images?: string[];
  cached?: boolean;
}

// ============================================================================
// DEMO GENERATOR TYPES
// ============================================================================

export interface DemoGenerationRequest {
  html: string;
  clientName: string;
}

export interface DemoGenerationResult {
  success: boolean;
  url: string;
  filePath: string;
  clientName: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: unknown;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ============================================================================
// FILTER & PAGINATION TYPES
// ============================================================================

export interface LeadFilters {
  status?: LeadStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ============================================================================
// FORM TYPES
// ============================================================================

export interface NewAnalysisFormData {
  prospectName: string;
  company: string;
  email: string;
  igHandle: string;
  websiteUrl: string;
  profilePictureUrl: string;
  websiteData: string;
  igFile: File | null;
  substackFile: File | null;
  threadsFile: File | null;
  otherFile: File | null;
}

export interface PlacesSearchFormData {
  query: string;
  location: string;
  maxResults: number;
  minReviews: number;
  maxReviews: number;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

// Make JSONB content type-safe
export type JSONBContent = JsonValue;
