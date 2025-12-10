# Google Places Lead Scraper - Quick Reference

## What It Does

The Google Places tab allows you to:
- Search for businesses by keyword (e.g., "yoga studio", "dentist", "coffee shop")
- Filter by location (e.g., "New York", "San Francisco")
- Only see businesses that have websites
- Select multiple businesses and create leads in bulk
- Automatically populate lead data with business info

## Quick Setup

1. **Get API Key**: 
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Enable "Places API (New)"
   - Create an API key
   
2. **Add to .env.local**:
   ```
   GOOGLE_PLACES_API_KEY=your_api_key_here
   ```

3. **Restart Dev Server**:
   ```bash
   npm run dev
   ```

## Usage Example

### Search for Yoga Studios in Austin
1. Go to "Google Places" tab
2. Enter "yoga studio" in Business Type
3. Enter "Austin" in Location
4. Set max results to 20
5. Click "Search Places"

### Create Leads
1. Review the results
2. Check the boxes for businesses you want as leads
3. Click "Create X Leads"
4. Leads appear in CRM tab with status "new"

## What Data Gets Saved

Each lead includes:
- **Name**: Business name
- **Company**: Same as name
- **Website**: Business website URL
- **Status**: Set to "new"
- **Source**: Set to "google_places"
- **Notes**: Contains:
  - Full address
  - Phone number
  - Rating and review count
  - Google Maps link

## API Costs

- **Text Search Pro**: ~$0.032 per search
- **Free Credits**: $200 for new Google Cloud accounts
- **Monthly Estimate**: 
  - 20 searches/day ≈ $19/month
  - 100 searches/day ≈ $96/month

## Tips

✅ **Do**:
- Be specific with keywords ("yoga studio" not "yoga")
- Use location filters for targeted results
- Review business details before creating leads
- Use "Select All" for bulk imports

❌ **Don't**:
- Use vague keywords
- Create duplicate leads (check CRM first)
- Share your API key publicly
- Forget to set API restrictions

## Troubleshooting

**No results?**
- Try a more specific search
- Change or add a location
- Some niches have fewer businesses with websites

**API Error?**
- Check you enabled "Places API (New)" (not old version)
- Verify API key is in .env.local
- Restart dev server after adding key
- Check API key restrictions in Google Cloud Console

**Costs too high?**
- Reduce max results per search
- Be more targeted with searches
- Monitor usage in Google Cloud Console

## Full Documentation

See `GOOGLE_PLACES_SETUP.md` for complete setup instructions and details.
