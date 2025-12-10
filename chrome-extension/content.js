// Content script - runs on every page
// Extracts data from websites and Instagram

console.log('PersonaAI Capture content script loaded');

// Detect page type and extract relevant data
async function extractPageData() {
  const url = window.location.href;
  const hostname = window.location.hostname;

  // Instagram detection
  if (hostname.includes('instagram.com')) {
    return extractInstagramData();
  }

  // Regular website
  return await extractWebsiteData();
}

// Extract data from Instagram profile page
function extractInstagramData() {
  const data = {
    source: 'instagram',
    igHandle: null,
    name: null,
    profilePicUrl: null
  };

  try {
    // Get handle from URL
    const pathMatch = window.location.pathname.match(/^\/([^\/\?]+)/);
    if (pathMatch && pathMatch[1] && 
        !['explore', 'reels', 'direct', 'stories', 'p'].includes(pathMatch[1])) {
      data.igHandle = '@' + pathMatch[1];
    }

    // Try to get name from meta tags
    const nameMetaTag = document.querySelector('meta[property="og:title"]');
    if (nameMetaTag) {
      const nameContent = nameMetaTag.getAttribute('content');
      // Instagram format: "Name (@username) • Instagram photos and videos"
      const nameMatch = nameContent.match(/^([^(]+)/);
      if (nameMatch) {
        data.name = nameMatch[1].trim();
      }
    }

    // Try to get profile picture
    const profilePicImg = document.querySelector('img[alt*="profile picture"]') ||
                          document.querySelector('header img[alt]');
    if (profilePicImg) {
      data.profilePicUrl = profilePicImg.src;
    }

    console.log('Instagram data extracted:', data);
  } catch (e) {
    console.error('Error extracting Instagram data:', e);
  }

  return data;
}

// Extract data from regular website
async function extractWebsiteData() {
  const data = {
    source: 'website',
    website: window.location.origin,
    name: null,
    company: null,
    email: null,
    websiteData: null
  };

  try {
    // Extract company/brand name from title or meta
    const titleTag = document.querySelector('title');
    if (titleTag) {
      const titleText = titleTag.textContent.trim();
      // Often the title contains "Brand Name | Tagline" or "Brand Name - Page"
      const brandMatch = titleText.match(/^([^|\\-•]+)/);
      if (brandMatch) {
        data.company = brandMatch[1].trim();
      }
    }

    // Try to get name from about/team pages or author meta
    const authorMeta = document.querySelector('meta[name="author"]');
    if (authorMeta) {
      data.name = authorMeta.getAttribute('content');
    }

    // Search for email addresses in the page
    const pageText = document.body.innerText;
    const emailRegex = /[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}/g;
    const emails = pageText.match(emailRegex);
    if (emails && emails.length > 0) {
      // Filter out common spam emails and pick the first valid one
      const validEmail = emails.find(e => 
        !e.includes('example.com') && 
        !e.includes('yourdomain') &&
        !e.includes('yourname') &&
        !e.includes('noreply') &&
        !e.includes('donotreply')
      );
      if (validEmail) {
        data.email = validEmail;
      }
    }

    // Use deep scraper API for comprehensive website data
    try {
      console.log('Calling deep scraper for:', window.location.href);
      const scraperResponse = await fetch('http://localhost:3000/api/scraper/deep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: window.location.href,
          includeImages: false,
          includeColors: false
        })
      });

      if (scraperResponse.ok) {
        const scraperData = await scraperResponse.json();
        console.log('Deep scraper response:', scraperData);
        
        // Use scraped text content
        if (scraperData.allText) {
          data.websiteData = scraperData.allText;
        }
        
        // Extract email from scraped content if not found yet
        if (!data.email && scraperData.allText) {
          const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
          const emails = scraperData.allText.match(emailRegex);
          if (emails && emails.length > 0) {
            const validEmail = emails.find(e => 
              !e.includes('example.com') && 
              !e.includes('yourdomain') &&
              !e.includes('yourname') &&
              !e.includes('noreply') &&
              !e.includes('donotreply')
            );
            if (validEmail) {
              data.email = validEmail;
            }
          }
        }
      } else {
        console.warn('Deep scraper API failed, using basic extraction');
        // Fallback to basic extraction
        const clonedBody = document.body.cloneNode(true);
        clonedBody.querySelectorAll('script, style, nav, footer, header, .nav, .menu, .footer, .header').forEach(el => el.remove());
        
        const headings = Array.from(clonedBody.querySelectorAll('h1, h2, h3'))
          .map(h => h.textContent.trim())
          .filter(t => t.length > 0)
          .join('\n');
        
        const paragraphs = Array.from(clonedBody.querySelectorAll('p'))
          .map(p => p.textContent.trim())
          .filter(t => t.length > 20)
          .join('\n\n');

        data.websiteData = `${headings}\n\n${paragraphs}`.substring(0, 10000);
      }
    } catch (scraperError) {
      console.error('Error calling deep scraper:', scraperError);
      // Fallback to basic extraction
      const clonedBody = document.body.cloneNode(true);
      clonedBody.querySelectorAll('script, style, nav, footer, header, .nav, .menu, .footer, .header').forEach(el => el.remove());
      
      const headings = Array.from(clonedBody.querySelectorAll('h1, h2, h3'))
        .map(h => h.textContent.trim())
        .filter(t => t.length > 0)
        .join('\n');
      
      const paragraphs = Array.from(clonedBody.querySelectorAll('p'))
        .map(p => p.textContent.trim())
        .filter(t => t.length > 20)
        .join('\n\n');

      data.websiteData = `${headings}\n\n${paragraphs}`.substring(0, 10000);
    }

    console.log('Website data extracted:', data);
  } catch (e) {
    console.error('Error extracting website data:', e);
  }

  return data;
}

// Listen for pull command from side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PULL_FROM_PAGE') {
    console.log('Pulling data from current page...');
    
    // Handle async extraction
    (async () => {
      const data = await extractPageData();
      
      // Send to background script
      chrome.runtime.sendMessage({
        type: 'PULL_DATA',
        data: data
      }, (response) => {
        sendResponse(response);
      });
    })();

    return true; // Keep channel open for async response
  }
});
