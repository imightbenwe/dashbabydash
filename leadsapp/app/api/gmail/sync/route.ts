import { NextRequest, NextResponse } from 'next/server';
import { gmailSyncService } from '@/lib/gmail-sync-service';
import { gmailOAuthService } from '@/lib/gmail-oauth-service';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/gmail/sync
 * 
 * Manually trigger Gmail sync
 * Body: { userEmail: string, reset?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const { userEmail, reset } = await request.json();

    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail is required' },
        { status: 400 }
      );
    }

    // Check if Gmail is connected
    const isConnected = await gmailOAuthService.isConnected(userEmail);
    if (!isConnected) {
      return NextResponse.json(
        { error: 'Gmail not connected. Please authorize Gmail access first.' },
        { status: 401 }
      );
    }

    // If reset flag is set, clear the message cache first
    if (reset) {
      console.log('🔄 Resetting Gmail sync cache...');
      
      // Clear message cache
      await supabaseAdmin.from('gmail_message_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Reset follow-up fields on all leads
      await supabaseAdmin.from('leads').update({
        followup_1_sent_at: null,
        followup_2_sent_at: null,
        followup_3_sent_at: null,
      }).neq('id', '00000000-0000-0000-0000-000000000000');
      
      console.log('✅ Cache cleared, re-syncing from scratch...');
    }

    console.log(`📧 Starting manual Gmail sync for ${userEmail}...`);

    // Run sync
    const result = await gmailSyncService.syncGmail(userEmail);

    console.log('✅ Gmail sync completed:', result);

    return NextResponse.json({
      success: true,
      result,
      message: `Synced ${result.emailsProcessed} emails, updated ${result.leadsUpdated} leads`,
    });
  } catch (error) {
    console.error('Gmail sync API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync Gmail',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/gmail/sync
 * 
 * Check Gmail connection status and last sync
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = request.nextUrl.searchParams.get('userEmail');

    if (!userEmail) {
      return NextResponse.json(
        { error: 'userEmail query parameter is required' },
        { status: 400 }
      );
    }

    // Check connection status
    const isConnected = await gmailOAuthService.isConnected(userEmail);

    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        userEmail: null,
        lastSync: null,
      });
    }

    // Get last sync info
    const { supabaseAdmin } = await import('@/lib/supabase/admin');
    const { data: lastSync } = await supabaseAdmin
      .from('gmail_sync_log')
      .select('*')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      connected: true,
      userEmail,
      lastSync: lastSync ? {
        completedAt: lastSync.completed_at,
        emailsProcessed: lastSync.emails_processed,
        leadsUpdated: lastSync.leads_updated,
      } : null,
    });
  } catch (error) {
    console.error('Gmail status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check Gmail status' },
      { status: 500 }
    );
  }
}
