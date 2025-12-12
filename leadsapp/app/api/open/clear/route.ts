import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// DELETE - Clear all open leads for a user
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('open_leads')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Clear open leads error:', error);
      return NextResponse.json({ error: 'Failed to clear open leads' }, { status: 500 });
    }

    return NextResponse.json({ message: 'All open leads cleared successfully' });
  } catch (error) {
    console.error('Clear Open Leads API Error:', error);
    return NextResponse.json({ error: 'Failed to clear open leads' }, { status: 500 });
  }
}
