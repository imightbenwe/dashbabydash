# Email Scheduler Architecture Plan (Revised)

> **Last Updated**: December 16, 2025  
> **Status**: Ready for Implementation  
> **Contributors**: Claude, GPT 5.2, Gemini 3

## Overview

Replace the broken browser-polling approach with a proper **GitHub Actions cron job** that reliably processes the email queue even when no browser is open.

## Current State (Problems)

1. **No reliable scheduler** - Old system used browser `setInterval` which:
   - Only runs when browser is open
   - Caused duplicate sends (5 emails to same person)
   - No protection against race conditions

2. **Rate limiting is naive** - Just counts "sent in last hour"

3. **No retry logic** - Failed emails sit in "failed" forever

4. **No crash recovery** - Emails stuck in "sending" status forever if server crashes

5. **No audit trail** - Hard to debug why emails failed

---

## Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      WAITING ROOM UI                        │
│                  (Manual Review & Approve)                  │
│              localhost:3000/pipeline/waiting-room           │
│                                                             │
│   Features:                                                 │
│   - Preview emails before sending                           │
│   - Approve individually or in bulk                         │
│   - "Failed" tab with Retry/Dismiss actions                 │
└─────────────────────┬───────────────────────────────────────┘
                      │ Click "Approve & Schedule"
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   email_send_queue (Postgres)               │
│                                                             │
│   status: approved → sending → sent/failed                  │
│   (NO 'retry' status - use next_retry_at instead)           │
│                                                             │
│   Protected by:                                             │
│   - Unique partial index (no duplicate pending emails)      │
│   - Atomic batch claim function (FOR UPDATE SKIP LOCKED)    │
│   - Idempotency key (prevents duplicate sends on timeout)   │
│   - Stuck email recovery (watchdog for crashed sends)       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              GITHUB ACTIONS CRON (every 5 min, 24/7)        │
│                                                             │
│   .github/workflows/email-scheduler.yml                     │
│                                                             │
│   - Runs: */5 * * * * (every 5 min, all day)                │
│   - Business hours enforced IN CODE (America/New_York)      │
│   - Calls: POST /api/cron/send-emails                       │
│   - Auth: Authorization: Bearer <CRON_SECRET>               │
│   - Concurrency: max 1 (no overlapping runs)                │
│   - Timeout: 4 minutes (fail fast)                          │
│   - Logs results to GitHub Actions                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### 1. Database Migration: Enhanced Queue Table

**Key Design Decision**: NO `'retry'` status! 

Adding a `'retry'` status would bypass the unique partial index and allow duplicate emails. Instead, keep `status='approved'` and use `next_retry_at` to gate retries.

```sql
-- ============================================================
-- ENHANCED EMAIL QUEUE MIGRATION
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add retry tracking columns (NO new status value!)
ALTER TABLE email_send_queue 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- 2. Add crash recovery tracking
ALTER TABLE email_send_queue 
ADD COLUMN IF NOT EXISTS sending_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Add idempotency for Gmail timeout protection
ALTER TABLE email_send_queue 
ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(64),
ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);

-- 4. Generate idempotency keys for existing rows
UPDATE email_send_queue 
SET idempotency_key = encode(sha256((lead_id::text || email_type || approved_at::text)::bytea), 'hex')
WHERE idempotency_key IS NULL;

-- 5. Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_email_queue_updated_at ON email_send_queue;
CREATE TRIGGER update_email_queue_updated_at
    BEFORE UPDATE ON email_send_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 6. Index for retry-aware queue processing
DROP INDEX IF EXISTS idx_email_queue_status_scheduled;
CREATE INDEX idx_email_queue_ready 
  ON email_send_queue(status, scheduled_for, next_retry_at) 
  WHERE status = 'approved';

-- 7. Index for stuck email detection
CREATE INDEX IF NOT EXISTS idx_email_queue_sending 
  ON email_send_queue(status, sending_started_at) 
  WHERE status = 'sending';
```

### 2. Database: Audit Trail Table

```sql
-- ============================================================
-- EMAIL SEND ATTEMPTS (Audit Trail)
-- ============================================================

CREATE TABLE IF NOT EXISTS email_send_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id UUID NOT NULL REFERENCES email_send_queue(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'timeout'
  error_message TEXT,
  response_meta JSONB, -- Store Gmail API response details
  provider_message_id VARCHAR(255),
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_attempts_queue ON email_send_attempts(queue_id);
CREATE INDEX idx_email_attempts_status ON email_send_attempts(status, created_at);
```

### 3. Database: Batch Claim Function (Retry-Aware)

