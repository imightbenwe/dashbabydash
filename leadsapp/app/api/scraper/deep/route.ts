import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface ScrapedPage {
  url: string;
  title: string;
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`🕷️ Starting deep scrape of: ${url}`);

    const scrapedPages: ScrapedPage[] = [];
    const visitedUrls = new Set<string>();
    const baseUrl = new URL(url);
    const baseDomain = baseUrl.hostname;

    // Helper function to scrape a single page
    const scrapePage = async (pageUrl: string): Promise<ScrapedPage | null> => {
      try {
        const response = await axios.get(pageUrl, {
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        const $ = cheerio.load(response.data);

        // Remove unwanted elements
        $('script, style, nav, footer, header, .nav, .menu, .footer, .header, .sidebar').remove();

        // Extract title
        const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

        // Extract main content
        const headings = $('h1, h2, h3').map((_, el) => $(el).text().trim()).get().join('\n');
        const paragraphs = $('p').map((_, el) => $(el).text().trim()).get().filter(p => p.length > 20).join('\n\n');
        const lists = $('li').map((_, el) => $(el).text().trim()).get().join('\n');

        const content = `${headings}\n\n${paragraphs}\n\n${lists}`.trim();

        return {
          url: pageUrl,
          title,
          content,
        };
      } catch (err) {
        console.error(`Failed to scrape ${pageUrl}:`, err);
        return null;
      }
    };

    // Helper function to extract links from header and footer
    const extractNavLinks = (html: string): string[] => {
      const $ = cheerio.load(html);
      const links: string[] = [];

      // Find header and footer navigation links
      $('header a, nav a, footer a, .header a, .nav a, .menu a, .footer a').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          try {
            // Convert relative URLs to absolute
            const absoluteUrl = new URL(href, url).href;
            const linkUrl = new URL(absoluteUrl);

            // Only add if same domain and not already visited
            if (linkUrl.hostname === baseDomain && !visitedUrls.has(absoluteUrl)) {
              // Filter out common non-content links
              const path = linkUrl.pathname.toLowerCase();
              if (!path.includes('#') && 
                  !path.endsWith('.pdf') && 
                  !path.endsWith('.jpg') && 
                  !path.endsWith('.png') &&
                  !path.includes('login') &&
                  !path.includes('signup') &&
                  !path.includes('cart')) {
                links.push(absoluteUrl);
              }
            }
          } catch (err) {
            // Invalid URL, skip
          }
        }
      });

      return [...new Set(links)]; // Remove duplicates
    };

    // Step 1: Scrape the homepage
    console.log(`📄 Scraping homepage: ${url}`);
    const homepageResponse = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    visitedUrls.add(url);
    const homepageData = await scrapePage(url);
    if (homepageData) {
      scrapedPages.push(homepageData);
    }

    // Step 2: Extract navigation links from homepage
    const navLinks = extractNavLinks(homepageResponse.data);
    console.log(`🔗 Found ${navLinks.length} navigation links to scrape`);

    // Step 3: Scrape each navigation link (one level deep)
    for (const link of navLinks.slice(0, 15)) { // Limit to 15 pages max
      if (!visitedUrls.has(link)) {
        console.log(`📄 Scraping: ${link}`);
        visitedUrls.add(link);
        const pageData = await scrapePage(link);
        if (pageData) {
          scrapedPages.push(pageData);
        }
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Step 4: Combine all content into a single text file
    let combinedContent = `Website Scrape Report\n`;
    combinedContent += `Source: ${url}\n`;
    combinedContent += `Date: ${new Date().toLocaleString()}\n`;
    combinedContent += `Pages Scraped: ${scrapedPages.length}\n`;
    combinedContent += `\n${'='.repeat(80)}\n\n`;

    for (const page of scrapedPages) {
      combinedContent += `\n\n${'='.repeat(80)}\n`;
      combinedContent += `PAGE: ${page.title}\n`;
      combinedContent += `URL: ${page.url}\n`;
      combinedContent += `${'='.repeat(80)}\n\n`;
      combinedContent += page.content;
      combinedContent += `\n\n`;
    }

    console.log(`✅ Scraping complete! ${scrapedPages.length} pages scraped`);

    return NextResponse.json({
      success: true,
      content: combinedContent,
      pagesScraped: scrapedPages.length,
      urls: scrapedPages.map(p => p.url),
    });

  } catch (error) {
    console.error('Deep scraper error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scrape website' },
      { status: 500 }
    );
  }
}
