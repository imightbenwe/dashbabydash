/**
 * Cron Security Utilities
 * 
 * Provides CRON_SECRET verification for automated endpoints.
 * This prevents unauthorized calls to cron/automation endpoints.
 */

import { NextRequest } from 'next/server';

/**
 * Verify that a request has a valid CRON_SECRET.
 * 
 * The secret can be provided via:
 * - Authorization header: `Bearer <secret>`
 * - x-cron-secret header: `<secret>`
 * - Query parameter: `?cron_secret=<secret>`
 * 
 * @returns true if valid, false if invalid or missing
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  
  // If no secret is configured, allow in development only
  if (!secret) {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.warn('⚠️ CRON_SECRET not set - allowing request in development mode');
      return true;
    }
    console.error('❌ CRON_SECRET not configured - rejecting request');
    return false;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token === secret) return true;
  }

  // Check x-cron-secret header
  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader === secret) return true;

  // Check query parameter
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('cron_secret');
  if (querySecret === secret) return true;

  return false;
}

/**
 * Create a JSON response for unauthorized cron requests
 */
export function unauthorizedCronResponse() {
  return {
    error: 'Unauthorized',
    message: 'Invalid or missing CRON_SECRET. This endpoint requires authentication.',
  };
}
