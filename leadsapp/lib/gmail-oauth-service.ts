/**
 * Gmail OAuth Service
 * Handles Gmail API authentication and token management
 */

import { google } from 'googleapis';
import { GMAIL_CONFIG } from './gmail-config';
import { supabaseAdmin } from './supabase/admin';

const { OAuth2 } = google.auth;

export class GmailOAuthService {
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new OAuth2(
      GMAIL_CONFIG.CLIENT_ID,
      GMAIL_CONFIG.CLIENT_SECRET,
      GMAIL_CONFIG.REDIRECT_URI
    );
  }

  /**
   * Generate OAuth URL for user to authorize Gmail access
   */
  generateAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Get refresh token
      scope: GMAIL_CONFIG.SCOPES,
      prompt: 'consent', // Force consent screen to get refresh token
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    return tokens;
  }

  /**
   * Store tokens in database
   */
  async storeTokens(userEmail: string, tokens: any) {
    const { access_token, refresh_token, expiry_date, scope } = tokens;

    const { data, error } = await supabaseAdmin
      .from('user_gmail_auth')
      .upsert({
        user_email: userEmail,
        access_token: access_token,
        refresh_token: refresh_token,
        token_expiry: expiry_date ? new Date(expiry_date).toISOString() : null,
        scope: Array.isArray(scope) ? scope.join(' ') : scope,
        gmail_sync_enabled: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email'
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Failed to store Gmail tokens');
    }

    return data;
  }

  /**
   * Get tokens from database
   */
  async getStoredTokens(userEmail: string) {
    const { data, error } = await supabaseAdmin
      .from('user_gmail_auth')
      .select('*')
      .eq('user_email', userEmail)
      .eq('gmail_sync_enabled', true)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expiry_date: data.token_expiry ? new Date(data.token_expiry).getTime() : null,
      scope: data.scope,
    };
  }

  /**
   * Get authenticated Gmail client
   */
  async getGmailClient(userEmail: string) {
    const tokens = await this.getStoredTokens(userEmail);
    
    if (!tokens || !tokens.refresh_token) {
      throw new Error('No Gmail authorization found. Please connect your Gmail account.');
    }

    // Set credentials on OAuth client
    this.oauth2Client.setCredentials(tokens);

    // Handle token refresh automatically
    this.oauth2Client.on('tokens', async (refreshedTokens: any) => {
      console.log('📧 Gmail tokens refreshed automatically');
      
      // Update access token in database
      if (refreshedTokens.access_token) {
        await supabaseAdmin
          .from('user_gmail_auth')
          .update({
            access_token: refreshedTokens.access_token,
            token_expiry: refreshedTokens.expiry_date 
              ? new Date(refreshedTokens.expiry_date).toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_email', userEmail);
      }
    });

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    return gmail;
  }

  /**
   * Revoke Gmail access (disconnect)
   */
  async revokeAccess(userEmail: string) {
    const tokens = await this.getStoredTokens(userEmail);
    
    if (tokens && tokens.access_token) {
      await this.oauth2Client.revokeToken(tokens.access_token);
    }

    // Remove from database
    await supabaseAdmin
      .from('user_gmail_auth')
      .delete()
      .eq('user_email', userEmail);
  }

  /**
   * Check if Gmail is connected
   */
  async isConnected(userEmail: string): Promise<boolean> {
    const tokens = await this.getStoredTokens(userEmail);
    return !!tokens && !!tokens.refresh_token;
  }
}

// Singleton instance
export const gmailOAuthService = new GmailOAuthService();
