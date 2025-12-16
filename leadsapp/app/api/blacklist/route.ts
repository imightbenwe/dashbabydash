import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/blacklist
 * Get all blacklisted domains
 */
export async function GET() {
  try {
    const { data: domains, error } = await supabaseAdmin
      .from('blacklisted_domains')
      .select('*')
      .order('blacklisted_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching blacklisted domains:', error);
      return NextResponse.json({ error: 'Failed to fetch blacklist' }, { status: 500 });
    }

    return NextResponse.json({ domains });
  } catch (error) {
    console.error('❌ Blacklist GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/blacklist
 * Add a domain to the blacklist
 */
export async function POST(request: NextRequest) {
  try {
    const { domain, reason } = await request.json();

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    // Normalize domain (lowercase, remove protocol, www, etc.)
    const normalizedDomain = domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim();

    // Add to blacklist
    const { data: blacklistedDomain, error: insertError } = await supabaseAdmin
      .from('blacklisted_domains')
      .insert({
        domain: normalizedDomain,
        reason: reason || 'No reason provided',
        blacklisted_by: 'manual',
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint violation
        return NextResponse.json({ error: 'Domain is already blacklisted' }, { status: 409 });
      }
      console.error('❌ Error adding domain to blacklist:', insertError);
      return NextResponse.json({ error: 'Failed to add domain to blacklist' }, { status: 500 });
    }

    // Update existing leads with this domain
    const { data: updatedLeads, error: _updateError } = await supabaseAdmin
      .from('leads')
      .update({
        status: 'lost',
        is_blacklisted: true,
        blacklist_reason: `Domain ${normalizedDomain} is blacklisted: ${reason || 'No reason provided'}`,
      })
      .or(`email.ilike.%@${normalizedDomain},website.ilike.%${normalizedDomain}%`)
      .select('id, name, email, website');

    console.log(`✅ Blacklisted domain ${normalizedDomain}, updated ${updatedLeads?.length || 0} leads`);

    return NextResponse.json({
      success: true,
      domain: blacklistedDomain,
      updatedLeadsCount: updatedLeads?.length || 0,
      updatedLeads,
    });
  } catch (error) {
    console.error('❌ Blacklist POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/blacklist
 * Remove a domain from the blacklist
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');

    if (!domain) {
      return NextResponse.json({ error: 'Domain is required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('blacklisted_domains')
      .delete()
      .eq('domain', domain.toLowerCase());

    if (error) {
      console.error('❌ Error removing domain from blacklist:', error);
      return NextResponse.json({ error: 'Failed to remove domain from blacklist' }, { status: 500 });
    }

    console.log(`✅ Removed ${domain} from blacklist`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Blacklist DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
