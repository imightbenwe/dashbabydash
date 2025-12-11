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
    const isWebsite = sourceType === 'website';
    const isPrivacyPolicy = sourceType === 'privacy_policy';
    let rawContent;
    let fileName;
    let finalSourceType;
    
    if (isInstagram) {
      // Parse JSON for Instagram data
      try {
        rawContent = JSON.parse(data);
      } catch (e) {
        rawContent = { text: data };
      }
      fileName = 'instagram_data.json';
      finalSourceType = 'instagram';
    } else if (isWebsite) {
      rawContent = { text: data };
      fileName = 'website_scraped';
      finalSourceType = 'website';
    } else if (isPrivacyPolicy) {
      rawContent = { text: data };
      fileName = 'privacy_policy_scraped';
      finalSourceType = 'privacy_policy';
    } else {
      rawContent = { text: data };
      fileName = 'manual_input';
      finalSourceType = 'other';
    }

    // Save to raw_data_sources table
    const { error } = await supabaseAdmin
      .from('raw_data_sources')
      .insert({
        lead_id: id,
        source_type: finalSourceType,
        file_name: fileName,
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
