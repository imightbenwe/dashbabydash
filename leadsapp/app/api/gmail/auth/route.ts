import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/lib/gmail-oauth-service';

/**
 * GET /api/gmail/auth
 * 
 * Initiates Gmail OAuth flow by redirecting user to Google consent screen
 */
export async function GET(request: NextRequest) {
  try {
    // Generate OAuth URL
    const authUrl = gmailOAuthService.generateAuthUrl();

    console.log('📧 Initiating Gmail OAuth flow');

    // Redirect user to Google consent screen
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Gmail auth error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Gmail authorization' },
      { status: 500 }
    );
  }
}
