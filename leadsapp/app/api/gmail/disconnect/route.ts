import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/gmail/disconnect
 * 
 * Disconnects Gmail by removing stored OAuth tokens.
 * User will need to reconnect and re-authorize to use Gmail features again.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userEmail } = body;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 400 }
      );
    }

    console.log(`🔌 Disconnecting Gmail for: ${userEmail}`);

    // Delete the user's Gmail auth tokens
    const { error } = await supabaseAdmin
      .from('user_gmail_auth')
      .delete()
      .eq('user_email', userEmail);

    if (error) {
      console.error('Failed to delete Gmail auth:', error);
      // Don't throw - might not exist
    }

    console.log(`✅ Gmail disconnected for: ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: 'Gmail disconnected successfully',
    });

  } catch (error: any) {
    console.error('❌ Disconnect API error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Gmail', details: error.message },
      { status: 500 }
    );
  }
}
