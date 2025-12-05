# Quick Start Guide - DashBabyDash + LeadsApp

## What You Just Got

✅ **Main Site** (dashbabydash.com) - Your spiritual systems reset website  
✅ **LeadsApp** (in `/leadsapp`) - CRM for prospects + Demo page generator  
✅ **Demo Generator** - Paste HTML, get public demo pages instantly

## How to Use the Demo Generator

### 1. Set Up LeadsApp Locally

```powershell
cd leadsapp
npm install
```

### 2. Configure Environment

Create `leadsapp/.env.local`:

```env
# Get these from https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Optional - if you want AI features
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...
```

### 3. Set Up Database (One-Time)

1. Go to your Supabase project
2. Open SQL Editor
3. Run the SQL from `leadsapp/supabase-schema.sql`

### 4. Run the App

```powershell
cd leadsapp
npm run dev
```

Open http://localhost:3000

### 5. Generate a Demo Page

1. Click **"Generate Demos"** in the sidebar
2. Enter client name: `john-doe`
3. Paste your complete HTML:
   ```html
   <!DOCTYPE html>
   <html>
   <head><title>John Doe Demo</title></head>
   <body><h1>Welcome John!</h1></body>
   </html>
   ```
4. Click **"Generate Static Demo"**
5. File created at: `/demos/john-doe/index.html`

### 6. Make It Live

```powershell
# From root directory
git add demos/
git commit -m "Add demo for John Doe"
git push
```

Vercel auto-deploys → Live at `dashbabydash.com/demos/john-doe/`

## Workflow Example

**Scenario:** You build a custom site for a prospect named "Toni"

1. **Build the HTML** (in any editor, or use AI)
2. **Open LeadsApp** → Generate Demos tab
3. **Paste HTML**, name it "toni"
4. **Click Generate** → Creates `/demos/toni/index.html`
5. **Commit & Push** → Live at `dashbabydash.com/demos/toni/`
6. **Send to Toni:** "Check out your site: dashbabydash.com/demos/toni/"

## Current Setup

```
DashBabyDash/
├── index.html              # Main landing page
├── demos/                  # Generated demo pages
│   └── toni/              # Example demo
│       └── index.html
├── leadsapp/              # Next.js CRM app
│   ├── app/
│   │   ├── page.tsx       # Main dashboard
│   │   └── api/
│   │       └── demos/generate/  # Demo generation API
│   └── .env.local         # Your API keys (create this)
└── DEPLOYMENT.md          # Deployment options
```

## Features of LeadsApp

1. **Prospect Analysis** - Upload Instagram/Substack data, get AI insights
2. **CRM Pipeline** - Track leads through stages
3. **Email Templates** - Proven cold email frameworks
4. **Demo Generator** ⭐ - Paste HTML → Public demo page

## Tips

- **Images in demos:** Just use regular `<img src="...">` tags with public URLs
- **Updating demos:** Re-run the generator, it overwrites the file
- **Testing locally:** Generated files work immediately in `/demos/client-name/`
- **No database needed** for demos - they're just static HTML files!

## Troubleshooting

**"Module not found" errors:**
```powershell
cd leadsapp
npm install
```

**Demo file not created:**
- Check console logs in terminal
- Verify you're in the right directory
- Path should be: `DashBabyDash/demos/client-name/`

**Can't connect to Supabase:**
- Check `.env.local` exists in `leadsapp/` folder
- Verify API keys are correct
- Database schema must be set up first

## Next Steps

1. ✅ Test the demo generator locally
2. Set up your Supabase account (if you want CRM features)
3. Generate your first demo
4. Commit and push to make it live
5. Use it for client outreach!

---

Need help? Check:
- `DEPLOYMENT.md` - Deployment configurations
- `leadsapp/README.md` - Full LeadsApp documentation
- `leadsapp/SETUP_GUIDE.md` - Original PersonaAI setup guide
