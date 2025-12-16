/**
 * Gmail Sync Service
 * Reads Gmail sent folder and inbox, matches emails to leads
 */

import { gmail_v1 } from 'googleapis';
import { supabaseAdmin } from './supabase/admin';
import { gmailOAuthService } from './gmail-oauth-service';
import { GMAIL_CONFIG } from './gmail-config';
import emailTemplates from './email-templates.json';
import { logLeadActivity, formatStatusChange } from './activity-logger';

// Statuses that should NEVER be overwritten by Gmail sync
// These are manually-set statuses that indicate human decisions
const PROTECTED_STATUSES = [
  'replied_not_fit',
  'replied_interested', 
  'replied_needs_info',
  'call_booked',
  'call_done_thinking',
  'won',
  'lost',
  'site_live',
  'email_bounced',
];

// Statuses that ARE part of the automated follow-up sequence (can be updated by sync)
const FOLLOWUP_SEQUENCE_STATUSES = [
  'lead_collected',
  'initial_email_sent',
  'followup_1_sent',
  'followup_2_sent', 
  'followup_3_sent',
];

interface SyncResult {
  emailsProcessed: number;
  leadsUpdated: number;
  errors: string[];
}

export class GmailSyncService {
  /**
   * Main sync function - syncs both sent and received emails
   */
  async syncGmail(userEmail: string): Promise<SyncResult> {
    const result: SyncResult = {
      emailsProcessed: 0,
      leadsUpdated: 0,
      errors: []
    };

    try {
      // Create sync log entry
      const { data: syncLog, error: logError } = await supabaseAdmin
        .from('gmail_sync_log')
        .insert({
          sync_type: 'both',
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (logError) throw logError;

      const gmail = await gmailOAuthService.getGmailClient(userEmail);

      // Sync sent emails (for follow-up tracking)
      const sentResult = await this.syncSentEmails(gmail, userEmail);
      result.emailsProcessed += sentResult.emailsProcessed;
      result.leadsUpdated += sentResult.leadsUpdated;
      result.errors.push(...sentResult.errors);

      // Sync inbox (for reply detection)
      const inboxResult = await this.syncInboxEmails(gmail, userEmail);
      result.emailsProcessed += inboxResult.emailsProcessed;
      result.leadsUpdated += inboxResult.leadsUpdated;
      result.errors.push(...inboxResult.errors);

      // Update sync log
      await supabaseAdmin
        .from('gmail_sync_log')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          emails_processed: result.emailsProcessed,
          leads_updated: result.leadsUpdated,
          error_message: result.errors.length > 0 ? result.errors.join('; ') : null,
        })
        .eq('id', syncLog.id);

      console.log('✅ Gmail sync completed:', result);
      return result;
    } catch (error) {
      console.error('❌ Gmail sync failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Sync sent emails to track follow-ups
   */
  private async syncSentEmails(gmail: gmail_v1.Gmail, userEmail: string): Promise<SyncResult> {
    const result: SyncResult = { emailsProcessed: 0, leadsUpdated: 0, errors: [] };

    try {
      // Calculate date range (last 90 days)
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - GMAIL_CONFIG.SYNC_LOOKBACK_DAYS);
      const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

      // Query sent emails
      const query = `in:sent after:${afterTimestamp}`;
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: GMAIL_CONFIG.BATCH_SIZE,
      });

      const messages = response.data.messages || [];
      console.log(`📧 Found ${messages.length} sent emails to process`);

      // Fetch all message dates first so we can sort chronologically
      // This is important: we need to process OLDEST emails first for count-based detection to work
      const messagesWithDates: { id: string; date: Date }[] = [];
      
      for (const message of messages) {
        try {
          const msgResponse = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'metadata',
            metadataHeaders: ['Date'],
          });
          const dateHeader = msgResponse.data.payload?.headers?.find(h => h.name === 'Date');
          const date = dateHeader?.value ? new Date(dateHeader.value) : new Date();
          messagesWithDates.push({ id: message.id!, date });
        } catch {
          // If we can't get date, use current time (will be processed last)
          messagesWithDates.push({ id: message.id!, date: new Date() });
        }
      }
      
      // Sort by date ASCENDING (oldest first) - critical for proper follow-up counting
      messagesWithDates.sort((a, b) => a.date.getTime() - b.date.getTime());
      console.log(`📧 Processing emails in chronological order (oldest first)`);

