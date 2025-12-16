import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import emailTemplates from '@/lib/email-templates.json';

/**
 * POST /api/gmail/approve-queue
 * 
 * Takes items from the preview queue and adds them to the approved email_send_queue
 * with scheduled send times. NOTHING sends until this approval happens.
 * 
 * Body:
 * - items: Array of { leadId, emailType } to approve
 * - emailsPerHour: Rate limit for scheduling
 * - sendingSchedule: 'business', 'extended', 'around_clock'
 * - sendingTimezone: IANA timezone string
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      items = [], 
      emailsPerHour = 10,
      sendingSchedule = 'business',
      sendingTimezone = 'America/New_York',
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items to approve' }, { status: 400 });
    }

    console.log(`📝 Approving ${items.length} items for send queue`);

    const approved = [];
    const skipped = [];
    let position = 0;

    for (const item of items) {
      const { leadId, emailType } = item;

      // SAFEGUARD 1: Check if this exact email is already queued (not sent)
      const { data: existing } = await supabaseAdmin
        .from('email_send_queue')
        .select('id')
        .eq('lead_id', leadId)
        .eq('email_type', emailType)
        .in('status', ['approved', 'sending'])
        .limit(1);

      if (existing && existing.length > 0) {
        skipped.push({ leadId, emailType, reason: 'Already in queue' });
        continue;
      }

      // SAFEGUARD 2: Get lead and verify the email is appropriate
      const { data: lead, error: leadError } = await supabaseAdmin
        .from('leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !lead) {
        skipped.push({ leadId, emailType, reason: 'Lead not found' });
        continue;
      }

      // SAFEGUARD 3: Check for missing email
      if (!lead.email || lead.email.trim() === '') {
        skipped.push({ leadId, emailType, reason: 'Missing email address - cannot send' });
        continue;
      }

      // SAFEGUARD 4: Verify this email type makes sense for this lead
      const validationError = validateEmailForLead(lead, emailType);
      if (validationError) {
        skipped.push({ leadId, emailType, reason: validationError });
        continue;
      }

      // SAFEGUARD 4: Check excluded statuses
      const excludedStatuses = [
        'replied_not_fit', 'replied_interested', 'call_booked', 
        'call_done_thinking', 'won', 'lost', 'site_live', 'email_bounced'
      ];
      if (excludedStatuses.includes(lead.status)) {
        skipped.push({ leadId, emailType, reason: `Lead has status: ${lead.status}` });
        continue;
      }

      // Generate email content (now async to fetch generated emails)
      const { subject, body: emailBody } = await generateEmailContent(lead, emailType);

      // Calculate scheduled time based on position
      const scheduledFor = calculateScheduledTime(position, emailsPerHour, sendingSchedule, sendingTimezone);

      // Insert into approved queue
      const { error: insertError } = await supabaseAdmin
        .from('email_send_queue')
        .insert({
          lead_id: leadId,
          email_type: emailType,
          to_email: lead.email,
          subject,
          body: emailBody,
          scheduled_for: scheduledFor.toISOString(),
          status: 'approved',
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        skipped.push({ leadId, emailType, reason: insertError.message });
        continue;
      }

      approved.push({
        leadId,
        leadName: lead.name,
        email: lead.email,
        emailType,
        scheduledFor: scheduledFor.toISOString(),
      });

      position++;
    }

    console.log(`✅ Approved: ${approved.length}, Skipped: ${skipped.length}`);

    return NextResponse.json({
      success: true,
      approved,
      skipped,
      totalApproved: approved.length,
      totalSkipped: skipped.length,
    });

  } catch (error) {
    console.error('❌ Approve queue error:', error);
    return NextResponse.json(
      { error: 'Failed to approve queue', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/gmail/approve-queue
 * Remove items from the approved queue (cancel pending sends)
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { queueIds } = body;

    if (!queueIds || queueIds.length === 0) {
      return NextResponse.json({ error: 'No queue IDs provided' }, { status: 400 });
    }

    // Only delete items that haven't been sent yet
    const { data: deleted, error } = await supabaseAdmin
      .from('email_send_queue')
      .delete()
      .in('id', queueIds)
      .in('status', ['approved', 'failed']) // Can't delete 'sending' or 'sent'
      .select();

    if (error) {
      return NextResponse.json({ error: 'Failed to remove items' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      removed: deleted?.length || 0,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to remove from queue', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gmail/approve-queue
 * Get the preview of what COULD be queued (not yet approved)
 * Also returns items that have issues and need attention
 */
