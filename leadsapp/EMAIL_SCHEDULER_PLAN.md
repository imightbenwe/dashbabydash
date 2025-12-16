# Email Scheduler Architecture Plan

## Overview

Replace the broken browser-polling approach with a proper **GitHub Actions cron job** that reliably processes the email queue even when no browser is open.

## Current State (Problems)

1. **No reliable scheduler** - Old system used browser `setInterval` which:
   - Only runs when browser is open
   - Caused duplicate sends (5 emails to same person)
   - No protection against race conditions

2. **Rate limiting is naive** - Just counts "sent in last hour"

3. **No retry logic** - Failed emails sit in "failed" forever

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      WAITING ROOM UI                        │
│                  (Manual Review & Approve)                  │
│              localhost:3000/pipeline/waiting-room           │
└─────────────────────┬───────────────────────────────────────┘
                      │ Click "Approve & Schedule"
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   email_send_queue (Postgres)               │
│                                                             │
│   status: approved → sending → sent/failed                  │
│   scheduled_for: when to send                               │
│   retry_count: 0, 1, 2, 3 (max retries)                     │
│                                                             │
│   Protected by:                                             │
│   - Unique index (no duplicate pending emails)              │
│   - Atomic claim function (FOR UPDATE SKIP LOCKED)          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              GITHUB ACTIONS CRON (every 5 min)              │
│                                                             │
│   .github/workflows/email-scheduler.yml                     │
│                                                             │
│   - Runs: */5 9-18 * * 1-5 (business hours, weekdays)       │
│   - Calls: POST /api/cron/send-emails                       │
│   - Auth: CRON_SECRET header                                │
│   - Logs results to GitHub Actions                          │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Steps

### 1. Database Changes

Add retry tracking to `email_send_queue`:

```sql
-- Add retry columns
ALTER TABLE email_send_queue 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Update status check to include 'retry'
ALTER TABLE email_send_queue 
DROP CONSTRAINT IF EXISTS email_send_queue_status_check;

ALTER TABLE email_send_queue 
ADD CONSTRAINT email_send_queue_status_check 
CHECK (status IN ('approved', 'sending', 'sent', 'failed', 'retry'));
```

### 2. New API Endpoint: `/api/cron/send-emails`

```typescript
// app/api/cron/send-emails/route.ts

- Verify CRON_SECRET header
- Check business hours (optional, can also be in cron schedule)
- Call atomic claim_next_email()
- Send email via Gmail API
- Update status to 'sent' or handle failure
- On failure: increment retry_count, set next_retry_at with exponential backoff
- After 3 retries: mark as 'failed', move to "Requires Attention"
```

### 3. GitHub Actions Workflow

```yaml
# .github/workflows/email-scheduler.yml

name: Email Scheduler

on:
  schedule:
    # Every 5 minutes, 9 AM - 6 PM EST, Monday-Friday
    # Note: GitHub uses UTC, so 9-18 EST = 14-23 UTC (or 13-22 during DST)
    - cron: '*/5 14-23 * * 1-5'
  workflow_dispatch: # Allow manual trigger for testing

jobs:
  send-emails:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger email processing
        run: |
          curl -X POST "${{ secrets.APP_URL }}/api/cron/send-emails" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

### 4. Environment Variables

Add to Vercel (and GitHub Secrets):

```
CRON_SECRET=<generate-random-32-char-string>
```

Add to GitHub Repository Secrets:
```
APP_URL=https://your-app.vercel.app
CRON_SECRET=<same-value-as-vercel>
```

## Rate Limiting Strategy

**Token Bucket** approach:
- Bucket size: 10 emails
- Refill rate: 10 per hour
- Each send consumes 1 token
- If bucket empty, wait for refill

Implementation in database:
```sql
CREATE TABLE email_rate_limit (
  id INTEGER PRIMARY KEY DEFAULT 1,
  tokens_available DECIMAL DEFAULT 10,
  last_refill_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1) -- Singleton row
);
```

## Retry Logic

| Retry # | Wait Time | Total Elapsed |
|---------|-----------|---------------|
| 1       | 5 min     | 5 min         |
| 2       | 30 min    | 35 min        |
| 3       | 2 hours   | 2h 35m        |
| Failed  | -         | Move to attention queue |

## Monitoring

GitHub Actions provides:
- Run history and logs
- Email notifications on failure
- Manual re-run capability

## Security

1. **CRON_SECRET** - Prevents unauthorized calls to the cron endpoint
2. **Atomic claiming** - Prevents duplicate sends even if cron runs twice
3. **Rate limiting** - Prevents Gmail API abuse
4. **Business hours** - Built into cron schedule

## Migration Path

1. ✅ Queue table already exists with atomic locking
2. Run SQL to add retry columns
3. Create `/api/cron/send-emails` endpoint
4. Add CRON_SECRET to Vercel env vars
5. Add secrets to GitHub repository
6. Create `.github/workflows/email-scheduler.yml`
7. Test with `workflow_dispatch` (manual trigger)
8. Monitor first few automated runs

## Costs

- **GitHub Actions**: Free tier includes 2,000 minutes/month
- **This workflow**: ~30 seconds per run × 108 runs/day (9 hours × 12 per hour) = ~54 minutes/day = ~1,620 minutes/month
- **Verdict**: Well within free tier

## Alternative: Supabase Edge Functions + pg_cron

If GitHub Actions proves unreliable, Supabase offers:
- `pg_cron` extension for database-level scheduling
- Edge Functions that can be triggered by database events

But GitHub Actions is simpler to start with and easier to debug.
