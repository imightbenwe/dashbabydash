import { supabaseAdmin } from '@/lib/supabase/admin';

export type ActivitySource = 'user' | 'gmail_sync' | 'automation' | 'ai_agent' | 'api' | 'system';
export type ActivityActionType = 
  | 'status_change'
  | 'field_update'
  | 'email_sent'
  | 'email_received'
  | 'email_bounced'
  | 'followup_detected'
  | 'analysis_run'
  | 'lead_created'
  | 'lead_scraped'
  | 'note_added';

interface LogActivityParams {
  leadId: string;
  actionType: ActivityActionType;
  source: ActivitySource;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Log an activity to the lead's activity log
 * This is a fire-and-forget function - errors are logged but don't throw
 */
export async function logLeadActivity(params: LogActivityParams): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('lead_activity_log').insert({
      lead_id: params.leadId,
      action_type: params.actionType,
      source: params.source,
      field_name: params.fieldName || null,
      old_value: params.oldValue || null,
      new_value: params.newValue || null,
      description: params.description || null,
      metadata: params.metadata || null,
    });
    
    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging should not break the main operation
  }
}

/**
 * Helper to format status changes for logging
 */
export function formatStatusChange(oldStatus: string | null, newStatus: string): string {
  const statusLabels: Record<string, string> = {
    lead_collected: 'Lead Collected',
    email_1_sent: 'Initial Email Sent',  // Database uses email_1_sent
    followup_1_sent: 'Follow-up #1 Sent',
    followup_2_sent: 'Follow-up #2 Sent',
    followup_3_sent: 'Follow-up #3 Sent',
    email_bounced: 'Email Bounced',
    replied_not_fit: 'Replied - Not a Fit',
    replied_interested: 'Replied - Interested',
    replied_needs_info: 'Replied - Needs Info',
    call_booked: 'Call Booked',
    call_done_thinking: 'Call Done - Thinking',
    won: 'Won',
    lost: 'Lost',
    site_live: 'Site Live',
  };
  
  const oldLabel = oldStatus ? (statusLabels[oldStatus] || oldStatus) : 'None';
  const newLabel = statusLabels[newStatus] || newStatus;
  
  return `Status changed from "${oldLabel}" to "${newLabel}"`;
}

/**
 * Get source display name
 */
export function getSourceDisplayName(source: ActivitySource): string {
  const names: Record<ActivitySource, string> = {
    user: 'User (UI)',
    gmail_sync: 'Gmail Integration',
    automation: 'Automation',
    ai_agent: 'AI Agent',
    api: 'API',
    system: 'System',
  };
  return names[source] || source;
}
