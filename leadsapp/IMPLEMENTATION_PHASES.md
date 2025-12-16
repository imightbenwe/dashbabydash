# Implementation Plan: Robust Email Scheduler & App Hardening

> **Status**: Ready for Execution  
> **Goal**: Transition from fragile browser-based polling to a robust, secure, and automated server-side email system.

---

## Phase 1: Foundation & Refactoring (The "Cleanup")
*Goal: Stop the bleeding. Fix security holes, remove fragile code, and prepare shared logic.*

### 1.1. Extract Shared Logic (Stop Self-Fetching)
- [x] Create `lib/gmail-sender.ts`: Move email sending logic out of API routes.
- [x] Create `lib/analysis-service.ts`: Move lead analysis logic out of API routes.
- [x] Refactor existing API routes to call these functions directly instead of `fetch()`.

### 1.2. Fix "Stop on Reply" Gap
- [x] Update `gmail-sync-service.ts`: When a reply is detected, find and cancel any pending/approved emails for that lead in `email_send_queue`.

### 1.3. Secure Endpoints
- [x] Add `CRON_SECRET` verification to any endpoint intended for automation.
- [x] Create `lib/cron-security.ts` with verification utilities.
- [ ] Ensure user-facing endpoints check for valid session/auth.

---

## Phase 2: Database Architecture (The "Brain")
*Goal: Make the database the single source of truth with atomic guarantees.*

### 2.1. Enhanced Queue Table Migration
- [ ] Run SQL to add columns: `retry_count`, `next_retry_at`, `sending_started_at`, `idempotency_key`, `provider_message_id`.
- [ ] **Crucial**: Do NOT add a 'retry' status. Use `next_retry_at` to gate retries.

### 2.2. Audit Trail & Safety Nets
- [ ] Create `email_send_attempts` table for full history.
- [ ] Create `claim_next_emails` function (Batch processing + Atomic locking).
- [ ] Create `recover_stuck_emails` function (Watchdog for crashed jobs).

### 2.3. Data Integrity Triggers
- [ ] Add trigger: When `leads.email` changes, update `email_send_queue.to_email`.

---

## Phase 3: The Scheduler (The "Heartbeat")
*Goal: Reliable, automated execution.*

### 3.1. Create Cron Endpoint
- [ ] Build `/api/cron/send-emails`:
    - Verify `CRON_SECRET`.
    - Check business hours (in code, timezone-aware).
    - Run `recover_stuck_emails`.
    - Call `claim_next_emails` (Batch size ~5).
    - Loop through batch and call `lib/gmail-sender.ts`.
    - Handle success/failure/retries with DB updates.

### 3.2. GitHub Actions Workflow
- [ ] Create `.github/workflows/email-scheduler.yml`.
- [ ] Schedule: `*/5 * * * *` (Every 5 min, 24/7).
- [ ] Configure concurrency (max 1) and timeouts.

### 3.3. Environment Setup
- [ ] Generate `CRON_SECRET`.
- [ ] Add to Vercel Environment Variables.
- [ ] Add to GitHub Repository Secrets.

---

## Phase 4: UI & Monitoring (The "Control Room")
*Goal: Visibility and manual control.*

### 4.1. Waiting Room Enhancements
- [ ] Add "Failed" tab to Waiting Room.
- [ ] Add "Retry" (reset `next_retry_at`) and "Dismiss" (delete) actions.

### 4.2. Monitoring Dashboard (Optional/Later)
- [ ] Simple stats view: Queue size, Sent today, Failed count.

---

## Execution Order

1.  **Phase 1** (Refactoring) - *Safe to do immediately.*
2.  **Phase 2** (Database) - *Safe to do immediately.*
3.  **Phase 3** (Scheduler) - *Enables the new system.*
4.  **Phase 4** (UI) - *Can be done in parallel or after.*

**Ready to begin Phase 1?**
