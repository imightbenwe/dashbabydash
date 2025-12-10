# Google Places Lead Management Setup Guide

## Overview
This document outlines the complete lead management system for Google Places results with Open and Dismissed tracking.

## Changes Made

### 1. Database Migration (`DISMISSED_LEADS_MIGRATION.sql`)
A new SQL migration file has been created to set up the lead tracking tables. You need to run this migration in your Supabase database.

**File:** `DISMISSED_LEADS_MIGRATION.sql`

**To apply:**
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `DISMISSED_LEADS_MIGRATION.sql`
4. Run the migration

**What it creates:**

#### `dismissed_leads` table
Stores dismissed leads with dismissal reasons:
- `id` (UUID)
- `user_id` (TEXT)
- `campaign_id` (UUID)
- `place_id` (TEXT)
- `place_name` (TEXT)
- `website` (TEXT)
- `address` (TEXT)
- `phone` (TEXT)
- `reason` (TEXT) - **Dismissal note**
- `dismissed_at` (TIMESTAMPTZ)

#### `open_leads` table (NEW)
Stores all search results shown to the user:
- `id` (UUID)
- `user_id` (TEXT)
- `campaign_id` (UUID)
- `place_id` (TEXT)
- `place_name` (TEXT)
- `website` (TEXT)
- `address` (TEXT)
- `phone` (TEXT)
- `rating` (DECIMAL)
- `user_rating_count` (INTEGER)
- `google_maps_uri` (TEXT)
- `first_shown_at` (TIMESTAMPTZ)
- `last_shown_at` (TIMESTAMPTZ)

Plus indexes, RLS policies, and helper functions.

### 2. API Routes

#### `/api/open/route.ts` (NEW)
Handles open leads management:
- **POST**: Saves/updates search results to open_leads
- **GET**: Retrieves all open leads (excluding dismissed/converted)
- **DELETE**: Removes lead when converted

#### `/api/dismissed/route.ts` (EXISTING)
Already handles dismissed leads with reason field support.

### 3. Frontend Changes (`app/page.tsx`)

#### New State Variables:
- `openLeadsList` - Stores all open leads
- `googlePlacesView` - Controls submenu: 'search' | 'open' | 'dismissed'

#### New Functions:
- `fetchOpenLeads()` - Fetches all open leads from database
- `saveSearchResultsToOpen()` - Automatically saves search results
- Updated `dismissPlace()` - Now refreshes both dismissed and open lists

#### New UI Structure:
**Google Places Navigation (Submenu)**
- **Search** - Main search interface
- **Open** - All results ever shown (not dismissed/converted)
- **Dismissed** - All dismissed results with reasons

### 4. Automatic Tracking
Every time you search for places:
1. Results are displayed in Search view
2. All results are automatically saved to `open_leads` table
3. They appear in the "Open" submenu
4. When dismissed, they move from Open to Dismissed
5. When converted to leads, they're removed from Open

## Features

### ✅ Google Places Submenu Navigation
- Collapsed submenu under Google Places
- Shows counts: "Open (15)", "Dismissed (3)"
- Clean organization

### ✅ Open Leads Section
- Shows ALL businesses ever shown to you
- Excludes dismissed and converted leads
- Displays last shown date
- Dismiss button available
- Website and Google Maps links

### ✅ Dismissed Leads Section
- Shows all dismissed leads
- Displays dismissal reason/note
- Shows dismissal timestamp
- Website link for reference

### ✅ Automatic Persistence
- All search results saved automatically
- No manual action needed
- Tracks when first shown and last shown
- Updates on duplicate searches

## How It Works

### Search Flow:
1. User searches for "yoga studio in NYC"
2. 20 results returned
3. All 20 automatically saved to `open_leads`
4. User can see them in Search view
5. User dismisses 3 → moved to Dismissed
6. User converts 5 to leads → removed from Open
7. 12 remain in Open for later review

### Navigation Flow:
```
Google Places (main tab)
  ├─ Search (default view)
  ├─ Open (12) ← WHITE results not yet acted upon
  └─ Dismissed (3) ← With reasons
```

## Testing Checklist

After running the migration:

- [ ] Search for places in Search view
- [ ] Check "Open" submenu - results should appear automatically
- [ ] Count shows correct number
- [ ] Click "Dismiss" on an open lead
- [ ] Dialog opens for reason
- [ ] Lead moves from Open to Dismissed
- [ ] Check Dismissed submenu - dismissed lead appears
- [ ] Reason is displayed correctly
- [ ] Convert some leads to CRM
- [ ] Verify they disappear from Open
- [ ] Do another search with same query
- [ ] Check that `last_shown_at` updates for duplicates
- [ ] Counts update correctly in submenu labels

## Database Queries

### View all open leads for a user:
```sql
SELECT * FROM open_leads 
WHERE user_id = 'user@example.com' 
ORDER BY last_shown_at DESC;
```

### View dismissed with reasons:
```sql
SELECT place_name, reason, dismissed_at 
FROM dismissed_leads 
WHERE user_id = 'user@example.com' 
ORDER BY dismissed_at DESC;
```

### Count by status:
```sql
-- Open
SELECT COUNT(*) FROM open_leads WHERE user_id = 'user@example.com';

-- Dismissed  
SELECT COUNT(*) FROM dismissed_leads WHERE user_id = 'user@example.com';
```

## Next Steps

1. **Run the SQL migration** in Supabase
2. **Test the full flow** using the checklist
3. **Optional enhancements:**
   - Add bulk dismiss from Open view
   - Add "restore" button to un-dismiss
   - Add filtering/search in Open and Dismissed
   - Export to CSV functionality
   - Add tags/categories to open leads

## Notes

- Open leads persist forever until dismissed or converted
- Each place can only exist once per user in open_leads (UNIQUE constraint)
- Re-searching updates `last_shown_at` timestamp
- Dismissed leads are permanent (unless you add un-dismiss feature)
- Counts in submenu update in real-time
