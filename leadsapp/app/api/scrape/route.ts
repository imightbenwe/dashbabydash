import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        { error: 'Please provide an array of URLs to scrape' },
        { status: 400 }
      );
    }

    console.log(`🕷️ Scraping ${urls.length} website(s)...`);

    const scrapedData = await Promise.all(
      urls.map(async (url) => {
        try {
          // Fetch the webpage
          const response = await axios.get(url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
          });

          const html = response.data;
          const $ = cheerio.load(html);

          // Remove unwanted elements
          $('script, style, nav, footer, iframe, noscript').remove();

          // Extract metadata
          const title = $('title').text().trim() || $('h1').first().text().trim();
          const description = $('meta[name="description"]').attr('content') || '';
          
          // Extract all headings
          const headings: string[] = [];
          $('h1, h2, h3').each((_, el) => {
            const text = $(el).text().trim();
            if (text) headings.push(text);
          });

          // Extract all paragraphs
          const paragraphs: string[] = [];
          $('p').each((_, el) => {
            const text = $(el).text().trim();
            if (text && text.length > 20) { // Skip very short paragraphs
              paragraphs.push(text);
            }
          });

          // Extract images (just URLs)
          const images: string[] = [];
          $('img').each((_, el) => {
            const src = $(el).attr('src');
            if (src) {
              // Convert relative URLs to absolute
              const imgUrl = src.startsWith('http') ? src : new URL(src, url).href;
              images.push(imgUrl);
            }
          });

          // Extract main content text (clean)
          const bodyText = $('body').text()
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim()
            .substring(0, 5000); // Limit to first 5000 chars

          return {
            url,
            success: true,
            data: {
              title,
              description,
              headings: headings.slice(0, 20), // Top 20 headings
              paragraphs: paragraphs.slice(0, 15), // Top 15 paragraphs
              images: images.slice(0, 10), // Top 10 images
              bodyText,
              wordCount: bodyText.split(' ').length,
            },
          };
        } catch (error) {
          console.error(`Failed to scrape ${url}:`, error);
          return {
            url,
            success: false,
            error: error instanceof Error ? error.message : 'Failed to scrape',
          };
        }
      })
    );

    const successCount = scrapedData.filter(d => d.success).length;
    console.log(`✅ Successfully scraped ${successCount}/${urls.length} websites`);

    return NextResponse.json({
      success: true,
      results: scrapedData,
      summary: {
        total: urls.length,
        successful: successCount,
        failed: urls.length - successCount,
      },
    });
  } catch (error) {
    console.error('❌ Scrape API Error:', error);
    return NextResponse.json(
      { error: 'Failed to scrape websites', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
