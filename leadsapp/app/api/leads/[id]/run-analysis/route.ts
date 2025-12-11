import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { analyzeWithGemini, analyzeWithOpenAI, generateEmailWithOpenAI } from '@/lib/ai-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log('🚀 Running AI analysis for lead:', id);

  try {
    // 1. Get lead data
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 2. Get raw data sources (EXCLUDE privacy_policy - only for email extraction)
    const { data: rawSources } = await supabaseAdmin
      .from('raw_data_sources')
      .select('*')
      .eq('lead_id', id)
      .neq('source_type', 'privacy_policy'); // Don't include privacy policy in AI analysis

    // 3. Combine all content
    const combinedData: any = {
      prospectName: lead.name,
      company: lead.company,
      email: lead.email, // ADD EMAIL SO AI CAN EXTRACT NAME FROM IT
    };

    rawSources?.forEach(source => {
      if (source.source_type === 'instagram') {
        combinedData.instagramData = source.raw_content;
      } else if (source.source_type === 'website') {
        combinedData.websiteData = source.raw_content?.text || source.raw_content;
      } else if (source.source_type === 'substack') {
        combinedData.substackData = source.raw_content;
      } else if (source.source_type === 'threads') {
        combinedData.threadsData = source.raw_content;
      } else if (source.source_type === 'other') {
        combinedData.otherData = source.raw_content?.text || source.raw_content;
      }
    });

    // 4. Run OpenAI analysis only (faster, better quality)
    console.log('🤖 Running OpenAI analysis...');
    console.log('📊 Combined data:', {
      prospectName: combinedData.prospectName,
      company: combinedData.company,
      hasInstagram: !!combinedData.instagramData,
      hasWebsite: !!combinedData.websiteData,
      hasSubstack: !!combinedData.substackData,
      hasThreads: !!combinedData.threadsData,
      hasOther: !!combinedData.otherData,
    });
    
    const openaiAnalysis = await analyzeWithOpenAI(combinedData).catch(err => {
      console.error('❌ OpenAI analysis failed:', err.message);
      return null;
    });

    // 5. Check if analysis succeeded
    if (!openaiAnalysis) {
      console.error('❌ OpenAI analysis failed');
      return NextResponse.json(
        { error: 'AI analysis failed. Check API keys and try again.' },
        { status: 500 }
      );
    }

    // 6. Delete old analyses before storing new ones
    console.log('🗑️ Deleting old analyses...');
    await supabaseAdmin
      .from('ai_analyses')
      .delete()
      .eq('lead_id', id);

    // 7. Store new OpenAI analysis
    const { data: openaiRecord } = await supabaseAdmin
      .from('ai_analyses')
      .insert({
        lead_id: id,
        llm_provider: 'openai',
        full_response: openaiAnalysis,
      })
      .select()
      .single();

    // 8. Update lead name with extracted first name if available
    console.log(`🔍 AI returned firstNameGuess: "${openaiAnalysis?.firstNameGuess}"`);
    
    if (openaiAnalysis?.firstNameGuess && 
        openaiAnalysis.firstNameGuess.trim() !== '') {
      console.log(`📝 Updating lead name to: ${openaiAnalysis.firstNameGuess}`);
      await supabaseAdmin
        .from('leads')
        .update({ name: openaiAnalysis.firstNameGuess })
        .eq('id', id);
    } else {
      console.log('⚠️ No first name returned by AI');
    }

    // 9. Auto-generate initial email immediately
    console.log('📧 Auto-generating initial email...');
    try {
      const emailData = await generateEmailWithOpenAI(
        openaiAnalysis?.firstNameGuess || lead.name,
        openaiAnalysis,
        'initial',
        undefined,
        {
          mutualConnection: lead.mutual_connection_name,
          specificHookStory: lead.specific_hook_story || openaiAnalysis?.specificHookStory,
          problemStatement: lead.problem_statement || openaiAnalysis?.websiteProblem,
          caseStudy: lead.case_study_reference,
          mockupSiteUrl: lead.mockup_site_url,
        }
      );

      // Delete existing initial email if any
      await supabaseAdmin
        .from('generated_emails')
        .delete()
        .eq('lead_id', id)
        .eq('email_type', 'initial');

      // Save new email
      await supabaseAdmin
        .from('generated_emails')
        .insert({
          lead_id: id,
          email_type: 'initial',
          subject: emailData.subject,
          body: emailData.body,
          llm_provider: 'openai',
        });

      console.log('✅ Initial email auto-generated successfully');
    } catch (emailError) {
      console.error('⚠️ Failed to auto-generate email:', emailError);
      // Don't fail the whole analysis if email generation fails
    }

    // 10. Done - analysis and email complete
    console.log('✅ Analysis and email generation complete');

    return NextResponse.json({
      success: true,
      message: 'Analysis and email generated successfully',
      analyses: 1,
      emailGenerated: true,
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
