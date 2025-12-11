/**
 * DemoGenerator Component
 * Generate static HTML demo pages for clients
 */

'use client';

import { useState } from 'react';
import { Globe, CheckCircle } from 'lucide-react';
import { logger } from '@/lib/logger';

interface DemoGeneratorProps {
  onSuccess?: (result: { url: string; filePath: string; clientName: string }) => void;
}

export function DemoGenerator({ onSuccess }: DemoGeneratorProps) {
  const [demoHtml, setDemoHtml] = useState('');
  const [clientName, setClientName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; filePath: string; clientName: string } | null>(null);

  const handleGenerate = async () => {
    if (!demoHtml.trim() || !clientName.trim()) {
      setError('Please provide both HTML content and client name');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/demos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: demoHtml,
          clientName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate demo');
      }

      setResult(data);
      setDemoHtml('');
      setClientName('');
      onSuccess?.(data);
      logger.info('Demo generated successfully', { clientName: data.clientName });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate demo';
      setError(errorMessage);
      logger.error('Demo generation failed', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Generate Demo Page</h1>
        <p className="text-slate-500 mt-1">
          Create a static HTML demo page for a client. Paste complete HTML and give it a name.
        </p>
      </div>

      {/* Success Message */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-900 mb-2">Demo Generated Successfully!</h3>
              <div className="space-y-2">
                <p className="text-sm text-green-800">
                  <strong>Client:</strong> {result.clientName}
                </p>
                <p className="text-sm text-green-800">
                  <strong>File:</strong> <code className="bg-green-100 px-2 py-0.5 rounded">{result.filePath}</code>
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Globe className="w-4 h-4" />
                    View Demo
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.url);
                      alert('URL copied to clipboard!');
                    }}
                    className="text-sm text-green-700 hover:text-green-800 font-medium"
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            Client Name *
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="e.g., sarah-wellness, acme-corp"
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            Use lowercase with hyphens (e.g., "my-client-name"). This will be the folder name.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Complete HTML *
          </label>
          <textarea
            value={demoHtml}
            onChange={(e) => setDemoHtml(e.target.value)}
            placeholder="Paste complete HTML code here (including <!DOCTYPE html>, <html>, <head>, <body>, etc.)"
            rows={16}
            className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
          />
          <p className="text-xs text-slate-500 mt-1">
            Must be a complete, self-contained HTML document
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !demoHtml.trim() || !clientName.trim()}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Globe className="w-5 h-5" />
              Generate Demo
            </>
          )}
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-semibold text-blue-900 text-sm mb-2">How it works:</h3>
        <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
          <li>Creates a new folder in <code>/demos/client-name/</code></li>
          <li>Saves HTML as <code>index.html</code> in that folder</li>
          <li>Demo is accessible at <code>dashbabydash.com/demos/client-name/</code></li>
          <li>Perfect for showing prospects their custom site before going live</li>
        </ul>
      </div>
    </div>
  );
}
