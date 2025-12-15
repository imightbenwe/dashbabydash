# Gmail Follow-up Automation System

**Date Added**: December 12, 2025  
**Version**: 2.4.0

## Overview

Automated follow-up system that tracks when leads need follow-up emails and provides one-click Gmail integration to send them in the same email thread.

## Features

### 1. **Automatic Follow-up Scheduling**
- **Follow-up #1**: 3 days after initial contact (uses `RE:` to thread with original email)
- **Follow-up #2**: 5 days after Follow-up #1 (new subject: "Quick check-in")
- **Follow-up #3**: 7 days after Follow-up #2 (new subject: "Closing the loop")

### 2. **Gmail Integration**
- One-click button opens Gmail with pre-filled email
- First follow-up uses `RE: [Original Subject]` for proper threading
- Automatically marks follow-up as sent in database
- Tracks all follow-up timestamps

### 3. **Visual Queue**
- Displays at top of CRM page when follow-ups are needed
- Shows how many leads need each type of follow-up
- Expandable/collapsible interface
- Refreshes every 5 minutes automatically

## Database Schema

### New Fields in `leads` table:
```sql
followup_1_sent_at TIMESTAMPTZ     -- When first follow-up was sent
followup_2_sent_at TIMESTAMPTZ     -- When second follow-up was sent
followup_3_sent_at TIMESTAMPTZ     -- When third follow-up was sent
initial_email_subject TEXT         -- Subject of initial email (for threading)
```

### Migration
Run `GMAIL_FOLLOWUP_MIGRATION.sql` to add these fields to your database.

## Email Templates

All email templates are stored in `/lib/email-templates.json`:

- `auto_followup_1`: First follow-up (3 days)
- `auto_followup_2`: Second follow-up (5-7 days)
- `auto_followup_3`: Final follow-up (7-10 days)

Each template includes:
- `subject`: Email subject line
- `body`: Email body with `{firstName}` placeholder
- `daysAfter`: Number of days to wait
- `description`: Human-readable description

## API Endpoints

### `GET/POST /api/gmail/check-followups`
Checks for leads that need follow-ups based on their contacted dates.

**Response:**
```json
{
  "success": true,
  "followups": {
    "followup_1": [...leads],
    "followup_2": [...leads],
    "followup_3": [...leads]
  },
  "total": 5
}
```

### `POST /api/gmail/mark-followup-sent`
Marks a follow-up as sent for a specific lead.

**Body:**
```json
{
  "leadId": "uuid",
  "followupNumber": 1,
  "subject": "RE: Quick note after seeing your work"
}
```

## Components

### `<GmailFollowupQueue />`
- Location: `/components/gmail/GmailFollowupQueue.tsx`
- Displays on CRM page (main dashboard)
- Auto-refreshes every 5 minutes
- Shows all leads needing follow-ups grouped by type

## Workflow

1. **Initial Email Sent**
   - User clicks "Send to Gmail" on generated email
   - System sets `status='email_1_sent'` and `date_contacted=NOW()`
   - System saves `initial_email_subject` for threading

2. **3 Days Later**
   - System detects lead needs follow-up #1
   - Lead appears in GmailFollowupQueue component
   - User clicks "Send via Gmail"
   - Gmail opens with `RE: [Original Subject]` and pre-filled body
   - System sets `followup_1_sent_at=NOW()`

3. **5 Days After Follow-up #1**
   - System detects lead needs follow-up #2
   - User sends via Gmail with new subject
   - System sets `followup_2_sent_at=NOW()`

4. **7 Days After Follow-up #2**
   - System detects lead needs follow-up #3 (final)
   - User sends via Gmail
   - System sets `followup_3_sent_at=NOW()`

## Usage

### For Users:
1. Navigate to the **CRM** tab
2. If any leads need follow-ups, you'll see a blue box at the top
3. Click **"Send via Gmail"** next to any lead
4. Gmail opens with pre-filled email
5. Review and send the email
6. System automatically marks it as sent

### For Developers:
The system uses:
- `date_contacted` as the anchor point for all follow-up timing
- `status='email_1_sent'` as a filter (only follows up with leads in this status)
- Database timestamps to prevent duplicate sends
- Real Gmail compose URLs (no backend email sending required)

## Email Threading

**First follow-up** uses `RE:` to thread properly in Gmail:
```
Subject: RE: Quick note after seeing your work
```

This ensures the follow-up appears in the same conversation thread as the original email, making it more likely to be noticed and replied to.

## Future Enhancements

- [ ] Add email tracking (opened, clicked)
- [ ] Integrate with Gmail API for automatic sending
- [ ] Add A/B testing for email templates
- [ ] Add custom delay configuration per lead
- [ ] Add pause/skip follow-up functionality
- [ ] Add analytics dashboard for follow-up response rates

## Notes

- System only follows up with leads in `email_1_sent` status
- If lead replies or status changes, they won't get more follow-ups
- All follow-ups require manual user action (clicking "Send via Gmail")
- No emails are sent automatically from the server (GDPR/CAN-SPAM compliant)
