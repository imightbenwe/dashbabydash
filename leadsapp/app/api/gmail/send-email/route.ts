import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/lib/gmail-oauth-service';
import { supabaseAdmin } from '@/lib/supabase/admin';
import emailTemplates from '@/lib/email-templates.json';

/**
 * POST /api/gmail/send-email
 * 
 * Sends an email via Gmail API as a proper threaded reply.
 * Uses thread_id and In-Reply-To headers to nest the email in the same conversation.
 * 
 * Body:
 * - leadId: UUID of the lead
 * - to: recipient email
 * - subject: email subject (should include "Re: " for replies)
 * - body: email body text
 * - followupNumber: 1, 2, or 3 (optional - for tracking which follow-up this is)
 * - threadId: Gmail thread ID (optional - will be looked up from lead if not provided)
 * - messageId: Message-ID to reply to (optional - for In-Reply-To header)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, to, subject, body: emailBody, followupNumber, threadId, messageId } = body;

    if (!leadId || !to || !subject || !emailBody) {
      return NextResponse.json(
        { error: 'Missing required fields: leadId, to, subject, body' },
        { status: 400 }
      );
    }

    // Get the user's Gmail email from localStorage (passed in request) or from auth
    const userEmail = request.headers.get('x-user-email') || 
                      (await supabaseAdmin.from('user_gmail_auth').select('user_email').single())?.data?.user_email;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'No Gmail account connected' },
        { status: 401 }
      );
    }

    // Get the Gmail client
    const gmail = await gmailOAuthService.getGmailClient(userEmail);

    // Get lead data to find thread info
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('gmail_thread_id, gmail_message_id, initial_email_subject, name')
      .eq('id', leadId)
      .single();

    if (leadError) {
      console.error('Failed to fetch lead:', leadError);
      return NextResponse.json(
        { error: 'Failed to fetch lead data' },
        { status: 500 }
      );
    }

    // Use provided threadId or fall back to lead's stored thread
    const emailThreadId = threadId || lead?.gmail_thread_id;
    const replyToMessageId = messageId || lead?.gmail_message_id;

    // Build the email message with From name
    const emailLines = [
      `From: Kayden West <${userEmail}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset="UTF-8"',
      'MIME-Version: 1.0',
    ];

    // Add threading headers if this is a reply
    if (replyToMessageId) {
      emailLines.push(`In-Reply-To: ${replyToMessageId}`);
      emailLines.push(`References: ${replyToMessageId}`);
    }

    // Add empty line and body with signature (convert to HTML)
    const signature = (emailTemplates as any).signature || '';
    const htmlBody = emailBody.replace(/\n/g, '<br>');
    emailLines.push('');
    emailLines.push(htmlBody + signature);

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
            sentVia: 'gmail_api',
          },
        });
    } catch (logError) {
      console.error('Failed to log activity:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      messageId: sentMessage.data.id,
      threadId: sentMessage.data.threadId,
      message: 'Email sent successfully as threaded reply',
    });

  } catch (error: any) {
    console.error('❌ Send email API error:', error);
    
    // Check for specific Gmail API errors
    if (error.message?.includes('insufficient authentication')) {
      return NextResponse.json(
        { error: 'Gmail access expired. Please reconnect your Gmail account.' },
        { status: 401 }
      );
    }
    
    if (error.message?.includes('Insufficient Permission')) {
      return NextResponse.json(
        { error: 'Gmail send permission not granted. Please reconnect Gmail with send permissions.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to send email', details: error.message },
      { status: 500 }
    );
  }
}
