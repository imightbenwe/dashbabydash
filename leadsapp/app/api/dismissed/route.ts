import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST - Dismiss a lead
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, campaignId, placeId, placeName, website, address, phone, reason } = body;

    if (!userId || !placeId || !placeName) {
      return NextResponse.json(
        { error: 'userId, placeId, and placeName are required' },
        { status: 400 }
      );
    }

    // Try to get search query info from open_leads if it exists
    const { data: openLead } = await supabaseAdmin
      .from('open_leads')
      .select('search_query, search_location, search_date')
      .eq('user_id', userId)
      .eq('place_id', placeId)
      .single();

    // Insert dismissed lead (will ignore if already exists due to UNIQUE constraint)
    const { data: dismissed, error } = await supabaseAdmin
      .from('dismissed_leads')
      .insert({
        user_id: userId,
        campaign_id: campaignId || null,
        place_id: placeId,
        place_name: placeName,
        website: website || null,
        address: address || null,
        phone: phone || null,
        reason: reason || null,
        search_query: openLead?.search_query || null,
        search_location: openLead?.search_location || null,
        search_date: openLead?.search_date || null,
      })
      .select()
      .single();

    if (error) {
      // If it's a unique constraint violation, it means already dismissed
      if (error.code === '23505') {
        return NextResponse.json({ message: 'Already dismissed' }, { status: 200 });
      }
      console.error('Dismiss lead error:', error);
      return NextResponse.json({ error: 'Failed to dismiss lead' }, { status: 500 });
    }

    // Delete from open_leads after dismissing
    await supabaseAdmin
      .from('open_leads')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId);

    // Update campaign stats if campaign_id provided
    if (campaignId) {
      const { error: updateError } = await supabaseAdmin.rpc('increment_campaign_dismissed', {
        campaign_id: campaignId,
      });

      if (updateError) {
        console.error('Campaign stat update error:', updateError);
      }
    }

    return NextResponse.json({ dismissed });
  } catch (error) {
    console.error('Dismiss Lead API Error:', error);
    return NextResponse.json({ error: 'Failed to dismiss lead' }, { status: 500 });
  }
}

// GET - Get dismissed leads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const campaignId = searchParams.get('campaignId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('dismissed_leads')
      .select('*')
      .eq('user_id', userId)
      .order('dismissed_at', { ascending: false });

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: dismissed, error } = await query;

    if (error) {
      console.error('Dismissed leads fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch dismissed leads' }, { status: 500 });
    }

    return NextResponse.json({ dismissed });
  } catch (error) {
    console.error('Dismissed Leads API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch dismissed leads' }, { status: 500 });
  }
}

// DELETE - Un-dismiss a lead
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const placeId = searchParams.get('placeId');

    if (!userId || !placeId) {
      return NextResponse.json({ error: 'userId and placeId required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('dismissed_leads')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId);

    if (error) {
      console.error('Un-dismiss lead error:', error);
      return NextResponse.json({ error: 'Failed to un-dismiss lead' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Lead un-dismissed successfully' });
  } catch (error) {
    console.error('Dismissed Leads API Error:', error);
    return NextResponse.json({ error: 'Failed to un-dismiss lead' }, { status: 500 });
  }
}
