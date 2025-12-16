import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { logLeadActivity } from '@/lib/activity-logger';
import { verifyCronSecret, unauthorizedCronResponse } from '@/lib/cron-security';

/**
 * Automation Process API
 * Checks for leads that need automation and processes them through stages:
 * Stage 0 -> 1: Website scraping (2 min after creation)
 * Stage 1 -> 2: AI analysis (1 min after scraping)
 * 
 * SECURITY: Requires CRON_SECRET for production use.
 */
export async function POST(request: NextRequest) {
  // Verify CRON_SECRET for automated calls
  if (!verifyCronSecret(request)) {
    return NextResponse.json(unauthorizedCronResponse(), { status: 401 });
  }

  try {
    console.log('🤖 Starting automation check...');
    
    const results = {
      stage0Processed: 0,
      stage1Processed: 0,
      errors: [] as string[],
    };

    // ========================================
    // STAGE 0 -> 1: Website Scraping
    // ========================================
    
    // Find all Stage 0 leads (created at least 2 minutes ago)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    
    const { data: stage0Leads, error: stage0Error } = await supabaseAdmin
      .from('leads')
      .select('id, name, website')
      .eq('automation_stage', 0)
      .eq('status', 'lead_collected') // Only automate new leads, not already-contacted ones
      .lte('created_at', twoMinutesAgo)
      .not('website', 'is', null)
      .limit(10); // Process max 10 at a time to avoid overload

    if (stage0Error) {
      console.error('❌ Error fetching Stage 0 leads:', stage0Error);
      results.errors.push(`Stage 0 query error: ${stage0Error.message}`);
    } else if (stage0Leads && stage0Leads.length > 0) {
      console.log(`📊 Found ${stage0Leads.length} Stage 0 leads ready for scraping`);

      // Process each lead
      for (const lead of stage0Leads) {
        try {
          console.log(`🔍 Scraping website for ${lead.name}...`);
          
          // Call the scraping API
          const scrapeResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/scraper/deep`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: lead.website }),
          });

          if (!scrapeResponse.ok) {
            throw new Error(`Scraping failed: ${scrapeResponse.statusText}`);
          }

          const scrapeData = await scrapeResponse.json();
          const scrapedContent = scrapeData.content || '';

          // Extract email from scraped content
          const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
          const emails = scrapedContent.match(emailRegex);
          const validEmails = emails?.filter(email => 
            !email.includes('example.com') && 
            !email.includes('domain.com') &&
            !email.includes('yourdomain.com') &&
            !email.includes('wix.com') &&
            !email.includes('wordpress.com')
          );

          let extractedEmail = null;
          const emailsFoundMatch = scrapedContent.match(/EMAILS FOUND:\s*([^\n]+)/);
          if (emailsFoundMatch && emailsFoundMatch[1]) {
            const foundEmails = emailsFoundMatch[1].split(',').map(e => e.trim());
            extractedEmail = foundEmails[0];
          } else if (validEmails && validEmails.length > 0) {
            extractedEmail = validEmails[0];
          }

          // Save scraped data to raw_data_sources
          await supabaseAdmin.from('raw_data_sources').insert({
            lead_id: lead.id,
            source_type: 'website',
            file_name: 'website_scraped',
            raw_content: { text: scrapedContent },
          });

          // Update lead with extracted email and move to Stage 1
          const updateData: any = {
            automation_stage: 1,
            automation_stage_updated_at: new Date().toISOString(),
            automation_error: null, // Clear any previous errors
          };

          if (extractedEmail) {
            updateData.email = extractedEmail;
          }

          await supabaseAdmin
            .from('leads')
            .update(updateData)
            .eq('id', lead.id);

          // Log activity
          await logLeadActivity(lead.id, {
            action: 'automation_stage_change',
            source: 'automation',
            details: {
              fromStage: 0,
              toStage: 1,
              description: 'Website scraped',
              emailExtracted: extractedEmail || null,
            },
          });

          console.log(`✅ ${lead.name} moved to Stage 1 (scraped)`);
          results.stage0Processed++;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to scrape ${lead.name}:`, errorMessage);
          
          // Mark lead as failed (stage -1) with error message
          await supabaseAdmin
            .from('leads')
            .update({
              automation_stage: -1,
              automation_error: `Scraping failed: ${errorMessage}`,
              automation_stage_updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id);

          // Log scraping failure
          await logLeadActivity(lead.id, {
            action: 'automation_error',
            source: 'automation',
            details: {
              stage: 0,
              error: `Scraping failed: ${errorMessage}`,
            },
          });

          results.errors.push(`${lead.name}: ${errorMessage}`);
        }
      }
    }

    // ========================================
    // STAGE 1 -> 2: AI Analysis
    // ========================================
    
    // Find all Stage 1 leads (updated at least 1 minute ago)
    const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
    
    const { data: stage1Leads, error: stage1Error } = await supabaseAdmin
      .from('leads')
      .select('id, name, website, instagram, facebook')
      .eq('automation_stage', 1)
      .lte('automation_stage_updated_at', oneMinuteAgo)
      .limit(10); // Process max 10 at a time

    if (stage1Error) {
      console.error('❌ Error fetching Stage 1 leads:', stage1Error);
      results.errors.push(`Stage 1 query error: ${stage1Error.message}`);
    } else if (stage1Leads && stage1Leads.length > 0) {
      console.log(`📊 Found ${stage1Leads.length} Stage 1 leads ready for AI analysis`);

      // Process each lead
      for (const lead of stage1Leads) {
        try {
          console.log(`🧠 Running AI analysis for ${lead.name}...`);
          
          // Call the AI analysis API
          const analysisResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/leads/${lead.id}/run-analysis`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });

          if (!analysisResponse.ok) {
            throw new Error(`AI analysis failed: ${analysisResponse.statusText}`);
          }

          // Move to Stage 2
          await supabaseAdmin
            .from('leads')
            .update({
              automation_stage: 2,
              automation_stage_updated_at: new Date().toISOString(),
              automation_error: null, // Clear any previous errors
            })
            .eq('id', lead.id);

          // Log activity
          await logLeadActivity(lead.id, {
            action: 'automation_stage_change',
            source: 'ai_agent',
            details: {
              fromStage: 1,
              toStage: 2,
              description: 'AI analysis completed',
            },
          });

          console.log(`✅ ${lead.name} moved to Stage 2 (analyzed)`);
          results.stage1Processed++;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed to analyze ${lead.name}:`, errorMessage);
          
          // Mark lead as failed (stage -1) with error message
          await supabaseAdmin
            .from('leads')
            .update({
              automation_stage: -1,
              automation_error: `AI analysis failed: ${errorMessage}`,
              automation_stage_updated_at: new Date().toISOString(),
            })
            .eq('id', lead.id);

          // Log AI analysis failure
          await logLeadActivity(lead.id, {
            action: 'automation_error',
            source: 'ai_agent',
            details: {
              stage: 1,
              error: `AI analysis failed: ${errorMessage}`,
            },
          });

          results.errors.push(`${lead.name}: ${errorMessage}`);
        }
      }
    }

    console.log('🤖 Automation check complete:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });

  } catch (error) {
    console.error('❌ Automation process error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
