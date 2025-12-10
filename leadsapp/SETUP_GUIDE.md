# PersonaAI - Setup Guide

Your app is now **fully functional**! Follow these steps to complete the setup and start analyzing prospects.

---

## 🚀 Quick Start (3 Steps)

### 1. Setup Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once created, go to **SQL Editor** in your project dashboard
3. Copy and paste the entire contents of `supabase-schema.sql` into the editor
4. Click **Run** to create all tables, policies, and triggers

### 2. Get API Keys

#### Supabase Keys
- In your Supabase project, go to **Settings** → **API**
- Copy the **Project URL** and **service_role key** (NOT the anon key)

#### OpenAI API Key
- Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Create a new API key
- You'll need credits in your OpenAI account

#### Gemini API Key
- Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Click **Create API Key**
- Gemini has a generous free tier!

#### Google Places API Key (Optional - for Lead Scraper)
- See detailed setup guide: `GOOGLE_PLACES_SETUP.md`
- Enables searching for businesses and creating leads in bulk
- Pay-as-you-go pricing with $200 free credit for new accounts

### 3. Configure Environment Variables

Open `.env.local` and update with your real credentials:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Gemini
GEMINI_API_KEY=AIza...

# Google Places (Optional - for lead scraper)
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

---

## 🎯 Testing Your Setup

1. **Start the dev server** (if not already running):
   ```powershell
   npm run dev
   ```

2. **Open the app**: http://localhost:3000

3. **Run a test analysis**:
   - Enter a prospect name (e.g., "Sarah Jones")
   - Add a company name (optional)
   - Paste some sample website text
   - Optionally upload a JSON file with Instagram data
   - Click "Run Deep Analysis"

4. **What happens**:
   - Both Gemini and OpenAI analyze the data in parallel
   - Raw data is stored in `raw_data_sources` table
   - AI analyses are stored in `ai_analyses` table
   - An initial email is generated and stored in `generated_emails` table
   - Lead is created in `leads` table with status "analysis_done"

5. **Check the results**:
   - View the AI-generated persona profile
   - Read the personalized email draft
   - Click "Add to CRM" to see it in the leads table
   - Go to CRM tab to see all your analyzed prospects

---

## 📁 File Upload Formats

### Instagram Data (JSON)
Expected structure (from Instagram data export):
```json
{
  "posts": [
    {
      "caption": "Post caption here...",
      "timestamp": "2024-12-01",
      "likes": 150
    }
  ]
}
```

### Text Files (Substack, Threads, Other)
Just plain text files (.txt) with the content you want to analyze.

---

## 🔍 API Routes

Your backend API is now live at:

- `POST /api/analyze` - Run full prospect analysis
- `GET /api/leads` - Fetch all leads
- `POST /api/leads` - Create new lead
- `GET /api/leads/[id]` - Get lead details with related data
- `PATCH /api/leads/[id]` - Update lead status
- `POST /api/emails/generate` - Generate follow-up emails

---

## 🛠️ Troubleshooting

### Build Errors
If you see TypeScript errors, run:
```powershell
npm run build
```

### Database Errors
- Make sure you ran the entire `supabase-schema.sql` file
- Verify your `SUPABASE_SERVICE_ROLE_KEY` is the service role key, not the anon key
- Check the Supabase logs in your project dashboard

### AI Analysis Errors
- Verify your API keys are correct in `.env.local`
- Check you have credits/quota for OpenAI
- Gemini is free but has rate limits - if you hit them, wait a minute

### File Upload Issues
- Instagram files must be valid JSON
- File size limit is handled by Next.js (default 4MB)
- Make sure `accept` attributes match your file types

---

## 🎨 Customization

### Change AI Models
Edit `lib/ai-service.ts`:

**Gemini models** (December 2025):
- `gemini-3-pro` - BEST: "Best model in the world for multimodal understanding" (DEFAULT)
- `gemini-2.5-pro` - Advanced thinking model (FALLBACK 1)
- `gemini-2.5-flash` - Fast, cost-effective (FALLBACK 2)

**OpenAI models** (December 2025):
- `gpt-5.1` - NEWEST: Latest GPT-5 family, November 2025 (DEFAULT)
- `gpt-5` - Standard GPT-5, August 2025 (FALLBACK 1)
- `o3` - Advanced reasoning model (FALLBACK 2)
- `gpt-4o` - Reliable workhorse (FALLBACK 3)

The app automatically tries the newest model first and falls back to older ones if it fails!

### Adjust Prompts
The analysis prompts are in `lib/ai-service.ts` in the `analyzeWithGemini()` and `analyzeWithOpenAI()` functions.

### Email Templates
Email generation logic is in `generateEmailWithOpenAI()` in `lib/ai-service.ts`.

---

## 📊 Database Schema

### Tables Created
1. **leads** - Main prospect records
2. **raw_data_sources** - Uploaded files and data
3. **ai_analyses** - Gemini and OpenAI analysis results
4. **generated_emails** - AI-generated email drafts

All tables have Row Level Security (RLS) enabled and timestamps.

---

## 🎉 You're Ready!

Your PersonaAI app is now fully functional with:
- ✅ Dual LLM analysis (Gemini + OpenAI)
- ✅ File upload support (JSON/text)
- ✅ Database persistence (Supabase)
- ✅ Email generation
- ✅ CRM/leads pipeline
- ✅ Real-time UI updates

Start analyzing prospects and watch the AI generate personalized insights!
