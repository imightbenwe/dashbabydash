# Email Scheduler Setup Guide

Complete guide for the automated email sending system.

## Overview

- **GitHub Actions cron** runs every 20 minutes (free tier: ~2,160 min/month)
- **Server-side endpoint** sends approved emails via Gmail API
- **Business hours** enforcement (9 AM - 6 PM Eastern, weekdays)
- **Automatic retries** for failed emails (max 3 attempts)
- **Watchdog** recovers stuck emails

---

## Quick Setup Checklist

- [ ] Run `supabase-schema.sql` in Supabase SQL Editor
- [ ] Generate `CRON_SECRET` and add to Vercel env vars
- [ ] Add `LEADSAPP_URL` and `CRON_SECRET` to GitHub Secrets
- [ ] Add production redirect URI to Google Cloud Console
- [ ] Connect Gmail in the app

---

## Step 1: Generate CRON_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 2: Vercel Environment Variables

Go to Vercel → `dash-leadsapp` → **Settings** → **Environment Variables**

| Name | Value |
|------|-------|
| `CRON_SECRET` | (your generated secret) |

Redeploy after adding.

---

## Step 3: GitHub Repository Secrets

Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**

| Name | Value |
|------|-------|
| `LEADSAPP_URL` | `https://dash-leadsapp.vercel.app` |
| `CRON_SECRET` | (same secret from Step 1) |

---

## Step 4: Google Cloud Console

Add this redirect URI to your OAuth 2.0 Client:

```
https://dash-leadsapp.vercel.app/api/gmail/callback
```

---

## Step 5: Connect Gmail

1. Go to https://dash-leadsapp.vercel.app
2. Navigate to Gmail Settings
3. Click "Connect Gmail"
4. Authorize with Google

---

## Testing

### Manual Trigger
1. GitHub → **Actions** → **Email Scheduler**
2. Click **Run workflow**
3. Check summary for results

### Expected (no emails queued)
```
Claimed: 0
Sent: 0
Skipped: No emails due to send
```

---

## How It Works

```
GitHub Actions (every 20 min)
         │
         ▼
/api/cron/send-emails
         │
         ├─ Verify CRON_SECRET
         ├─ Check business hours (skip if outside 9-6 ET)
         ├─ Run watchdog (recover stuck emails)
         ├─ Claim batch atomically
         ├─ Send via Gmail API
         └─ Update database
         │
         ▼
    Supabase DB
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | `CRON_SECRET` must match exactly in Vercel and GitHub |
| Emails not sending | Check business hours, Gmail connection, Approved queue |
| Gmail auth error | Re-connect Gmail, verify redirect URI in Google Console |

---

## Monitoring

### In App
- **Waiting Room** → **Approved**: Queued emails
- **Waiting Room** → **Failed**: Failed with errors

### In Supabase
```sql
SELECT status, COUNT(*) FROM email_send_queue GROUP BY status;
```
