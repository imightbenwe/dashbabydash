/**
 * Gmail Sender Service
 * 
 * Shared email sending logic extracted from API routes.
 * Can be called directly by cron jobs or other services without HTTP fetch.
 */

import { gmailOAuthService } from './gmail-oauth-service';
import { supabaseAdmin } from './supabase/admin';

export interface SendEmailParams {
  leadId: string;
  to: string;
  subject: string;
  body: string;
  followupNumber?: number;  // 1, 2, or 3 for follow-ups; undefined for initial
  threadId?: string;        // Gmail thread ID for threading
  messageId?: string;       // Message-ID to reply to
  userEmail: string;        // Gmail account to send from
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  error?: string;
}

/**
 * Send an email via Gmail API as a proper threaded reply.
 * Uses thread_id and In-Reply-To headers to nest the email in the same conversation.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { leadId, to, subject, body: emailBody, followupNumber, threadId, messageId, userEmail } = params;

  try {
    // Get the Gmail client
    const gmail = await gmailOAuthService.getGmailClient(userEmail);

    // Get lead data to find thread info if not provided
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('gmail_thread_id, gmail_message_id, initial_email_subject, name')
      .eq('id', leadId)
      .single();

    if (leadError) {
      console.error('Failed to fetch lead:', leadError);
      return { success: false, error: 'Failed to fetch lead data' };
    }

    // Use provided threadId or fall back to lead's stored thread
    const emailThreadId = threadId || lead?.gmail_thread_id;
    const replyToMessageId = messageId || lead?.gmail_message_id;

    // Build the email message
    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
    ];

    // Add threading headers if this is a reply
    if (replyToMessageId) {
      emailLines.push(`In-Reply-To: ${replyToMessageId}`);
      emailLines.push(`References: ${replyToMessageId}`);
    }

    // Add empty line and body
    emailLines.push('');
    emailLines.push(emailBody);

    // Encode the email in base64url format
    const rawEmail = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    const sendRequest: any = {
      userId: 'me',
      requestBody: {
        raw: rawEmail,
      },
    };

    // If we have a thread ID, add it to send as part of that thread
    if (emailThreadId) {
      sendRequest.requestBody.threadId = emailThreadId;
    }

    console.log(`📧 Sending email to ${to} (thread: ${emailThreadId || 'new'})`);

    const sentMessage = await gmail.users.messages.send(sendRequest);

    console.log(`✅ Email sent successfully. Message ID: ${sentMessage.data.id}, Thread ID: ${sentMessage.data.threadId}`);

    // Update lead with the new message/thread IDs (for future replies)
    const updateData: any = {
      gmail_message_id: sentMessage.data.id,
      updated_at: new Date().toISOString(),
    };

    // If this is the first email, store the thread ID
    if (!lead?.gmail_thread_id && sentMessage.data.threadId) {
      updateData.gmail_thread_id = sentMessage.data.threadId;
    }

    // If followupNumber is provided, update the appropriate sent_at field and status
    if (followupNumber === 1) {
      updateData.followup_1_sent_at = new Date().toISOString();
      updateData.status = 'followup_1_sent';
    } else if (followupNumber === 2) {
      updateData.followup_2_sent_at = new Date().toISOString();
      updateData.status = 'followup_2_sent';
    } else if (followupNumber === 3) {
      updateData.followup_3_sent_at = new Date().toISOString();
      updateData.status = 'followup_3_sent';
    }

    await supabaseAdmin
      .from('leads')
      .update(updateData)
      .eq('id', leadId);

    // Log the activity
    try {
      await supabaseAdmin
        .from('lead_activity_log')
        .insert({
          lead_id: leadId,
          activity_type: followupNumber ? `followup_${followupNumber}_sent` : 'email_sent',
          description: `Email sent: ${subject}`,
          metadata: {
            to,
            subject,
            messageId: sentMessage.data.id,
            threadId: sentMessage.data.threadId,
            sentVia: 'gmail_sender_service',
          },
        });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
      // Don't fail if logging fails
    }

    return {
      success: true,
      messageId: sentMessage.data.id!,
      threadId: sentMessage.data.threadId!,
    };

  } catch (error: any) {
    console.error('❌ Gmail sender error:', error);
    
    // Return specific error messages
    if (error.message?.includes('insufficient authentication')) {
      return { success: false, error: 'Gmail access expired. Please reconnect your Gmail account.' };
    }
    
    if (error.message?.includes('Insufficient Permission')) {
      return { success: false, error: 'Gmail send permission not granted. Please reconnect Gmail with send permissions.' };
    }

    return { success: false, error: error.message || 'Failed to send email' };
  }
}

/**
 * Cancel any pending/approved emails for a lead in the queue.
 * Call this when a reply is detected to prevent follow-ups to leads who've already replied.
 */
export async function cancelPendingEmailsForLead(leadId: string, reason: string = 'Reply received'): Promise<number> {
  const { data: cancelled, error } = await supabaseAdmin
    .from('email_send_queue')
    .delete()
    .eq('lead_id', leadId)
    .in('status', ['approved', 'sending'])
    .select('id');

  if (error) {
    console.error(`❌ Failed to cancel pending emails for lead ${leadId}:`, error);
    return 0;
  }

  const count = cancelled?.length || 0;
  
  if (count > 0) {
    console.log(`🛑 Cancelled ${count} pending email(s) for lead ${leadId}: ${reason}`);
    
    // Log the cancellation
    try {
      await supabaseAdmin
        .from('lead_activity_log')
        .insert({
          lead_id: leadId,
          activity_type: 'emails_cancelled',
          description: `${count} pending email(s) cancelled: ${reason}`,
          metadata: { cancelledIds: cancelled.map(c => c.id), reason },
        });
    } catch (logError) {
      console.error('Failed to log cancellation:', logError);
    }
  }

  return count;
}
