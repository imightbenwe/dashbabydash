import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logLeadActivity, formatStatusChange } from '@/lib/activity-logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { 
      status, persona_score, next_action, company, email, website, instagram, facebook, substack, threads, linkedin, name, 
      date_contacted, last_touch_date,
      mutual_connection_name, specific_hook_story, problem_statement, case_study_reference,
      pdf_url, mockup_site_url, pdf_sent_date, site_live_date,
      initial_email_subject, followup_1_sent_at, followup_2_sent_at, followup_3_sent_at,
      _source // Optional: source of the change (default to 'user')
    } = body;

    console.log(`🔄 Updating lead ${id}:`, { status, persona_score, next_action });

    // Fetch current lead data for comparison (to log changes)
    const { data: currentLead } = await supabaseAdmin
      .from('leads')
      .select('status, name')
      .eq('id', id)
      .single();

    const updateData: any = {};
    if (name) updateData.name = name;
    if (status) updateData.status = status;
    if (persona_score) updateData.persona_score = persona_score;
    if (next_action !== undefined) updateData.next_action = next_action;
    if (company !== undefined) updateData.company = company;
    if (email !== undefined) updateData.email = email;
    if (website !== undefined) updateData.website = website;
    if (instagram !== undefined) updateData.instagram = instagram;
    if (facebook !== undefined) updateData.facebook = facebook;
    if (substack !== undefined) updateData.substack = substack;
    if (threads !== undefined) updateData.threads = threads;
    if (linkedin !== undefined) updateData.linkedin = linkedin;
    if (date_contacted !== undefined) updateData.date_contacted = date_contacted;
    if (last_touch_date !== undefined) updateData.last_touch_date = last_touch_date;
    
    // Cold email personalization fields
    if (mutual_connection_name !== undefined) updateData.mutual_connection_name = mutual_connection_name;
    if (specific_hook_story !== undefined) updateData.specific_hook_story = specific_hook_story;
    if (problem_statement !== undefined) updateData.problem_statement = problem_statement;
    if (case_study_reference !== undefined) updateData.case_study_reference = case_study_reference;
    if (pdf_url !== undefined) updateData.pdf_url = pdf_url;
    if (mockup_site_url !== undefined) updateData.mockup_site_url = mockup_site_url;
    if (pdf_sent_date !== undefined) updateData.pdf_sent_date = pdf_sent_date;
    if (site_live_date !== undefined) updateData.site_live_date = site_live_date;
    
    // Gmail follow-up tracking fields
    if (initial_email_subject !== undefined) updateData.initial_email_subject = initial_email_subject;
    if (followup_1_sent_at !== undefined) updateData.followup_1_sent_at = followup_1_sent_at;
    if (followup_2_sent_at !== undefined) updateData.followup_2_sent_at = followup_2_sent_at;
    if (followup_3_sent_at !== undefined) updateData.followup_3_sent_at = followup_3_sent_at;

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Lead update error:', error);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
    }

    // Log activity for status changes
    if (status && currentLead && status !== currentLead.status) {
      await logLeadActivity({
        leadId: id,
        actionType: 'status_change',
        source: (_source as any) || 'user',
        fieldName: 'status',
        oldValue: currentLead.status,
        newValue: status,
        description: formatStatusChange(currentLead.status, status),
      });

      // AUTO-REMOVE from email queue if status changes to excluded status
      const excludedStatuses = [
        'replied_not_fit', 'replied_interested', 'call_booked', 
        'call_done_thinking', 'won', 'lost', 'site_live', 'email_bounced'
      ];
      
      if (excludedStatuses.includes(status)) {
        const { data: removed, error: removeError } = await supabaseAdmin
          .from('email_send_queue')
          .delete()
          .eq('lead_id', id)
          .in('status', ['approved', 'sending'])
          .select();
        
        if (removed && removed.length > 0) {
          console.log(`🗑️ Auto-removed ${removed.length} queued email(s) for lead ${id} (status: ${status})`);
        }
      }
    }

    console.log('✅ Lead updated successfully');

    return NextResponse.json({ lead });
  } catch (error) {
    console.error('❌ Lead PATCH API Error:', error);
    return NextResponse.json(
      { error: 'Failed to update lead' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🔍 Fetching lead ${id}`);

    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      console.error('❌ Lead not found:', leadError);
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Fetch all related data in PARALLEL for much faster response
    const [rawDataResult, analysesResult, emailsResult] = await Promise.all([
      supabaseAdmin.from('raw_data_sources').select('*').eq('lead_id', id),
      supabaseAdmin.from('ai_analyses').select('*').eq('lead_id', id),
      supabaseAdmin.from('generated_emails').select('*').eq('lead_id', id).order('created_at', { ascending: false })
    ]);

    const rawData = rawDataResult.data;
    const analyses = analysesResult.data;
    const emails = emailsResult.data;

    console.log('✅ Lead data fetched successfully');

    return NextResponse.json({
      lead,
      rawData: rawData || [],
      analyses: analyses || [],
      emails: emails || [],
    });
  } catch (error) {
    console.error('❌ Lead GET API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lead details' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`🗑️ Deleting lead ${id}`);

    const { error } = await supabaseAdmin
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Lead delete error:', error);
      return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
    }

    console.log('✅ Lead deleted successfully');

    return NextResponse.json({ success: true, message: 'Lead deleted successfully' });
  } catch (error) {
    console.error('❌ Lead DELETE API Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete lead' },
      { status: 500 }
    );
  }
}
