import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/gmail-sender';
import { verifyCronSecret, unauthorizedCronResponse } from '@/lib/cron-security';

/**
 * POST /api/cron/send-emails
 * 
 * Server-side email scheduler - designed to be called by GitHub Actions cron.
 * This endpoint:
 * 1. Verifies CRON_SECRET
 * 2. Checks business hours (configurable timezone)
 * 3. Runs watchdog to recover stuck emails
 * 4. Claims a batch of emails atomically
 * 5. Sends each email via Gmail API
 * 6. Updates status with proper retry handling
 * 
 * SECURITY: Requires CRON_SECRET for all calls.
 */

interface CronConfig {
  batchSize: number;
  sendingTimezone: string;
  businessHoursStart: number;  // 24h format
  businessHoursEnd: number;    // 24h format
  enableWeekends: boolean;
  stuckThresholdMinutes: number;
}

const DEFAULT_CONFIG: CronConfig = {
  batchSize: 5,
  sendingTimezone: 'America/New_York',
  businessHoursStart: 9,   // 9 AM
  businessHoursEnd: 18,    // 6 PM
  enableWeekends: false,
  stuckThresholdMinutes: 10,
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  // 1. Verify CRON_SECRET
  if (!verifyCronSecret(request)) {
    console.log('❌ Cron: Unauthorized request');
    return NextResponse.json(unauthorizedCronResponse(), { status: 401 });
  }

  try {
    // Parse config from body or use defaults
    let config = DEFAULT_CONFIG;
    try {
      const body = await request.json();
      config = { ...DEFAULT_CONFIG, ...body };
    } catch {
      // No body or invalid JSON, use defaults
    }

    const results = {
      timestamp: new Date().toISOString(),
      config,
      businessHoursCheck: { passed: false, currentHour: 0, timezone: config.sendingTimezone },
      watchdog: { recovered: 0, recoveredIds: [] as string[] },
      claimed: 0,
      sent: [] as Array<{ leadId: string; leadName: string; email: string; type: string; success: boolean; error?: string }>,
      skipped: null as string | null,
      durationMs: 0,
    };

    // 2. Check business hours
    const now = new Date();
    const tzOptions: Intl.DateTimeFormatOptions = { 
      timeZone: config.sendingTimezone, 
      hour: 'numeric', 
      hour12: false,
      weekday: 'short',
    };
    
    const tzHour = parseInt(now.toLocaleString('en-US', { ...tzOptions, weekday: undefined }));
    const tzDay = now.toLocaleString('en-US', { ...tzOptions, hour: undefined });
    
    results.businessHoursCheck.currentHour = tzHour;
    
    // Weekend check
    const isWeekend = ['Sat', 'Sun'].includes(tzDay);
    if (isWeekend && !config.enableWeekends) {
      results.skipped = `Weekend (${tzDay}) - sending disabled`;
      results.durationMs = Date.now() - startTime;
      return NextResponse.json(results);
    }
    
    // Business hours check
    const inBusinessHours = tzHour >= config.businessHoursStart && tzHour < config.businessHoursEnd;
    if (!inBusinessHours) {
      results.skipped = `Outside business hours (${tzHour}:00 ${config.sendingTimezone}, window: ${config.businessHoursStart}:00-${config.businessHoursEnd}:00)`;
      results.durationMs = Date.now() - startTime;
      return NextResponse.json(results);
    }
    
    results.businessHoursCheck.passed = true;

    // 3. Run watchdog to recover stuck emails
    const { data: watchdogResult, error: watchdogError } = await supabaseAdmin
      .rpc('recover_stuck_emails', { stuck_threshold_minutes: config.stuckThresholdMinutes });
    
    if (watchdogError) {
      console.error('⚠️ Watchdog error:', watchdogError);
    } else if (watchdogResult && watchdogResult.length > 0) {
      const recovered = watchdogResult[0];
      results.watchdog.recovered = recovered.recovered_count || 0;
      results.watchdog.recoveredIds = recovered.recovered_ids || [];
      if (results.watchdog.recovered > 0) {
        console.log(`🔧 Watchdog recovered ${results.watchdog.recovered} stuck email(s)`);
      }
    }

    // 4. Get Gmail user email (for sending)
    const { data: gmailAuth } = await supabaseAdmin
      .from('user_gmail_auth')
      .select('user_email')
      .eq('gmail_sync_enabled', true)
      .single();
    
    if (!gmailAuth?.user_email) {
      results.skipped = 'No Gmail account connected for sending';
      results.durationMs = Date.now() - startTime;
      return NextResponse.json(results);
    }
    
    const userEmail = gmailAuth.user_email;

    // 5. Claim batch of emails atomically
    const { data: claimedEmails, error: claimError } = await supabaseAdmin
      .rpc('claim_next_emails', { 
        max_scheduled: now.toISOString(),
        batch_size: config.batchSize,
      });
    
    if (claimError) {
      console.error('❌ Claim error:', claimError);
      results.skipped = `Claim error: ${claimError.message}`;
      results.durationMs = Date.now() - startTime;
      return NextResponse.json(results, { status: 500 });
    }
    
    if (!claimedEmails || claimedEmails.length === 0) {
      results.skipped = 'No emails due to send';
      results.durationMs = Date.now() - startTime;
      return NextResponse.json(results);
    }
    
    results.claimed = claimedEmails.length;
    console.log(`📧 Claimed ${claimedEmails.length} email(s) for sending`);

    // 6. Process each claimed email
    for (const queueItem of claimedEmails) {
      const sendResult: typeof results.sent[0] = {
        leadId: queueItem.lead_id,
        leadName: '',
        email: queueItem.to_email,
        type: queueItem.email_type,
        success: false,
      };

      try {
        // Fetch lead data for threading
        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('name, gmail_thread_id, gmail_message_id')
          .eq('id', queueItem.lead_id)
          .single();
        
        sendResult.leadName = lead?.name || 'Unknown';

        // Log attempt start
        const { data: attempt } = await supabaseAdmin
          .from('email_send_attempts')
          .insert({
            queue_id: queueItem.id,
            lead_id: queueItem.lead_id,
            attempt_number: (queueItem.retry_count || 0) + 1,
            status: 'started',
          })
          .select()
          .single();

        const attemptStartTime = Date.now();

        // Send the email
        const emailResult = await sendEmail({
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

        const responseTimeMs = Date.now() - attemptStartTime;

        if (emailResult.success) {
          // Mark as sent in queue
          await supabaseAdmin.rpc('mark_email_sent', {
            p_queue_id: queueItem.id,
            p_provider_message_id: emailResult.messageId,
          });

          // Update attempt record
          if (attempt) {
            await supabaseAdmin
              .from('email_send_attempts')
              .update({
                status: 'success',
                completed_at: new Date().toISOString(),
                provider_message_id: emailResult.messageId,
                response_time_ms: responseTimeMs,
              })
              .eq('id', attempt.id);
          }

          // Update lead status for initial emails
          if (queueItem.email_type === 'initial') {
            await supabaseAdmin
              .from('leads')
              .update({
                date_contacted: new Date().toISOString(),
                status: 'email_1_sent',
                initial_email_subject: queueItem.subject,
              })
              .eq('id', queueItem.lead_id);
          }

          sendResult.success = true;
          console.log(`✅ Sent ${queueItem.email_type} to ${sendResult.leadName} (${queueItem.to_email})`);

        } else {
          // Determine if we should retry
          const isTransientError = emailResult.error?.includes('rate limit') || 
                                   emailResult.error?.includes('timeout') ||
                                   emailResult.error?.includes('temporarily');
          
          // Mark as failed with retry scheduling
          await supabaseAdmin.rpc('mark_email_failed', {
            p_queue_id: queueItem.id,
            p_error_message: emailResult.error || 'Unknown error',
            p_should_retry: isTransientError,
          });

          // Update attempt record
          if (attempt) {
            await supabaseAdmin
              .from('email_send_attempts')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: emailResult.error,
                response_time_ms: responseTimeMs,
              })
              .eq('id', attempt.id);
          }

          sendResult.error = emailResult.error;
          console.log(`❌ Failed to send to ${sendResult.leadName}: ${emailResult.error}`);
        }

      } catch (error: any) {
        sendResult.error = error.message || 'Unexpected error';
        
        // Mark as failed
        await supabaseAdmin.rpc('mark_email_failed', {
          p_queue_id: queueItem.id,
          p_error_message: sendResult.error,
          p_should_retry: true,  // Retry unexpected errors
        });
        
        console.error(`❌ Error processing email for ${sendResult.leadName}:`, error);
      }

      results.sent.push(sendResult);
    }

    results.durationMs = Date.now() - startTime;
    
    const successCount = results.sent.filter(s => s.success).length;
    console.log(`📧 Cron complete: ${successCount}/${results.claimed} sent in ${results.durationMs}ms`);

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('❌ Cron error:', error);
    return NextResponse.json(
      { error: 'Cron execution failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cron/send-emails
 * Health check / status endpoint
 */
export async function GET(request: NextRequest) {
  // Allow health checks without auth in dev, require auth in prod
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev && !verifyCronSecret(request)) {
    return NextResponse.json(unauthorizedCronResponse(), { status: 401 });
  }

  try {
    // Get queue stats
    const { data: stats } = await supabaseAdmin
      .from('email_send_queue')
      .select('status')
      .in('status', ['approved', 'sending', 'failed']);

    const statusCounts = {
      approved: 0,
      sending: 0,
      failed: 0,
    };
    
    stats?.forEach((row: { status: string }) => {
      if (row.status in statusCounts) {
        statusCounts[row.status as keyof typeof statusCounts]++;
      }
    });

    // Get sent today count
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { count: sentToday } = await supabaseAdmin
      .from('email_send_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'sent')
      .gte('sent_at', todayStart.toISOString());

    return NextResponse.json({
      status: 'healthy',
      queue: statusCounts,
      sentToday: sentToday || 0,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', error: error.message },
      { status: 500 }
    );
  }
}
