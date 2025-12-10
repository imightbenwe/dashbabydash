import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET - Fetch all campaigns with stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const { data: campaigns, error } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Campaigns fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    return NextResponse.json({ campaigns });
  } catch (error) {
    console.error('Campaigns API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

// POST - Create or update a campaign
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, searchQuery, location, totalFetched } = body;

    if (!userId || !searchQuery) {
      return NextResponse.json({ error: 'userId and searchQuery are required' }, { status: 400 });
    }

    // Check if campaign already exists
    const { data: existing } = await supabaseAdmin
      .from('campaigns')
      .select('*')
      .eq('user_id', userId)
      .eq('search_query', searchQuery)
      .eq('location', location || '')
      .single();

    if (existing) {
      // Update existing campaign
      const { data: updated, error } = await supabaseAdmin
        .from('campaigns')
        .update({
          total_fetched: existing.total_fetched + (totalFetched || 0),
          last_search_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Campaign update error:', error);
        return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
      }

      return NextResponse.json({ campaign: updated });
    } else {
      // Create new campaign
      const { data: campaign, error } = await supabaseAdmin
        .from('campaigns')
        .insert({
          user_id: userId,
          search_query: searchQuery,
          location: location || null,
          total_fetched: totalFetched || 0,
          last_search_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Campaign creation error:', error);
        return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
      }

      return NextResponse.json({ campaign });
    }
  } catch (error) {
    console.error('Campaigns API Error:', error);
    return NextResponse.json({ error: 'Failed to process campaign' }, { status: 500 });
  }
}