```sql
-- ============================================================
-- BATCH CLAIM FUNCTION (Replaces single-email claim)
-- Supports retry logic via next_retry_at
-- ============================================================

CREATE OR REPLACE FUNCTION claim_next_emails(
  p_limit INTEGER,
  p_max_scheduled TIMESTAMPTZ
)
RETURNS SETOF email_send_queue AS $$
BEGIN
  RETURN QUERY
  UPDATE email_send_queue
  SET 
    status = 'sending',
    sending_started_at = NOW()
  WHERE id IN (
    SELECT id FROM email_send_queue
    WHERE status = 'approved'
      AND scheduled_for <= p_max_scheduled
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY 
      next_retry_at NULLS FIRST,  -- Retries have priority (they've waited)
      scheduled_for ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$ LANGUAGE plpgsql;
```

### 4. Database: Stuck Email Recovery Function

```sql
-- ============================================================
-- STUCK EMAIL RECOVERY (Watchdog)
-- Recovers emails stuck in 'sending' for >10 minutes
-- ============================================================

CREATE OR REPLACE FUNCTION recover_stuck_emails(p_timeout_minutes INTEGER DEFAULT 10)
RETURNS INTEGER AS $$
DECLARE
  recovered_count INTEGER;
BEGIN
  WITH recovered AS (
    UPDATE email_send_queue
    SET 
      status = 'approved',
      retry_count = retry_count + 1,
      next_retry_at = NOW() + INTERVAL '5 minutes',
      sending_started_at = NULL,
      error_message = 'Recovered from stuck sending state (timeout after ' || p_timeout_minutes || ' min)'
    WHERE status = 'sending'
      AND sending_started_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
      AND retry_count < 3
    RETURNING id
  )
  SELECT COUNT(*) INTO recovered_count FROM recovered;
  
  -- Mark as failed if exceeded max retries
  UPDATE email_send_queue
  SET 
    status = 'failed',
    error_message = 'Max retries exceeded (stuck in sending)'
  WHERE status = 'sending'
    AND sending_started_at < NOW() - (p_timeout_minutes || ' minutes')::INTERVAL
    AND retry_count >= 3;
  
  RETURN recovered_count;
END;
$$ LANGUAGE plpgsql;
```

### 5. API Endpoint: `/api/cron/send-emails`

