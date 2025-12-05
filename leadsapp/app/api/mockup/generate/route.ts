import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleGenAI } from '@google/genai';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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

    // 6. Create Gemini prompt with "Vibe Code" methodology
    const prompt = `Role:
You are an award-winning web designer and brand strategist. You specialize in taking raw social media data and transmuting it into high-end, "Vibe Coded" landing pages that feel expensive and deeply resonant.

Objective:
I will provide you with Instagram data (Profile info, Posts, Captions, Comments) and optional website scraping data.
You must analyze this data to infer the Brand Identity, Tone of Voice, and Audience Pain Points.
Then, generate a Single-File HTML "One-Page Site" (using Tailwind CSS) that acts as a "Vision Gift" for this specific creator.

# CLIENT DATA
Name: ${lead.name}
Company: ${lead.company || 'Not specified'}
Current Website: ${lead.website || 'None'}
Instagram: ${lead.instagram ? '@' + lead.instagram.replace('@', '') : 'Not available'}

# INSTAGRAM POSTS (their voice and style)
${instagramPosts.length > 0 ? JSON.stringify(instagramPosts.slice(0, 15), null, 2) : 'No Instagram data available'}

# AI PERSONALITY ANALYSIS (Deep insights about their brand)
${curatedData.aiAnalysis ? JSON.stringify(curatedData.aiAnalysis, null, 2) : 'No analysis available'}

# CURRENT WEBSITE DATA (if available)
${scrapedWebsites.length > 0 ? JSON.stringify(curatedData.currentWebsites, null, 2) : 'No current website scraped'}

---

Step 1: Analyze the Data (Do this internally)
1. Identify the Creator: Extract the First Name from the name field.
2. Identify the Niche: Analyze the Instagram captions and AI analysis. (e.g., "Manifestation", "Trauma Healing", "Business Coaching").
3. Identify the Vibe: Look at the emojis used 🌿✨🦋 and the tone (Gentle? Fiery? Academic?).
4. Color Palette: Infer a 4-color palette based on this vibe. (e.g., Earthy = Sage/Sand; Bold = Black/Electric Blue).
5. Extract the Hook: Read the Instagram captions. Find a specific story about a struggle or realization. Use this for the copy.
6. Extract Social Proof: Read the Instagram post captions and use them to craft testimonials that show deep resonance.
7. Identify Existing Offers (CRITICAL):
   - Scan captions and AI analysis for keywords: "Masterclass", "1:1", "Course", "Waitlist", "Program", "Retreat", "Book Now", "Session".
   - Extract the exact name of their current offer if found (e.g., "The Alignment Academy").

Step 2: Design Constraints (The "Vibe Code")
- Tech Stack: Single HTML file. Tailwind CSS via CDN. FontAwesome/HeroIcons via CDN.
- Navigation: Create a sticky "Glassmorphism" Navigation Bar with links: Home, About, [Offer Name], Contact.
- Typography: Google Fonts. Choose a pairing that matches the niche (e.g., 'Playfair Display' for spiritual, 'Montserrat' for business).
- Images:
  * DO NOT use Instagram post images as backgrounds (they are often vertical/low-res).
  * Use high-quality Pexels URLs with keywords matching the Niche (e.g., https://images.pexels.com/photos/[id]/pexels-photo-[id].jpeg).
  * Choose Pexels images that match: meditation, yoga, nature, wellness, spirituality, healing, etc.

Step 3: The Content Structure (HTML Output)
Build the page with these specific sections in order:

1. **Hero Section:**
   - Headline: A magnetic statement derived from their Niche (e.g., "Manifestation without the Panic").
   - Subheadline: "A digital sanctuary for [Target Audience] ready to [Desired Outcome]."
   - Call to Action: "Explore the Container" or similar spiritual/wellness CTA.

2. **The "Resonance" Section (The Hook):**
   - Use the "Struggle" analysis from Instagram captions.
   - "You've been feeling [Pain Point from Captions]..."
   - Validate their feelings based on the community engagement.

3. **About the Guide:**
   - Write a bio based on the "Story Arc" found in the captions.
   - "Hi, I'm [Name]. I help [Audience] move from [Struggle] to [Transformation]."

4. **The "Vision" Offer (Extract First, Refine Second):**
   - Priority A (Extract): If you found an existing offer in Step 1, highlight it. Use their exact language but elevate the presentation.
   - Priority B (Refine): If they mention "sessions" or vague offerings, package it attractively (e.g., "Private 1:1 Mentorship").
   - Priority C (Invent): ONLY if the data is completely void of any sales intent, create a placeholder "Signature Offer" relevant to their niche.

5. **Social Proof Cards:**
   - Create 3 elegant cards using insights from the Instagram engagement data.
   - Make them feel authentic and resonant (e.g., "This changed everything for me").

6. **Contact / Booking Section:**
   - A clean, inviting footer area inviting them to "Step into the Portal" or "Book a Discovery Call."
   - Include a contact form or CTA button.

7. **Footer:**
   - Simple, clean, with a "Built with Intention for ${lead.name}" tag.

TECHNICAL REQUIREMENTS:
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Use FontAwesome icons via CDN
- Add smooth scroll behavior
- Mobile responsive (mobile-first design)
- Use Google Fonts (serif for headings, sans-serif for body)
- Add subtle animations and transitions (use Tailwind's transition classes)
- Glassmorphism effects for nav bar (backdrop-blur, bg-opacity)
- Modern gradient backgrounds
- Professional color palette that matches their vibe

OUTPUT:
Return ONLY the complete, runnable HTML code starting with <!DOCTYPE html>. 
No explanations, no markdown code blocks, no commentary - just pure HTML that can be saved and opened in a browser immediately.`;

    // 7. Call Gemini
    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
    });

    const generatedHtml = result.text;

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
