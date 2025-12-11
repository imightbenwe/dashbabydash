import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Retry Automation API
 * Resets a lead's automation stage to retry from the failed step
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🔄 Retrying automation for lead ${id}`);

    // Get the lead to check current stage
    const { data: lead, error: fetchError } = await supabaseAdmin
      .from('leads')
      .select('id, name, automation_stage, automation_error')
      .eq('id', id)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json(
        { error: 'Lead not found' },
        { status: 404 }
      );
    }

    // Only retry if the lead is in error state (stage -1)
    if (lead.automation_stage !== -1) {
      return NextResponse.json(
        { error: 'Lead is not in error state. Nothing to retry.' },
        { status: 400 }
      );
    }

    // Determine which stage to retry from based on the error message
    let resetStage = 0;
    if (lead.automation_error?.includes('AI analysis failed')) {
      // If AI analysis failed, set back to stage 1 (scraped, ready for analysis)
      resetStage = 1;
    } else if (lead.automation_error?.includes('Scraping failed')) {
      // If scraping failed, set back to stage 0 (ready for scraping)
      resetStage = 0;
    }

    // Reset the lead's automation stage and clear error
    const { error: updateError } = await supabaseAdmin
      .from('leads')
      .update({
        automation_stage: resetStage,
        automation_error: null,
        automation_stage_updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('❌ Failed to reset automation stage:', updateError);
      return NextResponse.json(
        { error: 'Failed to reset automation stage' },
        { status: 500 }
      );
    }

    console.log(`✅ ${lead.name} reset to stage ${resetStage} for retry`);

    return NextResponse.json({
      success: true,
      message: `Lead reset to stage ${resetStage}. Automation will retry on next check.`,
      resetStage,
    });

  } catch (error) {
    console.error('❌ Retry automation error:', error);
    return NextResponse.json(
      { error: 'Failed to retry automation' },
      { status: 500 }
    );
  }
}
