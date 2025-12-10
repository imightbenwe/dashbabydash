# Google Places API Setup Guide

This guide will help you set up the Google Places API for the lead scraper feature.

## Overview

The Google Places scraper allows you to search for businesses by keyword and location, filtering only those with websites. This is perfect for finding potential leads in specific industries or areas.

## Features

- **Keyword Search**: Search by business type (e.g., "yoga studio", "coffee shop", "dentist")
- **Location Filter**: Optionally specify a location (e.g., "New York", "Los Angeles")
- **Website Filter**: Only returns businesses that have a website URL
- **Bulk Lead Creation**: Select multiple businesses and create leads in one click
- **Rich Business Data**: Includes address, phone, ratings, reviews, and Google Maps links

## Setup Instructions

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top
3. Click "NEW PROJECT"
4. Give your project a name (e.g., "PersonaAI Lead Scraper")
5. Click "CREATE"

### 2. Enable the Places API (New)

1. In the Google Cloud Console, go to **APIs & Services > Library**
2. Search for "Places API (New)"
3. Click on "Places API (New)" (NOT the old "Places API")
4. Click the blue "ENABLE" button

⚠️ **Important**: Make sure you enable "Places API (New)" which is the current version. The old "Places API" is now legacy and won't work with this integration.

### 3. Create an API Key

1. Go to **APIs & Services > Credentials**
2. Click "CREATE CREDENTIALS" at the top
3. Select "API key"
4. Your new API key will be displayed
5. Click "RESTRICT KEY" (recommended for security)

### 4. Restrict Your API Key (Recommended)

For security, restrict your API key:

1. Under "Application restrictions":
   - For development: Choose "HTTP referrers" and add `http://localhost:3000/*`
   - For production: Add your domain (e.g., `https://yourdomain.com/*`)

2. Under "API restrictions":
   - Select "Restrict key"
   - Check only "Places API (New)"

3. Click "SAVE"

### 5. Add API Key to Your Environment

1. Copy your API key
2. Open `.env.local` in your project root
3. Add the line:
   ```
   GOOGLE_PLACES_API_KEY=your_api_key_here
   ```
4. Replace `your_api_key_here` with your actual API key
5. Restart your dev server

## Usage

### Basic Search

1. Go to the "Google Places" tab in the app
2. Enter a business type (e.g., "yoga studio")
3. Optionally enter a location (e.g., "San Francisco")
4. Set max results (5-20)
5. Click "Search Places"

### Creating Leads

1. After searching, check the businesses you want to add as leads
2. Click "Create X Leads" button
3. Leads will be created with status "new" and source "google_places"
4. View them in the CRM/Leads tab

## Pricing

Google Places API (New) uses a pay-as-you-go pricing model:

- **Text Search**: $32 per 1,000 requests (when requesting basic fields like name, address, website)
- **Place Details**: Additional cost if you need more detailed information

For this integration, we use the "Text Search Pro" SKU which includes:
- Business name
- Address
- Website URL
- Phone number
- Ratings
- Google Maps link

### Cost Estimation

- 20 searches per day = ~$0.64/day = ~$19/month
- 100 searches per day = ~$3.20/day = ~$96/month

**Free Tier**: Google Cloud offers $200 in free credits for new accounts, which you can use for testing.

## API Response Fields

Each place returned includes:

- `name` - Business name
- `address` - Full formatted address
- `website` - Website URL (required for results)
- `phone` - Phone number (if available)
- `rating` - Average rating (0-5)
- `userRatingCount` - Number of reviews
- `googleMapsUri` - Google Maps link
- `businessStatus` - Operating status (OPERATIONAL, etc.)

## Troubleshooting

### "API key not configured" error
- Make sure you added `GOOGLE_PLACES_API_KEY` to `.env.local`
- Restart your dev server after adding the key

### "Failed to fetch places" error
- Check that you enabled "Places API (New)" (not the old Places API)
- Verify your API key is correct
- Check that your API key restrictions allow localhost

### "No places found with websites" message
- Try a more specific search query
- Try a different location
- Some business types may not have many websites in certain areas

### API Key Security

⚠️ **Never commit your API key to version control**

The `.env.local` file is already in `.gitignore`, but be careful not to:
- Share your API key publicly
- Commit it to GitHub
- Expose it in client-side code

## Best Practices

1. **Be Specific**: Use specific keywords like "yoga studio" instead of just "yoga"
2. **Use Locations**: Adding a location helps narrow results to relevant businesses
3. **Batch Processing**: Use the select all feature to create multiple leads at once
4. **Review Data**: Check the business details before creating leads
5. **Monitor Usage**: Keep an eye on your API usage in Google Cloud Console

## Support

For API-specific issues, refer to:
- [Places API (New) Documentation](https://developers.google.com/maps/documentation/places/web-service/overview)
- [Google Maps Platform Support](https://developers.google.com/maps/support/)

For app-specific issues, check the main README.md file.
