# Automation System Documentation

## Overview

The automation system automatically processes leads through multiple stages without manual intervention. While your localhost server is running, leads automatically progress from collection through scraping and AI analysis.

## Architecture

### Components

1. **Database Fields** (`AUTOMATION_STAGE_MIGRATION.sql`)
   - `automation_stage`: Integer tracking progress (0, 1, 2, or -1 for errors)
   - `automation_stage_updated_at`: Timestamp of last stage change
   - `automation_error`: Error message if automation fails

2. **Backend API** (`app/api/automation/process/route.ts`)
   - Runs server-side automation logic
   - Checks for leads ready for next stage
   - Processes up to 10 leads per stage per check
   - Handles errors gracefully

3. **Frontend Polling** (`lib/hooks/useAutomation.ts`)
   - Triggers automation check every 60 seconds
   - Only runs while app is open in browser
   - Logs results to console

4. **Retry Mechanism** (`app/api/automation/retry/[id]/route.ts`)
   - Resets failed leads for retry
   - Accessible via UI button

## Automation Stages

### Stage 0: Lead Collected (Queued)
- **Trigger**: Lead created with status "lead_collected"
- **Wait Time**: 2 minutes after creation
- **Action**: Scrapes website using `/api/scraper/deep`
- **On Success**: Moves to Stage 1
- **On Failure**: Moves to Stage -1 with error message

### Stage 1: Website Scraped
- **Trigger**: Stage 0 automation completes successfully
- **Wait Time**: 1 minute after scraping
- **Action**: Runs AI analysis using `/api/leads/{id}/run-analysis`
- **On Success**: Moves to Stage 2
- **On Failure**: Moves to Stage -1 with error message

### Stage 2: AI Analysis Complete
- **Status**: Automation complete
- **Manual Actions**: User can now generate emails, send to Gmail, etc.

### Stage -1: Error State
- **Trigger**: Any automation step fails
- **Behavior**: Removed from automation queue
- **Recovery**: Manual "Retry" button in UI resets to appropriate stage

## How It Works

### 1. Lead Creation
```
New Lead Created
    ↓
automation_stage = 0
automation_stage_updated_at = NOW()
```

### 2. Polling Loop (Every 60 seconds)
```
Frontend calls /api/automation/process
    ↓
API checks for Stage 0 leads (created > 2 min ago)
    ↓
Scrapes websites for each lead
    ↓
Updates to Stage 1 or -1 (error)
    ↓
API checks for Stage 1 leads (updated > 1 min ago)
    ↓
Runs AI analysis for each lead
    ↓
Updates to Stage 2 or -1 (error)
```

### 3. Error Handling
- Each lead processed independently
- Errors don't block other leads
- Failed leads moved to Stage -1
- Error message stored in `automation_error`
- Visible in CRM table with warning icon
- Can be retried via UI button

## Visual Indicators

### CRM Table
- **⏳ Queued**: Stage 0, waiting for scraping
- **🔍 Scraped**: Stage 1, waiting for analysis
- **✅ Analyzed**: Stage 2, automation complete
- **❌ Error**: Stage -1, failed (hover for details)

### Lead Detail Page
- Badge at top showing current automation status
- "Retry" button appears for failed leads
- Error message displayed in red box

## Requirements

### To Run Automation:
1. ✅ Next.js dev server running (`npm run dev`)
2. ✅ App open in browser (any tab)
3. ✅ Database migration applied (`AUTOMATION_STAGE_MIGRATION.sql`)

### Automation Stops When:
- ❌ Dev server stopped
- ❌ All browser tabs closed
- ❌ Laptop asleep/shutdown

## Performance & Limits

- **Max Concurrent**: 10 leads per stage per check (prevents overload)
- **Check Interval**: 60 seconds
- **Wait Times**:
  - Stage 0 → 1: 2 minutes after lead creation
  - Stage 1 → 2: 1 minute after scraping

## Future Enhancements

### Planned Stages:
- **Stage 3**: Email generation (auto-generate initial email)
- **Stage 4**: Email sent via Gmail API
- **Stage 5**: Follow-up scheduled
- **Stage 6**: Second follow-up

### Production Deployment:
When deployed to Vercel, replace frontend polling with:
- Vercel Cron Jobs (runs server-side, no browser needed)
- Or Supabase Edge Functions with webhooks

## Troubleshooting

### Automation not running?
1. Check browser console for `🤖 Triggering automation check...`
2. Verify dev server is running
3. Confirm app is open in browser

### Leads stuck in Stage 0?
1. Check if lead has a website URL (required for scraping)
2. Verify 2 minutes have passed since creation
3. Check browser console for errors

### Leads stuck in Stage 1?
1. Verify 1 minute has passed since scraping
2. Check for AI API errors in console
3. Try manual "Run AI Analysis" button

### Lead in Error State?
1. Check error message in CRM table (hover over ⚠️)
2. View full error in lead detail page
3. Click "Retry" button to attempt again

## API Endpoints

### `POST /api/automation/process`
**Purpose**: Main automation worker
**Called By**: Frontend polling hook
**Returns**:
```json
{
  "success": true,
  "stage0Processed": 2,
  "stage1Processed": 3,
  "errors": ["Lead Name: error message"]
}
```

### `POST /api/automation/retry/{id}`
**Purpose**: Reset failed lead for retry
**Called By**: Retry button in UI
**Returns**:
```json
{
  "success": true,
  "message": "Lead reset to stage 0. Automation will retry on next check.",
  "resetStage": 0
}
```

## Code Locations

- **Migration**: `leadsapp/AUTOMATION_STAGE_MIGRATION.sql`
- **API Process**: `leadsapp/app/api/automation/process/route.ts`
- **API Retry**: `leadsapp/app/api/automation/retry/[id]/route.ts`
- **Hook**: `leadsapp/lib/hooks/useAutomation.ts`
- **Main Page**: `leadsapp/app/page.tsx` (hook initialized here)
- **CRM Table**: `leadsapp/components/tables/CRMTable.tsx`
- **Lead Detail**: `leadsapp/app/lead/[id]/page.tsx`
- **Types**: `leadsapp/lib/types/index.ts`

## Database Schema

```sql
-- Automation fields in leads table
automation_stage INTEGER DEFAULT 0
  -- 0 = Queued (just created)
  -- 1 = Website scraped
  -- 2 = AI analysis complete
  -- -1 = Error state

automation_stage_updated_at TIMESTAMPTZ
  -- Last time stage changed

automation_error TEXT
  -- Error message if stage = -1
  -- NULL if no error
```

## Example Timeline

```
00:00 - Lead "Jane Doe" created → Stage 0 (Queued)
00:02 - Automation checks → Scrapes website → Stage 1 (Scraped)
00:03 - Automation checks → Runs AI analysis → Stage 2 (Analyzed)
00:03 - User generates email, sends to Gmail
```

## Success Metrics

View automation performance in browser console:
- "🤖 Triggering automation check..." (every 60s)
- "✅ Automation processed: scraped: 2, analyzed: 3"
- "❌ Automation errors: [...]" (if any failures)
