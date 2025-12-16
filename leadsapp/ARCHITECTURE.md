# LeadsApp Architecture Documentation

**Last Updated**: December 16, 2025  
**Version**: 2.5.0  
**Purpose**: Complete reference for AI assistants and developers working on this codebase

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Core Concepts](#core-concepts)
5. [Data Flow](#data-flow)
6. [API Routes Reference](#api-routes-reference)
7. [Component Architecture](#component-architecture)
8. [Database Schema](#database-schema)
9. [AI Integration](#ai-integration)
10. [Google Places Workflow](#google-places-workflow)
11. [Automation System](#automation-system)
12. [Common Patterns](#common-patterns)
13. [Configuration](#configuration)
14. [Troubleshooting](#troubleshooting)

---

## System Overview

**LeadsApp** is a Next.js CRM application for analyzing leads using AI (OpenAI GPT-4o) and scraping business data from Google Places. It features:

- **Lead Analysis**: Scrape websites, analyze with AI, generate personalized emails
- **Google Places Integration**: Search businesses, track in Open/Dismissed/Promoted tabs
- **Automation**: Background processing (website scraping → AI analysis)
- **Email Generation**: AI-powered personalized cold email openers
- **CRM Pipeline**: Status tracking from lead collection → contacted → booked

### Key User Workflows

1. **Manual Lead Entry**: User pastes website URL → AI scrapes → AI analyzes → Email generated
2. **Google Places**: User searches "reiki boston" → Results auto-saved to Open tab → User promotes to CRM or dismisses
3. **Automation**: New lead created with `status='lead_collected'` → Auto-scraped after 2min → Auto-analyzed after 1min → Email ready

---

## Tech Stack

### Frontend
- **Framework**: Next.js 16.0.7 (App Router, Turbopack)
- **React**: 19.0.0 (Hooks: useState, useEffect, useCallback)
- **Styling**: TailwindCSS 3.4.1
- **UI Components**: shadcn/ui (Radix primitives)
- **Icons**: Lucide React
- **Language**: TypeScript 5.x (strict mode)

### Backend
- **Runtime**: Node.js (Next.js API Routes)
- **Database**: Supabase (PostgreSQL with RLS)
- **AI Models**: 
  - OpenAI GPT-4o (primary, fallback to gpt-4o-mini)
  - Previously used Gemini (deprecated Dec 11, 2025)
- **Web Scraping**: Cheerio (static HTML parsing)
- **External APIs**: Google Places API (New v1)

### Development Tools
- **Package Manager**: npm
- **Type Checking**: TypeScript compiler
- **Linting**: ESLint
- **Version Control**: Git + GitHub

---

## Project Structure

```
leadsapp/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Main dashboard (120 lines)
│   ├── layout.tsx                # Root layout with metadata
│   ├── globals.css               # Tailwind + custom styles
│   ├── lead/[id]/page.tsx        # Lead detail view
│   └── api/                      # API Routes (server-side)
│       ├── analyze/route.ts      # AI analysis endpoint
│       ├── automation/
│       │   ├── process/route.ts  # Automation worker (runs every 60s)
│       │   └── retry/[id]/route.ts
│       ├── leads/
│       │   ├── route.ts          # CRUD operations
│       │   ├── [id]/route.ts     # Single lead operations
│       │   ├── [id]/run-analysis/route.ts
│       │   ├── [id]/additional-data/route.ts
│       │   └── create-from-places/route.ts  # Promote places to leads
│       ├── places/
│       │   ├── search/route.ts   # Google Places search
│       │   └── search-log/route.ts
│       ├── open/
│       │   ├── route.ts          # Open leads management
│       │   └── clear/route.ts
│       ├── dismissed/route.ts    # Dismissed leads
│       ├── promoted/route.ts     # Promoted leads
│       ├── scraper/
│       │   └── deep/route.ts     # Website scraping
│       └── emails/
│           └── generate/route.ts
│
├── components/                   # React components (modular)
│   ├── forms/
│   │   └── NewAnalysisForm.tsx   # Lead creation form (300 lines)
│   ├── tables/
│   │   └── CRMTable.tsx          # Lead table with pagination (350 lines)
│   ├── places/
│   │   └── GooglePlacesSearch.tsx # Google Places UI (700 lines)
│   ├── demo/
│   │   └── DemoGenerator.tsx     # Static HTML demo generator
│   ├── scraper/
│   │   └── WebsiteScraper.tsx    # Website scraper UI
│   └── ui/                       # shadcn/ui components
│       ├── button.tsx
│       ├── input.tsx
│       └── ...
│
├── lib/                          # Utilities and shared code
│   ├── ai-service.ts             # AI analysis functions
│   ├── api-utils.ts              # API response helpers
│   ├── logger.ts                 # Structured logging
│   ├── utils.ts                  # General utilities
│   ├── types/
│   │   └── index.ts              # TypeScript interfaces (470 lines)
│   ├── hooks/
│   │   └── useAutomation.ts      # Background automation polling
│   └── supabase/
│       └── admin.ts              # Server-side Supabase client
│
├── public/                       # Static assets
├── supabase-schema.sql           # Database schema (single source of truth)
├── GOOGLE_PLACES_SEARCH_LOG.md   # Search history log
├── FIX_AUTOMATION_STAGES.sql     # Utility SQL script
├── CHANGELOG.md                  # Version history
├── README.md                     # Quick start guide
├── SETUP_GUIDE.md                # Detailed setup instructions
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── tailwind.config.ts            # Tailwind config
└── .env.local                    # Environment variables (not in git)
```

---

## Core Concepts

### 1. Lead Lifecycle

```
lead_collected → scraped (automation_stage 0→1) → analyzed (stage 1→2) 
→ email_1_sent → responded → qualified → proposal_sent → negotiating 
→ booked / lost
```

**Key Status Values**:
- `lead_collected`: Initial state, ready for automation
- `email_1_sent`: First email sent (manual or automated)
- `booked`: Successfully converted to client
- `lost`: Lead marked as lost/uninterested

### 2. Automation Stages

```
Stage 0 (Queued): Lead just created, waiting 2 minutes
Stage 1 (Scraped): Website scraped, waiting 1 minute  
Stage 2 (Analyzed): AI analysis complete, email ready
Stage -1 (Error): Automation failed, needs manual retry
```

**Filter Logic**: Automation ONLY processes leads with `status='lead_collected'`. This prevents reprocessing contacted leads.

### 3. Google Places Workflow

```
Search → Auto-save to Open → User reviews → Promote to CRM OR Dismiss
```

**Tables**:
- `open_leads`: All search results (not dismissed/promoted)
- `dismissed_leads`: User marked as not relevant
- `promoted_leads`: Successfully converted to CRM leads

**userId Pattern**: Uses hardcoded `'demo-user'` for now (TODO: implement auth)

---

## Data Flow

### Manual Lead Analysis
```
User Input (form) 
→ POST /api/analyze 
→ Scrape website (Cheerio) 
→ AI Analysis (OpenAI GPT-4o) 
→ Generate email opening
→ Save to database (leads, raw_data_sources, ai_analyses, generated_emails)
→ Return results to UI
```

### Google Places → CRM
```
User searches "reiki boston"
→ POST /api/places/search
→ Google Places API call
→ Filter by review count (0-25 default)
→ Return results with (displayName, websiteUri, formattedAddress, etc)
→ Frontend auto-calls POST /api/open (save all results)
→ Switch to Open tab

User selects leads
→ Click "Create X Leads"
→ POST /api/leads/create-from-places
→ Fetch open_leads data for selected place_ids
→ Create leads table records (status='lead_collected', automation_stage=0)
→ Create promoted_leads records
→ Return to UI
→ Refresh Open (count decreases) and Promoted (count increases)
```

### Automation Background Processing
```
useAutomation hook polls every 60 seconds
→ POST /api/automation/process
→ Fetch leads WHERE status='lead_collected' AND automation_stage IN (0,1)

For Stage 0 (created > 2 minutes ago):
→ POST /api/scraper/deep
→ Scrape website with Cheerio
→ Save to raw_data_sources
→ Update automation_stage=1

For Stage 1 (scraped > 1 minute ago):
→ POST /api/leads/[id]/run-analysis
→ AI analyzes scraped content
→ Generate email opening
→ Save to ai_analyses + generated_emails
→ Update automation_stage=2
```

---

## API Routes Reference

### Lead Management

**`POST /api/analyze`**
- **Purpose**: Full lead analysis pipeline
- **Body**: `{ name, website, companyName, additionalText, files[] }`
- **Returns**: `{ lead, analysis, email }`
- **Process**: Scrape → Analyze → Generate email → Save all

**`GET /api/leads`**
- **Purpose**: Fetch all leads with optional filters
- **Query**: `?status=X&automation_stage=Y&limit=999999`
- **Returns**: `{ leads: [...] }`
- **Note**: No pagination on server (client-side pagination in CRMTable)

**`GET /api/leads/[id]`**
- **Purpose**: Single lead with all related data
- **Returns**: `{ lead, rawData, analyses, emails }`

**`PATCH /api/leads/[id]`**
- **Purpose**: Update lead fields
- **Body**: `{ status?, name?, notes?, etc }`
- **Returns**: `{ lead }`

**`POST /api/leads/create-from-places`**
- **Purpose**: Promote Google Places to CRM leads
- **Body**: `{ placeIds: string[], userId?: 'demo-user' }`
- **Process**: 
  1. Fetch open_leads for placeIds
  2. Create leads (status='lead_collected', automation_stage=0)
  3. Create promoted_leads records
  4. Return created leads
- **Returns**: `{ leadsCreated: number, leads: [...] }`

### Automation

**`POST /api/automation/process`**
- **Purpose**: Background worker (called every 60s)
- **Body**: None
- **Process**:
  1. Fetch leads WHERE status='lead_collected' AND automation_stage IN (0,1)
  2. Process up to 10 stage 0 leads (scrape if >2min old)
  3. Process up to 10 stage 1 leads (analyze if >1min old)
- **Returns**: `{ stage0Processed: number, stage1Processed: number, errors: [] }`

**`POST /api/automation/retry/[id]`**
- **Purpose**: Retry failed automation
- **Body**: None
- **Process**: Reset automation_stage to 0, clear error

### Google Places

**`POST /api/places/search`**
- **Purpose**: Search businesses via Google Places API
- **Body**: `{ query, location, minReviews?, maxReviews?, maxResults? }`
- **Returns**: `{ places: [...], cached: boolean }`
- **Caching**: 24-hour cache (TTL: 86400000ms)
- **Logging**: Logs to GOOGLE_PLACES_SEARCH_LOG.md

**`GET /api/places/search-log`**
- **Purpose**: Serve search log file
- **Returns**: Plain text markdown content

**`GET /api/open?userId=demo-user`**
- **Purpose**: Fetch open leads (not dismissed/promoted)
- **Returns**: `{ openLeads: [...] }`
- **Filters**: Excludes dismissed place_ids and converted websites

**`POST /api/open`**
- **Purpose**: Save search results to open_leads
- **Body**: `{ userId, places: [...], searchQuery, searchLocation }`
- **Process**: Upsert with conflict on (user_id, place_id)

**`DELETE /api/open/clear?userId=demo-user`**
- **Purpose**: Delete all open leads for user
- **Returns**: `{ message }`

**`GET /api/dismissed?userId=demo-user`**
- **Purpose**: Fetch dismissed leads
- **Returns**: `{ dismissed: [...] }`

**`POST /api/dismissed`**
- **Purpose**: Dismiss a lead
- **Body**: `{ userId, placeId, placeName, reason? }`
- **Process**: Insert to dismissed_leads, delete from open_leads

**`GET /api/promoted?userId=demo-user`**
- **Purpose**: Fetch promoted leads
- **Returns**: `{ promoted: [...] }`

### Scraping

**`POST /api/scraper/deep`**
- **Purpose**: Deep website scraping with Cheerio
- **Body**: `{ url }`
- **Returns**: `{ content: string, bodyText: string }`
- **Targets**: Wix (.wsite-section-content), Squarespace (.sqs-block-content), all body text fallback

### AI & Email

**`POST /api/leads/[id]/run-analysis`**
- **Purpose**: Manual AI analysis trigger
- **Body**: None
- **Process**: Fetch raw data → Analyze with GPT-4o → Generate email

**`POST /api/emails/generate`**
- **Purpose**: Generate follow-up emails
- **Body**: `{ leadId, emailType: 'follow_up_1' | 'follow_up_2' }`
- **Templates**: Loaded from lib/email-templates.json

---

## Component Architecture

### Main Dashboard (`app/page.tsx`)

**Structure**:
```tsx
<div className="min-h-screen">
  <Sidebar navigation />
  <MainContent>
    {view === 'new' && <NewAnalysisForm />}
    {view === 'crm' && <CRMTable />}
    {view === 'places' && <GooglePlacesSearch />}
    {view === 'demos' && <DemoGenerator />}
    {view === 'scraper' && <WebsiteScraper />}
  </MainContent>
  <AutomationIndicator /> {/* useAutomation hook */}
</div>
```

**State**: `view` (string) - current tab

### NewAnalysisForm

**Props**: `{ onLeadCreated?: (lead) => void }`

**Key Features**:
- Manual lead entry form
- Website URL input
- Additional text area
- File uploads (Instagram JSON, Substack, etc.)
- Calls POST /api/analyze
- Loading states

### CRMTable

**Props**: `{ onLeadClick?: (id) => void }`

**Key Features**:
- Client-side pagination (50 per page)
- Status filter dropdown
- Automation stage filter
- Bulk delete with confirmation
- Sortable columns
- "Run AI Analysis" button for individual leads

**State**:
- `leads` (array)
- `currentPage` (number)
- `statusFilter` (string | null)
- `automationStageFilter` (number | null)
- `selectedLeads` (Set<number>)

### GooglePlacesSearch

**Props**: `{ onLeadsCreated?: (count) => void }`

**Key Features**:
- Search form (query, location, review filters)
- 4 tabs: Search, Open, Dismissed, Promoted
- Auto-saves search results to Open
- Select All / Deselect All
- Create X Leads (promote to CRM)
- Dismiss with optional reason
- Clear All button

**State**:
- `googlePlacesView` ('search' | 'open' | 'dismissed' | 'promoted')
- `searchResults` (array)
- `openLeadsList` (array)
- `dismissedLeadsList` (array)
- `promotedLeadsList` (array)
- `selectedPlaces` (Set<string>)

**Important**: Uses hardcoded `userId='demo-user'`

---

## Database Schema

### Core Tables

**`leads`**
```sql
id                BIGSERIAL PRIMARY KEY
name              TEXT NOT NULL
website           TEXT
status            TEXT (see Lead Lifecycle)
automation_stage  INTEGER DEFAULT 0
automation_stage_updated_at TIMESTAMPTZ
automation_error  TEXT
created_at        TIMESTAMPTZ DEFAULT NOW()
updated_at        TIMESTAMPTZ DEFAULT NOW()
date_contacted    TIMESTAMPTZ
```

**`raw_data_sources`**
```sql
id           BIGSERIAL PRIMARY KEY
lead_id      BIGINT REFERENCES leads(id) ON DELETE CASCADE
source_type  TEXT ('website', 'instagram', 'substack', etc.)
file_name    TEXT
raw_content  TEXT (website HTML or JSON data)
created_at   TIMESTAMPTZ
```

**`ai_analyses`**
```sql
id                 BIGSERIAL PRIMARY KEY
lead_id            BIGINT REFERENCES leads(id) ON DELETE CASCADE
llm_provider       TEXT ('openai', 'gemini', 'static_template')
tone_keywords      TEXT[]
story_arc          TEXT
pain_points        TEXT[]
email_opening      TEXT (AI-generated opening line)
full_analysis_json JSONB
created_at         TIMESTAMPTZ
```

**`generated_emails`**
```sql
id          BIGSERIAL PRIMARY KEY
lead_id     BIGINT REFERENCES leads(id) ON DELETE CASCADE
email_type  TEXT ('initial', 'follow_up_1', 'follow_up_2')
subject     TEXT
body        TEXT
created_at  TIMESTAMPTZ
```

### Google Places Tables

**`open_leads`**
```sql
id                 BIGSERIAL PRIMARY KEY
user_id            TEXT NOT NULL
place_id           TEXT NOT NULL (Google Place ID)
place_name         TEXT
website            TEXT
address            TEXT
phone              TEXT
rating             NUMERIC
user_rating_count  INTEGER
google_maps_uri    TEXT
search_query       TEXT
search_location    TEXT
search_date        TIMESTAMPTZ
last_shown_at      TIMESTAMPTZ
UNIQUE(user_id, place_id)
```

**`dismissed_leads`** - Similar structure + `reason TEXT`, `dismissed_at TIMESTAMPTZ`

**`promoted_leads`** - Similar structure + `lead_id BIGINT`, `promoted_at TIMESTAMPTZ`

---

## AI Integration

### Current Setup (December 2025)

**Model**: OpenAI GPT-4o (switched from GPT-5.1 and Gemini for cost)

**Cost Optimization**: 
- Gemini analysis removed (Dec 11, 2025)
- Using gpt-4o instead of gpt-5.1 (10-20x cost reduction)
- Fallback to gpt-4o-mini if primary fails

### Analysis Function (`lib/ai-service.ts`)

```typescript
export async function analyzeWithOpenAI(content: string): Promise<AIAnalysisResult>
```

**Prompt Structure**:
- System message: Role definition
- User message: Content to analyze
- Response format: JSON with specific fields

**Output Fields**:
- `emailOpening` (18 words max, natural, warm)
- `toneKeywords` (3-5 adjectives)
- `storyArc` (2-3 sentences)
- `painPoints` (array of 3-5 items)

**Good Email Opening Example**:
```
"I really like how Beacon Healing Massage carries such a gentle, 
loving-kindness energy in its name alone."
```

**Bad Example** (too analytical):
```
"Your work in massage therapy truly highlights the healing power 
of touch and the importance of creating safe spaces for clients."
```

### Email Generation

**Static Template System** (no LLM for email assembly):
- Templates stored in `lib/email-templates.json`
- AI generates ONLY `emailOpening` (first 1-2 sentences)
- Rest of email is static template with `{firstName}` and `{emailOpening}` placeholders
- Subject line: "Quick note after seeing your work" (always static)

---

## Google Places Workflow

### 1. Search Phase

**User Action**: Enter query + location + review filters → Click Search

**Backend**:
```
POST /api/places/search
→ Build textQuery: "{query} in {location}"
→ Check 24hr cache
→ If miss: Call Google Places API
→ Filter: places with websiteUri AND within review range
→ Map to frontend structure (displayName, websiteUri, formattedAddress, etc)
→ Log to GOOGLE_PLACES_SEARCH_LOG.md
→ Return { places: [...], cached: boolean }
```

**Frontend**:
```
→ Receive places
→ Auto-call POST /api/open (save all to open_leads)
→ Switch to Open tab
→ Display success message
```

### 2. Open Tab

**Purpose**: Review all search results, decide which to promote or dismiss

**Actions**:
- Select individual leads (checkbox)
- Select All (bulk action)
- Filter by name, date range
- Create X Leads (promote selected)
- Dismiss (with optional reason)
- Clear All (delete all open leads)

### 3. Promote to CRM

**User Action**: Select leads → Click "Create X Leads"

**Backend**:
```
POST /api/leads/create-from-places { placeIds: [...] }
→ Fetch open_leads WHERE place_id IN (placeIds)
→ For each place:
   - INSERT INTO leads (name, website, status='lead_collected', automation_stage=0)
   - INSERT INTO promoted_leads (with lead_id)
→ Return { leadsCreated: number }
```

**Frontend**:
```
→ Clear selected places
→ Refresh Open leads (GET /api/open) - count decreases
→ Refresh Promoted leads (GET /api/promoted) - count increases
→ Show alert: "X lead(s) created and added to CRM!"
```

### 4. Dismiss Flow

**User Action**: Click Dismiss → Optional reason → Confirm

**Backend**:
```
POST /api/dismissed
→ INSERT INTO dismissed_leads (userId, placeId, placeName, reason)
→ DELETE FROM open_leads WHERE placeId
→ Return success
```

**Frontend**:
```
→ Clear from selected places
→ Refresh Open leads (count decreases)
→ Refresh Dismissed leads (count increases)
```

---

## Automation System

### Background Polling

**Hook**: `lib/hooks/useAutomation.ts`

```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    await fetch('/api/automation/process', { method: 'POST' });
  }, 60000); // 60 seconds
  return () => clearInterval(interval);
}, []);
```

### Processing Logic

**Stage 0 → 1 (Scraping)**:
```
Condition: automation_stage=0 AND created_at < (NOW() - 2 minutes)
Action: 
  → POST /api/scraper/deep { url: lead.website }
  → Save to raw_data_sources
  → UPDATE leads SET automation_stage=1, automation_stage_updated_at=NOW()
```

**Stage 1 → 2 (Analysis)**:
```
Condition: automation_stage=1 AND automation_stage_updated_at < (NOW() - 1 minute)
Action:
  → POST /api/leads/[id]/run-analysis
  → AI analyzes scraped content
  → Generate email opening
  → Save to ai_analyses + generated_emails
  → UPDATE leads SET automation_stage=2, automation_stage_updated_at=NOW()
```

### Error Handling

**On Failure**:
```sql
UPDATE leads 
SET automation_stage = -1, 
    automation_error = error_message
WHERE id = lead_id;
```

**Retry**: User clicks "Retry" button → Resets automation_stage to 0

---

## Common Patterns

### API Error Handling

```typescript
try {
  const { data, error } = await supabaseAdmin
    .from('table')
    .select('*');
  
  if (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Message' }, { status: 500 });
  }
  
  return NextResponse.json({ data });
} catch (error) {
  console.error('Unexpected error:', error);
  return NextResponse.json({ error: 'Message' }, { status: 500 });
}
```

### TypeScript Types

**Import**: `import type { Lead, AIAnalysis, GeneratedEmail } from '@/lib/types';`

**Usage**: Always type function returns and API responses

### Supabase Queries

**Server-side only**: Use `lib/supabase/admin.ts` (service role key)

```typescript
import { supabaseAdmin } from '@/lib/supabase/admin';

const { data, error } = await supabaseAdmin
  .from('leads')
  .select('*')
  .eq('status', 'lead_collected')
  .order('created_at', { ascending: false });
```

### Loading States

```typescript
const [isLoading, setIsLoading] = useState(false);

const handleAction = async () => {
  setIsLoading(true);
  try {
    // API call
  } finally {
    setIsLoading(false);
  }
};
```

---

## Configuration

### Environment Variables (`.env.local`)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx... (NOT anon key)

# OpenAI
OPENAI_API_KEY=sk-proj-xxx

# Google Places (Optional)
GOOGLE_PLACES_API_KEY=AIzaxxx
```

### Database Setup

1. Create Supabase project
2. Go to SQL Editor
3. Run `supabase-schema.sql` (full schema)
4. Verify tables created in Table Editor

---

## Troubleshooting

### "Could not find the 'X' column"
- Database schema out of sync
- Re-run `supabase-schema.sql`
- Check Supabase Table Editor

### Google Places returns 0 results
- Check API key is valid
- Verify New Places API (v1) is enabled
- Check quota/billing in Google Cloud Console
- Review search parameters (query, location, review filters)

### Automation not processing
- Check `useAutomation` hook is mounted
- Verify leads have `status='lead_collected'`
- Check `automation_stage` values (0 or 1)
- Look for errors in `automation_error` field
- Check timing: 2min for scraping, 1min for analysis

### AI analysis fails
- Verify OpenAI API key
- Check API credits/quota
- Look for rate limiting errors
- Fallback to gpt-4o-mini should trigger automatically

### Open leads not showing website links
- Old records saved before field mapping fix (Dec 12, 2025)
- Solution: Click "Clear All" in Open tab → Re-search
- New searches save with correct field mapping

---

## Quick Reference for AI Assistants

**When asked to...**

- **Add a new API route**: Create in `app/api/[name]/route.ts`, export `GET`/`POST`/`PATCH`/`DELETE` functions
- **Modify lead status**: Update `leads` table, consider impact on automation filtering
- **Change AI prompts**: Edit `lib/ai-service.ts` → `analyzeWithOpenAI()` function
- **Add new lead field**: Update database schema, TypeScript types (`lib/types/index.ts`), and UI components
- **Fix Google Places bug**: Check field mapping in both `/api/places/search` and `/api/open` (websiteUri vs website, etc.)
- **Modify email templates**: Edit `lib/email-templates.json` (no code changes needed)
- **Debug automation**: Check `/api/automation/process`, verify status filter, review timing logic
- **Update UI component**: Likely in `components/` folder, check CHANGELOG for recent refactoring

**Key Files to Know**:
- `lib/types/index.ts` - All TypeScript interfaces
- `lib/ai-service.ts` - AI analysis logic
- `components/places/GooglePlacesSearch.tsx` - Google Places UI (700 lines)
- `app/api/automation/process/route.ts` - Background worker
- `supabase-schema.sql` - Database source of truth
- `CHANGELOG.md` - Recent changes and reasoning

---

**End of Architecture Documentation**
