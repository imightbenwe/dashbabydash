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

          // Remove unwanted elements - expanded to include navigation, menus, and other boilerplate
          $('script, style, nav, footer, iframe, noscript, header, .nav, .navigation, .menu, .header, .footer, .sidebar, [class*="nav"], [class*="menu"], [id*="nav"], [id*="menu"], [id*="header"], [id*="footer"]').remove();

          // Extract metadata
          const title = $('title').text().trim() || $('h1').first().text().trim();
          const description = $('meta[name="description"]').attr('content') || '';
          
          // Extract all headings (with deduplication)
          const headings: string[] = [];
          const seenHeadings = new Set<string>();
          $('h1, h2, h3, h4, .wsite-content-title, [class*="heading"], [class*="title"]').each((_, el) => {
            const text = $(el).text().trim();
            if (text && !seenHeadings.has(text.toLowerCase())) {
              headings.push(text);
              seenHeadings.add(text.toLowerCase());
            }
          });

          // Extract all paragraphs and content divs (with deduplication)
          const paragraphs: string[] = [];
          const seenParagraphs = new Set<string>();
          $('p, .paragraph, [class*="content"], [class*="description"], [class*="text"], article').each((_, el) => {
            const text = $(el).text().trim();
            // Skip very short paragraphs and duplicates
            if (text && text.length > 20 && !seenParagraphs.has(text.toLowerCase())) {
              paragraphs.push(text);
              seenParagraphs.add(text.toLowerCase());
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

          // Extract main content text - prioritize main content areas
          let contentText = '';
          
          // Try to find main content area first
          const mainContentSelectors = [
            'main',
            '[role="main"]',
            '#main',
            '#content',
            '#main-content',
            '.main-content',
            '.content',
            '#wsite-content',
            '.wsite-section-content',
            'article',
            '.post-content',
            '.entry-content'
          ];
          
          for (const selector of mainContentSelectors) {
            const mainContent = $(selector);
            if (mainContent.length > 0) {
              contentText = mainContent.text();
              break;
            }
          }
          
          // Fallback to body if no main content found
          if (!contentText) {
            contentText = $('body').text();
          }
          
          // Clean and normalize the text
          const bodyText = contentText
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\n+/g, '\n') // Normalize newlines
            .trim()
            .substring(0, 10000); // Increased limit to 10000 chars

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