```typescript
// app/api/cron/send-emails/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';

// Constant-time string comparison (security best practice)
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Check if current time is within business hours
function isBusinessHours(timezone: string = 'America/New_York'): boolean {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    timeZone: timezone, 
    hour: 'numeric', 
    weekday: 'short' 
  };
  const formatted = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
  
  const hour = parseInt(formatted.find(p => p.type === 'hour')?.value || '0');
  const weekday = formatted.find(p => p.type === 'weekday')?.value || '';
  
  const isWeekend = ['Sat', 'Sun'].includes(weekday);
  const isBusinessTime = hour >= 9 && hour < 18; // 9 AM - 6 PM
  
  return !isWeekend && isBusinessTime;
}

export async function POST(request: NextRequest) {
  // 1. Verify CRON_SECRET (constant-time comparison)
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token || !secureCompare(token, process.env.CRON_SECRET || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // 2. Check business hours (in code, not cron schedule - DST safe!)
  if (!isBusinessHours('America/New_York')) {
    return NextResponse.json({ 
      message: 'Outside business hours', 
      skipped: true 
    });
  }
  
  const supabase = await createClient();
  
  // 3. First, recover any stuck emails
  const { data: recoveredCount } = await supabase.rpc('recover_stuck_emails', {
    p_timeout_minutes: 10
  });
  
  // 4. Check rate limit from user settings
  // TODO: Read from database or use default
  const emailsPerHour = 10; // Default, should come from settings
  
  // Count emails sent in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: sentLastHour } = await supabase
    .from('email_send_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'sent')
    .gte('sent_at', oneHourAgo);
  
  const remainingQuota = Math.max(0, emailsPerHour - (sentLastHour || 0));
  
  if (remainingQuota === 0) {
    return NextResponse.json({ 
      message: 'Rate limit reached', 
      sentLastHour,
      limit: emailsPerHour
    });
  }
  
  // 5. Claim batch of emails (up to remaining quota, max 5 per run)
  const batchSize = Math.min(remainingQuota, 5);
  const { data: emails, error: claimError } = await supabase.rpc('claim_next_emails', {
    p_limit: batchSize,
    p_max_scheduled: new Date().toISOString()
  });
  
  if (claimError || !emails?.length) {
    return NextResponse.json({ 
      message: 'No emails to send',
      recovered: recoveredCount || 0
    });
  }
  
  // 6. Process each email
  const results = [];
  for (const email of emails) {
    const startTime = Date.now();
    try {
      // TODO: Call Gmail API to send email
      // const gmailResponse = await sendViaGmail(email);
      
      // For now, simulate success
      const success = true;
      const gmailMessageId = 'mock-' + Date.now();
      
      if (success) {
        // Update queue status
        await supabase
          .from('email_send_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            provider_message_id: gmailMessageId
          })
          .eq('id', email.id);
        
        // Log attempt
        await supabase.from('email_send_attempts').insert({
          queue_id: email.id,
          attempt_number: email.retry_count + 1,
          status: 'success',
          provider_message_id: gmailMessageId,
          duration_ms: Date.now() - startTime
        });
        
        results.push({ id: email.id, status: 'sent' });
      }
    } catch (error: any) {
      // Handle failure with retry logic
      const newRetryCount = email.retry_count + 1;
      const maxRetries = 3;
      
      // Exponential backoff: 5min, 30min, 2hr
      const backoffMinutes = [5, 30, 120][Math.min(newRetryCount - 1, 2)];
      
      if (newRetryCount >= maxRetries) {
        // Max retries exceeded - mark as failed
        await supabase
          .from('email_send_queue')
          .update({
            status: 'failed',
            error_message: error.message,
            sending_started_at: null
          })
          .eq('id', email.id);
      } else {
        // Schedule retry (keep status='approved', just set next_retry_at)
        await supabase
          .from('email_send_queue')
          .update({
            status: 'approved',
            retry_count: newRetryCount,
            next_retry_at: new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString(),
            error_message: error.message,
            sending_started_at: null
          })
          .eq('id', email.id);
      }
      
      // Log attempt
      await supabase.from('email_send_attempts').insert({
        queue_id: email.id,
        attempt_number: newRetryCount,
        status: 'failed',
        error_message: error.message,
        duration_ms: Date.now() - startTime
      });
      
      results.push({ id: email.id, status: 'failed', error: error.message });
    }
  }
  
  return NextResponse.json({
    processed: results.length,
    results,
    recovered: recoveredCount || 0,
    remainingQuota: remainingQuota - results.filter(r => r.status === 'sent').length
  });
}
```

### 6. GitHub Actions Workflow (Hardened)

```yaml
# .github/workflows/email-scheduler.yml

name: Email Scheduler

on:
  schedule:
    # Every 5 minutes, 24/7
    # Business hours are checked IN CODE (DST-safe)
    - cron: '*/5 * * * *'
  workflow_dispatch: # Manual trigger for testing

# CRITICAL: Prevent overlapping runs
concurrency:
  group: email-scheduler
  cancel-in-progress: false  # Let current run finish

jobs:
  send-emails:
    runs-on: ubuntu-latest
    timeout-minutes: 4  # Fail fast if stuck
    
    steps:
      - name: Trigger email processing
        run: |
          response=$(curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.APP_URL }}/api/cron/send-emails" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            --fail-with-body \
            --retry 3 \
            --retry-delay 5 \
            --max-time 180)
          
          http_code=$(echo "$response" | tail -n1)
          body=$(echo "$response" | sed '$d')
          
          echo "Response: $body"
          echo "HTTP Code: $http_code"
          
          if [ "$http_code" -ge 400 ]; then
            echo "::error::API returned error: $body"
            exit 1
          fi
```

### 7. Environment Variables

**Add to Vercel:**
```
CRON_SECRET=<generate-random-32-char-string>
```

**Add to GitHub Repository Secrets:**
```
APP_URL=https://your-app.vercel.app
CRON_SECRET=<same-value-as-vercel>
```

Generate a secure secret:
```bash
openssl rand -hex 32
```

---

## Rate Limiting Strategy

Rate limits are **user-configurable** via `gmail_emails_per_hour` setting (1-30 emails/hour).

The cron runs every 5 minutes and processes **batches** of up to 5 emails per run, checking the rate limit before each batch:

| Setting | Max Throughput | How It Works |
|---------|---------------|--------------|
| 10/hour | 10 emails/hour | Cron checks count, sends up to remaining quota |
| 30/hour | 30 emails/hour | ~3-5 emails per 5-min run |

**Token Bucket** (optional future enhancement):
```sql
CREATE TABLE email_rate_limit (
  id INTEGER PRIMARY KEY DEFAULT 1,
  tokens_available DECIMAL DEFAULT 10,
  last_refill_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1) -- Singleton row
);
```

