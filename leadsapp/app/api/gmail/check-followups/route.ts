import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/gmail/check-followups
 * 
 * Checks for leads that need automated follow-ups based on date_contacted
 * and generates Gmail URLs for sending them.
 * 
 * This endpoint doesn't actually send emails (requires user action in Gmail)
 * but identifies which leads need follow-ups and prepares the data.
 */
export async function POST() {
  try {
    console.log('🔍 Checking for leads needing automated follow-ups...');

    const now = new Date();
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const eightDaysAgo = new Date(now);
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
    
    const fifteenDaysAgo = new Date(now);
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    // Get leads that need follow-up #1 (3 days after initial contact, no follow-up sent yet)
    // Only for leads that haven't replied, bounced, or been marked as lost/won
    const { data: needsFollowup1, error: error1 } = await supabaseAdmin
      .from('leads')
      .select('*')
      .not('status', 'in', '(replied_not_fit,replied_interested,call_booked,call_done_thinking,won,lost,site_live,email_bounced)')
      .is('followup_1_sent_at', null)
      .lte('date_contacted', threeDaysAgo.toISOString())
      .not('date_contacted', 'is', null);

    // Get leads that need follow-up #2 (5 days after follow-up #1)
    const { data: needsFollowup2, error: error2 } = await supabaseAdmin
      .from('leads')
      .select('*')
      .not('status', 'in', '(replied_not_fit,replied_interested,call_booked,call_done_thinking,won,lost,site_live,email_bounced)')
      .is('followup_2_sent_at', null)
      .not('followup_1_sent_at', 'is', null)
      .lte('followup_1_sent_at', new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString());

    // Get leads that need follow-up #3 (7 days after follow-up #2)
    const { data: needsFollowup3, error: error3 } = await supabaseAdmin
      .from('leads')
      .select('*')
      .not('status', 'in', '(replied_not_fit,replied_interested,call_booked,call_done_thinking,won,lost,site_live,email_bounced)')
      .is('followup_3_sent_at', null)
      .not('followup_2_sent_at', 'is', null)
      .lte('followup_2_sent_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error1 || error2 || error3) {
      console.error('❌ Database query errors:', { error1, error2, error3 });
      return NextResponse.json({ error: 'Failed to query leads' }, { status: 500 });
    }

    const followups = {
      followup_1: needsFollowup1 || [],
      followup_2: needsFollowup2 || [],
      followup_3: needsFollowup3 || [],
    };

    console.log(`📧 Follow-ups needed:`, {
      followup_1: followups.followup_1.length,
      followup_2: followups.followup_2.length,
      followup_3: followups.followup_3.length,
    });

    return NextResponse.json({
      success: true,
      followups,
      total: followups.followup_1.length + followups.followup_2.length + followups.followup_3.length,
    });
  } catch (error) {
    console.error('❌ Check follow-ups API error:', error);
    return NextResponse.json(
      { error: 'Failed to check follow-ups' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gmail/check-followups
 * Same as POST but for easy browser testing
 */
export async function GET() {
  return POST();
}
