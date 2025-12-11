/**
 * LeadsApp Dashboard - REFACTORED VERSION
 * Main application page with modular components
 */

'use client';

import { useState } from 'react';
import { Users, Brain, Database, MapPin, Globe, FileText } from 'lucide-react';
import { NewAnalysisForm } from '@/components/forms/NewAnalysisForm';
import { CRMTable } from '@/components/tables/CRMTable';
import { GooglePlacesSearch } from '@/components/places/GooglePlacesSearch';
import { DemoGenerator } from '@/components/demo/DemoGenerator';
import { WebsiteScraper } from '@/components/scraper/WebsiteScraper';
import { useAutomation } from '@/lib/hooks/useAutomation';

type Tab = 'crm' | 'new-analysis' | 'google-places' | 'demo-generator' | 'website-scraper';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<Tab>('crm');
  
  // Enable automation polling - runs every minute
  useAutomation(true);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-slate-900">LeadsApp</h1>
            </div>
            
            {/* Tab Navigation */}
            <nav className="flex gap-2">
              {[
                { id: 'crm', label: 'CRM', icon: Users },
                { id: 'new-analysis', label: 'New Lead', icon: Brain },
                { id: 'google-places', label: 'Google Places', icon: MapPin },
                { id: 'demo-generator', label: 'Demos', icon: Globe },
                { id: 'website-scraper', label: 'Scraper', icon: FileText },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id as Tab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentTab === 'crm' && (
          <div>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-slate-900">Lead Management</h1>
              <p className="text-slate-600 mt-2">
                View, filter, and manage all your leads in one place
              </p>
            </div>
            <CRMTable />
          </div>
        )}

        {currentTab === 'new-analysis' && (
          <div>
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-slate-900">Create New Lead</h1>
              <p className="text-slate-600 mt-2">
                AI-powered lead analysis and personalized email generation
              </p>
            </div>
            <NewAnalysisForm />
          </div>
        )}

        {currentTab === 'google-places' && (
          <GooglePlacesSearch 
            onLeadsCreated={(count) => {
              alert(`${count} leads created successfully! Switch to CRM tab to view them.`);
            }}
          />
        )}

        {currentTab === 'demo-generator' && (
          <DemoGenerator 
            onSuccess={(result) => {
              console.log('Demo generated:', result);
            }}
          />
        )}

        {currentTab === 'website-scraper' && (
          <WebsiteScraper 
            onScraped={(content) => {
              console.log('Website scraped, content length:', content.length);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-600">
              <Database className="w-5 h-5" />
              <span className="text-sm font-medium">
                LeadsApp - AI-Powered Lead Management
              </span>
            </div>
            <div className="text-sm text-slate-500">
              Built with Next.js, Supabase, and OpenAI
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
