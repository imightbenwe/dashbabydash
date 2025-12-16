# Gmail API Full Integration Plan

**Date**: December 15, 2025  
**Purpose**: Automatically sync Gmail sent emails with lead follow-up tracking

## Current Limitation

The existing system uses `mailto:` links to open Gmail with pre-filled emails. After sending, users must manually mark the follow-up as "sent" in the app. This requires:
1. Clicking "Send Follow-up" button
2. Sending email in Gmail
3. Returning to app to mark as sent

**Problem**: No automatic detection of sent emails, leading to potential missed tracking.

## Proposed Solution: Gmail API Integration

### Architecture Overview

```
┌─────────────────────┐
│   PersonaAI App     │
│                     │
│  ┌──────────────┐   │      ┌──────────────────┐
│  │ Gmail OAuth  │◄──┼──────┤  Google OAuth    │
│  └──────────────┘   │      │  Authorization   │
│         │            │      └──────────────────┘
│         ▼            │
│  ┌──────────────┐   │
│  │ Gmail API    │   │      ┌──────────────────┐
│  │ Sync Service │◄──┼──────┤  Gmail Sent      │
│  └──────────────┘   │      │  Folder (API)    │
│         │            │      └──────────────────┘
│         ▼            │
│  ┌──────────────┐   │
│  │ Email Match  │   │
│  │ Algorithm    │   │
│  └──────────────┘   │
│         │            │
│         ▼            │
│  ┌──────────────┐   │      ┌──────────────────┐
│  │ Update Lead  │───┼──────►  Supabase        │
│  │ Status/Date  │   │      │  leads table     │
│  └──────────────┘   │      └──────────────────┘
└─────────────────────┘
```

### Implementation Steps

#### 1. **Google Cloud Console Setup**
- Create Google Cloud Project
- Enable Gmail API
- Create OAuth 2.0 credentials (Web application)
- Configure authorized redirect URIs
- Set required scopes:
  - `https://www.googleapis.com/auth/gmail.readonly` (read sent emails)
  - `https://www.googleapis.com/auth/gmail.compose` (optional: send directly)

#### 2. **Install Dependencies**
```bash
npm install googleapis @google-cloud/local-auth @types/google.auth
```

#### 3. **OAuth Flow Implementation**
- **Route**: `/api/gmail/auth`
  - Initiates OAuth flow
  - Redirects to Google consent screen
  - Stores refresh token in database (user settings table)

- **Route**: `/api/gmail/callback`
  - Handles OAuth callback
  - Exchanges code for tokens
  - Stores tokens securely

#### 4. **Gmail Sync Service**
- **Route**: `/api/gmail/sync`
  - Reads Gmail sent folder (last 24 hours or since last sync)
  - Filters emails sent to known lead email addresses
  - Matches email content to follow-up templates
  - Updates `followup_X_sent_at`, `status`, `last_touch_date`

#### 5. **Email Matching Algorithm**
```typescript
interface EmailMatch {
  gmailMessageId: string;
  leadId: string;
  followupNumber: 1 | 2 | 3 | null;
  confidence: 'high' | 'medium' | 'low';
}

function matchEmailToLead(gmailEmail: GmailMessage, leads: Lead[]): EmailMatch | null {
  // Match by recipient email
  const recipient = extractRecipient(gmailEmail);
  const matchingLeads = leads.filter(l => l.email === recipient);
  
  if (matchingLeads.length === 0) return null;
  if (matchingLeads.length > 1) {
    // Multiple leads with same email - match by subject/content
    console.warn('Multiple leads found for', recipient);
  }
  
  const lead = matchingLeads[0];
  
  // Determine followup number by:
  // 1. Subject line (RE: indicates followup #1)
  // 2. Content similarity to templates
  // 3. Send date relative to initial contact
  
  const followupNumber = detectFollowupNumber(gmailEmail, lead);
  const confidence = calculateMatchConfidence(gmailEmail, followupNumber);
  
  return {
    gmailMessageId: gmailEmail.id,
    leadId: lead.id,
    followupNumber,
    confidence
  };
}
```

#### 6. **Background Sync Scheduler**
Options:
- **Vercel Cron** (if deployed on Vercel): Every hour
- **Manual trigger**: Button in UI to sync now
- **Webhook**: Gmail push notifications (advanced)

#### 7. **User Settings Table**
```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  gmail_refresh_token TEXT ENCRYPTED,
  gmail_access_token TEXT ENCRYPTED,
  gmail_token_expiry TIMESTAMPTZ,
  gmail_sync_enabled BOOLEAN DEFAULT false,
  last_gmail_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Security Considerations

1. **Token Storage**: Store refresh tokens encrypted in database
2. **Scope Minimization**: Only request `gmail.readonly` unless sending via API
3. **Rate Limiting**: Gmail API has quotas - implement exponential backoff
4. **User Consent**: Clear explanation of what data is accessed
5. **Revocation**: Allow users to disconnect Gmail integration

### UI Components

#### Gmail Connection Status Widget
```
┌────────────────────────────────────────┐
│ 📧 Gmail Integration                   │
│                                        │
│ Status: ● Connected                    │
│ Last Sync: 2 minutes ago               │
│                                        │
│ [Sync Now] [Disconnect]                │
└────────────────────────────────────────┘
```

#### Settings Page
- Enable/disable auto-sync
- View sync history
- Manually trigger sync
- Disconnect account

### Alternative: Simpler Approach (Phase 1)

Instead of full Gmail API integration, improve the current system:

1. **Auto-detect when Gmail tab closes**
   - Use `window.addEventListener('focus')` to detect when user returns
   - Prompt: "Did you send the follow-up email?"
   - One-click confirmation

2. **Email template signatures**
   - Add hidden tracking identifier in email body
   - Detect via Gmail API if present

3. **Manual batch update**
   - UI to bulk-mark multiple follow-ups as sent
   - Upload CSV of sent emails

### Timeline

**Phase 1** (Week 1): Improved manual tracking
- Auto-detection when returning from Gmail
- Batch update UI

**Phase 2** (Week 2-3): Gmail OAuth setup
- Google Cloud Console configuration
- OAuth flow implementation
- Token storage

**Phase 3** (Week 4): Gmail API sync
- Read sent folder
- Email matching algorithm
- Manual sync trigger

**Phase 4** (Week 5): Automation
- Background sync scheduler
- Webhook integration
- Full automation

### Estimated Development Time
- **Full Implementation**: 15-20 hours
- **Phase 1 (Simple improvements)**: 2-3 hours
- **Core Gmail API sync (no automation)**: 8-10 hours

## Next Steps

1. Decide on approach (full API vs improved manual)
2. Set up Google Cloud Console project
3. Install dependencies
4. Implement OAuth flow
5. Build sync endpoint
6. Test with sample emails
7. Deploy and monitor

---

**Questions to Answer:**
1. Do you have a Google Cloud Console account?
2. Are you comfortable storing OAuth tokens in the database?
3. Should this be per-user or system-wide Gmail account?
4. How often should sync run (hourly, manual, real-time)?
