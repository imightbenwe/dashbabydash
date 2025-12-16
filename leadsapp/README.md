# PersonaAI - Lead CRM & Email Automation

AI-powered prospect analysis, CRM, and automated email outreach.

**Production URL**: https://dash-leadsapp.vercel.app

---

## 🚀 Features

### Lead Management
- Import leads from Google Places search
- Scrape websites for contact info
- AI analysis with OpenAI GPT-4o
- Track through pipeline stages

### Email Automation
- Generate personalized cold emails with AI
- Gmail OAuth integration
- Automated follow-up sequences (3 follow-ups)
- Server-side scheduler via GitHub Actions (every 20 min)
- Business hours enforcement (9 AM - 6 PM ET, weekdays)

### Demo Generator
- Generate mockup websites with Gemini AI
- Deploy to `/demos/client-name/`
- Show prospects their potential site

---

## 📋 Setup

### Prerequisites
- Node.js 18+
- Supabase project
- OpenAI API key
- Google Cloud project (Places API, Gmail OAuth)

### Quick Start

1. **Clone and install**
   ```bash
   cd leadsapp
   npm install
   cp .env.example .env.local
   ```

2. **Configure `.env.local`**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   OPENAI_API_KEY=sk-...
   GEMINI_API_KEY=your-gemini-key
   GOOGLE_PLACES_API_KEY=your-places-key
   GOOGLE_OAUTH_CLIENT_ID=your-client-id
   GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
   GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/gmail/callback
   ```

3. **Setup database**
   - Run `supabase-schema.sql` in Supabase SQL Editor

4. **Run locally**
   ```bash
   npm run dev
   ```

---

## 🔐 Authentication

The app uses Supabase Auth (login only, no public signup).

**Create admin user:**
1. Supabase Dashboard → Authentication → Users
2. Add user with your email/password
3. Check "Auto Confirm User"

---

## 📧 Email Scheduler Setup

See [SCHEDULER_SETUP.md](SCHEDULER_SETUP.md) for complete guide.

**Quick version:**
1. Add `CRON_SECRET` to Vercel env vars
2. Add `LEADSAPP_URL` + `CRON_SECRET` to GitHub Secrets
3. Add production callback to Google OAuth
4. Connect Gmail in app

---

## 📁 Project Structure

```
leadsapp/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── cron/          # Scheduled tasks
│   │   ├── gmail/         # Gmail OAuth & sending
│   │   ├── leads/         # Lead CRUD
│   │   └── ...
│   ├── lead/[id]/         # Lead detail page
│   └── pipeline/          # Pipeline views
├── components/            # React components
├── lib/                   # Utilities & services
└── docs (*.md files)      # Documentation
```

---

## 📖 Documentation

| File | Description |
|------|-------------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture & data flows |
| [SCHEDULER_SETUP.md](SCHEDULER_SETUP.md) | Email scheduler configuration |
| [GMAIL_SETUP_GUIDE.md](GMAIL_SETUP_GUIDE.md) | Gmail OAuth setup |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: OpenAI GPT-4o, Google Gemini
- **Email**: Gmail API
- **Styling**: Tailwind CSS, shadcn/ui
- **Deployment**: Vercel
- **Scheduler**: GitHub Actions
