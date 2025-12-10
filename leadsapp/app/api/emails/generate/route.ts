import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmailWithOpenAI } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, emailType = 'initial', template, regenerate = false } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    console.log('📧 Email generation request:', { leadId, emailType, hasTemplate: !!template, regenerate });

    // Fetch lead
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Fetch latest analysis (prefer OpenAI)
    const { data: analyses } = await supabaseAdmin
      .from('ai_analyses')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    const openaiAnalysis = analyses?.find(a => a.llm_provider === 'openai');
    const analysisToUse = openaiAnalysis || analyses?.[0];

    if (!analysisToUse) {
      return NextResponse.json(
        { error: 'No analysis found for this lead. Run analysis first.' },
        { status: 400 }
      );
    }

    // Check if email of this type already exists and delete it (always allow regeneration)
    const { data: existingEmail } = await supabaseAdmin
      .from('generated_emails')
      .select('*')
      .eq('lead_id', leadId)
      .eq('email_type', emailType)
      .single();

    if (existingEmail) {
      console.log(`🔄 Deleting existing ${emailType} email to regenerate`);
      await supabaseAdmin
        .from('generated_emails')
        .delete()
        .eq('id', existingEmail.id);
    }

    // Generate email
    const emailData = await generateEmailWithOpenAI(
      lead.name,
      analysisToUse.full_response,
      emailType as 'initial' | 'follow_up_1' | 'follow_up_2',
      template, // Pass custom template if provided
      {
        mutualConnection: lead.mutual_connection_name,
        specificHookStory: lead.specific_hook_story || analysisToUse.full_response?.specificHookStory,
        problemStatement: lead.problem_statement || analysisToUse.full_response?.websiteProblem,
        caseStudy: lead.case_study_reference,
        mockupSiteUrl: lead.mockup_site_url,
      }
    );

    // Store in database
    const { data: savedEmail, error: emailError } = await supabaseAdmin
      .from('generated_emails')
      .insert({
        lead_id: leadId,
        email_type: emailType,
        subject: emailData.subject,
        body: emailData.body,
        llm_provider: 'openai',
      })
      .select()
      .single();

    if (emailError) {
      console.error('Email save error:', emailError);
      return NextResponse.json({ error: 'Failed to save email' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      email: savedEmail,
    });

  } catch (error) {
    console.error('Email generation API Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate email', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
