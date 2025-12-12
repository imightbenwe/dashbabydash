import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST - Add a place to open leads (or update last_shown_at if exists)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, campaignId, places, searchQuery, searchLocation } = body;

    if (!userId || !places || !Array.isArray(places)) {
      return NextResponse.json(
        { error: 'userId and places array are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Upsert each place (insert or update last_shown_at)
    const upsertPromises = places.map((place: any) =>
      supabaseAdmin
        .from('open_leads')
        .upsert({
          user_id: userId,
          campaign_id: campaignId || null,
          place_id: place.id,
          place_name: place.name || place.displayName?.text,
          website: place.websiteUri || place.website || null,
          address: place.formattedAddress || place.address || null,
          phone: place.nationalPhoneNumber || place.phone || null,
          rating: place.rating || null,
          user_rating_count: place.userRatingCount || null,
          google_maps_uri: place.googleMapsUri || null,
          search_query: searchQuery || null,
          search_location: searchLocation || null,
          search_date: now,
          last_shown_at: now,
        }, {
          onConflict: 'user_id,place_id',
          ignoreDuplicates: false,
        })
        .select()
    );

    const results = await Promise.all(upsertPromises);
    
    // Check for errors
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error('Open leads upsert errors:', errors);
      return NextResponse.json({ error: 'Some places failed to save' }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Places saved to open leads',
      count: places.length 
    });
  } catch (error) {
    console.error('Open Leads API Error:', error);
    return NextResponse.json({ error: 'Failed to save open leads' }, { status: 500 });
  }
}

// GET - Get open leads (not dismissed, not converted to actual leads)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const campaignId = searchParams.get('campaignId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get dismissed place_ids to exclude
    const { data: dismissedData } = await supabaseAdmin
      .from('dismissed_leads')
      .select('place_id')
      .eq('user_id', userId);

    const dismissedPlaceIds = new Set(dismissedData?.map(d => d.place_id) || []);

    // Get actual lead websites to exclude
    const { data: leadsData } = await supabaseAdmin
      .from('leads')
      .select('website');

    const leadWebsites = new Set(leadsData?.map(l => l.website).filter(Boolean) || []);

    // Get open leads
    let query = supabaseAdmin
      .from('open_leads')
      .select('*')
      .eq('user_id', userId)
      .order('last_shown_at', { ascending: false });

    if (campaignId) {
      query = query.eq('campaign_id', campaignId);
    }

    const { data: openLeads, error } = await query;

    if (error) {
      console.error('Open leads fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch open leads' }, { status: 500 });
    }

    // Filter out dismissed and converted leads
    const filteredOpenLeads = openLeads?.filter(ol => 
      !dismissedPlaceIds.has(ol.place_id) && !leadWebsites.has(ol.website)
    ) || [];

    return NextResponse.json({ openLeads: filteredOpenLeads });
  } catch (error) {
    console.error('Open Leads API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch open leads' }, { status: 500 });
  }
}

// DELETE - Remove from open leads (when converted to lead)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const placeId = searchParams.get('placeId');

    if (!userId || !placeId) {
      return NextResponse.json({ error: 'userId and placeId required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('open_leads')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId);

    if (error) {
      console.error('Remove open lead error:', error);
      return NextResponse.json({ error: 'Failed to remove open lead' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Open lead removed successfully' });
  } catch (error) {
    console.error('Open Leads API Error:', error);
    return NextResponse.json({ error: 'Failed to remove open lead' }, { status: 500 });
  }
}
