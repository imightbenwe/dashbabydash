# Gmail API Integration - Complete Setup Guide

## Overview

This integration automatically syncs your Gmail inbox and sent folder to:
- **Track sent follow-ups** - Automatically updates `followup_X_sent_at` and lead status
- **Detect replies** - Classifies responses as interested/not-fit/needs-info
- **Update last touch dates** - Keeps communication history accurate
- **Cancel pending follow-ups** - When leads reply, stops automation

## Step 1: Google Cloud Console Setup

### 1.1 Create/Select Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing one
3. Name it "PersonaAI Gmail Integration" (or your choice)

### 1.2 Enable Gmail API
1. Go to [Enable Gmail API](https://console.cloud.google.com/flows/enableapi?apiid=gmail.googleapis.com)
2. Select your project
3. Click "Enable"

### 1.3 Configure OAuth Consent Screen
1. Go to [OAuth Consent Screen](https://console.cloud.google.com/auth/branding)
2. Choose **External** user type (unless you have Google Workspace)
3. Fill in required fields:
   - **App name**: PersonaAI Lead Tracker
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue**
5. **Scopes** page:
   - Click "Add or Remove Scopes"
   - Search for "Gmail API"
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
   - Click **Update** then **Save and Continue**
6. **Test users** (while in testing mode):
   - Add your Gmail address
   - Click **Save and Continue**
7. Click **Back to Dashboard**

### 1.4 Create OAuth Client ID
1. Go to [API Credentials](https://console.cloud.google.com/apis/credentials)
2. Click **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Name: "PersonaAI Web Client"
5. **Authorized redirect URIs** - Add both:
   - `http://localhost:3000/api/gmail/callback` (for local dev)
   - `https://your-production-domain.com/api/gmail/callback` (for production)
6. Click **Create**
7. **Download JSON** - save as `gmail_credentials.json` (don't commit to git!)
8. Copy the **Client ID** and **Client Secret**

## Step 2: Database Setup

### 2.1 Run Migration
1. Open Supabase SQL Editor
2. Open `GMAIL_OAUTH_MIGRATION.sql`
3. Run the migration
4. Creates these tables:
   - `user_gmail_auth` - Stores OAuth tokens
   - `gmail_sync_log` - Tracks sync history
   - `gmail_message_cache` - Prevents duplicate processing

## Step 3: Environment Variables

Add to `.env.local`:

```bash
# Gmail OAuth Credentials (from Google Cloud Console)
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret

# OAuth Redirect URI
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/gmail/callback
# For production, use: https://your-domain.com/api/gmail/callback
```

## Step 4: Install Dependencies

```bash
cd leadsapp
npm install
```

This installs `googleapis@168.0.0` (latest Gmail API client).

## Step 5: Start Development Server

```bash
npm run dev
```

## Step 6: Connect Gmail

### 6.1 Add GmailSync Component to UI
In your main CRM page (`app/page.tsx`), add:

```tsx
import { GmailSync } from '@/components/gmail/GmailSync';

// Inside your component:
<GmailSync />
```

### 6.2 Authorize Gmail Access
1. Open app in browser (http://localhost:3000)
2. Find "Gmail Integration" card
3. Click **Connect Gmail** button
4. Sign in with your Gmail account
5. Review permissions and click **Allow**
6. You'll be redirected back to the app

## Step 7: Test Sync

### 7.1 Manual Sync
1. After connecting, click **Sync Now** button
2. Watch console for sync progress
3. Check leads table for updated status/dates

### 7.2 Verify Results
- Sent emails should update `followup_X_sent_at`
- Received emails should update `status` based on sentiment
- All emails should update `last_touch_date`

## How It Works

### Sent Email Sync
```
1. Query Gmail sent folder (last 90 days)
2. For each sent email:
   - Extract recipient email
   - Find matching lead in database
   - Determine followup number (by subject/timing)
   - Update lead status and followup_X_sent_at
   - Cache message ID to avoid reprocessing
```

### Inbox Email Sync
```
1. Query Gmail inbox (last 90 days)
2. For each received email:
   - Extract sender email
   - Find matching lead in database
   - Classify sentiment (interested/not-fit/needs-info)
   - Update lead status
   - Update last_touch_date
   - Cache message ID
```

### Automatic Sentiment Detection
```typescript
Positive → replied_interested
  Keywords: "interested", "yes", "let's talk", "schedule"

Negative → replied_not_fit
  Keywords: "not interested", "no thanks", "unsubscribe"

Neutral → replied_needs_info
  Default when lead replies but unclear intent
```

## Automatic Sync Schedule

The sync runs automatically every hour via cron job. To set this up on Vercel:

1. Create `vercel.json` cron configuration (coming in Phase 7)
2. Or use manual "Sync Now" button as needed

## Security Notes

- OAuth tokens are stored encrypted in Supabase
- Only `gmail.readonly` and `gmail.modify` scopes requested
- Refresh tokens never expire (unless user revokes)
- Access tokens auto-refresh when expired
- Only emails to/from known leads are processed

## Troubleshooting

### "Gmail not connected" error
- Run migration: `GMAIL_OAUTH_MIGRATION.sql`
- Verify OAuth credentials in `.env.local`
- Check redirect URI matches Google Cloud Console

### Tokens not refreshing
- Ensure `access_type: 'offline'` in auth URL
- Verify `prompt: 'consent'` forces new refresh token
- Check database has `refresh_token` stored

### Emails not syncing
- Check `gmail_sync_log` table for errors
- Verify lead email addresses match exactly
- Check date range (default: last 90 days)
- Look for errors in server console

### OAuth redirect fails
- Verify redirect URI in Google Cloud Console
- Check it matches `.env.local` exactly
- Ensure `/api/gmail/callback` endpoint exists

## API Endpoints

- `GET /api/gmail/auth` - Start OAuth flow
- `GET /api/gmail/callback` - OAuth callback handler
- `POST /api/gmail/sync` - Trigger manual sync
- `GET /api/gmail/sync?userEmail=...` - Check connection status

## Database Tables

### `user_gmail_auth`
Stores OAuth tokens per Gmail account.

### `gmail_sync_log`
Tracks every sync operation (started, completed, errors).

### `gmail_message_cache`
Prevents reprocessing same emails (by Gmail message ID).

## Production Deployment

1. Update `GOOGLE_OAUTH_REDIRECT_URI` to production URL
2. Add production redirect URI to Google Cloud Console
3. Deploy to Vercel/your hosting
4. Reconnect Gmail (new redirect URI = new auth)
5. Set up cron job for automatic hourly sync

## Monitoring

Check sync status:
```sql
-- Recent syncs
SELECT * FROM gmail_sync_log 
ORDER BY started_at DESC 
LIMIT 10;

-- Sync performance
SELECT 
  status,
  COUNT(*),
  AVG(emails_processed),
  AVG(leads_updated)
FROM gmail_sync_log
GROUP BY status;

-- Recently processed emails
SELECT * FROM gmail_message_cache
ORDER BY processed_at DESC
LIMIT 20;
```

## Next Steps

After basic setup works:
1. Add cron job for automatic hourly sync
2. Implement webhook for real-time push notifications
3. Add more sophisticated sentiment analysis (use OpenAI API)
4. Support multiple Gmail accounts per user
5. Add email threading detection (match entire conversation)

---

**Questions?** Check the code comments in:
- `lib/gmail-oauth-service.ts` - OAuth handling
- `lib/gmail-sync-service.ts` - Core sync logic
- `components/gmail/GmailSync.tsx` - UI component
