# Instagram Analytics Integration - Migration Guide

## ✅ Implementation Complete

All code changes have been implemented. Here's what was updated:

### 1. Database Schema Updates (`supabase-schema.sql`)
Added Instagram engagement fields to `leads` table:
- `top_commenter_username` - Most frequent commenter
- `top_commenter_profile_pic` - Commenter's profile picture URL
- `engagement_avg_likes` - Average likes across posts
- `engagement_avg_comments` - Average comments across posts
- `engagement_avg_views` - Average video views
- `total_posts_analyzed` - Number of posts analyzed
- `most_engaging_topic` - Topic with highest engagement
- `recent_post_date` - Date of most recent post

### 2. New Instagram Analytics Module (`lib/instagram-analytics.ts`)
Created comprehensive analytics extractor:
- `extractInstagramAnalytics()` - Parses full.json and calculates all metrics
- `formatAnalyticsForPrompt()` - Formats analytics for AI prompts
- Identifies most frequent commenter from comments data
- Calculates engagement averages
- Finds most engaging content and topics
- Extracts content performance patterns

### 3. AI Service Updates (`lib/ai-service.ts`)
Enhanced AI analysis prompts to:
- Parse Instagram JSON structure (posts, comments, engagement metrics)
- Extract top commenter for mutual connection
- Include specific engagement data in analysis
- Use real numbers in prompts (likes, views, comments)
- Generate data-backed email hooks

### 4. API Endpoint Updates (`app/api/analyze/route.ts`)
- Automatically extracts Instagram analytics during analysis
- Saves analytics to leads table
- Auto-populates `mutual_connection_name` with top commenter
- Stores analytics in `ai_analyses.full_response` for reference

### 5. Lead Detail Page UI (`app/lead/[id]/page.tsx`)
Added beautiful Instagram Analytics section showing:
- Top Commenter card with profile picture and link
- Engagement Metrics (average likes, comments, views)
- Content Insights (posts analyzed, top topic, last post date)
- Helper tip for using data in cold emails

### 6. Email Generation (`lib/ai-service.ts`)
Updated email prompts to:
- Use top commenter as mutual connection in subject line
- Reference specific engagement metrics ("Your post got ~176~ views")
- Include achievement data from analytics
- Use tildes (~) around numbers for credibility

---

## 🔧 Required Migration Steps

### Step 1: Update Supabase Database
Run this SQL in your Supabase SQL Editor:

```sql
-- Add Instagram engagement analytics columns
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS top_commenter_username TEXT,
ADD COLUMN IF NOT EXISTS top_commenter_profile_pic TEXT,
ADD COLUMN IF NOT EXISTS engagement_avg_likes DECIMAL,
ADD COLUMN IF NOT EXISTS engagement_avg_comments DECIMAL,
ADD COLUMN IF NOT EXISTS engagement_avg_views DECIMAL,
ADD COLUMN IF NOT EXISTS total_posts_analyzed INTEGER,
ADD COLUMN IF NOT EXISTS most_engaging_topic TEXT,
ADD COLUMN IF NOT EXISTS recent_post_date TIMESTAMPTZ;
```

### Step 2: Test the System
1. Upload a new lead with `full.json` format Instagram data
2. Verify Instagram Analytics section appears on lead detail page
3. Check that top commenter is auto-populated in mutual_connection_name
4. Generate an email and verify it includes:
   - Top commenter mention (if available)
   - Specific engagement metrics with ~tildes~
   - Data-backed achievements

---

## 📊 What Data Gets Extracted

From `full.json` Instagram data, the system now extracts:

### Comment Analysis
- **Most Frequent Commenter**: Username + profile picture of person who comments most
- **Commenter Insights**: Top 10 most engaged followers

### Engagement Metrics
- **Average Likes**: Calculated across all posts
- **Average Comments**: Calculated across all posts  
- **Average Video Views**: For video content only

### Content Performance
- **Most Engaging Topic**: Topic/theme with highest engagement
- **Best Performing Post**: Post with most likes + comments
- **Recent Activity**: Date of most recent post
- **Topic Patterns**: Top 5 topics ranked by engagement

---

## ✉️ Email Personalization Examples

### Before (Generic):
```
Subject: Your manifestation content is incredible

Sarah, I've been a big fan of yours.
```

### After (Data-Driven):
```
Subject: I found you through @coffeemindset25

Sarah, I've been a big fan of yours.
Your post about nervous system regulation got ~35~ likes and ~11~ comments.
I noticed manifestation content gets 2x more engagement than other topics.
```

---

## 🎯 Benefits

1. **Automatic Mutual Connection**: Top commenter auto-fills as referral source
2. **Data-Backed Credibility**: Real numbers with ~tildes~ show research depth
3. **Personalization at Scale**: Every field auto-populated from Instagram data
4. **Content Insights**: Know what resonates before reaching out
5. **UI Visibility**: All analytics visible in lead detail page

---

## 🧪 Testing Checklist

- [ ] Run SQL migration in Supabase
- [ ] Upload test lead with full.json format
- [ ] Verify Instagram Analytics section displays
- [ ] Check top_commenter_username is populated
- [ ] Generate initial email
- [ ] Verify email includes engagement metrics
- [ ] Check subject line uses top commenter OR achievement
- [ ] Confirm ~tildes~ around numbers in email body

---

## 📝 Notes

- Instagram analytics only display when `total_posts_analyzed > 0` or `top_commenter_username` exists
- System gracefully handles missing data (no errors if Instagram JSON not uploaded)
- Analytics are extracted once during initial analysis and saved to database
- All metrics are optional - email generation works with partial data
- Top commenter becomes default mutual_connection_name but can be manually overridden

---

## 🚀 Next Steps

1. Run the SQL migration above
2. Test with a real Instagram `full.json` export
3. Review generated emails for quality
4. Adjust email prompts if needed (in `lib/ai-service.ts`)
5. Monitor engagement metrics across multiple leads for patterns

Your cold emails will now be significantly more personalized and data-driven! 🎉
