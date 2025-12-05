'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Plus, Users, Mail, ArrowLeft, CheckCircle, Upload, Globe, FolderOpen, FileText, AtSign, Database, Sparkles, Filter, Clock, MessageSquare, Fingerprint, Check, Menu, Calendar } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState('new-analysis');
  const [leads, setLeads] = useState<any[]>([]);
  const [prospectName, setProspectName] = useState('');
  const [company, setCompany] = useState('');
  const [websiteData, setWebsiteData] = useState('');
  const [igFile, setIgFile] = useState<File | null>(null);
  const [substackFile, setSubstackFile] = useState<File | null>(null);
  const [threadsFile, setThreadsFile] = useState<File | null>(null);
  const [otherFile, setOtherFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailTemplate, setEmailTemplate] = useState('');
  const [isRegeneratingEmail, setIsRegeneratingEmail] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Demo generator state
  const [demoHtml, setDemoHtml] = useState('');
  const [demoClientName, setDemoClientName] = useState('');
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [demoResult, setDemoResult] = useState<any>(null);

  // Website scraper state
  const [scraperUrl, setScraperUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapedContent, setScrapedContent] = useState<string>('');

  const runAnalysis = async () => {
    if (!prospectName.trim()) {
      setError('Please enter a prospect name');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('prospectName', prospectName);
      if (company) formData.append('company', company);
      if (websiteData) formData.append('websiteData', websiteData);
      if (igFile) formData.append('igFile', igFile);
      if (substackFile) formData.append('substackFile', substackFile);
      if (threadsFile) formData.append('threadsFile', threadsFile);
      if (otherFile) formData.append('otherFile', otherFile);

      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an error. Please check your API keys in .env.local and make sure the dev server is running.');
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      setAnalysisResults(data);
      setCurrentTab('results');
      
      // Refresh leads
      fetchLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze prospect');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/leads');
      const data = await response.json();
      if (response.ok) {
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    }
  };

  const saveToCRM = () => {
    setCurrentTab('crm');
    fetchLeads();
  };

  const deleteLeads = async () => {
    if (selectedLeads.size === 0) return;
    
    const confirmDelete = confirm(`Are you sure you want to delete ${selectedLeads.size} lead(s)? This action cannot be undone.`);
    if (!confirmDelete) return;

    try {
      const deletePromises = Array.from(selectedLeads).map(leadId =>
        fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      );
      
      await Promise.all(deletePromises);
      
      // Refresh leads
      fetchLeads();
      setSelectedLeads(new Set());
      setSelectAll(false);
      alert(`Successfully deleted ${selectedLeads.size} lead(s)`);
    } catch (err) {
      console.error('Failed to delete leads:', err);
      alert('Failed to delete leads. Please try again.');
    }
  };

  const regenerateEmail = async () => {
    if (!analysisResults?.leadId) return;
    
    setIsRegeneratingEmail(true);
    try {
      const response = await fetch('/api/emails/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: analysisResults.leadId,
          emailType: 'initial',
          template: emailTemplate || undefined,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setAnalysisResults({
          ...analysisResults,
          email: data.email,
        });
      }
    } catch (err) {
      console.error('Failed to regenerate email:', err);
    } finally {
      setIsRegeneratingEmail(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/user');
      if (response.ok) {
        const data = await response.json();
        setUserEmail(data.email);
      }
    } catch (err) {
      console.error('Failed to fetch user:', err);
    }
  };

  const generateDemo = async () => {
    if (!demoHtml.trim() || !demoClientName.trim()) {
      setError('Please provide both HTML content and client name');
      return;
    }

    setIsGeneratingDemo(true);
    setError(null);
    setDemoResult(null);

    try {
      const response = await fetch('/api/demos/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: demoHtml,
          clientName: demoClientName,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate demo');
      }

      setDemoResult(data);
      setDemoHtml('');
      setDemoClientName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate demo');
    } finally {
      setIsGeneratingDemo(false);
    }
  };

  const scrapeWebsite = async () => {
    if (!scraperUrl.trim()) {
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
        body: JSON.stringify({
          url: scraperUrl,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to scrape website');
      }

      setScrapedContent(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape website');
    } finally {
      setIsScraping(false);
    }
  };

  const downloadScrapedContent = () => {
    const blob = new Blob([scrapedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const domain = new URL(scraperUrl).hostname.replace('www.', '');
    a.download = `${domain}-scraped-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Fetch leads when CRM tab is opened
  useEffect(() => {
    if (currentTab === 'crm') {
      fetchLeads();
    }
  }, [currentTab]);

  // Fetch current user on mount
  useEffect(() => {
    fetchCurrentUser();
  }, []);

  return (
    <div className="bg-slate-50 text-slate-900 h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex-col hidden md:flex z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xl">
            <Brain className="w-6 h-6" />
            <span>PersonaAI</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <button 
            onClick={() => setCurrentTab('new-analysis')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              currentTab === 'new-analysis' || currentTab === 'results' 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Plus className="w-5 h-5" />
            New Analysis
          </button>
          <button 
            onClick={() => setCurrentTab('crm')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              currentTab === 'crm' 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Users className="w-5 h-5" />
            CRM / Leads
          </button>
          <button 
            onClick={() => setCurrentTab('templates')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              currentTab === 'templates' 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Mail className="w-5 h-5" />
            Email Templates
          </button>
          <button 
            onClick={() => setCurrentTab('demos')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              currentTab === 'demos' 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Globe className="w-5 h-5" />
            Generate Demos
          </button>
          <button 
            onClick={() => setCurrentTab('scraper')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
              currentTab === 'scraper' 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <FileText className="w-5 h-5" />
            Website Scraper
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
              {userEmail ? userEmail[0].toUpperCase() : 'U'}
            </div>
            <div className="text-sm flex-1 min-w-0">
              <p className="font-medium truncate">{userEmail || 'Loading...'}</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <p className="text-xs text-slate-500">Logged in</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative min-w-0 overflow-hidden">
        <header className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-indigo-600 font-bold text-lg">
            <Brain className="w-6 h-6" />
            <span>PersonaAI</span>
          </div>
          <button className="text-slate-500 hover:text-slate-700">
            <Menu className="w-6 h-6" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          {/* New Analysis View */}
          {currentTab === 'new-analysis' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">New Prospect Analysis</h1>
                <p className="text-slate-500 mt-1">Feed data to generate a tone profile and draft emails.</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" /> Basic Info
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input 
                    type="text" 
                    placeholder="Prospect Name (e.g. Sarah Jones)" 
                    value={prospectName}
                    onChange={(e) => setProspectName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                  <input 
                    type="text" 
                    placeholder="Company / Brand Name" 
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <span className="text-pink-600">📷</span> Instagram Data
                    </h2>
                    <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                      <input 
                        type="file" 
                        accept=".json"
                        onChange={(e) => setIgFile(e.target.files?.[0] || null)}
                        className="hidden" 
                        id="ig-file"
                      />
                      <label htmlFor="ig-file" className="cursor-pointer block">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm font-medium text-slate-700">{igFile ? igFile.name : 'Drop last 100 Posts JSON'}</p>
                        <p className="text-xs text-slate-500 mt-1">or click to browse</p>
                      </label>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-500" /> Website Raw Data
                    </h2>
                    <textarea 
                      placeholder="Paste raw text scraped from their website here..." 
                      value={websiteData}
                      onChange={(e) => setWebsiteData(e.target.value)}
                      className="w-full h-32 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 text-sm resize-none"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm h-full flex flex-col">
                    <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-amber-500" /> Additional Sources
                    </h2>
                    
                    <div className="space-y-4 flex-1">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                          <FileText className="w-3 h-3" /> Substack Data
                        </label>
                        <input 
                          type="file" 
                          accept=".txt,.json"
                          onChange={(e) => setSubstackFile(e.target.files?.[0] || null)}
                          className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                          <AtSign className="w-3 h-3" /> Threads Data
                        </label>
                        <input 
                          type="file" 
                          accept=".txt,.json"
                          onChange={(e) => setThreadsFile(e.target.files?.[0] || null)}
                          className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                          <Database className="w-3 h-3" /> Other Data
                        </label>
                        <input 
                          type="file" 
                          accept=".txt,.json"
                          onChange={(e) => setOtherFile(e.target.files?.[0] || null)}
                          className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                        />
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                      <h3 className="text-indigo-900 font-semibold text-sm mb-1">Processing Pipeline</h3>
                      <ul className="text-xs text-indigo-700 space-y-2 list-disc list-inside">
                        <li>Merge All Uploaded Data</li>
                        <li>Analyze Tone & Story (LLM)</li>
                        <li>Extract Key Pain Points</li>
                        <li>Draft Personalized Email</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <div className="text-red-600 font-bold">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-red-900">Error</p>
                    <p className="text-xs text-red-700 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button 
                  onClick={runAnalysis}
                  disabled={isAnalyzing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-medium shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:bg-indigo-400"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Analyzing Data...
                    </>
                  ) : (
                    <>
                      <span>Run Deep Analysis</span>
                      <Sparkles className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Results View */}
          {currentTab === 'results' && (
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <button onClick={() => setCurrentTab('new-analysis')} className="text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="font-bold text-slate-900">{prospectName}</h2>
                    <p className="text-xs text-slate-500">Analysis Completed • Ready for Outreach</p>
                  </div>
                </div>
                <button 
                  onClick={saveToCRM}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Add to CRM
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="bg-indigo-50 p-4 border-b border-indigo-100">
                      <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                        <Fingerprint className="w-4 h-4" /> AI Persona Profile
                      </h3>
                    </div>
                    <div className="p-4 space-y-4">
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Tone of Voice</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {(analysisResults?.analyses?.openai?.toneKeywords || analysisResults?.analyses?.gemini?.toneKeywords || ['Authentic', 'Vulnerable', 'Educational']).map((keyword: string, idx: number) => (
                            <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100">{keyword}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Core Story Arc</span>
                        <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                          {analysisResults?.analyses?.openai?.storyArc || analysisResults?.analyses?.gemini?.storyArc || 'Overcoming corporate burnout to build a sustainable creator business. Focuses heavily on "slow growth" and mental health.'}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Key Triggers</span>
                        <ul className="mt-1 space-y-1">
                          {(analysisResults?.analyses?.openai?.keyTriggers || analysisResults?.analyses?.gemini?.keyTriggers || ['Time management struggles', 'Technical overwhelm']).map((trigger: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                              <Check className="w-3 h-3 mt-1 text-green-500" /> {trigger}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 shadow-sm">
                    <h3 className="font-bold text-amber-900 text-sm mb-3">Your Workflow</h3>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 text-sm text-amber-800 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"/>
                        <span>Build Gemini Website</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm text-amber-800 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"/>
                        <span>Create PDF w/ Screenshots</span>
                      </label>
                      <label className="flex items-center gap-3 text-sm text-amber-800 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"/>
                        <span>Review Email Draft</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-indigo-500" /> Cold Email Draft
                      </h3>
                      <button className="text-xs text-indigo-600 font-medium hover:underline">Copy to Clipboard</button>
                    </div>
                    <div className="p-6 bg-slate-50">
                      <div className="bg-white p-6 rounded shadow-sm border border-slate-200 font-mono text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                        {analysisResults?.email ? (
                          `Subject: ${analysisResults.email.subject}\n\n${analysisResults.email.body}`
                        ) : (
`Subject: Your recent posts about sustainable growth resonated...

Hi ${prospectName.split(' ')[0]},

I've been analyzing your content and your unique voice really stands out.

Best,
[Your Name]`
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 border-t border-slate-100 rounded-b-xl flex justify-end gap-2">
                      <button 
                        onClick={regenerateEmail}
                        disabled={isRegeneratingEmail}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded shadow-sm disabled:opacity-50"
                      >
                        {isRegeneratingEmail ? 'Regenerating...' : 'Regenerate'}
                      </button>
                      <button className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-sm">Send to Gmail</button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm opacity-75 hover:opacity-100 transition-opacity">
                    <div className="p-4 border-b border-slate-100">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500" /> Follow-up Draft (Day +3)
                      </h3>
                    </div>
                    <div className="p-6">
                      <p className="text-sm text-slate-600 leading-relaxed font-mono">
                        Hi {prospectName.split(' ')[0]},<br/><br/>
                        Just floating this to the top of your inbox. I know things can make weeks crazy.<br/><br/>
                        Did you get a chance to peek at the PDF? I think the &quot;Story&quot; section I mocked up really nails your vibe.<br/><br/>
                        Cheers,<br/>[Your Name]
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CRM View */}
          {currentTab === 'crm' && (
            <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl font-bold text-slate-900">Leads Pipeline</h1>
                  {selectedLeads.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">{selectedLeads.size} selected</span>
                      <button
                        onClick={deleteLeads}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Search leads..." className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"/>
                  <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2">
                    <Filter className="w-4 h-4" /> Filter
                  </button>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-4 w-12">
                        <input 
                          type="checkbox" 
                          checked={selectAll}
                          onChange={(e) => {
                            setSelectAll(e.target.checked);
                            if (e.target.checked) {
                              setSelectedLeads(new Set(leads.map(l => l.id)));
                            } else {
                              setSelectedLeads(new Set());
                            }
                          }}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                      </th>
                      <th className="px-6 py-4">Prospect</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Persona Score</th>
                      <th className="px-6 py-4">Date Created</th>
                      <th className="px-6 py-4">Date Contacted</th>
                      <th className="px-6 py-4">Last Touch</th>
                      <th className="px-6 py-4">Next Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leads.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                          No leads yet. Run an analysis to get started!
                        </td>
                      </tr>
                    ) : (
                      leads.map(lead => (
                        <tr 
                          key={lead.id} 
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={selectedLeads.has(lead.id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedLeads);
                                if (e.target.checked) {
                                  newSelected.add(lead.id);
                                } else {
                                  newSelected.delete(lead.id);
                                  setSelectAll(false);
                                }
                                setSelectedLeads(newSelected);
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                            />
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/lead/${lead.id}`)}>
                            <div className="flex items-center gap-3">
                              {lead.profile_picture ? (
                                <img 
                                  src={lead.profile_picture} 
                                  alt={lead.name}
                                  className="w-10 h-10 rounded-full object-cover border-2 border-slate-100"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm border-2 border-slate-100">
                                  {lead.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-slate-900">{lead.name}</div>
                                <div className="text-xs text-slate-500">{lead.company || 'No company'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/lead/${lead.id}`)}>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              lead.status === 'analysis_done' ? 'bg-blue-100 text-blue-800' :
                              lead.status === 'pdf_sent' ? 'bg-purple-100 text-purple-800' :
                              lead.status === 'site_live' ? 'bg-yellow-100 text-yellow-800' :
                              lead.status === 'follow_up_sent' ? 'bg-orange-100 text-orange-800' :
                              lead.status === 'closed_won' ? 'bg-green-100 text-green-800' :
                              lead.status === 'closed_lost' ? 'bg-red-100 text-red-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {lead.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </span>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/lead/${lead.id}`)}>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{width: lead.persona_score === 'high' ? '90%' : lead.persona_score === 'medium' ? '60%' : '30%'}}></div>
                              </div>
                              <span className="text-xs text-slate-500 capitalize">{lead.persona_score || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/lead/${lead.id}`)}>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Calendar className="w-3.5 h-3.5" />
                              {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                            </div>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/lead/${lead.id}`)}>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Calendar className="w-3.5 h-3.5" />
                              {lead.date_contacted ? new Date(lead.date_contacted).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/lead/${lead.id}`)}>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Calendar className="w-3.5 h-3.5" />
                              {lead.last_touch_date ? new Date(lead.last_touch_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/lead/${lead.id}`)}>
                            <span className="text-xs text-slate-500">
                              {lead.next_action || 'Review'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Templates View */}
          {currentTab === 'templates' && (
            <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Email Templates</h1>
                  <p className="text-slate-500 mt-1">Customize your default email template. Leave blank to use AI-generated default.</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500" /> Custom Email Template
                </h3>
                <p className="text-sm text-slate-600 mb-4">
                  Use placeholders: <code className="bg-slate-100 px-2 py-1 rounded text-xs">[Name]</code>, <code className="bg-slate-100 px-2 py-1 rounded text-xs">[Company]</code>, <code className="bg-slate-100 px-2 py-1 rounded text-xs">[StoryArc]</code>, <code className="bg-slate-100 px-2 py-1 rounded text-xs">[Tone]</code>
                </p>
                <textarea
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.target.value)}
                  placeholder="Hi [Name],\n\nI've been following your journey on [Platform]... especially your recent series on [StoryArc]...\n\nYour tone is [Tone], which really stands out.\n\nBest,\n[Your Name]"
                  className="w-full h-64 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-mono resize-none"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button 
                    onClick={() => setEmailTemplate('')}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg"
                  >
                    Clear Template
                  </button>
                  <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
                    Save Template
                  </button>
                </div>
              </div>

              <h2 className="text-lg font-bold text-slate-900 mb-4">Pre-built Templates</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-indigo-200 rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                      <Mail className="w-5 h-5" />
                    </div>
                    <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded font-medium">Proven Framework</span>
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">Initial Cold Email (20-50% Response Rate)</h3>
                  <p className="text-xs text-slate-600 mb-4">The proven framework that generates $15K/month</p>
                  <div className="bg-slate-50 p-4 rounded border border-slate-100 overflow-auto max-h-96">
                    <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{`Subject: I found you through [mutual connection]
OR
Subject: Your [specific achievement] is incredible

[FirstName], I've been a big fan of yours.

[2-3 SHORT sentences about their transformation/story]

You're a busy person so I'll just cut to the chase:

Right now, [specific website problem with data like ~7.8 second load time or ~48% bounce rate].

So we took your site and added:

1. A minimal layout that Google loves
   We did this for an agency in Queensland—leads went up 30%, closed a $4.2M project in 2 weeks.

2. Lead Qualification System
   80% of [their industry] I talk to don't want more leads, they want better leads.

3. Built-in SEO to rank higher on Google

4. After launch, we test and optimize based on data to maximize ROI.

To see the full website, check the PDF attached.

So what do you think? We can have it live within 72 hours.

[Your Name]

P.S. 67% of searches start on a phone. Your site is responsive on every device.`}</pre>
                  </div>
                </div>

                <div className="bg-white border border-purple-200 rounded-xl p-6 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                      <Clock className="w-5 h-5" />
                    </div>
                    <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded font-medium">Follow-up</span>
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">"Made Your Site Live" Follow-up</h3>
                  <p className="text-xs text-slate-600 mb-4">Sent 24-48 hours after initial. Closes 30-40% of non-responders.</p>
                  <div className="bg-slate-50 p-4 rounded border border-slate-100">
                    <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap">{`Subject: Made your site live

[FirstName], I know you've got a million things going on. Finding time for this is tough.

TBH, I was thinking about you over the weekend and got a little carried away. I was so convinced your work could look incredible that I went ahead and made your site live.

Here it is: [Live URL]

Let me know what you think.

[Your Name]`}</pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Demo Generator View */}
          {currentTab === 'demos' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Generate Static Demo Pages</h1>
                <p className="text-slate-500 mt-1">Paste HTML to create a public demo at dashbabydash.com/demos/</p>
              </div>

              {demoResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-900">Demo created successfully!</p>
                      <p className="text-sm text-green-700 mt-1">
                        Public URL: <a href={demoResult.url} target="_blank" rel="noopener noreferrer" className="underline font-mono">{demoResult.url}</a>
                      </p>
                      <p className="text-xs text-green-600 mt-1">Local path: {demoResult.localPath}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Client/Project Name
                  </label>
                  <input
                    type="text"
                    value={demoClientName}
                    onChange={(e) => setDemoClientName(e.target.value)}
                    placeholder="e.g., Toni, Yoga Studio, John Doe"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Will be used for folder name: demos/client-name/
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    HTML Content
                  </label>
                  <textarea
                    value={demoHtml}
                    onChange={(e) => setDemoHtml(e.target.value)}
                    placeholder="Paste complete HTML here..."
                    rows={20}
                    className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Paste the full HTML including &lt;!DOCTYPE html&gt; and all content
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <button
                  onClick={generateDemo}
                  disabled={isGeneratingDemo || !demoHtml.trim() || !demoClientName.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                  {isGeneratingDemo ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Globe className="w-5 h-5" />
                      Generate Static Demo
                    </>
                  )}
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
                <h3 className="font-semibold text-amber-900 text-sm mb-2">How it works:</h3>
                <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
                  <li>Creates a static HTML file in /demos/client-name/index.html</li>
                  <li>Publicly accessible at dashbabydash.com/demos/client-name/</li>
                  <li>Images can be hosted on Supabase or embedded in HTML</li>
                  <li>Perfect for showing prospects their custom demo sites</li>
                </ul>
              </div>
            </div>
          )}

          {/* Website Scraper View */}
          {currentTab === 'scraper' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-300">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Website Scraper</h1>
                <p className="text-slate-500 mt-1">Scrape homepage + follow header/footer links (one level deep)</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Website URL
                  </label>
                  <input
                    type="url"
                    value={scraperUrl}
                    onChange={(e) => setScraperUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter the homepage URL to scrape
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <button
                  onClick={scrapeWebsite}
                  disabled={isScraping || !scraperUrl.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                  {isScraping ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Scraping...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Scrape Website
                    </>
                  )}
                </button>

                {scrapedContent && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-slate-700">Scraped Content</h3>
                      <button
                        onClick={downloadScrapedContent}
                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                      >
                        <FolderOpen className="w-4 h-4" />
                        Download TXT
                      </button>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono">
                        {scrapedContent}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                <h3 className="font-semibold text-blue-900 text-sm mb-2">How it works:</h3>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>Scrapes the homepage and extracts all text content</li>
                  <li>Finds header and footer navigation links</li>
                  <li>Follows internal links (same domain) one level deep</li>
                  <li>Combines all content into a single TXT file</li>
                  <li>Perfect for analyzing competitor sites or gathering content</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
