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

    // 2. Get raw data sources
    const { data: rawSources } = await supabaseAdmin
      .from('raw_data_sources')
      .select('*')
      .eq('lead_id', id);

    // 3. Combine all content
    const combinedData: any = {
      prospectName: lead.name,
      company: lead.company,
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

    // 8. Done - user can now generate email with updated data
    console.log('✅ Analysis complete - user can now generate email with updated data');

    return NextResponse.json({
      success: true,
      message: 'Analysis completed successfully',
      analyses: 1,
    });

  } catch (error) {
    console.error('❌ Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run analysis', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
