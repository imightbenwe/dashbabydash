import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST - Create actual leads from selected place IDs
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { placeIds, userId = 'demo-user' } = body;

    if (!placeIds || !Array.isArray(placeIds) || placeIds.length === 0) {
      return NextResponse.json(
        { error: 'placeIds array is required' },
        { status: 400 }
      );
    }

    console.log('Looking for placeIds:', placeIds);
    console.log('Using userId:', userId);

    // Get the open leads data for these place IDs
    const { data: openLeads, error: fetchError } = await supabaseAdmin
      .from('open_leads')
      .select('*')
      .eq('user_id', userId)
      .in('place_id', placeIds);

    console.log('Found open leads:', openLeads?.length || 0);
    console.log('Fetch error:', fetchError);

    if (fetchError || !openLeads || openLeads.length === 0) {
      console.error('Failed to fetch open leads:', fetchError);
      return NextResponse.json(
        { 
          error: 'No open leads found for the selected place IDs',
          debug: { placeIds, userId, foundCount: openLeads?.length || 0 }
        },
        { status: 404 }
      );
    }

    const createdLeads = [];
    const promotedPlaces = [];

    // Create a lead for each place
    for (const place of openLeads) {
      // Create the actual lead in the leads table
      const { data: lead, error: leadError } = await supabaseAdmin
        .from('leads')
        .insert({
          name: place.place_name,
          website: place.website,
          status: 'lead_collected',
          automation_stage: 0, // Queued for automation
        })
        .select()
        .single();

      if (leadError) {
        console.error('Failed to create lead:', leadError);
        continue;
      }

      createdLeads.push(lead);

      // Add to promoted_leads table
      await supabaseAdmin
        .from('promoted_leads')
        .insert({
          user_id: userId,
          place_id: place.place_id,
          place_name: place.place_name,
          website: place.website,
          address: place.address,
          phone: place.phone,
          rating: place.rating,
          user_rating_count: place.user_rating_count,
          google_maps_uri: place.google_maps_uri,
          search_query: place.search_query,
          search_location: place.search_location,
          search_date: place.search_date,
          lead_id: lead.id,
        });

      promotedPlaces.push(place);
    }

    return NextResponse.json({
      success: true,
      message: `Created ${createdLeads.length} leads`,
      leadsCreated: createdLeads.length,
      leads: createdLeads,
    });
  } catch (error) {
    console.error('Create leads from places error:', error);
    return NextResponse.json(
      { error: 'Failed to create leads from places' },
      { status: 500 }
    );
  }
}
