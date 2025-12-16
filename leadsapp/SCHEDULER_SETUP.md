# Email Scheduler Setup Guide

This guide walks you through setting up the automated email scheduler system.

## Prerequisites

1. Supabase database with the email queue tables
2. Vercel-deployed Next.js app
3. Gmail OAuth connected

## Step 1: Run Database Migrations

Run these migrations in order in your Supabase SQL Editor:

1. **EMAIL_QUEUE_MIGRATION.sql** - Creates the base email queue table
2. **PHASE2_QUEUE_ENHANCEMENT.sql** - Adds retry logic, audit trails, and watchdog functions

## Step 2: Generate CRON_SECRET

Generate a secure random secret:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using openssl
openssl rand -hex 32
```

Example output: `a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456`

## Step 3: Add Environment Variables to Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable:

| Name | Value | Environments |
|------|-------|--------------|
| `CRON_SECRET` | (your generated secret) | Production, Preview |

4. Click **Save**
5. **Redeploy** your app for the changes to take effect

## Step 4: Add GitHub Repository Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

| Name | Value |
|------|-------|
| `APP_URL` | Your Vercel app URL (e.g., `https://your-app.vercel.app`) |
| `CRON_SECRET` | Same secret you added to Vercel |

## Step 5: Enable GitHub Actions

The workflow file is at `.github/workflows/email-scheduler.yml`.

1. Push the workflow file to your repository
2. Go to **Actions** tab in your GitHub repo
3. You should see "Email Scheduler" workflow
4. It will automatically run every 5 minutes

## Step 6: Test the Setup

### Manual Test via GitHub Actions

1. Go to **Actions** → **Email Scheduler**
2. Click **Run workflow**
3. Choose your branch and optionally adjust batch size
4. Click **Run workflow**
5. Watch the run and check the logs

### Manual Test via cURL

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 1}' \
  https://your-app.vercel.app/api/cron/send-emails
```

### Health Check

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/send-emails
```

## Configuration Options

The scheduler accepts these configuration options in the POST body:

```json
{
  "batchSize": 5,                    // Emails per run (default: 5)
  "sendingTimezone": "America/New_York",  // Timezone for business hours
  "businessHoursStart": 9,           // Start hour (24h format)
  "businessHoursEnd": 18,            // End hour (24h format)
  "enableWeekends": false,           // Send on weekends?
  "stuckThresholdMinutes": 10        // Timeout for stuck emails
}
```

## Monitoring

### View Queue Status

The GET endpoint returns current queue stats:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/send-emails
```

Response:
```json
{
  "status": "healthy",
  "queue": {
    "approved": 3,
    "sending": 0,
    "failed": 1
  },
  "sentToday": 15,
  "timestamp": "2024-12-16T14:30:00.000Z"
}
```

### View in Supabase

Query the `email_queue_status` view for a complete picture:

```sql
SELECT * FROM email_queue_status;
```

### View Audit Trail

```sql
SELECT * FROM email_send_attempts 
ORDER BY created_at DESC 
LIMIT 50;
```

## Troubleshooting

### Emails Not Sending

1. **Check business hours**: Scheduler only runs 9 AM - 6 PM Eastern by default
2. **Check queue**: Are there approved emails in `email_send_queue`?
3. **Check Gmail auth**: Is `user_gmail_auth` table populated?

### 401 Unauthorized

- Verify `CRON_SECRET` matches in both Vercel and GitHub
- Check the secret doesn't have trailing whitespace

### Stuck Emails

The watchdog automatically recovers emails stuck in "sending" state for >10 minutes.
Check `email_send_attempts` for error details.

### Rate Limiting

Gmail has sending limits. If you hit them, emails will fail with rate limit errors.
The system will automatically retry these with exponential backoff (5, 10, 15 minutes).

## Architecture Overview

```
┌─────────────────────┐     ┌─────────────────────────────┐
│   GitHub Actions    │────▶│  /api/cron/send-emails      │
│   (every 5 min)     │     │                             │
└─────────────────────┘     │  1. Verify CRON_SECRET      │
                            │  2. Check business hours    │
                            │  3. Run watchdog            │
                            │  4. Claim batch (atomic)    │
                            │  5. Send via Gmail API      │
                            │  6. Update DB status        │
                            └─────────────────────────────┘
                                          │
                                          ▼
                            ┌─────────────────────────────┐
                            │        Supabase             │
                            │  • email_send_queue         │
                            │  • email_send_attempts      │
                            │  • leads                    │
                            └─────────────────────────────┘
```
