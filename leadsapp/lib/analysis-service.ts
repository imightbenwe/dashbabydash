/**
 * Analysis Service
 * 
 * Shared lead analysis logic extracted from API routes.
 * Can be called directly by cron jobs or other services without HTTP fetch.
 */

import { supabaseAdmin } from './supabase/admin';
import { analyzeWithOpenAI, generateEmailWithOpenAI } from './ai-service';

export interface AnalyzeLeadParams {
  leadId: string;
  generateEmail?: boolean;
}

export interface AnalyzeLeadResult {
  success: boolean;
  analysis?: any;
  email?: { subject: string; body: string };
  error?: string;
}

/**
 * Run AI analysis on a lead using their stored raw data sources
 */
export async function analyzeLead(params: AnalyzeLeadParams): Promise<AnalyzeLeadResult> {
  const { leadId, generateEmail = false } = params;

  try {
    // Fetch lead data
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Fetch raw data sources
    const { data: rawSources } = await supabaseAdmin
      .from('raw_data_sources')
      .select('*')
      .eq('lead_id', leadId);

    // Build combined data for analysis
    const combinedData: any = {
      prospectName: lead.name,
      company: lead.company,
      email: lead.email,
    };

    // Process raw data sources
    if (rawSources) {
      for (const source of rawSources) {
        switch (source.source_type) {
          case 'instagram':
            combinedData.instagramData = source.raw_content;
            break;
          case 'website':
            combinedData.websiteData = source.raw_content?.text || JSON.stringify(source.raw_content);
            break;
          case 'substack':
            combinedData.substackData = source.raw_content?.text || JSON.stringify(source.raw_content);
            break;
          case 'threads':
            combinedData.threadsData = source.raw_content?.text || JSON.stringify(source.raw_content);
            break;
          case 'other':
            combinedData.otherData = source.raw_content?.text || JSON.stringify(source.raw_content);
            break;
        }
      }
    }

    // Run AI analysis
    console.log(`🤖 Running AI analysis for lead: ${lead.name}`);
    const analysis = await analyzeWithOpenAI(combinedData);

    // Store analysis in database
    const { error: analysisError } = await supabaseAdmin
      .from('ai_analyses')
      .insert({
        lead_id: leadId,
        llm_provider: 'openai',
        tone_keywords: analysis.toneKeywords || [],
        story_arc: analysis.storyArc || null,
        key_triggers: analysis.keyTriggers || [],
        full_response: analysis,
      })
      .select()
      .single();

    if (analysisError) {
      console.error('Failed to store analysis:', analysisError);
    }

    // Update lead with Instagram analytics if present
    const instagramAnalytics = analysis._instagramAnalytics;
    if (instagramAnalytics) {
      await supabaseAdmin
        .from('leads')
        .update({
          top_commenter_username: instagramAnalytics.topCommenterUsername,
          top_commenter_profile_pic: instagramAnalytics.topCommenterProfilePic,
          engagement_avg_likes: instagramAnalytics.engagementAvgLikes,
          engagement_avg_comments: instagramAnalytics.engagementAvgComments,
          engagement_avg_views: instagramAnalytics.engagementAvgViews,
          total_posts_analyzed: instagramAnalytics.totalPostsAnalyzed,
          most_engaging_topic: instagramAnalytics.mostEngagingTopic,
          recent_post_date: instagramAnalytics.recentPostDate,
          mutual_connection_name: instagramAnalytics.topCommenterUsername,
          personal_location: instagramAnalytics.personalDetails?.location,
          personal_hobbies: instagramAnalytics.personalDetails?.hobbies || [],
          personal_pets: instagramAnalytics.personalDetails?.pets || [],
          personal_struggles: instagramAnalytics.personalDetails?.struggles || [],
          personal_mentions: instagramAnalytics.personalDetails?.personalMentions || [],
          personal_story_hook: instagramAnalytics.personalStoryHook,
          audience_pain_points: instagramAnalytics.audiencePainPoints || [],
          specific_post_topics: instagramAnalytics.specificPostTopics || [],
          // Also update with analysis results
          ai_first_name_guess: analysis.firstNameGuess,
          ai_email_opening: analysis.emailOpening,
          ai_specific_achievement: analysis.specificAchievement,
          ai_specific_hook_story: analysis.specificHookStory,
        })
        .eq('id', leadId);

      console.log(`✅ Instagram analytics saved for ${lead.name}`);
    }

    // Optionally generate email
    let email: { subject: string; body: string } | undefined;
    if (generateEmail) {
      try {
        email = await generateEmailWithOpenAI(lead.name, analysis, 'initial');
        console.log(`✅ Initial email generated for ${lead.name}`);
      } catch (emailError) {
        console.error('Failed to generate email:', emailError);
      }
    }

    // Log activity
    await supabaseAdmin
      .from('lead_activity_log')
      .insert({
        lead_id: leadId,
        activity_type: 'ai_analysis_completed',
        description: 'AI analysis completed via analysis service',
        metadata: {
          provider: 'openai',
          hasInstagramAnalytics: !!instagramAnalytics,
          generatedEmail: !!email,
        },
      });

    return {
      success: true,
      analysis,
      email,
    };

  } catch (error: any) {
    console.error('❌ Analysis service error:', error);
    return { success: false, error: error.message || 'Analysis failed' };
  }
}

/**
 * Generate a follow-up email for a lead
 */
export async function generateFollowUpEmail(
  leadId: string,
  followUpNumber: 1 | 2 | 3
): Promise<{ success: boolean; subject?: string; body?: string; error?: string }> {
  try {
    // Fetch lead and their analysis
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return { success: false, error: 'Lead not found' };
    }

    // Fetch the latest analysis
    const { data: analysis } = await supabaseAdmin
      .from('ai_analyses')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const emailType = followUpNumber === 1 ? 'follow_up_1' : 
                      followUpNumber === 2 ? 'follow_up_2' : 'follow_up_2';

    const email = await generateEmailWithOpenAI(
      lead.name,
      analysis?.full_response || {},
      emailType,
      undefined,
      {
        mockupSiteUrl: lead.mockup_site_url,
        mutualConnection: lead.mutual_connection_name,
        specificHookStory: lead.ai_specific_hook_story,
      }
    );

    return {
      success: true,
      subject: email.subject,
      body: email.body,
    };

  } catch (error: any) {
    console.error('❌ Follow-up generation error:', error);
    return { success: false, error: error.message || 'Failed to generate follow-up' };
  }
}
