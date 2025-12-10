import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET - Get all existing place IDs (for filtering search results)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    // Get all place IDs from open_leads, dismissed_leads, and promoted_leads
    const [openRes, dismissedRes, promotedRes] = await Promise.all([
      supabaseAdmin
        .from('open_leads')
        .select('place_id')
        .eq('user_id', userId),
      supabaseAdmin
        .from('dismissed_leads')
        .select('place_id')
        .eq('user_id', userId),
      supabaseAdmin
        .from('promoted_leads')
        .select('place_id')
        .eq('user_id', userId),
    ]);

    const openPlaceIds = new Set(openRes.data?.map(d => d.place_id) || []);
    const dismissedPlaceIds = new Set(dismissedRes.data?.map(d => d.place_id) || []);
    const promotedPlaceIds = new Set(promotedRes.data?.map(d => d.place_id) || []);

    // Combine all into one set of existing place IDs
    const allExistingPlaceIds = new Set([
      ...openPlaceIds,
      ...dismissedPlaceIds,
      ...promotedPlaceIds,
    ]);

    return NextResponse.json({ 
      existingPlaceIds: Array.from(allExistingPlaceIds),
      openPlaceIds: Array.from(openPlaceIds),
      dismissedPlaceIds: Array.from(dismissedPlaceIds),
      promotedPlaceIds: Array.from(promotedPlaceIds),
    });
  } catch (error) {
    console.error('Existing Place IDs API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch existing place IDs' }, { status: 500 });
  }
}
