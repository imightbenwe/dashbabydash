import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data, sourceType } = await request.json();

    if (!data || !data.trim()) {
      return NextResponse.json({ error: 'No data provided' }, { status: 400 });
    }

    console.log(`📝 Saving ${sourceType || 'additional'} data for lead ${id}`);

    // Determine source type and content format
    const isInstagram = sourceType === 'instagram';
    let rawContent;
    
    if (isInstagram) {
      // Parse JSON for Instagram data
      try {
        rawContent = JSON.parse(data);
      } catch (e) {
        rawContent = { text: data };
      }
    } else {
      rawContent = { text: data };
    }

    // Save to raw_data_sources table
    const { error } = await supabaseAdmin
      .from('raw_data_sources')
      .insert({
        lead_id: id,
        source_type: isInstagram ? 'instagram' : 'other',
        file_name: isInstagram ? 'instagram_data.json' : 'manual_input',
        raw_content: rawContent,
      });

    if (error) {
      console.error('Error saving additional data:', error);
      return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }

    console.log('✅ Additional data saved successfully');

    return NextResponse.json({
      success: true,
      message: 'Additional data saved successfully',
    });

  } catch (error) {
    console.error('❌ Error saving additional data:', error);
    return NextResponse.json(
      { error: 'Failed to save data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
