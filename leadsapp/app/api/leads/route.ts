import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { 
  apiSuccess, 
  apiError, 
  databaseError, 
  missingFieldError,
  parsePaginationParams,
  createPaginationMeta,
} from '@/lib/api-utils';
import { logger } from '@/lib/logger';
import type { Lead, LeadStatus } from '@/lib/types';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as LeadStatus | null;
    const { page, limit, offset } = parsePaginationParams(searchParams);

    logger.debug('Fetching leads', { status, page, limit });

    // Build query
    let query = supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: leads, error, count } = await query;

    if (error) {
      logger.error('Database query failed', error);
      return databaseError('fetch leads', error);
    }

    const duration = Date.now() - startTime;
    logger.api('GET', '/api/leads', 200, duration);

    return apiSuccess({
      leads: leads as Lead[],
      pagination: createPaginationMeta(count || 0, page, limit),
    });
  } catch (error) {
    logger.error('Leads API Error', error);
    return apiError('Failed to fetch leads', 500);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { name, company, email } = body;

    if (!name) {
      return missingFieldError('name');
    }

    logger.debug('Creating new lead', { name, company });

    const { data: lead, error } = await supabaseAdmin
      .from('leads')
      .insert({
        name,
        company: company || null,
        email: email || null,
        status: (body.status as LeadStatus) || 'lead_collected',
        website: body.website || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      logger.error('Lead creation failed', error);
      return databaseError('create lead', error);
    }

    const duration = Date.now() - startTime;
    logger.api('POST', '/api/leads', 201, duration);
    logger.info('Lead created successfully', { leadId: lead.id });

    return apiSuccess({ lead: lead as Lead }, 'Lead created successfully', 201);
  } catch (error) {
    logger.error('Leads POST API Error', error);
    return apiError('Failed to create lead', 500);
  }
}
