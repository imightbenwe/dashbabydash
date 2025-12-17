import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/gmail/settings
 * Get the current email sending settings from database
 */
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_gmail_auth')
      .select('emails_per_hour, sending_schedule, sending_timezone')
      .eq('gmail_sync_enabled', true)
      .single();

    if (error || !data) {
      // Return defaults if no settings found
      return NextResponse.json({
        emailsPerHour: 10,
        sendingSchedule: 'around_clock',
        sendingTimezone: 'America/New_York',
      });
    }

    return NextResponse.json({
      emailsPerHour: data.emails_per_hour || 10,
      sendingSchedule: data.sending_schedule || 'around_clock',
      sendingTimezone: data.sending_timezone || 'America/New_York',
    });

  } catch (error: any) {
    console.error('Failed to get settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gmail/settings
 * Save email sending settings to database
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { emailsPerHour, sendingSchedule, sendingTimezone } = body;

    // Get the current Gmail auth record
    const { data: existing } = await supabaseAdmin
      .from('user_gmail_auth')
      .select('user_email')
      .eq('gmail_sync_enabled', true)
      .single();

    if (!existing?.user_email) {
      return NextResponse.json(
        { error: 'No Gmail account connected' },
        { status: 400 }
      );
    }

    // Update the settings
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (emailsPerHour !== undefined) {
      updateData.emails_per_hour = emailsPerHour;
    }
    if (sendingSchedule !== undefined) {
      updateData.sending_schedule = sendingSchedule;
    }
    if (sendingTimezone !== undefined) {
      updateData.sending_timezone = sendingTimezone;
    }

    const { error } = await supabaseAdmin
      .from('user_gmail_auth')
      .update(updateData)
      .eq('user_email', existing.user_email);

    if (error) {
      console.error('Failed to save settings:', error);
      return NextResponse.json(
        { error: 'Failed to save settings', details: error.message },
        { status: 500 }
      );
    }

    console.log('📧 Email settings saved:', updateData);

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
      settings: {
        emailsPerHour: emailsPerHour ?? 10,
        sendingSchedule: sendingSchedule ?? 'around_clock',
        sendingTimezone: sendingTimezone ?? 'America/New_York',
      },
    });

  } catch (error: any) {
    console.error('Failed to save settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings', details: error.message },
      { status: 500 }
    );
  }
}
