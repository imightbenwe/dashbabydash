import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id, sourceId } = await params;

    console.log(`🗑️ Deleting data source ${sourceId} for lead ${id}`);

    const { error } = await supabaseAdmin
      .from('raw_data_sources')
      .delete()
      .eq('id', sourceId)
      .eq('lead_id', id); // Ensure it belongs to this lead

    if (error) {
      console.error('Error deleting data source:', error);
      return NextResponse.json({ error: 'Failed to delete data source' }, { status: 500 });
    }

    console.log('✅ Data source deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'Data source deleted successfully',
    });

  } catch (error) {
    console.error('❌ Error deleting data source:', error);
    return NextResponse.json(
      { error: 'Failed to delete data source', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
