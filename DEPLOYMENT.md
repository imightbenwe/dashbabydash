# Deployment Configuration for DashBabyDash + LeadsApp

## Architecture Overview

This project combines:
1. **Static HTML Site** (root) - dashbabydash.com
2. **Next.js App** (leadsapp/) - for CRM and demo generation

## Deployment Option 1: Separate Vercel Projects (Recommended)

### Main Site (dashbabydash.com)
- Deploy from root directory
- Serves static HTML files
- No build step needed

### LeadsApp (leadsapp.dashbabydash.com or dashbabydash.com/leadsapp)
- Deploy leadsapp folder as separate Vercel project
- Custom domain: `leadsapp.dashbabydash.com`
- Environment variables needed:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY
  - OPENAI_API_KEY
  - GEMINI_API_KEY

## Deployment Option 2: Monorepo with Vercel

Create `vercel.json` in root:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "leadsapp/package.json",
      "use": "@vercel/next",
      "config": {
        "rootDirectory": "leadsapp"
      }
    }
  ],
  "routes": [
    { "handle": "filesystem" },
    { "src": "/leadsapp.*", "dest": "/leadsapp/$1" },
    { "src": "/(.*)", "dest": "/$1" }
  ]
}
```

## Demo Generation Workflow

1. Access leadsapp at `/leadsapp` or `leadsapp.dashbabydash.com`
2. Use "Generate Demos" tab
3. Paste HTML content
4. System creates static file at `/demos/client-name/index.html`
5. File is committed to git (or uploaded to Vercel deployment)
6. Accessible at `dashbabydash.com/demos/client-name/`

## Setup Steps

1. **For LeadsApp:**
   ```bash
   cd leadsapp
   npm install
   cp .env.example .env.local
   # Add your API keys to .env.local
   npm run dev
   ```

2. **For Static Site:**
   - Just open index.html in browser
   - Or deploy to Vercel from root

3. **Database Setup:**
   - Run leadsapp/supabase-schema.sql in your Supabase project
   - Create storage bucket called "demos" in Supabase Storage
   - Make bucket public

## Environment Variables for LeadsApp

Copy to `leadsapp/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_key
GEMINI_API_KEY=your_gemini_key
```

## Current Limitation

The demo generation API creates files on the server filesystem. For this to work in production:

### Option A: Manual Copy (Simple)
1. Generate demo locally
2. Copy `/demos/client-name/` folder to your static site
3. Commit and push to GitHub
4. Vercel auto-deploys

### Option B: Git Integration (Advanced)
- Modify API to use GitHub API to create files
- Requires GitHub personal access token
- Automatically commits demo files to repo

### Option C: Pure Static (Current Setup)
- Just create HTML manually in /demos folder
- Use the leadsapp for lead tracking only
- Keep it simple!
