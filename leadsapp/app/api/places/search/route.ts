import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Simple cache for Google Places searches (24 hour TTL to save API costs)
const placesCache = new Map<string, { results: any; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Log search to file
async function logSearch(
  query: string, 
  location: string, 
  resultsCount: number, 
  cached: boolean,
  minReviews?: number,
  maxReviews?: number
) {
  try {
    const logPath = path.join(process.cwd(), 'GOOGLE_PLACES_SEARCH_LOG.md');
    const timestamp = new Date().toLocaleString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
    
    let reviewFilter = '';
    if (minReviews !== undefined || maxReviews !== undefined) {
      const min = minReviews ?? 0;
      const max = maxReviews ?? '∞';
      reviewFilter = ` | Reviews: ${min}-${max}`;
    }
    
    const logEntry = `**${timestamp}** | Query: "${query}" | Location: "${location || 'N/A'}"${reviewFilter} | Results: ${resultsCount} | ${cached ? '(CACHED)' : 'API CALL'}\n`;
    
    await fs.appendFile(logPath, logEntry, 'utf8');
  } catch (error) {
    console.error('Failed to log search:', error);
    // Don't fail the request if logging fails
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, location, maxResults = 20, pageToken, minReviews = 0, maxReviews = 10000 } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Google Places API key not configured' },
        { status: 500 }
      );
    }

    // Build the text query
    let textQuery = query;
    if (location) {
      textQuery = `${query} in ${location}`;
    }

    // Check cache first to avoid duplicate API calls ($$$)
    // Don't cache if using pageToken (pagination requests)
    const cacheKey = `${textQuery}_${maxResults}`;
    if (!pageToken) {
      const cached = placesCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`✅ Returning cached Google Places results for: ${textQuery}`);
        
        // Log the cached search
        await logSearch(query, location || '', cached.results.length, true, minReviews, maxReviews);
        
        return NextResponse.json({
          places: cached.results,
          cached: true,
          cacheAge: Math.round((Date.now() - cached.timestamp) / 1000 / 60), // minutes
        });
      }
    }

    console.log(`🔍 Fetching fresh Google Places results for: ${textQuery}${pageToken ? ' (page ' + pageToken + ')' : ''}`);

    // Call Google Places API (New) - Text Search
    const requestBody: any = {
      textQuery,
      pageSize: Math.min(maxResults, 20), // API max is 20 per page
      languageCode: 'en'
    };
    
    // Add pageToken if provided for pagination
    if (pageToken) {
      requestBody.pageToken = pageToken;
    }
    
    const placesResponse = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.rating,places.userRatingCount,places.businessStatus,places.types,places.googleMapsUri,nextPageToken'
      },
      body: JSON.stringify(requestBody)
    });

    if (!placesResponse.ok) {
      const errorText = await placesResponse.text();
      console.error('Google Places API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch places from Google API' },
        { status: placesResponse.status }
      );
    }

    const data = await placesResponse.json();
    
    console.log('Google Places API Response:', {
      placesCount: data.places?.length || 0,
      hasNextPageToken: !!data.nextPageToken,
      nextPageToken: data.nextPageToken
    });
    
    // Filter results to only include places with websites AND within review count range
    const placesWithWebsites = (data.places || [])
      .filter((place: any) => {
        const hasWebsite = !!place.websiteUri;
        const reviewCount = place.userRatingCount || 0;
        const withinReviewRange = reviewCount >= minReviews && reviewCount <= maxReviews;
        return hasWebsite && withinReviewRange;
      })
      .map((place: any) => ({
        id: place.id,
        displayName: place.displayName,
        name: place.displayName?.text || 'Unknown',
        formattedAddress: place.formattedAddress || '',
        websiteUri: place.websiteUri || '',
        nationalPhoneNumber: place.nationalPhoneNumber || place.internationalPhoneNumber || '',
        rating: place.rating || 0,
        userRatingCount: place.userRatingCount || 0,
        businessStatus: place.businessStatus || 'OPERATIONAL',
        types: place.types || [],
        googleMapsUri: place.googleMapsUri || ''
      }));

    // Cache the results to avoid duplicate API calls (only cache first page)
    if (!pageToken) {
      placesCache.set(cacheKey, {
        results: placesWithWebsites,
        timestamp: Date.now()
      });
      console.log(`💾 Cached ${placesWithWebsites.length} results for: ${textQuery}`);
    }

    // Log the search
    await logSearch(query, location || '', placesWithWebsites.length, false, minReviews, maxReviews);

    return NextResponse.json({
      success: true,
      places: placesWithWebsites,
      totalFound: placesWithWebsites.length,
      query: textQuery,
      cached: false,
      nextPageToken: data.nextPageToken || null
    });

  } catch (error: any) {
    console.error('Places search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search places' },
      { status: 500 }
    );
  }
}
