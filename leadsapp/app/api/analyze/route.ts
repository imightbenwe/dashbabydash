import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { analyzeWithGemini, analyzeWithOpenAI, generateEmailWithOpenAI } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  console.log('📥 POST /api/analyze - Request received');
  
  try {
    const formData = await request.formData();
    console.log('📝 FormData parsed successfully');
    
    const prospectName = formData.get('prospectName') as string;
    const company = formData.get('company') as string;
    const email = formData.get('email') as string;
    const igHandle = formData.get('igHandle') as string;
    const websiteUrl = formData.get('websiteUrl') as string;
    const profilePictureUrl = formData.get('profilePictureUrl') as string;
    const websiteData = formData.get('websiteData') as string;
    
    console.log('👤 Prospect:', prospectName, 'Company:', company);
    
    const igFile = formData.get('igFile') as File | null;
    const substackFile = formData.get('substackFile') as File | null;
    const threadsFile = formData.get('threadsFile') as File | null;
    const otherFile = formData.get('otherFile') as File | null;

    if (!prospectName) {
      console.log('❌ No prospect name provided');
      return NextResponse.json({ error: 'Prospect name is required' }, { status: 400 });
    }

    console.log('🗄️ Creating lead in database...');
    
    // 1. Create lead in database
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .insert({
        name: prospectName,
        company: company || null,
        email: email || null,
        instagram: igHandle || null,
        website: websiteUrl || null,
        profile_picture: profilePictureUrl || null,
        status: 'lead_collected',
      })
      .select()
      .single();

    if (leadError || !lead) {
      console.error('❌ Lead creation error:', leadError);
      return NextResponse.json({ error: 'Failed to create lead. Have you run supabase-schema.sql in your Supabase project?', details: leadError?.message }, { status: 500 });
    }
    
    console.log('✅ Lead created:', lead.id);

    // SKIP AI ANALYSIS ON INITIAL CREATION - Return early
    console.log('⏭️ Skipping AI analysis (run via "Run AI Analysis" button instead)');
    return NextResponse.json({
      message: 'Lead created successfully',
      leadId: lead.id,
    });

    // === REST OF CODE DISABLED FOR NOW ===
    /* 
    // 2. Parse and store raw data
    const combinedData: any = {
      prospectName,
      company,
      websiteData,
    };

    // Parse Instagram JSON
    if (igFile) {
      const igText = await igFile.text();
      try {
        const igData = JSON.parse(igText);
        combinedData.instagramData = igData;
        
        await supabaseAdmin.from('raw_data_sources').insert({
          lead_id: lead.id,
          source_type: 'instagram',
          file_name: igFile.name,
          raw_content: igData,
        });
      } catch (e) {
        console.error('Failed to parse Instagram JSON:', e);
      }
    }

    // Store website data
    if (websiteData) {
      await supabaseAdmin.from('raw_data_sources').insert({
        lead_id: lead.id,
        source_type: 'website',
        raw_content: { text: websiteData },
      });
    }

    // Parse Substack file
    if (substackFile) {
      const substackText = await substackFile.text();
      combinedData.substackData = substackText;
      
      await supabaseAdmin.from('raw_data_sources').insert({
        lead_id: lead.id,
        source_type: 'substack',
        file_name: substackFile.name,
        raw_content: { text: substackText },
      });
    }

    // Parse Threads file
    if (threadsFile) {
      const threadsText = await threadsFile.text();
      combinedData.threadsData = threadsText;
      
      await supabaseAdmin.from('raw_data_sources').insert({
        lead_id: lead.id,
        source_type: 'threads',
        file_name: threadsFile.name,
        raw_content: { text: threadsText },
      });
    }

    // Parse other data file
    if (otherFile) {
      const otherText = await otherFile.text();
      combinedData.otherData = otherText;
      
      await supabaseAdmin.from('raw_data_sources').insert({
        lead_id: lead.id,
        source_type: 'other',
        file_name: otherFile.name,
        raw_content: { text: otherText },
      });
    }

    // 3. Run AI analyses in parallel
    const [geminiAnalysis, openaiAnalysis] = await Promise.all([
      analyzeWithGemini(combinedData).catch(err => {
        console.error('Gemini analysis failed:', err);
        return null;
      }),
      analyzeWithOpenAI(combinedData).catch(err => {
        console.error('OpenAI analysis failed:', err);
        return null;
      }),
    ]);

    // 4. Store AI analyses and extract Instagram analytics
    const analyses = [];
    let instagramAnalytics = null;
    
    if (geminiAnalysis) {
      // Extract Instagram analytics from analysis
      if (geminiAnalysis._instagramAnalytics) {
        instagramAnalytics = geminiAnalysis._instagramAnalytics;
      }
      
      const { data: geminiRecord } = await supabaseAdmin
        .from('ai_analyses')
        .insert({
          lead_id: lead.id,
          llm_provider: 'gemini',
          tone_keywords: geminiAnalysis.toneKeywords || [],
          story_arc: geminiAnalysis.storyArc || null,
          key_triggers: geminiAnalysis.keyTriggers || [],
          full_response: geminiAnalysis,
        })
        .select()
        .single();
      
      if (geminiRecord) analyses.push(geminiRecord);
    }

    if (openaiAnalysis) {
      // Extract Instagram analytics from analysis (prefer OpenAI if both exist)
      if (openaiAnalysis._instagramAnalytics) {
        instagramAnalytics = openaiAnalysis._instagramAnalytics;
      }
      
      const { data: openaiRecord } = await supabaseAdmin
        .from('ai_analyses')
        .insert({
          lead_id: lead.id,
          llm_provider: 'openai',
          tone_keywords: openaiAnalysis.toneKeywords || [],
          story_arc: openaiAnalysis.storyArc || null,
          key_triggers: openaiAnalysis.keyTriggers || [],
          full_response: openaiAnalysis,
        })
        .select()
        .single();
      
      if (openaiRecord) analyses.push(openaiRecord);
    }

    // Update lead with Instagram analytics
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
          mutual_connection_name: instagramAnalytics.topCommenterUsername, // Auto-populate mutual connection
          // Personal details
          personal_location: instagramAnalytics.personalDetails?.location,
          personal_hobbies: instagramAnalytics.personalDetails?.hobbies || [],
          personal_pets: instagramAnalytics.personalDetails?.pets || [],
          personal_struggles: instagramAnalytics.personalDetails?.struggles || [],
          personal_mentions: instagramAnalytics.personalDetails?.personalMentions || [],
          personal_story_hook: instagramAnalytics.personalStoryHook,
          audience_pain_points: instagramAnalytics.audiencePainPoints || [],
          specific_post_topics: instagramAnalytics.specificPostTopics || [],
        })
        .eq('id', lead.id);
      
      console.log(`✅ Instagram analytics saved: ${instagramAnalytics.totalPostsAnalyzed} posts, top commenter: @${instagramAnalytics.topCommenterUsername}`);
    }

    // 5. Generate initial email using best analysis (prefer OpenAI)
    const analysisForEmail = openaiAnalysis || geminiAnalysis;
    let emailData = null;

    if (analysisForEmail) {
      try {
        emailData = await generateEmailWithOpenAI(prospectName, analysisForEmail, 'initial');
        
        if (emailData) {
          await supabaseAdmin.from('generated_emails').insert({
            lead_id: lead.id,
            email_type: 'initial',
            subject: emailData.subject,
            body: emailData.body,
            llm_provider: 'openai',
          });
        }
      } catch (emailError) {
        console.error('Email generation failed:', emailError);
      }
    }

    // 6. Update lead status and score
    const personaScore = (geminiAnalysis || openaiAnalysis) ? 'high' : 'medium';
    await supabaseAdmin
      .from('leads')
      .update({
        status: 'lead_collected',
        persona_score: personaScore,
        next_action: 'Send Email',
      })
      .eq('id', lead.id);

    // 7. Return combined results
    return NextResponse.json({
      success: true,
      leadId: lead.id,
      lead,
      analyses: {
        gemini: geminiAnalysis,
        openai: openaiAnalysis,
      },
      email: emailData,
    });
    */ // End disabled block

  } catch (error) {
    console.error('❌ Analysis API Error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack:', error instanceof Error ? error.stack : '');
    
    return NextResponse.json(
      { error: 'Failed to process analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
