import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  rawHtml: string; // Store raw HTML for image analysis
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

        const rawHtml = response.data; // Store raw HTML
        const $ = cheerio.load(rawHtml);

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
          rawHtml, // Include raw HTML
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

    // Step 2.5: Extract color scheme from CSS
    console.log(`🎨 Extracting color scheme...`);
    let colorScheme = '';
    try {
      const $ = cheerio.load(homepageResponse.data);
      const cssColors: string[] = [];
      
      // Extract colors from inline styles
      $('[style]').each((_, el) => {
        const style = $(el).attr('style') || '';
        const colorMatches = style.match(/#[0-9A-Fa-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/g);
        if (colorMatches) {
          cssColors.push(...colorMatches);
        }
      });
      
      // Extract colors from style tags
      $('style').each((_, el) => {
        const cssText = $(el).html() || '';
        const colorMatches = cssText.match(/#[0-9A-Fa-f]{3,6}|rgb\([^)]+\)|rgba\([^)]+\)/g);
        if (colorMatches) {
          cssColors.push(...colorMatches);
        }
      });
      
      // Get unique colors (limit to most common ones)
      const uniqueColors = [...new Set(cssColors)].slice(0, 10);
      colorScheme = uniqueColors.length > 0 ? uniqueColors.join(', ') : 'Unable to detect color scheme';
    } catch (err) {
      colorScheme = 'Error extracting color scheme';
    }

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

    // Step 4: Extract and analyze images with Gemini
    console.log(`🖼️ Analyzing images with Gemini...`);
    let imageAnalysis = '';
    
    try {
      // Extract all images from all pages
      const allImages: Array<{url: string, alt: string, context: string, pageTitle: string, pageUrl: string}> = [];
      
      for (const page of scrapedPages) {
        const $ = cheerio.load(page.rawHtml);
        
        $('img').each((_, el) => {
          const imgSrc = $(el).attr('src');
          const imgAlt = $(el).attr('alt') || '';
          
          if (imgSrc && !imgSrc.startsWith('data:')) {
            // Convert relative URLs to absolute
            let absoluteImgUrl = imgSrc;
            try {
              absoluteImgUrl = new URL(imgSrc, page.url).href;
            } catch (e) {
              // Already absolute or invalid
            }
            
            // Get context: parent element, nearby headings, surrounding text
            const parent = $(el).parent();
            const parentClass = parent.attr('class') || '';
            const parentId = parent.attr('id') || '';
            
            // Find nearest heading
            const nearestHeading = $(el).prevAll('h1, h2, h3, h4').first().text().trim() ||
                                   $(el).parent().prevAll('h1, h2, h3, h4').first().text().trim() ||
                                   $(el).closest('section').find('h1, h2, h3, h4').first().text().trim();
            
            // Get surrounding text
            const surroundingText = parent.text().trim().substring(0, 200);
            
            // Get HTML dimensions if available
            const width = $(el).attr('width') || $(el).css('width') || '';
            const height = $(el).attr('height') || $(el).css('height') || '';
            const dimensions = (width && height) ? `${width}x${height}` : '';
            
            const context = `
              Nearest heading: "${nearestHeading}"
              Parent element: ${parent.prop('tagName')} (class: "${parentClass}", id: "${parentId}")
              Surrounding text: "${surroundingText}"
              ${dimensions ? `Dimensions: ${dimensions}` : ''}
            `.trim();
            
            allImages.push({
              url: absoluteImgUrl,
              alt: imgAlt,
              context,
              pageTitle: page.title,
              pageUrl: page.url,
            });
          }
        });
      }
      
      if (allImages.length > 0) {
        // Prepare Gemini prompt
        const imagePrompt = `You are analyzing images from a website based on their HTML context (NOT visual analysis).

Website: ${url}
Total images found: ${allImages.length}

For each image below, determine:
1. What the image likely represents (hero image, product photo, team member, logo, icon, decoration, etc.)
2. Which section/purpose of the website it belongs to (header, about section, products, team, footer, etc.)
3. How important/relevant it is to understanding the website's content

Base your analysis ONLY on:
- The image filename/URL
- The alt text
- The surrounding HTML context (headings, parent elements, nearby text)
- The page it appears on

Format your response as a simple list:
[Image URL] - [What it represents] - [Section/Purpose] - [Relevance: High/Medium/Low]

Here are the images:

${allImages.map((img, idx) => `
Image ${idx + 1}:
URL: ${img.url}
Alt text: "${img.alt}"
Page: ${img.pageTitle} (${img.pageUrl})
Context: ${img.context}
---
`).join('\n')}

Provide concise, practical descriptions for each image.`;

        const result = await genai.models.generateContent({
          model: 'gemini-2.0-flash-exp',
          contents: imagePrompt,
        });
        
        imageAnalysis = result.text;
        console.log(`✅ Image analysis complete! Analyzed ${allImages.length} images`);
      } else {
        imageAnalysis = 'No images found on the scraped pages.';
      }
    } catch (err) {
      console.error('Failed to analyze images:', err);
      imageAnalysis = `Error analyzing images: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }

    // Step 5: Combine all content into a single text file
    let combinedContent = `Website Scrape Report\n`;
    combinedContent += `Source: ${url}\n`;
    combinedContent += `Date: ${new Date().toLocaleString()}\n`;
    combinedContent += `Pages Scraped: ${scrapedPages.length}\n`;
    combinedContent += `\nPrimary Color Scheme: ${colorScheme}\n`;
    combinedContent += `\n${'='.repeat(80)}\n\n`;

    for (const page of scrapedPages) {
      combinedContent += `\n\n${'='.repeat(80)}\n`;
      combinedContent += `PAGE: ${page.title}\n`;
      combinedContent += `URL: ${page.url}\n`;
      combinedContent += `${'='.repeat(80)}\n\n`;
      combinedContent += page.content;
      combinedContent += `\n\n`;
    }

    // Add image analysis section
    combinedContent += `\n\n${'='.repeat(80)}\n`;
    combinedContent += `IMAGE ANALYSIS (AI-Generated)\n`;
    combinedContent += `${'='.repeat(80)}\n\n`;
    combinedContent += imageAnalysis;
    combinedContent += `\n\n`;

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
