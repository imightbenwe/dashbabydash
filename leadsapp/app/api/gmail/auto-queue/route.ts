import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import emailTemplates from '@/lib/email-templates.json';

/**
 * POST /api/gmail/auto-queue
 * 
 * AUTOMATIC EMAIL QUEUING WITH DELAY (Waiting Room = Delayed Fuse)
 * 
 * This endpoint automatically queues ALL ready emails with a configurable delay.
 * The delay acts as a "fuse" - emails will automatically send after the delay
 * unless cancelled in the waiting room.
 * 
 * Body:
 * - delayMinutes: How long to wait before sending (default: 60 minutes)
 * - emailsPerHour: Rate limit for scheduling after delay
 * - sendingSchedule: 'business', 'extended', 'around_clock'
 * - sendingTimezone: IANA timezone string
 * 
 * Flow:
 * 1. Lead enters automation at 8:14 PM
 * 2. Gets queued with scheduled_for = 9:14 PM (60 min delay)
 * 3. Cron job picks it up at 9:14 PM and sends
 * 4. User can cancel in waiting room BEFORE 9:14 PM if something looks wrong
 */

// Statuses that should NOT receive follow-ups
const EXCLUDED_STATUSES = [
  'replied_not_fit', 'replied_interested', 'call_booked', 
  'call_done_thinking', 'won', 'lost', 'site_live', 'email_bounced'
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      delayMinutes = 60,  // Default: 60 minute fuse
      emailsPerHour = 10,
      sendingSchedule = 'business',
      sendingTimezone = 'America/New_York',
    } = body;

    console.log(`🔥 Auto-queueing with ${delayMinutes}min delay (fuse mode)`);

    const results = {
      queued: [] as any[],
      skipped: [] as any[],
      total: 0,
    };

    const now = new Date();

    // Get already queued items to exclude
    const { data: alreadyQueued } = await supabaseAdmin
      .from('email_send_queue')
      .select('lead_id, email_type')
      .in('status', ['approved', 'sending']);

    const queuedSet = new Set(
      (alreadyQueued || []).map(q => `${q.lead_id}:${q.email_type}`)
    );

    // Collect all leads that need emails
    const leadsToQueue: Array<{ lead: any; emailType: string; reason: string }> = [];

    // 1. Leads needing initial email (must have completed automation - stage 2)
    const { data: initialLeads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .is('date_contacted', null)
      .not('email', 'is', null)
      .eq('automation_stage', 2);  // Only fully analyzed leads

    for (const lead of initialLeads || []) {
      if (EXCLUDED_STATUSES.includes(lead.status)) continue;
      if (queuedSet.has(`${lead.id}:initial`)) continue;
      if (!lead.email || lead.email.trim() === '') continue;
      
      leadsToQueue.push({ lead, emailType: 'initial', reason: 'Not yet contacted' });
    }

    // 2. Leads needing follow-up #1 (3+ days since contact)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: fu1Leads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .is('followup_1_sent_at', null)
      .not('date_contacted', 'is', null)
      .lte('date_contacted', threeDaysAgo);

    for (const lead of fu1Leads || []) {
      if (EXCLUDED_STATUSES.includes(lead.status)) continue;
      if (queuedSet.has(`${lead.id}:followup_1`)) continue;
      if (!lead.email || lead.email.trim() === '') continue;
      
      leadsToQueue.push({ lead, emailType: 'followup_1', reason: '3+ days since initial contact' });
    }

    // 3. Leads needing follow-up #2 (5+ days since FU1)
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: fu2Leads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .is('followup_2_sent_at', null)
      .not('followup_1_sent_at', 'is', null)
      .lte('followup_1_sent_at', fiveDaysAgo);

    for (const lead of fu2Leads || []) {
      if (EXCLUDED_STATUSES.includes(lead.status)) continue;
      if (queuedSet.has(`${lead.id}:followup_2`)) continue;
      if (!lead.email || lead.email.trim() === '') continue;
      
      leadsToQueue.push({ lead, emailType: 'followup_2', reason: '5+ days since follow-up #1' });
    }

    // 4. Leads needing follow-up #3 (7+ days since FU2)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: fu3Leads } = await supabaseAdmin
      .from('leads')
      .select('*')
      .is('followup_3_sent_at', null)
      .not('followup_2_sent_at', 'is', null)
      .lte('followup_2_sent_at', sevenDaysAgo);

    for (const lead of fu3Leads || []) {
      if (EXCLUDED_STATUSES.includes(lead.status)) continue;
      if (queuedSet.has(`${lead.id}:followup_3`)) continue;
      if (!lead.email || lead.email.trim() === '') continue;
      
      leadsToQueue.push({ lead, emailType: 'followup_3', reason: '7+ days since follow-up #2' });
    }

    // Now queue all of them with the delay applied
    let position = 0;
    for (const { lead, emailType, reason } of leadsToQueue) {
      try {
        // Validate email type for lead
        const validationError = validateEmailForLead(lead, emailType);
        if (validationError) {
          results.skipped.push({ leadId: lead.id, leadName: lead.name, emailType, reason: validationError });
          continue;
        }

        // Generate email content
        const { subject, body: emailBody } = await generateEmailContent(lead, emailType);

        // Calculate scheduled time: NOW + delay + position offset
        const scheduledFor = calculateScheduledTimeWithDelay(
          position, 
          delayMinutes, 
          emailsPerHour, 
          sendingSchedule, 
          sendingTimezone
        );

        // Insert into queue
        const { error: insertError } = await supabaseAdmin
          .from('email_send_queue')
          .insert({
            lead_id: lead.id,
            email_type: emailType,
            to_email: lead.email,
            subject,
            body: emailBody,
            scheduled_for: scheduledFor.toISOString(),
            status: 'approved',  // Already "approved" - this is auto-queue
          });

        if (insertError) {
          results.skipped.push({ leadId: lead.id, leadName: lead.name, emailType, reason: insertError.message });
          continue;
        }

        results.queued.push({
          leadId: lead.id,
          leadName: lead.name,
          email: lead.email,
          emailType,
          scheduledFor: scheduledFor.toISOString(),
          reason,
        });

        position++;
      } catch (error) {
        results.skipped.push({ 
          leadId: lead.id, 
          leadName: lead.name, 
          emailType, 
          reason: `Error: ${error instanceof Error ? error.message : 'Unknown'}` 
        });
      }
    }

    results.total = results.queued.length;
    console.log(`✅ Auto-queued ${results.queued.length} emails (fuse: ${delayMinutes}min)`);

    return NextResponse.json({
      success: true,
      ...results,
      delayMinutes,
      message: `${results.queued.length} emails queued with ${delayMinutes} minute delay`,
    });

  } catch (error) {
    console.error('❌ Auto-queue error:', error);
    return NextResponse.json(
      { error: 'Failed to auto-queue emails', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gmail/auto-queue
 * Get current queue status and countdown info
 */
export async function GET() {
  try {
    const now = new Date();

    // Get all queued items with lead details
    const { data: queue, error } = await supabaseAdmin
      .from('email_send_queue')
      .select(`
        *,
        leads:lead_id (id, name, email, company, status)
      `)
      .eq('status', 'approved')
      .order('scheduled_for', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
    }

    // Calculate time remaining for each item
    const queueWithCountdown = (queue || []).map((item: any) => {
      const scheduledFor = new Date(item.scheduled_for);
      const timeRemaining = scheduledFor.getTime() - now.getTime();
      const minutesRemaining = Math.max(0, Math.ceil(timeRemaining / 60000));
      
      return {
        ...item,
        minutesRemaining,
        isOverdue: timeRemaining < 0,
        willSendAt: item.scheduled_for,
      };
    });

    return NextResponse.json({
      success: true,
      queue: queueWithCountdown,
      total: queueWithCountdown.length,
      nextSendAt: queueWithCountdown[0]?.scheduled_for || null,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get queue status', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gmail/auto-queue
 * Clear all approved emails from queue (for rescheduling)
 */
export async function DELETE() {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_send_queue')
      .delete()
      .eq('status', 'approved');

    if (error) {
      return NextResponse.json({ error: 'Failed to clear queue' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Queue cleared',
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to clear queue', details: String(error) },
      { status: 500 }
    );
  }
}

// Helper: Validate that this email type is appropriate for this lead
function validateEmailForLead(lead: any, emailType: string): string | null {
  if (emailType === 'initial') {
    if (lead.date_contacted) {
      return 'Lead already contacted - cannot send initial email';
    }
  } else if (emailType === 'followup_1') {
    if (!lead.date_contacted) {
      return 'Lead not yet contacted - send initial email first';
    }
    if (lead.followup_1_sent_at) {
      return 'Follow-up #1 already sent';
    }
  } else if (emailType === 'followup_2') {
    if (!lead.followup_1_sent_at) {
      return 'Follow-up #1 not sent yet';
    }
    if (lead.followup_2_sent_at) {
      return 'Follow-up #2 already sent';
    }
  } else if (emailType === 'followup_3') {
    if (!lead.followup_2_sent_at) {
      return 'Follow-up #2 not sent yet';
    }
    if (lead.followup_3_sent_at) {
      return 'Follow-up #3 already sent';
    }
  }
  return null;
}

// Helper: Generate email content
async function generateEmailContent(lead: any, emailType: string): Promise<{ subject: string; body: string }> {
  const firstName = lead.name.split(' ')[0];
  const originalSubject = lead.initial_email_subject || 'Quick note after seeing your work';

  if (emailType === 'initial') {
    // For initial email, fetch the GENERATED email from AI analysis
    const { data: generatedEmails } = await supabaseAdmin
      .from('generated_emails')
      .select('subject, body')
      .eq('lead_id', lead.id)
      .eq('email_type', 'initial')
      .order('created_at', { ascending: false })
      .limit(1);

    if (generatedEmails && generatedEmails.length > 0 && generatedEmails[0]) {
      return {
        subject: generatedEmails[0].subject,
        body: generatedEmails[0].body,
      };
    }

    // Fallback to template
    const template = (emailTemplates as any).initial;
    return {
      subject: template.subject,
      body: template.body.replace(/{firstName}/g, firstName),
    };
  }

  // For follow-ups, use the template
  const templateKey = `auto_${emailType}` as keyof typeof emailTemplates;
  const template = (emailTemplates as any)[templateKey];

  return {
    subject: template.subject === 'RE:' ? `Re: ${originalSubject}` : template.subject,
    body: template.body
      .replace(/{firstName}/g, firstName)
      .replace(/{originalSubject}/g, originalSubject),
  };
}

// Helper: Calculate scheduled send time with delay
// First calculates the NORMAL send time based on position/rate/schedule,
// then ADDS the delay on top (the "fuse")
function calculateScheduledTimeWithDelay(
  position: number, 
  delayMinutes: number,
  perHour: number, 
  schedule: string, 
  timezone: string
): Date {
  const minutesBetweenEmails = 60 / perHour;
  
  // Step 1: Calculate the NORMAL send time (from NOW, based on rate limits)
  let currentTime = new Date();
  let emailsScheduled = 0;

  while (emailsScheduled <= position) {
    const tzHour = parseInt(currentTime.toLocaleString('en-US', { 
      timeZone: timezone, 
      hour: 'numeric', 
      hour12: false 
    }));

    let inSendingHours = true;
    if (schedule === 'business') {
      inSendingHours = tzHour >= 9 && tzHour < 18;
    } else if (schedule === 'extended') {
      inSendingHours = tzHour >= 7 && tzHour < 21;
    }

    if (inSendingHours) {
      if (emailsScheduled === position) {
        // Step 2: ADD the delay to this calculated time
        // e.g., if normal time is 8:14 PM and delay is 60 min → 9:14 PM
        return new Date(currentTime.getTime() + delayMinutes * 60 * 1000);
      }
      emailsScheduled++;
    }

    currentTime = new Date(currentTime.getTime() + minutesBetweenEmails * 60 * 1000);

    // Safety break (max 48 hours out)
    if (currentTime.getTime() - Date.now() > 48 * 60 * 60 * 1000) {
      return new Date(currentTime.getTime() + delayMinutes * 60 * 1000);
    }
  }

  return new Date(currentTime.getTime() + delayMinutes * 60 * 1000);
}
