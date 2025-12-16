import { NextRequest, NextResponse } from 'next/server';
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
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await supabaseAdmin.from('lead_activity_log').insert({
      lead_id: params.leadId,
      action_type: params.actionType,
      source: params.source,
      field_name: params.fieldName || null,
      old_value: params.oldValue || null,
      new_value: params.newValue || null,
      description: params.description || null,
      metadata: params.metadata || null,
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging should not break the main operation
  }
}

/**
 * GET /api/leads/[id]/activity
 * Fetch activity log for a specific lead
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: activities, error } = await supabaseAdmin
      .from('lead_activity_log')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching activity log:', error);
      return NextResponse.json({ error: 'Failed to fetch activity log' }, { status: 500 });
    }

    // Also get email cache count for this lead
    const { count: emailCount } = await supabaseAdmin
      .from('gmail_message_cache')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', id);

    return NextResponse.json({
      activities: activities || [],
      emailsCached: emailCount || 0,
    });
  } catch (error) {
    console.error('Activity log API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/leads/[id]/activity
 * Manually add an activity log entry (for user actions from UI)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { actionType, source, fieldName, oldValue, newValue, description, metadata } = body;

    await logActivity({
      leadId: id,
      actionType,
      source: source || 'user',
      fieldName,
      oldValue,
      newValue,
      description,
      metadata,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to log activity:', error);
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}