---

## Retry Logic

| Retry # | Wait Time | Total Elapsed | Action |
|---------|-----------|---------------|--------|
| 1       | 5 min     | 5 min         | Set `next_retry_at` |
| 2       | 30 min    | 35 min        | Set `next_retry_at` |
| 3       | 2 hours   | 2h 35m        | Set `next_retry_at` |
| 4+      | -         | -             | Mark `status='failed'` |

**Key**: Status stays `'approved'`, retries are gated by `next_retry_at`. This preserves the unique index protection.

---

## Safety Nets

### 1. Stuck Email Recovery
- If `status='sending'` for >10 minutes, assume crash
- Watchdog function resets to `'approved'` with `next_retry_at`
- Runs at start of every cron job

### 2. Idempotency Protection
- `idempotency_key` = hash of `(lead_id + email_type + approved_at)`
- `provider_message_id` = Gmail's message ID after send
- If Gmail times out after sending, we can detect duplicate on retry

### 3. Duplicate Prevention
- Partial unique index on `(lead_id, email_type) WHERE status IN ('approved', 'sending')`
- Only one pending email per lead per type at a time

### 4. Concurrency Control
- GitHub Actions: `concurrency.group` prevents overlapping runs
- Database: `FOR UPDATE SKIP LOCKED` prevents double-claiming

---

## Monitoring & Observability

### GitHub Actions Dashboard
- Run history and logs
- Email notifications on failure
- Manual re-run capability

### Database Queries

**Queue health check:**
```sql
SELECT 
  status,
  COUNT(*) as count,
  MIN(scheduled_for) as oldest,
  MAX(scheduled_for) as newest
FROM email_send_queue
GROUP BY status;
```

**Failed emails requiring attention:**
```sql
SELECT * FROM email_send_queue 
WHERE status = 'failed' 
ORDER BY updated_at DESC;
```

**Recent send attempts:**
```sql
SELECT 
  a.*,
  q.to_email,
  q.subject
FROM email_send_attempts a
JOIN email_send_queue q ON q.id = a.queue_id
ORDER BY a.created_at DESC
LIMIT 50;
```

### Future: Health Check Endpoint

```typescript
// GET /api/cron/health
// Returns queue stats, last successful send, etc.
```

---

## Security

1. **CRON_SECRET** - Bearer token with constant-time comparison
2. **Atomic claiming** - `FOR UPDATE SKIP LOCKED` prevents race conditions
3. **Concurrency group** - GitHub Actions prevents overlapping runs
4. **Rate limiting** - Respects user-configured `gmail_emails_per_hour`
5. **Business hours** - Enforced in code with explicit timezone (DST-safe)
6. **No session assumptions** - Cron endpoint uses server-side credentials only

---

## Migration Checklist

- [ ] 1. Run SQL migration to add new columns to `email_send_queue`
- [ ] 2. Run SQL to create `email_send_attempts` table
- [ ] 3. Run SQL to create/update functions (`claim_next_emails`, `recover_stuck_emails`)
- [ ] 4. Create `/api/cron/send-emails` endpoint
- [ ] 5. Generate `CRON_SECRET` and add to Vercel env vars
- [ ] 6. Add `APP_URL` and `CRON_SECRET` to GitHub repository secrets
- [ ] 7. Create `.github/workflows/email-scheduler.yml`
- [ ] 8. Test with `workflow_dispatch` (manual trigger)
- [ ] 9. Update Waiting Room UI with "Failed" tab (Retry/Dismiss actions)
- [ ] 10. Monitor first few automated runs
- [ ] 11. Deprecate/remove old browser-based polling code

---

## Costs

- **GitHub Actions**: Free tier includes 2,000 minutes/month
- **This workflow**: ~30 seconds per run × 288 runs/day (24 hours × 12 per hour) = ~144 minutes/day = ~4,320 minutes/month
- **With free tier**: May need to optimize or use business-hours-only if costs matter
- **Alternative**: Run every 10 minutes instead of 5 (halves usage)

---

## Alternative: Supabase Edge Functions + pg_cron

If GitHub Actions proves unreliable, Supabase offers:
- `pg_cron` extension for database-level scheduling
- Edge Functions that can be triggered by database events

But GitHub Actions is simpler to start with and easier to debug.

---

## Appendix: Consolidation Notes

The existing `/api/gmail/process-queue` endpoint shares logic with the new cron endpoint. Consider:
1. Extract shared email-sending logic into `lib/email-sender.ts`
2. Both endpoints call the same core function
3. Deprecate `process-queue` once cron is stable
