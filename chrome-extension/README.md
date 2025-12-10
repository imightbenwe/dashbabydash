# PersonaAI Capture - Chrome Extension

Browser extension to automate prospect data capture from websites and Instagram profiles.

## Features

- **Website Data Extraction**: Automatically scrapes company name, email addresses, and content from any website
- **Instagram Profile Capture**: Extracts name, handle, and profile picture from Instagram profiles
- **Smart Lead Matching**: Combines data from website + Instagram into single lead
- **Side Panel UI**: Beautiful interface showing captured fields with checkboxes
- **One-Click Send**: Sends complete lead data directly to PersonaAI app
- **Persistent Storage**: Maintains lead data across tabs for 1 hour

## Installation

### 1. Generate Icons (Optional)

Open `icons/generate-icons.html` in your browser. It will automatically download 3 icon files:
- `icon16.png`
- `icon48.png`
- `icon128.png`

Move these files into the `chrome-extension/icons/` folder.

**OR** use placeholder icons by creating simple PNG files at those sizes.

### 2. Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder
5. Extension should now appear in your toolbar

### 3. Make Sure PersonaAI is Running

The extension sends data to `http://localhost:3000/api/analyze`, so make sure your Next.js app is running:

```bash
cd leadsapp
npm run dev
```

## Usage

### Capturing Website Data

1. Visit any website (e.g., a prospect's business site)
2. Click the PersonaAI extension icon to open the side panel
3. Click "Pull Data from Page"
4. Extension will extract:
   - Company/brand name
   - Email address (from contact pages, privacy policies, etc.)
   - Website URL
   - Page content for AI analysis

### Capturing Instagram Data

1. Visit an Instagram profile (e.g., `instagram.com/username`)
2. Open the PersonaAI side panel
3. Click "Pull Data from Page"
4. Extension will extract:
   - Profile name
   - Instagram handle (@username)
   - Profile picture URL

### Combining Website + Instagram

The extension automatically matches data from the same prospect:

1. Visit their website, click "Pull Data"
2. Visit their Instagram, click "Pull Data" again
3. Data merges into the same lead
4. Click "Send to PersonaAI" when ready

### Sending to PersonaAI

1. Once you've captured data (website, Instagram, or both)
2. Review the checkboxes - green checkmarks show captured fields
3. Click "Send to PersonaAI"
4. Lead is created in the app and opens automatically
5. Extension clears and is ready for next prospect

## Architecture

```
┌─────────────────┐
│   Webpage/IG    │
│   (Content)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  content.js     │  ← Extracts data from DOM
│  (Scraper)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  background.js  │  ← Manages lead state
│  (State)        │  ← Persists to storage
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  sidepanel.js   │  ← Displays UI
│  (UI + API)     │  ← Sends to PersonaAI
└─────────────────┘
```

## Files

- `manifest.json` - Extension configuration (Manifest v3)
- `background.js` - Service worker for state management
- `content.js` - Content script for data extraction
- `sidepanel.html` - Side panel UI
- `sidepanel.js` - Side panel logic and API integration
- `icons/` - Extension icons (16x16, 48x48, 128x128)

## Data Flow

1. **Extract**: content.js scrapes current page (website or Instagram)
2. **Store**: background.js receives data, merges with existing lead
3. **Display**: sidepanel.js shows captured fields as checkboxes
4. **Send**: POSTs to `/api/analyze` with all captured data
5. **Clear**: Resets for next prospect

## Permissions

- `activeTab` - Access current page content
- `storage` - Persist lead data locally
- `sidePanel` - Display side panel UI
- `host_permissions: ["<all_urls>"]` - Required for Instagram + all websites

## Development

### Testing Website Extraction

1. Visit any business website
2. Open DevTools Console
3. Check for "PersonaAI Capture content script loaded"
4. Click "Pull Data from Page"
5. Should see extracted company name, email, website URL

### Testing Instagram Extraction

1. Visit any Instagram profile
2. Open extension side panel
3. Click "Pull Data from Page"
4. Should capture name, handle (@username), profile pic

### Debugging

- Check background script logs: `chrome://extensions/` → "service worker"
- Check content script logs: DevTools Console on active page
- Check side panel logs: Right-click side panel → Inspect

## Troubleshooting

**"Could not access page" error**
- Refresh the webpage and try again
- Some pages block extensions (chrome://, edge://, etc.)

**Email not found**
- Not all websites have visible email addresses
- Try visiting the Contact or About page first

**Instagram data not extracting**
- Make sure you're on a profile page (not feed)
- Instagram may have changed their DOM structure

**Extension not appearing**
- Check `chrome://extensions/` for errors
- Make sure "Developer mode" is enabled
- Try reloading the extension

## Future Enhancements

- [ ] LinkedIn profile scraping
- [ ] Twitter/X profile scraping
- [ ] Automatic email finding (crawl contact pages)
- [ ] Lead scoring based on captured data
- [ ] Keyboard shortcuts (Ctrl+Shift+P to pull)
- [ ] Context menu integration (right-click → "Pull to PersonaAI")

## License

Internal tool for DashBabyDash project.
