# Quick Start Guide - Follow-up Timeline System

## You're seeing empty timelines because:
1. ❌ Database migration not run yet (new columns don't exist)
2. ❌ All your leads have status "Lead Collected" (timeline only shows for "Email 1 sent")

## 🚀 Steps to Get It Working:

### Step 1: Run Database Migration
1. Open Supabase Dashboard → SQL Editor
2. Copy the contents of `GMAIL_FOLLOWUP_MIGRATION.sql`
3. Paste and run it
4. You should see: "Success. No rows returned"

### Step 2: Test with Sample Data
**Option A - Quick Test (Recommended):**
1. Copy the contents of `TEST_FOLLOWUP_DATA.sql`
2. Run it in Supabase SQL Editor
3. Refresh your LeadsApp page
4. You should now see timelines!

**Option B - Real Usage:**
1. Pick a lead from your CRM
2. Click on it to open the detail page
3. Scroll to "Generated Emails" section
4. Click "Send to Gmail" button
5. This sets `status='email_1_sent'` and `date_contacted=NOW()`
6. Go back to CRM - you'll see the timeline appear!

### Step 3: Explore the Features

#### CRM Table
- Look for the "Follow-up Timeline" column
- You'll see dots representing each follow-up stage
- Hover over dots to see details
- Pulsing red dot = ready to send

#### Follow-up Pipeline Tab
- Click "Follow-up Pipeline" in the top nav
- See the Kanban board with all stages
- Drag and organize leads visually
- Click "Send via Gmail" on ready leads

#### Lead Detail Page
- Open any lead with status "Email 1 sent"
- Scroll down to see full timeline
- Shows exact dates and countdowns

## 🎯 What You'll See After Setup:

**Timeline Stages:**
- 🟢 Initial Email (completed)
- 🔵 Follow-up #1 (ready if 3+ days) 
- ⏳ Follow-up #2 (upcoming/ready)
- ⏳ Follow-up #3 (upcoming/ready)

**Colors:**
- 🟢 Green = Completed
- 🔵 Blue pulsing = Ready to send NOW
- ⚪ Gray = Upcoming (shows days remaining)

## 🐛 Still Not Seeing Anything?

Check the browser console (F12) for errors. Most common issues:
1. Migration not run → columns don't exist → API errors
2. No leads with `status='email_1_sent'` → timeline returns null
3. Browser cache → hard refresh (Ctrl+Shift+R)

## 💡 Pro Tip:
Use `TEST_FOLLOWUP_DATA.sql` to set up a variety of test scenarios:
- Lead ready for FU1 (4 days old)
- Lead not ready yet (1 day old)
- Lead ready for FU2 (FU1 sent 6 days ago)
- Lead with all follow-ups complete

This lets you see all the different timeline states!
