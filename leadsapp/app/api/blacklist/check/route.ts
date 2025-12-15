import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/blacklist/check
 * Check if a domain or email is blacklisted
 */
export async function POST(request: NextRequest) {
  try {
    const { email, website } = await request.json();

    const domainsToCheck: string[] = [];

    // Extract domain from email
    if (email) {
      const emailDomain = email.split('@')[1]?.toLowerCase();
      if (emailDomain) {
        domainsToCheck.push(emailDomain);
      }
    }

    // Extract domain from website
    if (website) {
      const websiteDomain = website
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split('/')[0]
        .trim();
      if (websiteDomain && !domainsToCheck.includes(websiteDomain)) {
        domainsToCheck.push(websiteDomain);
      }
    }

    if (domainsToCheck.length === 0) {
      return NextResponse.json({ isBlacklisted: false });
    }

    // Check if any of these domains are blacklisted
    const { data: blacklistedDomains, error } = await supabaseAdmin
      .from('blacklisted_domains')
      .select('*')
      .in('domain', domainsToCheck);

    if (error) {
      console.error('❌ Error checking blacklist:', error);
      return NextResponse.json({ error: 'Failed to check blacklist' }, { status: 500 });
    }

    const isBlacklisted = blacklistedDomains && blacklistedDomains.length > 0;

    return NextResponse.json({
      isBlacklisted,
      blacklistedDomains: blacklistedDomains || [],
      checkedDomains: domainsToCheck,
    });
  } catch (error) {
    console.error('❌ Blacklist check error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
