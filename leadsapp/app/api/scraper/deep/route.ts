import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Simple cache for scraped content (1 hour TTL)
const scraperCache = new Map<string, { content: string; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface ScrapedPage {
  url: string;
  title: string;
  content: string;
  rawHtml: string;
}

// Parallel request limiter
async function pLimit<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  
  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
    });
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const { url, includeImages = false, includeColors = false } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Check cache first
    const cacheKey = `${url}_${includeImages}_${includeColors}`;
    const cached = scraperCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`✅ Returning cached result for ${url}`);
      return NextResponse.json({
        success: true,
        content: cached.content,
        cached: true,
      });
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
          timeout: 5000, // Reduced from 10s to 5s
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        });

        const rawHtml = response.data; // Store raw HTML
        const $ = cheerio.load(rawHtml);

        // Extract emails and phone numbers from raw HTML BEFORE removing elements
        const emailsInHtml: string[] = [];
        const phonesInHtml: string[] = [];
        const socialLinks: { instagram?: string; facebook?: string; linkedin?: string } = {};
        
        // Helper to clean and validate email
        const cleanEmail = (email: string): string | null => {
          if (!email) return null;
          // Remove any trailing text after common TLDs
          const cleaned = email.toLowerCase().trim()
            .replace(/(\.com|\.net|\.org|\.co|\.io|\.uk|\.edu|\.gov|\.biz|\.info|\.me|\.co\.uk).*$/i, '$1');
          // Validate email format
          const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(com|net|org|co|io|uk|edu|gov|biz|info|me|co\.uk)$/i;
          return emailPattern.test(cleaned) ? cleaned : null;
        };

        // Look for mailto: links
        $('a[href^="mailto:"]').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            const rawEmail = href.replace('mailto:', '').split('?')[0] || ''; // Remove query params
            const email = cleanEmail(rawEmail);
            if (email) emailsInHtml.push(email);
          }
        });
        
        // Look for tel: links
        $('a[href^="tel:"]').each((_, el) => {
          const href = $(el).attr('href');
          if (href) {
            const phone = href.replace('tel:', '');
            phonesInHtml.push(phone);
          }
        });

        // Extract social media links from href attributes
        $('a[href*="instagram.com"], a[href*="facebook.com"], a[href*="linkedin.com"]').each((_, el) => {
          const href = $(el).attr('href');
          if (!href) return;

          // Instagram
          if (href.includes('instagram.com')) {
            const match = href.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
            if (match && match[1] && !['explore', 'p', 'tv', 'reels', 'accounts', 'direct'].includes(match[1].toLowerCase())) {
              socialLinks.instagram = match[1];
            }
          }

          // Facebook
          if (href.includes('facebook.com')) {
            const match = href.match(/facebook\.com\/([a-zA-Z0-9._]+)/i);
            if (match && match[1] && !['pages', 'groups', 'events', 'sharer'].includes(match[1].toLowerCase())) {
              socialLinks.facebook = match[1];
            }
          }

          // LinkedIn
          if (href.includes('linkedin.com')) {
            const match = href.match(/linkedin\.com\/(in\/[a-zA-Z0-9._-]+|company\/[a-zA-Z0-9._-]+)/i);
            if (match && match[1]) {
              socialLinks.linkedin = match[1];
            }
          }
        });

        // Extract title first
        const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

        // Remove unwanted elements that don't contribute to main content
        $('script, style, noscript, iframe, svg, path, img').remove();

        // Get ALL visible text content from body
        // This captures content regardless of HTML structure (divs, spans, p, etc.)
        const bodyText = $('body').text()
          .replace(/\s+/g, ' ') // Normalize whitespace
          .trim();

        // Also get structured content for better formatting
        const headings = $('h1, h2, h3, h4, h5, h6').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 0);
        const paragraphs = $('p').map((_, el) => $(el).text().trim()).get().filter(p => p.length > 20);
        const lists = $('li').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 0);
        
        // Get text from common content containers (for Wix, Squarespace, etc.)
        const contentDivs = $('.wsite-section-content, .sqs-block-content, .content, article, main, [role="main"]')
          .map((_, el) => $(el).text().trim())
          .get()
          .filter(t => t.length > 50);

        // Add extracted emails and phones to content
        let contactInfo = '';
        if (emailsInHtml.length > 0) {
          contactInfo += `\n\nEMAILS FOUND: ${emailsInHtml.join(', ')}\n`;
        }
        if (phonesInHtml.length > 0) {
          contactInfo += `PHONES FOUND: ${phonesInHtml.join(', ')}\n`;
        }
        if (socialLinks.instagram) {
          contactInfo += `INSTAGRAM FOUND: ${socialLinks.instagram}\n`;
        }
        if (socialLinks.facebook) {
          contactInfo += `FACEBOOK FOUND: ${socialLinks.facebook}\n`;
        }
        if (socialLinks.linkedin) {
          contactInfo += `LINKEDIN FOUND: ${socialLinks.linkedin}\n`;
        }

        // Combine all content sources - prefer structured content if available, fall back to body text
        let mainContent = '';
        if (contentDivs.length > 0) {
          mainContent = contentDivs.join('\n\n');
        } else if (headings.length > 0 || paragraphs.length > 0) {
          mainContent = `${headings.join('\n')}\n\n${paragraphs.join('\n\n')}\n\n${lists.join('\n')}`;
        } else {
          mainContent = bodyText; // Fallback to all body text
        }

        const content = `${mainContent}${contactInfo}`.trim();

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

    // Helper function to normalize domain (remove www.)
    const normalizeDomain = (domain: string): string => {
      return domain.replace(/^www\./, '');
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

            // Only add if same domain and not already visited (normalize to ignore www.)
            if (normalizeDomain(linkUrl.hostname) === normalizeDomain(baseDomain) && !visitedUrls.has(absoluteUrl)) {
              // Filter out common non-content links
              const path = linkUrl.pathname.toLowerCase();
              const pathSegments = path.split('/').filter(Boolean);
              const firstSegment = pathSegments[0] || '';
              
              // Filter out Wix image transformation params and other junk
              const isImageParam = pathSegments.length === 1 && (
                firstSegment.startsWith('w_') ||
                firstSegment.startsWith('h_') ||
                firstSegment.startsWith('al_') ||
                firstSegment.startsWith('q_') ||
                firstSegment.startsWith('usm_') ||
                firstSegment.startsWith('enc_') ||
                firstSegment.includes('quality_') ||
                firstSegment.length < 3 // Skip very short paths
              );
              
              if (!path.includes('#') && 
                  !path.endsWith('.pdf') && 
                  !path.endsWith('.jpg') && 
                  !path.endsWith('.png') &&
                  !path.endsWith('.jpeg') &&
                  !path.endsWith('.gif') &&
                  !path.endsWith('.svg') &&
                  !path.endsWith('.css') &&
                  !path.endsWith('.js') &&
                  !path.includes('login') &&
                  !path.includes('signup') &&
                  !path.includes('cart') &&
                  !isImageParam &&
                  pathSegments.length > 0) { // Must have at least one path segment
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
      timeout: 5000, // Reduced from 10s to 5s
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

    // Step 2.1: Look for privacy policy page specifically (often contains email)
    const $ = cheerio.load(homepageResponse.data);
    const privacyPolicyLinks: string[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().toLowerCase();
      if (href && (
        text.includes('privacy') || 
        text.includes('terms') ||
        href.toLowerCase().includes('privacy') ||
        href.toLowerCase().includes('terms')
      )) {
        try {
          const absoluteUrl = new URL(href, url).href;
          const linkUrl = new URL(absoluteUrl);
          if (normalizeDomain(linkUrl.hostname) === normalizeDomain(baseDomain) && !visitedUrls.has(absoluteUrl)) {
            privacyPolicyLinks.push(absoluteUrl);
          }
        } catch (err) {
          // Invalid URL
        }
      }
    });
    console.log(`🔒 Found ${privacyPolicyLinks.length} privacy/terms pages to check for contact info`);

    // Step 2.5: Extract color scheme from CSS (optional)
    let colorScheme = '';
    if (includeColors) {
      console.log(`🎨 Extracting color scheme...`);
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
    }

    // Step 3: Scrape navigation links in parallel (limit 5 concurrent)
    const linksToScrape = navLinks.slice(0, 15); // Limit to 15 pages max
    console.log(`📄 Scraping ${linksToScrape.length} pages in parallel...`);
    
    const scrapeTasks = linksToScrape
      .filter(link => !visitedUrls.has(link))
      .map(link => async () => {
        visitedUrls.add(link);
        console.log(`📄 Scraping: ${link}`);
        return await scrapePage(link);
      });
    
    const scraped = await pLimit(scrapeTasks, 5); // Max 5 concurrent requests
    scraped.forEach(pageData => {
      if (pageData) scrapedPages.push(pageData);
    });

    // Step 3.5: Scrape privacy policy pages separately (for email extraction only)
    const privacyEmails: string[] = [];
    const privacyPhones: string[] = [];
    let privacyPolicyContent = '';
    
    for (const privacyUrl of privacyPolicyLinks.slice(0, 3)) { // Max 3 privacy pages
      try {
        console.log(`🔒 Checking privacy page for contact info: ${privacyUrl}`);
        const privacyResponse = await axios.get(privacyUrl, {
          timeout: 5000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        });
        const $priv = cheerio.load(privacyResponse.data);
        
        // Extract emails from mailto links AND link text
        $priv('a[href^="mailto:"]').each((_, el) => {
          const href = $priv(el).attr('href');
          const linkText = $priv(el).text().trim();
          
          if (href) {
            const email = href.replace('mailto:', '').split('?')[0];
            if (!privacyEmails.includes(email)) {
              privacyEmails.push(email);
            }
          }
          
          // Also check if the link text itself is an email (handles your exact case!)
          if (linkText && linkText.includes('@')) {
            const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
            const textEmails = linkText.match(emailRegex);
            if (textEmails) {
              textEmails.forEach(email => {
                if (!privacyEmails.includes(email)) {
                  privacyEmails.push(email);
                }
              });
            }
          }
        });
        
        // Extract phones from tel links
        $priv('a[href^="tel:"]').each((_, el) => {
          const href = $priv(el).attr('href');
          if (href) {
            const phone = href.replace('tel:', '');
            if (!privacyPhones.includes(phone)) {
              privacyPhones.push(phone);
            }
          }
        });

        // Also look for email patterns in text
        const privacyText = $priv('body').text();
        const emailMatches = privacyText.match(/\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g);
        if (emailMatches) {
          emailMatches.forEach(email => {
            if (!privacyEmails.includes(email) && 
                !email.includes('example.com') && 
                !email.includes('domain.com')) {
              privacyEmails.push(email);
            }
          });
        }
        
        // Store full privacy policy content separately
        const pageTitle = $priv('title').text() || $priv('h1').first().text() || 'Privacy/Terms Page';
        privacyPolicyContent += `\n\n${'='.repeat(80)}\n`;
        privacyPolicyContent += `${pageTitle}\n`;
        privacyPolicyContent += `URL: ${privacyUrl}\n`;
        privacyPolicyContent += `${'='.repeat(80)}\n\n`;
        privacyPolicyContent += privacyText;
      } catch (err) {
        console.error(`Failed to scrape privacy page ${privacyUrl}:`, err);
      }
    }

    if (privacyEmails.length > 0) {
      console.log(`📧 Found ${privacyEmails.length} emails in privacy/terms pages: ${privacyEmails.join(', ')}`);
    }

    // Step 4: Extract and analyze images with Gemini (optional)
    let imageAnalysis = '';
    
    if (includeImages) {
      console.log(`🖼️ Analyzing images with Gemini...`);
      
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
          
          imageAnalysis = result.text || 'No analysis available';
          console.log(`✅ Image analysis complete! Analyzed ${allImages.length} images`);
        } else {
          imageAnalysis = 'No images found on the scraped pages.';
        }
      } catch (err) {
        console.error('Failed to analyze images:', err);
        imageAnalysis = `Error analyzing images: ${err instanceof Error ? err.message : 'Unknown error'}`;
      }
    }

    // Step 5: Combine all content into a single text file
    let combinedContent = `Website Scrape Report\n`;
    combinedContent += `Source: ${url}\n`;
    combinedContent += `Date: ${new Date().toLocaleString()}\n`;
    combinedContent += `Pages Scraped: ${scrapedPages.length}\n`;
    if (includeColors && colorScheme) {
      combinedContent += `\nPrimary Color Scheme: ${colorScheme}\n`;
    }
    
    // Add contact info found in privacy/terms pages (but NOT the content itself)
    if (privacyEmails.length > 0 || privacyPhones.length > 0) {
      combinedContent += `\n${'='.repeat(80)}\n`;
      combinedContent += `CONTACT INFO FROM PRIVACY/TERMS PAGES\n`;
      combinedContent += `${'='.repeat(80)}\n`;
      if (privacyEmails.length > 0) {
        combinedContent += `Emails: ${privacyEmails.join(', ')}\n`;
      }
      if (privacyPhones.length > 0) {
        combinedContent += `Phones: ${privacyPhones.join(', ')}\n`;
      }
    }
    
    combinedContent += `\n${'='.repeat(80)}\n\n`;

    for (const page of scrapedPages) {
      combinedContent += `\n\n${'='.repeat(80)}\n`;
      combinedContent += `PAGE: ${page.title}\n`;
      combinedContent += `URL: ${page.url}\n`;
      combinedContent += `${'='.repeat(80)}\n\n`;
      combinedContent += page.content;
      combinedContent += `\n\n`;
    }

    // Add image analysis section if included
    if (includeImages && imageAnalysis) {
      combinedContent += `\n\n${'='.repeat(80)}\n`;
      combinedContent += `IMAGE ANALYSIS (AI-Generated)\n`;
      combinedContent += `${'='.repeat(80)}\n\n`;
      combinedContent += imageAnalysis;
      combinedContent += `\n\n`;
    }

    console.log(`✅ Scraping complete! ${scrapedPages.length} pages scraped`);

    // Cache the result
    scraperCache.set(cacheKey, {
      content: combinedContent,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      content: combinedContent,
      privacyPolicyContent: privacyPolicyContent || null,
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
