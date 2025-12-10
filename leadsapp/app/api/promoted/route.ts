import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST - Add a place to promoted leads (when converted to lead)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, campaignId, placeId, placeName, website, address, phone, rating, userRatingCount, googleMapsUri, searchQuery, searchLocation, searchDate, leadId } = body;

    if (!userId || !placeId || !placeName) {
      return NextResponse.json(
        { error: 'userId, placeId, and placeName are required' },
        { status: 400 }
      );
    }

    // Insert promoted lead
    const { data: promoted, error } = await supabaseAdmin
      .from('promoted_leads')
      .insert({
        user_id: userId,
        campaign_id: campaignId || null,
        place_id: placeId,
        place_name: placeName,
        website: website || null,
        address: address || null,
        phone: phone || null,
        rating: rating || null,
        user_rating_count: userRatingCount || null,
        google_maps_uri: googleMapsUri || null,
        search_query: searchQuery || null,
        search_location: searchLocation || null,
        search_date: searchDate || null,
        lead_id: leadId || null,
      })
      .select()
      .single();

    if (error) {
      // If it's a unique constraint violation, it means already promoted
      if (error.code === '23505') {
        return NextResponse.json({ message: 'Already promoted' }, { status: 200 });
      }
      console.error('Promote lead error:', error);
      return NextResponse.json({ error: 'Failed to promote lead' }, { status: 500 });
    }

    // Delete from open_leads if exists
    await supabaseAdmin
      .from('open_leads')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId);

    return NextResponse.json({ promoted });
  } catch (error) {
    console.error('Promoted Lead API Error:', error);
    return NextResponse.json({ error: 'Failed to promote lead' }, { status: 500 });
  }
}

// GET - Get promoted leads
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const campaignId = searchParams.get('campaignId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('promoted_leads')
      .select('*')
      .eq('user_id', userId)
      .order('promoted_at', { ascending: false });

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: promoted, error } = await query;

    if (error) {
      console.error('Promoted leads fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch promoted leads' }, { status: 500 });
    }

    return NextResponse.json({ promoted });
  } catch (error) {
    console.error('Promoted Leads API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch promoted leads' }, { status: 500 });
  }
}
