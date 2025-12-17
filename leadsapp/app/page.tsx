/**
 * LeadsApp Dashboard - REFACTORED VERSION
 * Main application page with modular components
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Users, Brain, Database, MapPin, Globe, FileText, TrendingUp, Shield, Plus, Search, Settings, ChevronDown, Mail, Clock } from 'lucide-react';
import { NewAnalysisForm } from '@/components/forms/NewAnalysisForm';
import { CRMTable } from '@/components/tables/CRMTable';
import { GooglePlacesSearch } from '@/components/places/GooglePlacesSearch';
import { DemoGenerator } from '@/components/demo/DemoGenerator';
import { WebsiteScraper } from '@/components/scraper/WebsiteScraper';
import { FollowupPipeline } from '@/components/gmail/FollowupPipeline';
import { useAutomation } from '@/lib/hooks/useAutomation';
import { BlacklistManager } from '@/components/BlacklistManager';
import { GmailSync } from '@/components/gmail/GmailSync';

type Tab = 'crm' | 'pipeline' | 'new-analysis' | 'google-places' | 'demo-generator' | 'website-scraper' | 'blacklist' | 'gmail-settings';

// Dropdown Menu Component
function DropdownMenu({ 
  label, 
  icon: Icon, 
  items, 
  currentTab, 
  onSelect 
}: { 
  label: string;
  icon: React.ElementType;
  items: { id: Tab; label: string; icon: React.ElementType }[];
  currentTab: Tab;
  onSelect: (tab: Tab) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  
  const isActive = items.some(item => item.id === currentTab);
  
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px] z-50">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                currentTab === item.id
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
            
            {/* Tab Navigation - Simplified */}
            <nav className="flex items-center gap-2">
              {/* Main Tabs */}
              <button
                onClick={() => setCurrentTab('crm')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentTab === 'crm'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4" />
                CRM
              </button>
              
              {/* Pipeline Dropdown */}
              <div className="relative group">
                <button
                  onClick={() => setCurrentTab('pipeline')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    currentTab === 'pipeline'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  Pipeline
                  <ChevronDown className="w-3 h-3" />
                </button>
                <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 min-w-[180px] z-50 hidden group-hover:block">
                  <button
                    onClick={() => setCurrentTab('pipeline')}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                      currentTab === 'pipeline'
                        ? 'bg-indigo-50 text-indigo-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Follow-up Pipeline
                  </button>

                </div>
              </div>
              
              {/* Find Leads Dropdown */}
              <DropdownMenu
                label="Find Leads"
                icon={Search}
                currentTab={currentTab}
                onSelect={setCurrentTab}
                items={[
                  { id: 'google-places', label: 'Google Places', icon: MapPin },
                  { id: 'website-scraper', label: 'Website Scraper', icon: FileText },
                ]}
              />
              
              {/* Tools Dropdown */}
              <DropdownMenu
                label="Tools"
                icon={Settings}
                currentTab={currentTab}
                onSelect={setCurrentTab}
                items={[
                  { id: 'gmail-settings', label: 'Gmail Settings', icon: Mail },
                  { id: 'demo-generator', label: 'Demo Generator', icon: Globe },
                  { id: 'blacklist', label: 'Domain Blacklist', icon: Shield },
                ]}
              />
              
              {/* Divider */}
              <div className="w-px h-8 bg-slate-200 mx-2" />
              
              {/* New Lead Button - Primary Action */}
              <button
                onClick={() => setCurrentTab('new-analysis')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentTab === 'new-analysis'
                    ? 'bg-green-600 text-white'
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                <Plus className="w-4 h-4" />
                New Lead
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {currentTab === 'crm' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Lead Management</h1>
              <p className="text-slate-600 mt-2">
                View, filter, and manage all your leads in one place
              </p>
            </div>
            
            {/* CRM Table */}
            <CRMTable />
          </div>
        )}

        {currentTab === 'pipeline' && (
          <FollowupPipeline />
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
              // Alert is shown by the component itself
              console.log(`${count} leads created`);
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

        {currentTab === 'blacklist' && (
          <BlacklistManager />
        )}

        {currentTab === 'gmail-settings' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Gmail Settings</h1>
              <p className="text-slate-600 mt-2">
                Connect your Gmail account to sync emails and automate follow-ups
              </p>
            </div>
            <GmailSync />
          </div>
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
