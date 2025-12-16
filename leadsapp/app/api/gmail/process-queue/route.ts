import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/gmail-sender';
import { verifyCronSecret, unauthorizedCronResponse } from '@/lib/cron-security';

/**
 * POST /api/gmail/process-queue
 * 
 * SAFE AUTOMATION: Only sends emails that have been MANUALLY APPROVED
 * and added to the email_send_queue table.
 * 
 * This endpoint:
 * 1. Checks ONLY the email_send_queue table (approved emails)
 * 2. Only sends emails where scheduled_for <= NOW
 * 3. Respects rate limits
 * 4. Updates status to 'sent' after sending
 * 
 * NOTHING sends without explicit approval in the queue first.
 * 
 * SECURITY: Requires CRON_SECRET for production automated calls.
 * User-initiated calls (with userEmail in body) are allowed without secret.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      emailsPerHour = 10, 
      sendingSchedule = 'business', 
      sendingTimezone = 'America/New_York',
      testMode = true,
      userEmail,
    } = body;

    // Allow user-initiated calls (from UI) without CRON_SECRET
    // But require CRON_SECRET for automated/cron calls (no userEmail provided initially)
    const isAutomatedCall = request.headers.get('x-cron-secret') || 
                           request.headers.get('authorization')?.startsWith('Bearer ');
    
    if (isAutomatedCall && !verifyCronSecret(request)) {
      return NextResponse.json(unauthorizedCronResponse(), { status: 401 });
    }

    console.log('🔄 Process Approved Queue:', { testMode, userEmail: userEmail ? '✓' : '✗' });

    // Test Mode - don't send
    if (testMode) {
      return NextResponse.json({
        success: true,
        sent: [],
        skipped: 'Test Mode enabled - no emails sent.',
        testMode: true,
      });
    }

    // Check Gmail connection
    if (!userEmail) {
      return NextResponse.json({
        success: false,
        sent: [],
        skipped: 'No Gmail account connected.',
      });
    }

    // Check sending hours
    const now = new Date();
    const tzHour = parseInt(now.toLocaleString('en-US', { 
      timeZone: sendingTimezone, 
      hour: 'numeric', 
      hour12: false 
    }));

    let inSendingHours = true;
    if (sendingSchedule === 'business') {
      inSendingHours = tzHour >= 9 && tzHour < 18;
    } else if (sendingSchedule === 'extended') {
      inSendingHours = tzHour >= 7 && tzHour < 21;
    }

    if (!inSendingHours) {
      return NextResponse.json({
        success: true,
        sent: [],
        skipped: `Outside sending hours (${tzHour}:00 ${sendingTimezone})`,
      });
    }

    // Check rate limit
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { count: sentLastHour } = await supabaseAdmin
      .from('email_send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', oneHourAgo);

    if ((sentLastHour || 0) >= emailsPerHour) {
      return NextResponse.json({
        success: true,
        sent: [],
        skipped: `Rate limit reached (${sentLastHour}/${emailsPerHour} this hour)`,
        rateLimitReached: true,
      });
    }

    // ATOMIC CLAIM: Update status to 'sending' and return the row in ONE operation
    // This prevents race conditions where two process-queue calls pick up the same email
    const { data: claimedEmail, error: claimError } = await supabaseAdmin
      .rpc('claim_next_email', { max_scheduled: now.toISOString() });

    if (claimError) {
      console.error('❌ Claim error:', claimError);
      // Fallback: try the old way but with immediate status check
      const { data: dueEmails } = await supabaseAdmin
        .from('email_send_queue')
        .select('*, leads(name, email, gmail_thread_id, gmail_message_id, initial_email_subject)')
        .eq('status', 'approved')
        .lte('scheduled_for', now.toISOString())
        .order('scheduled_for', { ascending: true })
        .limit(1);

      if (!dueEmails || dueEmails.length === 0) {
        return NextResponse.json({
          success: true,
          sent: [],
          skipped: 'No approved emails due to send.',
        });
      }

      // Try to claim it atomically - only update if still 'approved'
      const { data: claimed, error: updateError } = await supabaseAdmin
        .from('email_send_queue')
        .update({ status: 'sending' })
        .eq('id', dueEmails[0].id)
        .eq('status', 'approved') // CRITICAL: Only if still approved!
        .select('*, leads(name, email, gmail_thread_id, gmail_message_id, initial_email_subject)')
        .single();

      if (updateError || !claimed) {
        return NextResponse.json({
          success: true,
          sent: [],
          skipped: 'Email was already claimed by another process.',
        });
      }

      // Use the claimed email
      const queueItem = claimed;
      const lead = queueItem.leads;

      try {
        // Call shared gmail-sender directly (no HTTP fetch)
        const result = await sendEmail({
          leadId: queueItem.lead_id,
          to: queueItem.to_email,
          subject: queueItem.subject,
          body: queueItem.body,
          followupNumber: queueItem.email_type === 'initial' ? undefined : 
            parseInt(queueItem.email_type.split('_')[1] || '1', 10),
          threadId: lead?.gmail_thread_id,
          messageId: lead?.gmail_message_id,
          userEmail,
        });

        if (!result.success) {
          throw new Error(result.error || 'Send failed');
        }

        await supabaseAdmin
          .from('email_send_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', queueItem.id);

        if (queueItem.email_type === 'initial') {
          await supabaseAdmin
            .from('leads')
            .update({
              date_contacted: new Date().toISOString(),
              status: 'contacted',
              initial_email_subject: queueItem.subject,
            })
            .eq('id', queueItem.lead_id);
        }

        return NextResponse.json({
          success: true,
          sent: [{
            leadId: queueItem.lead_id,
            leadName: lead?.name,
            email: queueItem.to_email,
            type: queueItem.email_type,
            success: true,
          }],
        });

      } catch (sendError) {
        await supabaseAdmin
          .from('email_send_queue')
          .update({ status: 'failed', error_message: String(sendError) })
          .eq('id', queueItem.id);

        return NextResponse.json({
          success: false,
          sent: [{
            leadId: queueItem.lead_id,
            leadName: lead?.name,
            email: queueItem.to_email,
            type: queueItem.email_type,
            success: false,
            error: String(sendError),
          }],
        });
      }
    }

    // RPC worked - use the claimed email
    if (!claimedEmail || claimedEmail.length === 0) {
      return NextResponse.json({
        success: true,
        sent: [],
        skipped: 'No approved emails due to send.',
      });
    }

    const queueItem = claimedEmail[0];
    
    // Fetch lead data
    const { data: leadData } = await supabaseAdmin
      .from('leads')
      .select('name, email, gmail_thread_id, gmail_message_id, initial_email_subject')
      .eq('id', queueItem.lead_id)
      .single();
    
    const lead = leadData;

    try {
      // Call shared gmail-sender directly (no HTTP fetch)
      const result = await sendEmail({
        leadId: queueItem.lead_id,
        to: queueItem.to_email,
        subject: queueItem.subject,
        body: queueItem.body,
        followupNumber: queueItem.email_type === 'initial' ? undefined : 
          parseInt(queueItem.email_type.split('_')[1] || '1', 10),
        threadId: lead?.gmail_thread_id,
        messageId: lead?.gmail_message_id,
        userEmail,
      });

      if (!result.success) {
        throw new Error(result.error || 'Send failed');
      }

      // Mark as sent
      await supabaseAdmin
        .from('email_send_queue')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', queueItem.id);

      // If initial email, update lead's date_contacted
      if (queueItem.email_type === 'initial') {
        await supabaseAdmin
          .from('leads')
          .update({
            date_contacted: new Date().toISOString(),
            status: 'contacted',
            initial_email_subject: queueItem.subject,
          })
          .eq('id', queueItem.lead_id);
      }

      console.log(`✅ Sent ${queueItem.email_type} to ${lead?.name} (${queueItem.to_email})`);

      return NextResponse.json({
        success: true,
        sent: [{
          leadId: queueItem.lead_id,
          leadName: lead?.name,
          email: queueItem.to_email,
          type: queueItem.email_type,
          success: true,
        }],
      });

    } catch (sendError) {
      // Mark as failed
      await supabaseAdmin
        .from('email_send_queue')
        .update({ 
          status: 'failed', 
          error_message: String(sendError) 
        })
        .eq('id', queueItem.id);

      console.error(`❌ Failed to send to ${lead?.name}:`, sendError);

      return NextResponse.json({
        success: false,
        sent: [{
          leadId: queueItem.lead_id,
          leadName: lead?.name,
          email: queueItem.to_email,
          type: queueItem.email_type,
          success: false,
          error: String(sendError),
        }],
      });
    }

  } catch (error) {
    console.error('❌ Process queue error:', error);
    return NextResponse.json(
      { error: 'Failed to process queue', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gmail/process-queue
 * Returns the current approved queue status
 * Query params:
 * - status=failed: Also include failed items
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeStatus = url.searchParams.get('status');
    
    // Determine which statuses to fetch
    const statuses = ['approved', 'sending'];
    if (includeStatus === 'failed') {
      statuses.push('failed');
    }
    
    const { data: queue, error } = await supabaseAdmin
      .from('email_send_queue')
      .select('*, leads(name, email, company)')
      .in('status', statuses)
      .order('scheduled_for', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to get queue' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      queue: queue || [],
      total: queue?.length || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get queue', details: String(error) },
      { status: 500 }
    );
  }
}
