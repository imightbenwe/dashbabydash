import { NextRequest, NextResponse } from 'next/server';
import { gmailOAuthService } from '@/lib/gmail-oauth-service';
import { google } from 'googleapis';

/**
 * GET /api/gmail/callback
 * 
 * OAuth callback endpoint - Google redirects here after user authorizes
 * Exchanges authorization code for access/refresh tokens
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Handle user denial
    if (error) {
      console.error('📧 Gmail OAuth denied:', error);
      return NextResponse.redirect(
        new URL(`/?gmail_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.json(
        { error: 'No authorization code provided' },
        { status: 400 }
      );
    }

    console.log('📧 Received Gmail authorization code');

    // Exchange code for tokens
    const tokens = await gmailOAuthService.getTokensFromCode(code);

    // Get user's Gmail address using the new token
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const userEmail = profile.data.emailAddress;

    if (!userEmail) {
      throw new Error('Could not retrieve Gmail email address');
    }

    // Store tokens in database
    await gmailOAuthService.storeTokens(userEmail, tokens);

    console.log('✅ Gmail connected:', userEmail);

    // Redirect back to main page with success message
    return NextResponse.redirect(
      new URL(`/?gmail_connected=${encodeURIComponent(userEmail)}`, request.url)
    );
  } catch (error) {
    console.error('Gmail callback error:', error);
    return NextResponse.redirect(
      new URL(`/?gmail_error=connection_failed`, request.url)
    );
  }
}
