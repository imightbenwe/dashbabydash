import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/gmail/mark-followup-sent
 * 
 * Marks a follow-up email as sent for a specific lead
 * 
 * Body: { leadId: string, followupNumber: 1 | 2 | 3, subject?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { leadId, followupNumber, subject } = await request.json();

    if (!leadId || !followupNumber) {
      return NextResponse.json(
        { error: 'leadId and followupNumber are required' },
        { status: 400 }
      );
    }

    console.log(`📧 Marking follow-up #${followupNumber} as sent for lead ${leadId}`);

    const updateData: any = {};
    const now = new Date().toISOString();

    switch (followupNumber) {
      case 1:
        updateData.followup_1_sent_at = now;
        break;
      case 2:
        updateData.followup_2_sent_at = now;
        break;
      case 3:
        updateData.followup_3_sent_at = now;
        break;
      default:
        return NextResponse.json(
          { error: 'followupNumber must be 1, 2, or 3' },
          { status: 400 }
        );
    }

    // Update the lead
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .update(updateData)
      .eq('id', leadId)
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to update lead:', error);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }

    // Also save to generated_emails table for tracking
    const emailType = `auto_followup_${followupNumber}`;
    await supabaseAdmin
      .from('generated_emails')
      .insert({
        lead_id: leadId,
        email_type: emailType,
        subject: subject || `Follow-up #${followupNumber}`,
        body: '', // Body is in the template
        llm_provider: 'template',
        sent_at: now,
      });

    console.log(`✅ Follow-up #${followupNumber} marked as sent for lead ${leadId}`);

    return NextResponse.json({
      success: true,
      lead,
      message: `Follow-up #${followupNumber} marked as sent`,
    });
  } catch (error) {
    console.error('❌ Mark follow-up sent API error:', error);
    return NextResponse.json(
      { error: 'Failed to mark follow-up as sent' },
      { status: 500 }
    );
  }
}