export async function GET() {
  try {
    const now = new Date();
    const previewQueue: any[] = [];
    const requiresAttention: any[] = [];

    // Statuses that should NOT receive follow-ups
    const excludedStatuses = [
      'replied_not_fit', 'replied_interested', 'call_booked', 
      'call_done_thinking', 'won', 'lost', 'site_live', 'email_bounced'
    ];

    // Helper to detect issues with a lead
    const detectIssues = (lead: any, emailType: string): string[] => {
      const issues: string[] = [];
      if (!lead.email || lead.email.trim() === '') {
        issues.push('Missing email address');
      }
      if (!lead.name || lead.name.trim() === '') {
        issues.push('Missing name');
      }
      if (emailType === 'initial') {
        // For initial emails, we need a generated email
        // We'll check this separately
      }
      return issues;
    };

    // Get already queued items to exclude
    const { data: alreadyQueued } = await supabaseAdmin
      .from('email_send_queue')
      .select('lead_id, email_type')
      .in('status', ['approved', 'sending']);

    const queuedSet = new Set(
      (alreadyQueued || []).map(q => `${q.lead_id}:${q.email_type}`)
    );

    // 1. Leads needing initial email (including those with potential issues)
    const { data: initialLeads } = await supabaseAdmin
      .from('leads')
      .select('id, name, email, company, status')
      .is('date_contacted', null);

    for (const lead of initialLeads || []) {
      if (excludedStatuses.includes(lead.status)) continue;
      if (queuedSet.has(`${lead.id}:initial`)) continue;
      
      const issues = detectIssues(lead, 'initial');
      const item = {
        leadId: lead.id,
        leadName: lead.name || 'Unknown',
        email: lead.email || '',
        company: lead.company,
        emailType: 'initial',
        reason: 'Not yet contacted',
      };

      if (issues.length > 0) {
        requiresAttention.push({ ...item, issues });
      } else {
        previewQueue.push(item);
      }
    }

    // 2. Leads needing follow-up #1
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: fu1Leads } = await supabaseAdmin
      .from('leads')
      .select('id, name, email, company, status, date_contacted')
      .is('followup_1_sent_at', null)
      .not('date_contacted', 'is', null)
      .lte('date_contacted', threeDaysAgo);

    for (const lead of fu1Leads || []) {
      if (excludedStatuses.includes(lead.status)) continue;
      if (queuedSet.has(`${lead.id}:followup_1`)) continue;
      
      const issues = detectIssues(lead, 'followup_1');
      const item = {
        leadId: lead.id,
        leadName: lead.name || 'Unknown',
        email: lead.email || '',
        company: lead.company,
        emailType: 'followup_1',
        reason: '3+ days since initial contact',
      };

      if (issues.length > 0) {
        requiresAttention.push({ ...item, issues });
      } else {
        previewQueue.push(item);
      }
    }

    // 3. Leads needing follow-up #2
    const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { data: fu2Leads } = await supabaseAdmin
      .from('leads')
      .select('id, name, email, company, status, followup_1_sent_at')
      .is('followup_2_sent_at', null)
      .not('followup_1_sent_at', 'is', null)
      .lte('followup_1_sent_at', fiveDaysAgo);

    for (const lead of fu2Leads || []) {
      if (excludedStatuses.includes(lead.status)) continue;
      if (queuedSet.has(`${lead.id}:followup_2`)) continue;
      
      const issues = detectIssues(lead, 'followup_2');
      const item = {
        leadId: lead.id,
        leadName: lead.name || 'Unknown',
        email: lead.email || '',
        company: lead.company,
        emailType: 'followup_2',
        reason: '5+ days since follow-up #1',
      };

      if (issues.length > 0) {
        requiresAttention.push({ ...item, issues });
      } else {
        previewQueue.push(item);
      }
    }

    // 4. Leads needing follow-up #3
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: fu3Leads } = await supabaseAdmin
      .from('leads')
      .select('id, name, email, company, status, followup_2_sent_at')
      .is('followup_3_sent_at', null)
      .not('followup_2_sent_at', 'is', null)
      .lte('followup_2_sent_at', sevenDaysAgo);

    for (const lead of fu3Leads || []) {
      if (excludedStatuses.includes(lead.status)) continue;
      if (queuedSet.has(`${lead.id}:followup_3`)) continue;
      
      const issues = detectIssues(lead, 'followup_3');
      const item = {
        leadId: lead.id,
        leadName: lead.name || 'Unknown',
        email: lead.email || '',
        company: lead.company,
        emailType: 'followup_3',
        reason: '7+ days since follow-up #2',
      };

      if (issues.length > 0) {
        requiresAttention.push({ ...item, issues });
      } else {
        previewQueue.push(item);
      }
    }

    // Also get failed emails from the queue that need attention
    const { data: failedEmails } = await supabaseAdmin
      .from('email_send_queue')
      .select(`
        id,
        lead_id,
        email_type,
        to_email,
        error_message,
        leads:lead_id (name, email, company)
      `)
      .eq('status', 'failed');

    for (const failed of failedEmails || []) {
      const lead = (failed as any).leads;
      requiresAttention.push({
        leadId: failed.lead_id,
        leadName: lead?.name || 'Unknown',
        email: failed.to_email || '',
        company: lead?.company,
        emailType: failed.email_type,
        reason: 'Send failed',
        issues: [failed.error_message || 'Unknown error'],
        queueId: failed.id,
        isFailed: true,
      });
    }

    return NextResponse.json({
      success: true,
      preview: previewQueue,
      requiresAttention,
      total: previewQueue.length,
      totalRequiresAttention: requiresAttention.length,
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get preview', details: String(error) },
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
    // For initial email, fetch the GENERATED email from AI analysis (has emailOpening replaced)
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

    // Fallback to template (will have {emailOpening} placeholder - not ideal)
    const template = (emailTemplates as any).initial;
    return {
      subject: template.subject,
      body: template.body.replace(/{firstName}/g, firstName),
    };
  }

  // For follow-ups, use the template (no emailOpening needed)
  const templateKey = `auto_${emailType}` as keyof typeof emailTemplates;
  const template = (emailTemplates as any)[templateKey];

  return {
    subject: template.subject === 'RE:' ? `Re: ${originalSubject}` : template.subject,
    body: template.body
      .replace(/{firstName}/g, firstName)
      .replace(/{originalSubject}/g, originalSubject),
  };
}

// Helper: Calculate scheduled send time
function calculateScheduledTime(
  position: number, 
  perHour: number, 
  schedule: string, 
  timezone: string
): Date {
  const minutesBetweenEmails = 60 / perHour;
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
        return currentTime;
      }
      emailsScheduled++;
    }

    currentTime = new Date(currentTime.getTime() + minutesBetweenEmails * 60 * 1000);

    // Safety break
    if (currentTime.getTime() - Date.now() > 48 * 60 * 60 * 1000) {
      return currentTime;
    }
  }

  return currentTime;
}
