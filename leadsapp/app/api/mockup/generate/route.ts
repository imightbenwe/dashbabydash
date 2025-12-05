import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleGenerativeAI } from '@google/genai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const { leadId, websiteUrls } = await request.json();

    if (!leadId) {
      return NextResponse.json({ error: 'Lead ID is required' }, { status: 400 });
    }

    console.log(`🎨 Generating website mockup for lead ${leadId}`);

    // 1. Fetch lead data from database
    const { data: lead, error: leadError } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // 2. Fetch Instagram data and AI analyses
    const { data: rawData } = await supabaseAdmin
      .from('raw_data_sources')
      .select('*')
      .eq('lead_id', leadId);

    const { data: analyses } = await supabaseAdmin
      .from('ai_analyses')
      .select('*')
      .eq('lead_id', leadId);

    // 3. Extract Instagram posts (captions only) to reduce token usage
    let instagramPosts: any[] = [];
    const igData = rawData?.find(d => d.source_type === 'instagram');
    if (igData?.raw_content) {
      try {
        const fullData = igData.raw_content;
        // Extract only post captions, timestamps, and like counts
        if (fullData.posts && Array.isArray(fullData.posts)) {
          instagramPosts = fullData.posts.slice(0, 20).map((post: any) => ({
            caption: post.caption || '',
            timestamp: post.timestamp || '',
            likes: post.likesCount || 0,
          }));
        }
      } catch (e) {
        console.error('Failed to parse Instagram data:', e);
      }
    }

    // 4. Scrape their current website(s) if provided
    let scrapedWebsites: any[] = [];
    if (websiteUrls && websiteUrls.length > 0) {
      console.log(`🕷️ Scraping ${websiteUrls.length} website(s)...`);
      const scrapeResponse = await fetch(`${request.nextUrl.origin}/api/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: websiteUrls }),
      });
      const scrapeData = await scrapeResponse.json();
      scrapedWebsites = scrapeData.results || [];
    }

    // 5. Build curated data for Gemini
    const curatedData = {
      lead: {
        name: lead.name,
        company: lead.company,
        website: lead.website,
      },
      instagramPosts: instagramPosts.length > 0 ? instagramPosts : null,
      aiAnalysis: analyses?.[0]?.analysis_result || null,
      currentWebsites: scrapedWebsites.filter(w => w.success).map(w => ({
        url: w.url,
        title: w.data.title,
        headings: w.data.headings,
        paragraphs: w.data.paragraphs.slice(0, 5), // Only first 5 paragraphs
      })),
    };

    console.log('📊 Curated data prepared, sending to Gemini...');

    // 6. Create Gemini prompt
    const prompt = `You are a world-class web designer specializing in beautiful, modern websites for spiritual coaches, yoga studios, and wellness professionals.

CREATE A COMPLETE, PRODUCTION-READY HTML WEBSITE based on the following data:

# CLIENT INFORMATION
Name: ${lead.name}
Company: ${lead.company || 'Not specified'}
Current Website: ${lead.website || 'None'}

# INSTAGRAM POSTS (their voice and style)
${instagramPosts.length > 0 ? JSON.stringify(instagramPosts.slice(0, 10), null, 2) : 'No Instagram data available'}

# AI PERSONALITY ANALYSIS
${curatedData.aiAnalysis ? JSON.stringify(curatedData.aiAnalysis, null, 2) : 'No analysis available'}

# CURRENT WEBSITE(S)
${scrapedWebsites.length > 0 ? JSON.stringify(curatedData.currentWebsites, null, 2) : 'No current website scraped'}

# YOUR TASK
Create a COMPLETE, modern, beautiful single-page HTML website that:

1. **Captures their essence** - Use their Instagram voice, personality, and vibe
2. **Improves on their current site** - If they have one, make it better. If not, create from scratch.
3. **Professional design** - Modern, clean, spiritual/wellness aesthetic
4. **Fully functional** - Include Tailwind CSS, smooth scrolling, animations
5. **Conversion-focused** - Clear CTAs, contact section, booking links

REQUIREMENTS:
- Use Tailwind CSS (CDN)
- Include FontAwesome icons
- Add smooth scroll behavior
- Use beautiful color palette (earth tones, calming colors)
- Include sections: Hero, About, Services/Offerings, Testimonials (make up 2-3 realistic ones), Contact
- Make it mobile responsive
- Use Google Fonts (serif for headings, sans-serif for body)
- Add subtle animations and transitions
- Include a navigation bar
- Make images use placeholder URLs from Pexels (yoga, meditation, nature themes)

OUTPUT:
Return ONLY the complete HTML code, starting with <!DOCTYPE html>. No explanations, no markdown code blocks, just pure HTML.`;

    // 7. Call Gemini
    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
    const result = await model.generateContent(prompt);

    const generatedHtml = result.response.text();

    // 8. Clean up the response (remove markdown code blocks if any)
    let cleanHtml = generatedHtml;
    if (cleanHtml.includes('```html')) {
      cleanHtml = cleanHtml.split('```html')[1].split('```')[0].trim();
    } else if (cleanHtml.includes('```')) {
      cleanHtml = cleanHtml.split('```')[1].trim();
    }

    // 9. Save to demos folder
    const safeName = lead.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const projectRoot = join(process.cwd(), '..');
    const demoDir = join(projectRoot, 'demos', safeName);

    await mkdir(demoDir, { recursive: true });
    const htmlFilePath = join(demoDir, 'index.html');
    await writeFile(htmlFilePath, cleanHtml, 'utf-8');

    const publicUrl = `https://dashbabydash.com/demos/${safeName}/`;
    const localUrl = `/demos/${safeName}/`;

    console.log(`✅ Website mockup generated and saved!`);
    console.log(`📄 File: ${htmlFilePath}`);
    console.log(`🌐 URL: ${publicUrl}`);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      localUrl,
      localPath: localUrl,
      filePath: htmlFilePath,
      message: `Website mockup created for ${lead.name}. Don't forget to commit and push to make it live!`,
    });
  } catch (error) {
    console.error('❌ Mockup generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate mockup', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
