/**
 * Gmail OAuth Configuration
 * 
 * Setup Instructions:
 * 1. Go to https://console.cloud.google.com/
 * 2. Create new project or select existing
 * 3. Enable Gmail API: https://console.cloud.google.com/flows/enableapi?apiid=gmail.googleapis.com
 * 4. Configure OAuth consent screen:
 *    - App name: "PersonaAI Lead Tracker"
 *    - User support email: your email
 *    - Scopes: gmail.readonly, gmail.modify
 * 5. Create OAuth 2.0 Client ID:
 *    - Application type: Web application
 *    - Authorized redirect URIs: http://localhost:3000/api/gmail/callback (dev) and your production URL
 * 6. Download credentials JSON and add values to .env.local
 */

export const GMAIL_CONFIG = {
  // OAuth Scopes - what permissions we're requesting
  SCOPES: [
    'https://www.googleapis.com/auth/gmail.readonly',  // Read emails
    'https://www.googleapis.com/auth/gmail.modify',    // Modify labels/marks
    'https://www.googleapis.com/auth/gmail.send',      // Send emails (for auto follow-ups)
  ],
  
  // OAuth Client Configuration (from Google Cloud Console)
  CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback',
  
  // Sync Configuration
  SYNC_INTERVAL_MS: 60 * 60 * 1000, // 1 hour
  SYNC_LOOKBACK_DAYS: 90, // How far back to look for emails
  BATCH_SIZE: 100, // How many emails to process per batch
  
  // Email Matching Configuration
  SIMILARITY_THRESHOLD: 0.7, // 70% similarity to match email to template
};

// Add these to your .env.local file:
// GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
// GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
// GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/gmail/callback
