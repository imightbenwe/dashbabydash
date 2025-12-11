/**
 * WebsiteScraper Component
 * Deep scrape websites for content and analysis
 */

'use client';

import { useState } from 'react';
import { Globe, Download } from 'lucide-react';
import { logger } from '@/lib/logger';

interface WebsiteScraperProps {
  onScraped?: (content: string) => void;
}

export function WebsiteScraper({ onScraped }: WebsiteScraperProps) {
  const [url, setUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scrapedContent, setScrapedContent] = useState('');

  const handleScrape = async () => {
    if (!url.trim()) {
      setError('Please provide a website URL');
      return;
    }

    setIsScraping(true);
    setError(null);
    setScrapedContent('');

    try {
      const response = await fetch('/api/scraper/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape website');
      }

      setScrapedContent(data.content);
      onScraped?.(data.content);
      logger.info('Website scraped successfully', { url });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to scrape website';
      setError(errorMessage);
      logger.error('Website scraping failed', err);
    } finally {
      setIsScraping(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([scrapedContent], { type: 'text/plain' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      a.download = `${domain}-scraped-${Date.now()}.txt`;
    } catch {
      a.download = `website-scraped-${Date.now()}.txt`;
    }
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(downloadUrl);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Website Scraper</h1>
        <p className="text-slate-500 mt-1">
          Extract content from any website for analysis or data collection.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Website URL *
          </label>
          <div className="flex gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
            <button
              onClick={handleScrape}
              disabled={isScraping || !url.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {isScraping ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Scraping...
                </>
              ) : (
                <>
                  <Globe className="w-5 h-5" />
                  Scrape
                </>
              )}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enter the full URL including https://
          </p>
        </div>

        {/* Results */}
        {scrapedContent && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Scraped Content</h3>
              <button
                onClick={handleDownload}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                {scrapedContent}
              </pre>
            </div>
            <div className="text-xs text-slate-500">
              {scrapedContent.length.toLocaleString()} characters scraped
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 text-sm mb-2">Features:</h3>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>Deep scrapes the entire website (home page + navigation links)</li>
          <li>Extracts text content from all pages</li>
          <li>Finds email addresses and phone numbers</li>
          <li>Identifies social media links</li>
          <li>Analyzes color scheme and branding</li>
          <li>Downloads content for offline analysis</li>
        </ul>
        <p className="text-xs text-blue-700 mt-3 font-medium">
          💡 Tip: Use scraped content to analyze a prospect's messaging and tone before outreach
        </p>
      </div>
    </div>
  );
}