      // Process each message in chronological order
      for (const { id } of messagesWithDates) {
        try {
          const processed = await this.processSentEmail(gmail, id, userEmail);
          if (processed) {
            result.emailsProcessed++;
            result.leadsUpdated++;
          }
        } catch (error) {
          result.errors.push(`Failed to process sent message ${id}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Sent emails sync error: ${error}`);
    }

    return result;
  }

  /**
   * Sync inbox emails to detect replies
   */
  private async syncInboxEmails(gmail: gmail_v1.Gmail, userEmail: string): Promise<SyncResult> {
    const result: SyncResult = { emailsProcessed: 0, leadsUpdated: 0, errors: [] };

    try {
      // Calculate date range (last 90 days)
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - GMAIL_CONFIG.SYNC_LOOKBACK_DAYS);
      const afterTimestamp = Math.floor(afterDate.getTime() / 1000);

      // Query inbox for unread emails from leads
      const query = `in:inbox after:${afterTimestamp}`;
      const response = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: GMAIL_CONFIG.BATCH_SIZE,
      });

      const messages = response.data.messages || [];
      console.log(`📧 Found ${messages.length} inbox emails to process`);

      // Process each message
      for (const message of messages) {
        try {
          const processed = await this.processInboxEmail(gmail, message.id!, userEmail);
          if (processed) {
            result.emailsProcessed++;
            result.leadsUpdated++;
          }
        } catch (error) {
          result.errors.push(`Failed to process inbox message ${message.id}: ${error}`);
        }
      }
    } catch (error) {
      result.errors.push(`Inbox sync error: ${error}`);
    }

    return result;
  }

  /**
   * Process a sent email - match to lead and update follow-up status
   */
  private async processSentEmail(gmail: gmail_v1.Gmail, messageId: string, userEmail: string): Promise<boolean> {
    // Check if already processed
    const { data: cached } = await supabaseAdmin
      .from('gmail_message_cache')
      .select('id')
      .eq('gmail_message_id', messageId)
      .single();

    if (cached) {
      return false; // Already processed
    }

    // Fetch full message
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    
    // Extract email details
    const to = this.getHeader(headers, 'To');
    const subject = this.getHeader(headers, 'Subject');
    const date = this.getHeader(headers, 'Date');
    const threadId = message.threadId;

    if (!to) return false;

    // Extract email address from "Name <email@domain.com>" format
    const toEmail = this.extractEmail(to);

    // Find lead by email
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('email', toEmail)
      .single();

    if (error || !lead) {
      return false; // Not a lead we're tracking
    }

    console.log(`📧 Matched sent email to lead: ${lead.name} (${toEmail})`);

    // CHECK: Don't update leads with protected statuses (manually set by user)
    if (PROTECTED_STATUSES.includes(lead.status)) {
      console.log(`⏭️ Skipping ${lead.name} - has protected status: ${lead.status}`);
      // Still cache the message so we don't reprocess it
      await supabaseAdmin
        .from('gmail_message_cache')
        .insert({
          gmail_message_id: messageId,
          lead_id: lead.id,
          thread_id: threadId,
          message_type: 'sent',
          subject: subject || '',
          from_email: userEmail,
          to_email: toEmail,
          sent_at: date ? new Date(date).toISOString() : new Date().toISOString(),
          followup_number: null,
          status_updated: false, // Didn't update status
        });
      return true; // Processed but didn't update
    }

    // Parse email date properly
    const emailDate = date ? new Date(date) : new Date();
    const emailDateISO = emailDate.toISOString();

    // Determine which follow-up this is by counting ALL sent emails to this lead
    const followupNumber = await this.detectFollowupNumberByCount(lead, emailDate);

    // Update lead
    const updateData: any = {
      last_touch_date: emailDateISO,
    };

    let newStatus: string | null = null;
    
    if (followupNumber) {
      updateData[`followup_${followupNumber}_sent_at`] = emailDateISO;
      // Only update status if current status is in the follow-up sequence
      if (FOLLOWUP_SEQUENCE_STATUSES.includes(lead.status) || !lead.status) {
        newStatus = `followup_${followupNumber}_sent`;
        updateData.status = newStatus;
      }
      console.log(`📧 Detected as Follow-up #${followupNumber} for ${lead.name}`);
    } else {
      // This is the initial email
      updateData.date_contacted = emailDateISO;
      // Only update status if current status is in the follow-up sequence or null
      if (FOLLOWUP_SEQUENCE_STATUSES.includes(lead.status) || !lead.status) {
        newStatus = 'initial_email_sent';
        updateData.status = newStatus;
      }
      console.log(`📧 Detected as Initial Email for ${lead.name}`);
    }

    await supabaseAdmin
      .from('leads')
      .update(updateData)
      .eq('id', lead.id);

    // Log activity
    if (newStatus && newStatus !== lead.status) {
      await logLeadActivity({
        leadId: lead.id,
        actionType: 'status_change',
        source: 'gmail_sync',
        fieldName: 'status',
        oldValue: lead.status,
        newValue: newStatus,
        description: formatStatusChange(lead.status, newStatus),
        metadata: { emailSubject: subject, emailDate: emailDateISO },
      });
    }
    
    // Log the email detection
    await logLeadActivity({
      leadId: lead.id,
      actionType: followupNumber ? 'followup_detected' : 'email_sent',
      source: 'gmail_sync',
      description: followupNumber 
        ? `Follow-up #${followupNumber} email detected (sent ${emailDate.toLocaleDateString()})`
        : `Initial email detected (sent ${emailDate.toLocaleDateString()})`,
      metadata: { 
        emailSubject: subject, 
        emailDate: emailDateISO,
        followupNumber,
      },
    });

    // Cache this message
    await supabaseAdmin
      .from('gmail_message_cache')
      .insert({
        gmail_message_id: messageId,
        lead_id: lead.id,
        thread_id: threadId,
        message_type: 'sent',
        subject: subject || '',
        from_email: userEmail,
        to_email: toEmail,
        sent_at: emailDateISO,
        followup_number: followupNumber,
        status_updated: true,
      });

    return true;
  }

  /**
   * Process an inbox email - detect reply or bounce and update status
   */
  private async processInboxEmail(gmail: gmail_v1.Gmail, messageId: string, userEmail: string): Promise<boolean> {
    // Check if already processed
    const { data: cached } = await supabaseAdmin
      .from('gmail_message_cache')
      .select('id')
      .eq('gmail_message_id', messageId)
      .single();

    if (cached) {
      return false; // Already processed
    }

    // Fetch full message
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const message = response.data;
    const headers = message.payload?.headers || [];
    
    // Extract email details
    const from = this.getHeader(headers, 'From');
    const subject = this.getHeader(headers, 'Subject');
    const date = this.getHeader(headers, 'Date');
    const threadId = message.threadId;

    if (!from) return false;

    // Extract email address
    const fromEmail = this.extractEmail(from);
    
    // Get email body
    const body = this.getEmailBody(message);

    // CHECK FOR BOUNCE: Bounced emails come from mailer-daemon or postmaster
    const isBounce = this.isBounceEmail(from, subject || '', body);
    
    if (isBounce) {
      // Extract the original recipient from the bounce message
      const bouncedEmail = this.extractBouncedRecipient(body, subject || '');
      
      if (bouncedEmail) {
        // Find the lead by the bounced email address
        const { data: lead } = await supabaseAdmin
          .from('leads')
          .select('*')
          .eq('email', bouncedEmail)
          .single();
          
        if (lead) {
          console.log(`📧 BOUNCE detected for lead: ${lead.name} (${bouncedEmail})`);
          
          const oldStatus = lead.status;
          
          // Update lead status to bounced
          await supabaseAdmin
            .from('leads')
            .update({
              status: 'email_bounced',
              last_touch_date: date ? new Date(date).toISOString() : new Date().toISOString(),
            })
            .eq('id', lead.id);
          
          // Log the bounce activity
          await logLeadActivity({
            leadId: lead.id,
            actionType: 'email_bounced',
            source: 'gmail_sync',
            fieldName: 'status',
            oldValue: oldStatus,
            newValue: 'email_bounced',
            description: `Email bounced - delivery to ${bouncedEmail} failed`,
            metadata: { bounceSubject: subject, bouncedEmail },
          });
          
          // Cache this message
          await supabaseAdmin
            .from('gmail_message_cache')
            .insert({
              gmail_message_id: messageId,
              lead_id: lead.id,
              thread_id: threadId,
              message_type: 'bounce',
              subject: subject || '',
              from_email: fromEmail,
              to_email: userEmail,
              sent_at: date ? new Date(date).toISOString() : new Date().toISOString(),
              status_updated: true,
            });
            
          return true;
        }
      }
      
      return false; // Bounce but couldn't find the lead
    }

    // Regular reply processing - find lead by sender email
    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('email', fromEmail)
      .single();

    if (error || !lead) {
      return false; // Not a lead we're tracking
    }

    // CHECK: Don't update leads with protected statuses
    if (PROTECTED_STATUSES.includes(lead.status)) {
      console.log(`⏭️ Skipping reply update for ${lead.name} - has protected status: ${lead.status}`);
      // Still cache
      await supabaseAdmin
        .from('gmail_message_cache')
        .insert({
          gmail_message_id: messageId,
          lead_id: lead.id,
          thread_id: threadId,
          message_type: 'received',
          subject: subject || '',
          from_email: fromEmail,
          to_email: userEmail,
          sent_at: date ? new Date(date).toISOString() : new Date().toISOString(),
          status_updated: false,
        });
      return true;
    }

    console.log(`📧 Received reply from lead: ${lead.name} (${fromEmail})`);

    // Classify the reply
    const newStatus = await this.classifyReply(body, subject || '');
    const oldStatus = lead.status;

    // Update lead
    await supabaseAdmin
      .from('leads')
      .update({
        status: newStatus,
        last_touch_date: date ? new Date(date).toISOString() : new Date().toISOString(),
      })
      .eq('id', lead.id);

    // Log the reply activity
    await logLeadActivity({
      leadId: lead.id,
      actionType: 'email_received',
      source: 'gmail_sync',
      description: `Reply received from ${fromEmail}`,
      metadata: { replySubject: subject, fromEmail },
    });
    
    // Log the status change
    if (newStatus !== oldStatus) {
      await logLeadActivity({
        leadId: lead.id,
        actionType: 'status_change',
        source: 'gmail_sync',
        fieldName: 'status',
        oldValue: oldStatus,
        newValue: newStatus,
        description: formatStatusChange(oldStatus, newStatus),
        metadata: { trigger: 'reply_detected', replySubject: subject },
      });
    }

    // Cache this message
    await supabaseAdmin
      .from('gmail_message_cache')
      .insert({
        gmail_message_id: messageId,
        lead_id: lead.id,
        thread_id: threadId,
        message_type: 'received',
        subject: subject || '',
        from_email: fromEmail,
        to_email: userEmail,
        sent_at: date ? new Date(date).toISOString() : new Date().toISOString(),
        status_updated: true,
      });

    return true;
  }

  /**
   * Detect which follow-up number by counting emails already sent to this lead
   * Returns: null = initial email, 1 = first follow-up, 2 = second, 3 = third
   * 
   * SIMPLE RULE: Count how many emails we've already processed for this lead.
   * - 0 previous emails → this is the Initial Email
   * - 1 previous email → this is Follow-up #1
   * - 2 previous emails → this is Follow-up #2
   * - 3+ previous emails → this is Follow-up #3
   */
  private async detectFollowupNumberByCount(lead: any, currentEmailDate: Date): Promise<number | null> {
    // Count how many sent emails we've already cached for this lead BEFORE this email's date
    const { count, error } = await supabaseAdmin
      .from('gmail_message_cache')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', lead.id)
      .eq('message_type', 'sent')
      .lt('sent_at', currentEmailDate.toISOString());

    if (error) {
      console.error('Error counting cached emails:', error);
      return null; // Assume initial if we can't count
    }

    const previousEmailCount = count || 0;
    
    console.log(`📊 Lead ${lead.name}: ${previousEmailCount} previous emails cached before this one`);
    
    // SIMPLE: Email count determines follow-up number
    // Email #1 = initial email (return null)
    // Email #2 = follow-up #1
    // Email #3 = follow-up #2
    // Email #4+ = follow-up #3
    
    if (previousEmailCount === 0) return null; // Initial email
    if (previousEmailCount === 1) return 1;    // Follow-up #1
    if (previousEmailCount === 2) return 2;    // Follow-up #2
    if (previousEmailCount >= 3) return 3;     // Follow-up #3 (cap at 3)
    
    return null;
  }

  /**
   * @deprecated Legacy method - no longer used
   */
  private detectFollowupNumber(subject: string, lead: any): number | null {
    return null;
  }

  /**
   * Classify reply sentiment/intent
   */
  private async classifyReply(body: string, subject: string): Promise<string> {
    const lowerBody = body.toLowerCase();
    const lowerSubject = subject.toLowerCase();

    // Positive signals
    const positiveWords = ['interested', 'yes', 'sounds good', 'let\'s talk', 'schedule', 'call', 'meeting'];
    const hasPositive = positiveWords.some(word => lowerBody.includes(word) || lowerSubject.includes(word));

    // Negative signals
    const negativeWords = ['not interested', 'no thanks', 'unsubscribe', 'remove', 'stop', 'not right now'];
    const hasNegative = negativeWords.some(word => lowerBody.includes(word) || lowerSubject.includes(word));

    if (hasNegative) return 'replied_not_fit';
    if (hasPositive) return 'replied_interested';
    
    // Default: they replied but unclear intent
    return 'replied_needs_info';
  }

  /**
   * Extract email body from Gmail message
   */
  private getEmailBody(message: gmail_v1.Schema$Message): string {
    const parts = message.payload?.parts || [message.payload];
    
    for (const part of parts) {
      if (part?.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }

    // Fallback to body if no parts
    if (message.payload?.body?.data) {
      return Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }

    return '';
  }

  /**
   * Get header value from Gmail message headers
   */
  private getHeader(headers: gmail_v1.Schema$MessagePartHeader[], name: string): string | null {
    const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
    return header?.value || null;
  }

  /**
   * Extract email address from "Name <email@domain.com>" format
   */
  private extractEmail(emailString: string): string {
    const match = emailString.match(/<(.+?)>/);
    return match ? match[1] : emailString.trim();
  }

  /**
   * Check if an email is a bounce notification
   */
  private isBounceEmail(from: string, subject: string, body: string): boolean {
    const lowerFrom = from.toLowerCase();
    const lowerSubject = subject.toLowerCase();
    const lowerBody = body.toLowerCase();

    // Common bounce sender addresses
    const bounceSenders = [
      'mailer-daemon',
      'postmaster',
      'mail-daemon',
      'noreply',
      'no-reply',
      'maildelivery',
      'mail delivery',
    ];

    // Check if from address indicates bounce
    const isFromBounce = bounceSenders.some(sender => lowerFrom.includes(sender));

    // Common bounce subject patterns
    const bounceSubjectPatterns = [
      'delivery status notification',
      'undeliverable',
      'undelivered',
      'delivery failed',
      'mail delivery failed',
      'returned mail',
      'failure notice',
      'delivery failure',
      'message not delivered',
      'could not be delivered',
      'permanent failure',
      'address rejected',
    ];

    const hasBouncySubject = bounceSubjectPatterns.some(pattern => lowerSubject.includes(pattern));

    // Common bounce body patterns
    const bounceBodyPatterns = [
      'delivery to the following recipient failed',
      'this message was not delivered',
      'address rejected',
      'user unknown',
      'mailbox not found',
      'does not exist',
      'no such user',
      '550 5.1.1', // SMTP bounce code
      '550 5.2.1',
      '550-5.1.1',
      'recipient rejected',
      'invalid recipient',
      'undeliverable',
    ];

    const hasBouncyBody = bounceBodyPatterns.some(pattern => lowerBody.includes(pattern));

    return isFromBounce || hasBouncySubject || hasBouncyBody;
  }

  /**
   * Extract the original recipient email from a bounce message
   */
  private extractBouncedRecipient(body: string, subject: string): string | null {
    // Try various patterns to extract the bounced email address
    const patterns = [
      // Common patterns in bounce messages
      /delivery to the following recipient(?:s)? failed[:\s]*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
      /the following address(?:es)? failed[:\s]*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
      /failed recipient[:\s]*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
      /undeliverable[:\s]*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
      /<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>.*(?:failed|rejected|bounced)/i,
      /to[:\s]*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?\s*$/im,
      // X-Failed-Recipients header often contains the bounced address
      /x-failed-recipients?[:\s]*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
      // Final-Recipient field in DSN
      /final-recipient[:\s]*(?:rfc822;?\s*)?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
      // Original-Recipient field
      /original-recipient[:\s]*(?:rfc822;?\s*)?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern) || subject.match(pattern);
      if (match && match[1]) {
        return match[1].toLowerCase();
      }
    }

    // Fallback: try to find any email address in the bounce that's not from common bounce senders
    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emails = body.match(emailRegex) || [];
    
    const bounceSenderDomains = ['google.com', 'gmail.com', 'googlemail.com', 'outlook.com', 'microsoft.com'];
    
    for (const email of emails) {
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain && !bounceSenderDomains.includes(domain)) {
        return email.toLowerCase();
      }
    }

    return null;
  }
}

// Singleton instance
export const gmailSyncService = new GmailSyncService();
