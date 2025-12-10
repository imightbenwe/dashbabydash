import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🔍 Fetching full analysis for lead ${id}`);

    // Fetch AI analyses
    const { data: analyses, error: analysesError } = await supabaseAdmin
      .from('ai_analyses')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    if (analysesError) {
      console.error('❌ Error fetching analyses:', analysesError);
      return NextResponse.json({ error: 'Failed to fetch analyses' }, { status: 500 });
    }

    // Fetch raw data sources
    const { data: rawData, error: rawDataError } = await supabaseAdmin
      .from('raw_data_sources')
      .select('*')
      .eq('lead_id', id)
      .order('uploaded_at', { ascending: false });

    if (rawDataError) {
      console.error('❌ Error fetching raw data:', rawDataError);
    }

    // Organize analyses by provider
    const openaiAnalysis = analyses?.find(a => a.llm_provider === 'openai');
    const geminiAnalysis = analyses?.find(a => a.llm_provider === 'gemini');

    console.log('✅ Analysis data fetched successfully');

    return NextResponse.json({
      openai: openaiAnalysis || null,
      gemini: geminiAnalysis || null,
      rawDataSources: rawData || [],
    });

  } catch (error) {
    console.error('❌ Error in analysis endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}
