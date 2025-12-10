'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Plus, Users, Mail, ArrowLeft, CheckCircle, Upload, Globe, FolderOpen, FileText, AtSign, Database, Sparkles, Filter, Clock, MessageSquare, Fingerprint, Check, Menu, Calendar, X } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [currentTab, setCurrentTab] = useState('new-analysis');
  const [leads, setLeads] = useState<any[]>([]);
  const [prospectName, setProspectName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [igHandle, setIgHandle] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const [uploadedProfilePicUrl, setUploadedProfilePicUrl] = useState('');
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

  // Google Places scraper state
  const [placesQuery, setPlacesQuery] = useState('');
  const [placesLocation, setPlacesLocation] = useState('');
  const [placesMaxResults, setPlacesMaxResults] = useState(20);
  const [isSearchingPlaces, setIsSearchingPlaces] = useState(false);
  const [placesResults, setPlacesResults] = useState<any[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Set<string>>(new Set());
  const [isCreatingLeadsFromPlaces, setIsCreatingLeadsFromPlaces] = useState(false);
  const [placesSearchHistory, setPlacesSearchHistory] = useState<Array<{query: string, location: string, timestamp: number}>>([]);
  const [dismissedPlaces, setDismissedPlaces] = useState<Set<string>>(new Set());
  const [dismissedLeadsList, setDismissedLeadsList] = useState<any[]>([]);
  const [openLeadsList, setOpenLeadsList] = useState<any[]>([]);
  const [promotedLeadsList, setPromotedLeadsList] = useState<any[]>([]);
  const [existingPlaceIds, setExistingPlaceIds] = useState<Set<string>>(new Set());
  const [openPlaceIds, setOpenPlaceIds] = useState<Set<string>>(new Set());
  
  // Filters for Open tab
  const [openFilterQuery, setOpenFilterQuery] = useState('');
  const [openFilterDateFrom, setOpenFilterDateFrom] = useState('');
  const [openFilterDateTo, setOpenFilterDateTo] = useState('');
  
  const [showDismissDialog, setShowDismissDialog] = useState(false);
  const [placeToDissmiss, setPlaceToDissmiss] = useState<any>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [googlePlacesView, setGooglePlacesView] = useState<'search' | 'open' | 'dismissed' | 'promoted'>('search');
  const [currentCampaign, setCurrentCampaign] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [allFetchedPlaces, setAllFetchedPlaces] = useState<any[]>([]); // All places from all pages
  const [currentPage, setCurrentPage] = useState(1);

  // Load search history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('placesSearchHistory');
    if (savedHistory) {
      try {
        setPlacesSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse search history:', e);
      }
    }
  }, []);

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
      if (email) formData.append('email', email);
      if (igHandle) formData.append('igHandle', igHandle);
      if (websiteUrl) formData.append('websiteUrl', websiteUrl);
      if (uploadedProfilePicUrl) formData.append('profilePictureUrl', uploadedProfilePicUrl);
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
      
      // Clear form fields
      setProspectName('');
      setCompany('');
      setEmail('');
      setIgHandle('');
      setWebsiteUrl('');
      setProfilePictureUrl('');
      setUploadedProfilePicUrl('');
      setWebsiteData('');
      setIgFile(null);
      setSubstackFile(null);
      setThreadsFile(null);
      setOtherFile(null);
      
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

  const fetchCampaigns = async () => {
    if (!userEmail) return;
    
    try {
      const response = await fetch(`/api/campaigns?userId=${userEmail}`);
      const data = await response.json();
      if (response.ok) {
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
    }
  };

  const fetchDismissedLeads = async () => {
    if (!userEmail) return;
    
    try {
      const response = await fetch(`/api/dismissed?userId=${userEmail}`);
      const data = await response.json();
      if (response.ok) {
        const dismissedIds = new Set(data.dismissed.map((d: any) => d.place_id));
        setDismissedPlaces(dismissedIds);
        setDismissedLeadsList(data.dismissed);
      }
    } catch (err) {
      console.error('Failed to fetch dismissed leads:', err);
    }
  };

  const openDismissDialog = (place: any) => {
    setPlaceToDissmiss(place);
    setDismissReason('');
    setShowDismissDialog(true);
  };

  const dismissPlace = async () => {
    if (!userEmail || !placeToDissmiss) return;
    
    try {
      const response = await fetch('/api/dismissed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userEmail,
          campaignId: currentCampaign?.id,
          placeId: placeToDissmiss.id,
          placeName: placeToDissmiss.name,
          website: placeToDissmiss.website,
          address: placeToDissmiss.address,
          phone: placeToDissmiss.phone,
          reason: dismissReason.trim() || null,
        }),
      });

      if (response.ok) {
        setDismissedPlaces(new Set([...dismissedPlaces, placeToDissmiss.id]));
        // Remove from selected if it was selected
        const newSelected = new Set(selectedPlaces);
        newSelected.delete(placeToDissmiss.id);
        setSelectedPlaces(newSelected);
        // Refresh dismissed list
        fetchDismissedLeads();
        // Refresh open leads to remove dismissed item
        fetchOpenLeads();
        // Close dialog
        setShowDismissDialog(false);
        setPlaceToDissmiss(null);
        setDismissReason('');
      }
    } catch (err) {
      console.error('Failed to dismiss place:', err);
    }
  };

  const fetchOpenLeads = async () => {
    if (!userEmail) return;
    
    try {
      const response = await fetch(`/api/open?userId=${userEmail}`);
      const data = await response.json();
      if (response.ok) {
        setOpenLeadsList(data.openLeads);
      }
    } catch (err) {
      console.error('Failed to fetch open leads:', err);
    }
  };

  const fetchPromotedLeads = async () => {
    if (!userEmail) return;
    
    try {
      const response = await fetch(`/api/promoted?userId=${userEmail}`);
      const data = await response.json();
      if (response.ok) {
        setPromotedLeadsList(data.promoted);
      }
    } catch (err) {
      console.error('Failed to fetch promoted leads:', err);
    }
  };

  const fetchExistingPlaceIds = async () => {
    if (!userEmail) return;
    
    try {
      const response = await fetch(`/api/existing-places?userId=${userEmail}`);
      const data = await response.json();
      if (response.ok) {
        setExistingPlaceIds(new Set(data.existingPlaceIds));
        setOpenPlaceIds(new Set(data.openPlaceIds));
      }
    } catch (err) {
      console.error('Failed to fetch existing place IDs:', err);
    }
  };

  const saveSearchResultsToOpen = async (places: any[], query: string, location: string) => {
    if (!userEmail || places.length === 0) return;
    
    try {
      await fetch('/api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userEmail,
          campaignId: currentCampaign?.id,
          places: places,
          searchQuery: query,
          searchLocation: location,
        }),
      });
      // Refresh existing place IDs after saving
      await fetchExistingPlaceIds();
    } catch (err) {
      console.error('Failed to save to open leads:', err);
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
          regenerate: true, // Allow overwriting existing email
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

  const searchPlaces = async (loadMore = false) => {
    if (!placesQuery.trim()) {
      setError('Please enter a search query (e.g., "yoga studio", "coffee shop")');
      return;
    }

    setIsSearchingPlaces(true);
    setError(null);
    
    // Clear results IMMEDIATELY for new searches
    if (!loadMore) {
      setPlacesResults([]);
      setAllFetchedPlaces([]);
      setSelectedPlaces(new Set());
      setCurrentPage(1);
      setNextPageToken(null);
    }
    
    // Fetch existing place IDs before search
    if (!loadMore) {
      await fetchExistingPlaceIds();
    }

    try {
      const response = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: placesQuery,
          location: placesLocation,
          maxResults: placesMaxResults,
          pageToken: null, // Pagination disabled with duplicate filtering
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to search places');
      }

      let newPlaces = data.places || [];
      
      // Filter out places that already exist in Open, Dismissed, or Promoted
      const filteredNewPlaces = newPlaces.filter((place: any) => 
        !existingPlaceIds.has(place.id)
      );
      
      console.log('Search results:', {
        totalFromAPI: newPlaces.length,
        newPlaces: filteredNewPlaces.length,
        filtered: newPlaces.length - filteredNewPlaces.length,
        loadMore,
        nextPageToken: data.nextPageToken,
      });
      
      // Save ALL results to Open area (including ones we'll filter from display)
      if (newPlaces.length > 0) {
        await saveSearchResultsToOpen(newPlaces, placesQuery, placesLocation);
      }
      
      // But only display NEW results
      if (loadMore) {
        // Filter out duplicates by place ID before appending
        const existingIds = new Set(placesResults.map(p => p.id));
        const uniqueNewPlaces = filteredNewPlaces.filter((p: any) => !existingIds.has(p.id));
        
        setPlacesResults([...placesResults, ...uniqueNewPlaces]);
        setAllFetchedPlaces([...allFetchedPlaces, ...uniqueNewPlaces]);
        setCurrentPage(currentPage + 1);
      } else {
        setPlacesResults(filteredNewPlaces);
        setAllFetchedPlaces(filteredNewPlaces);
      }
      
      // Clear next page token since we don't support pagination with duplicate filtering
      setNextPageToken(null);
      
      if (data.cached) {
        console.log(`💰 Using cached results (${data.cacheAge} min old) - Saved API cost!`);
      }
      
      // Create or update campaign
      if (userEmail && newPlaces.length > 0) {
        const campaignResponse = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userEmail,
            searchQuery: placesQuery,
            location: placesLocation,
            totalFetched: newPlaces.length,
          }),
        });
        
        if (campaignResponse.ok) {
          const campaignData = await campaignResponse.json();
          setCurrentCampaign(campaignData.campaign);
        }
      }
      
      // Save to search history (only on new search, not on load more)
      if (!loadMore) {
        const newHistoryItem = {
          query: placesQuery,
          location: placesLocation,
          timestamp: Date.now()
        };
        
        // Add to history, remove duplicates, keep last 10
        const updatedHistory = [
          newHistoryItem,
          ...placesSearchHistory.filter(h => 
            !(h.query === placesQuery && h.location === placesLocation)
          )
        ].slice(0, 10);
      
        setPlacesSearchHistory(updatedHistory);
        localStorage.setItem('placesSearchHistory', JSON.stringify(updatedHistory));
      }
      
      if (!loadMore && filteredNewPlaces.length === 0 && newPlaces.length > 0) {
        setError(`No new results. All ${newPlaces.length} results already in Open, Dismissed, or Promoted tabs.`);
      } else if (!loadMore && newPlaces.length === 0) {
        setError('No places found with websites. Try a different search.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search places');
    } finally {
      setIsSearchingPlaces(false);
    }
  };

  const createLeadsFromPlaces = async () => {
    if (selectedPlaces.size === 0) {
      setError('Please select at least one place to create leads');
      return;
    }

    setIsCreatingLeadsFromPlaces(true);
    setError(null);

    try {
      const selectedPlacesData = placesResults.filter(place => 
        selectedPlaces.has(place.id)
      );

      let createdCount = 0;
      let failedCount = 0;

      for (const place of selectedPlacesData) {
        try {
          const response = await fetch('/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: place.name,
              company: place.name,
              website: place.website,
              status: 'lead_collected',
              notes: `Source: Google Places\nAddress: ${place.address}\nPhone: ${place.phone}\nRating: ${place.rating} (${place.userRatingCount} reviews)\nGoogle Maps: ${place.googleMapsUri}`,
            }),
          });

          if (response.ok) {
            const leadData = await response.json();
            createdCount++;
            
            // Add to promoted_leads table
            await fetch('/api/promoted', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: userEmail,
                campaignId: currentCampaign?.id || null,
                placeId: place.id,
                placeName: place.name,
                website: place.website,
                address: place.address,
                phone: place.phone,
                rating: place.rating,
                userRatingCount: place.userRatingCount,
                googleMapsUri: place.googleMapsUri,
                searchQuery: placesQuery,
                searchLocation: placesLocation,
                leadId: leadData.lead?.id || null,
              }),
            });
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
        }
      }

      // Refresh leads list and promoted leads
      await fetchLeads();
      await fetchPromotedLeads();
      
      // Clear selection and show success
      setSelectedPlaces(new Set());
      alert(`Successfully created ${createdCount} leads${failedCount > 0 ? `. ${failedCount} failed.` : '!'}`);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create leads');
    } finally {
      setIsCreatingLeadsFromPlaces(false);
    }
  };

  const isPlaceAlreadyLead = (place: any) => {
    return leads.some(lead => {
      // Check by website URL (most reliable)
      if (place.website && lead.website_url) {
        const normalizeUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').toLowerCase();
        const placeUrl = normalizeUrl(place.website);
        const leadUrl = normalizeUrl(lead.website_url);
        console.log(`Comparing URLs: place="${placeUrl}" vs lead="${leadUrl}" (${lead.company})`);
        if (placeUrl === leadUrl) {
          return true;
        }
      }
      // Check by exact company name match
      if (place.name && lead.company) {
        const placeName = place.name.toLowerCase();
        const leadName = lead.company.toLowerCase();
        console.log(`Comparing names: place="${placeName}" vs lead="${leadName}"`);
        if (placeName === leadName) {
          return true;
        }
      }
      return false;
    });
  };

  const togglePlaceSelection = (placeId: string) => {
    const place = placesResults.find(p => p.id === placeId);
    if (place && isPlaceAlreadyLead(place)) {
      // Don't allow selection of places that are already leads
      return;
    }
    
    const newSelection = new Set(selectedPlaces);
    if (newSelection.has(placeId)) {
      newSelection.delete(placeId);
    } else {
      newSelection.add(placeId);
    }
    setSelectedPlaces(newSelection);
  };

  const toggleAllPlaces = () => {
    // Only select places that aren't already leads or dismissed
    const selectablePlaces = placesResults.filter(p => 
      !isPlaceAlreadyLead(p) && !dismissedPlaces.has(p.id)
    );
    
    if (selectedPlaces.size === selectablePlaces.length) {
      setSelectedPlaces(new Set());
    } else {
      setSelectedPlaces(new Set(selectablePlaces.map(p => p.id)));
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

  // Fetch leads when CRM or Google Places tab is opened
  useEffect(() => {
    if (currentTab === 'crm' || currentTab === 'google-places') {
      fetchLeads();
    }
    if (currentTab === 'google-places') {
      fetchCampaigns();
      fetchDismissedLeads();
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
            onClick={() => {
              setCurrentTab('new-analysis');
              // Clear form fields when clicking New Analysis
              setProspectName('');
              setCompany('');
              setEmail('');
              setIgHandle('');
              setWebsiteUrl('');
              setProfilePictureUrl('');
              setUploadedProfilePicUrl('');
              setWebsiteData('');
              setIgFile(null);
              setSubstackFile(null);
              setThreadsFile(null);
              setOtherFile(null);
            }}
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
          
          {/* Google Places with submenu */}
          <div className="space-y-1">
            <button 
              onClick={() => {
                setCurrentTab('google-places');
                setGooglePlacesView('search');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                currentTab === 'google-places' 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Globe className="w-5 h-5" />
              Google Places
            </button>
            
            {/* Submenu items - only show when Google Places is active */}
            {currentTab === 'google-places' && (
              <div className="ml-4 space-y-1 border-l-2 border-indigo-200 pl-2">
                <button
                  onClick={() => setGooglePlacesView('search')}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    googlePlacesView === 'search'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Search
                </button>
                <button
                  onClick={() => {
                    setGooglePlacesView('open');
                    fetchOpenLeads();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    googlePlacesView === 'open'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Open {openLeadsList.length > 0 && `(${openLeadsList.length})`}
                </button>
                <button
                  onClick={() => {
                    setGooglePlacesView('dismissed');
                    fetchDismissedLeads();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    googlePlacesView === 'dismissed'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Dismissed {dismissedLeadsList.length > 0 && `(${dismissedLeadsList.length})`}
                </button>
                <button
                  onClick={() => {
                    setGooglePlacesView('promoted');
                    fetchPromotedLeads();
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    googlePlacesView === 'promoted'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  Promoted {promotedLeadsList.length > 0 && `(${promotedLeadsList.length})`}
                </button>
              </div>
            )}
          </div>
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
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Prospect Name (e.g. Sarah Jones)" 
                      value={prospectName}
                      onChange={(e) => setProspectName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Company / Brand Name" 
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="email" 
                      placeholder="Email address" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Instagram handle (e.g. @username)" 
                      value={igHandle}
                      onChange={(e) => setIgHandle(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Website URL" 
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                  <div className="relative">
                    <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Profile Picture URL (paste IG image URL + Enter)" 
                      value={profilePictureUrl}
                      onChange={(e) => setProfilePictureUrl(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && profilePictureUrl.trim() && !isUploadingProfilePic) {
                          e.preventDefault();
                          setIsUploadingProfilePic(true);
                          
                          try {
                            // Download and upload the image
                            const response = await fetch('/api/leads/profile-picture', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ 
                                imageUrl: profilePictureUrl,
                                prospectName: prospectName || 'temp'
                              }),
                            });
                            
                            if (response.ok) {
                              const data = await response.json();
                              setUploadedProfilePicUrl(data.publicUrl);
                              setProfilePictureUrl(''); // Clear input
                            }
                          } catch (err) {
                            console.error('Failed to upload profile picture:', err);
                          } finally {
                            setIsUploadingProfilePic(false);
                          }
                        }
                      }}
                      disabled={isUploadingProfilePic}
                      className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm disabled:opacity-50"
                    />
                  </div>
                  {isUploadingProfilePic && (
                    <div className="col-span-2 text-xs text-indigo-600">Uploading profile picture...</div>
                  )}
                  {uploadedProfilePicUrl && (
                    <div className="col-span-2">
                      <img src={uploadedProfilePicUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-200" />
                    </div>
                  )}
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
                      className="w-full h-24 px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 text-sm resize-none"
                    />
                    <div className="mt-3 text-center text-xs text-slate-500">or</div>
                    <div className="mt-3 border-2 border-dashed border-slate-200 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer">
                      <input 
                        type="file" 
                        accept=".txt"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setWebsiteData(event.target?.result as string);
                            };
                            reader.readAsText(file);
                          }
                        }}
                        className="hidden" 
                        id="website-file"
                      />
                      <label htmlFor="website-file" className="cursor-pointer block">
                        <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                        <p className="text-xs font-medium text-slate-700">Upload .txt file</p>
                      </label>
                    </div>
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
                              lead.status === 'email_1_sent' ? 'bg-blue-100 text-blue-800' :
                              lead.status === 'email_2_sent' ? 'bg-indigo-100 text-indigo-800' :
                              lead.status === 'email_3_sent' ? 'bg-purple-100 text-purple-800' :
                              lead.status === 'replied_not_fit' ? 'bg-orange-100 text-orange-800' :
                              lead.status === 'replied_interested' ? 'bg-cyan-100 text-cyan-800' :
                              lead.status === 'call_booked' ? 'bg-teal-100 text-teal-800' :
                              lead.status === 'call_done_thinking' ? 'bg-yellow-100 text-yellow-800' :
                              lead.status === 'won' ? 'bg-green-100 text-green-800' :
                              lead.status === 'lost' ? 'bg-red-100 text-red-800' :
                              lead.status === 'site_live' ? 'bg-violet-100 text-violet-800' :
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
                  Use placeholders: <code className="bg-slate-100 px-2 py-1 rounded text-xs">[name]</code>, <code className="bg-slate-100 px-2 py-1 rounded text-xs">[topic]</code>
                </p>
                <textarea
                  value={emailTemplate}
                  onChange={(e) => setEmailTemplate(e.target.value)}
                  placeholder="Hi [name],\n\nI came across your post about [topic] and it really stood out.\n\nQuick question: is anything in your online flow currently slowing you down (website, automations, client funnel)?\n\nI help spiritual entrepreneurs streamline their systems so they attract more ideal clients with less effort.\n\nIf you want, I can take a quick look and tell you exactly where the bottleneck is.\n\nWould that be useful?\n\nCheers,"
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

          {/* Google Places Scraper View */}
          {currentTab === 'google-places' && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
              
              {/* Search View */}
              {googlePlacesView === 'search' && (
                <>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Google Places Lead Finder</h1>
                <p className="text-slate-500 mt-1">Search for businesses by keyword and location. Only businesses with websites will be shown.</p>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
                {/* Search History */}
                {placesSearchHistory.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Recent Searches (click to repeat)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {placesSearchHistory.map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setPlacesQuery(item.query);
                            setPlacesLocation(item.location);
                          }}
                          className="px-3 py-1.5 bg-white border border-indigo-300 rounded-lg text-xs text-indigo-700 hover:bg-indigo-100 hover:border-indigo-400 transition-colors flex items-center gap-2"
                        >
                          <span className="font-medium">{item.query}</span>
                          {item.location && <span className="text-indigo-500">in {item.location}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Business Type / Keyword *
                    </label>
                    <input
                      type="text"
                      value={placesQuery}
                      onChange={(e) => setPlacesQuery(e.target.value)}
                      placeholder="e.g., yoga studio, coffee shop, dentist, real estate agent"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      What type of business are you looking for?
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Location (Optional)
                    </label>
                    <input
                      type="text"
                      value={placesLocation}
                      onChange={(e) => setPlacesLocation(e.target.value)}
                      placeholder="e.g., New York, Los Angeles, Chicago"
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Leave empty to search everywhere
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Results per Page
                    </label>
                    <select
                      value={placesMaxResults}
                      onChange={(e) => setPlacesMaxResults(Number(e.target.value))}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value={5}>5 per page</option>
                      <option value={10}>10 per page</option>
                      <option value={15}>15 per page</option>
                      <option value={20}>20 per page (max)</option>
                    </select>
                    <p className="text-xs text-slate-500 mt-1">
                      Google API limit: 20 per request. Use "Load More" for additional results.
                    </p>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                <button
                  onClick={() => searchPlaces(false)}
                  disabled={isSearchingPlaces || !placesQuery.trim()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:bg-indigo-400 disabled:cursor-not-allowed"
                >
                  {isSearchingPlaces ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Searching Google Places...
                    </>
                  ) : (
                    <>
                      <Globe className="w-5 h-5" />
                      Search Places
                    </>
                  )}
                </button>

                {placesResults.length > 0 && (
                  <div className="space-y-4 mt-6">
                    {/* Campaign Stats */}
                    {currentCampaign && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-indigo-900 text-sm">
                              Campaign: "{currentCampaign.search_query}"
                              {currentCampaign.location && ` in ${currentCampaign.location}`}
                            </h4>
                            <div className="flex items-center gap-4 mt-2 text-xs text-indigo-700">
                              <span>📊 Fetched: {currentCampaign.total_fetched}</span>
                              <span>❌ Dismissed: {currentCampaign.total_dismissed}</span>
                              <span>✅ Converted: {currentCampaign.total_converted}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-700">
                          Showing {placesResults.length} Places with Websites
                          {currentPage > 1 && <span className="text-slate-500 font-normal">(Page {currentPage})</span>}
                        </h3>
                        <span className="text-xs text-slate-500">
                          ({selectedPlaces.size} selected)
                        </span>
                        {placesResults.filter(p => isPlaceAlreadyLead(p)).length > 0 && (
                          <span className="text-xs text-green-600 font-medium">
                            • {placesResults.filter(p => isPlaceAlreadyLead(p)).length} already in CRM
                          </span>
                        )}
                        {placesResults.filter(p => dismissedPlaces.has(p.id)).length > 0 && (
                          <span className="text-xs text-red-600 font-medium">
                            • {placesResults.filter(p => dismissedPlaces.has(p.id)).length} dismissed
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleAllPlaces}
                          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          {selectedPlaces.size === placesResults.length ? 'Deselect All' : 'Select All'}
                        </button>
                        <button
                          onClick={createLeadsFromPlaces}
                          disabled={selectedPlaces.size === 0 || isCreatingLeadsFromPlaces}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:bg-green-400 disabled:cursor-not-allowed"
                        >
                          {isCreatingLeadsFromPlaces ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Creating...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Create {selectedPlaces.size} Lead{selectedPlaces.size !== 1 ? 's' : ''}
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {placesResults.map((place) => {
                        const alreadyLead = isPlaceAlreadyLead(place);
                        const isDismissed = dismissedPlaces.has(place.id);
                        const isInOpen = openPlaceIds.has(place.id);
                        return (
                        <div
                          key={place.id}
                          className={`border rounded-lg p-4 transition-all ${
                            isDismissed
                              ? 'border-red-200 bg-red-50 opacity-60'
                              : alreadyLead
                              ? 'border-green-300 bg-green-50 opacity-75'
                              : selectedPlaces.has(place.id)
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          {/* Top Right: Query/Date Info */}
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-start gap-3 flex-1">
                              <div 
                                className="flex-shrink-0 mt-1 cursor-pointer"
                                onClick={() => !alreadyLead && !isDismissed && togglePlaceSelection(place.id)}
                              >
                                {isDismissed ? (
                                  <div className="w-5 h-5 rounded border-2 border-red-400 bg-red-400 flex items-center justify-center">
                                    <X className="w-3 h-3 text-white" />
                                  </div>
                                ) : alreadyLead ? (
                                  <div className="w-5 h-5 rounded border-2 border-green-600 bg-green-600 flex items-center justify-center">
                                    <Check className="w-3 h-3 text-white" />
                                  </div>
                                ) : (
                                  <div
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                      selectedPlaces.has(place.id)
                                        ? 'bg-indigo-600 border-indigo-600'
                                        : 'border-slate-300'
                                    }`}
                                  >
                                    {selectedPlaces.has(place.id) && (
                                      <Check className="w-3 h-3 text-white" />
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-semibold text-slate-900">{place.name}</h4>
                                  {isInOpen && !isDismissed && !alreadyLead && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                      Open
                                    </span>
                                  )}
                                  {isDismissed && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                      <X className="w-3 h-3" />
                                      Dismissed
                                    </span>
                                  )}
                                  {alreadyLead && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                      <CheckCircle className="w-3 h-3" />
                                      Already a Lead
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 mt-1">{place.address}</p>
                                {place.phone && (
                                  <p className="text-sm text-slate-500 mt-1">📞 {place.phone}</p>
                                )}
                                {place.rating > 0 && (
                                  <p className="text-sm text-amber-600 mt-1">
                                    ⭐ {place.rating.toFixed(1)} ({place.userRatingCount} reviews)
                                  </p>
                                )}
                              </div>
                            </div>
                            {/* Query/Date on top right */}
                            <div className="text-right text-xs text-slate-500 flex-shrink-0">
                              <div>query: {placesQuery}</div>
                              {placesLocation && <div>{placesLocation}</div>}
                              <div>date: {new Date().toLocaleDateString('en-GB')}</div>
                            </div>
                          </div>
                          
                          {/* Bottom: Links and Dismiss */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={place.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                              >
                                <Globe className="w-4 h-4" />
                                Visit Website
                              </a>
                              {place.googleMapsUri && (
                                <a
                                  href={place.googleMapsUri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-sm text-slate-600 hover:text-slate-700 font-medium flex items-center gap-1"
                                >
                                  <Globe className="w-4 h-4" />
                                  Google Maps
                                </a>
                              )}
                            </div>
                            {!alreadyLead && !isDismissed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDismissDialog(place);
                                }}
                                className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                              >
                                <X className="w-4 h-4" />
                                Dismiss
                              </button>
                            )}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    
                    {/* Info message */}
                    {placesResults.length === 0 && !isSearchingPlaces && (
                      <div className="text-center text-sm text-slate-500 pt-4">
                        All results from this search are already in Open, Dismissed, or Promoted tabs.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 text-sm mb-2">How it works:</h3>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>Searches Google Places API for businesses matching your criteria</li>
                  <li>Only shows businesses that have a website URL</li>
                  <li>View business details including address, phone, ratings, and reviews</li>
                  <li>Select multiple businesses and create leads in bulk</li>
                  <li>Each lead includes all business info in the notes field</li>
                  <li>Leads are created with "new" status and can be managed in the CRM tab</li>
                </ul>
                <p className="text-xs text-blue-700 mt-3 font-medium">
                  💡 Tip: Be specific with your search. "yoga studio" is better than just "yoga"
                </p>
              </div>
                </>
              )}

              {/* Open Leads View */}
              {googlePlacesView === 'open' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h1 className="text-2xl font-bold text-slate-900">Open Leads</h1>
                      <p className="text-slate-600 mt-1">All businesses shown to you that haven't been dismissed or converted to leads</p>
                    </div>

                    <div className="p-6">
                      {openLeadsList.length === 0 ? (
                        <div className="text-center py-12">
                          <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Open Leads</h3>
                          <p className="text-slate-500">Search for places to see them appear here.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Filters */}
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Filter Leads</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Search Query</label>
                                <input
                                  type="text"
                                  placeholder="Filter by query..."
                                  value={openFilterQuery}
                                  onChange={(e) => setOpenFilterQuery(e.target.value)}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Date From</label>
                                <input
                                  type="date"
                                  value={openFilterDateFrom}
                                  onChange={(e) => setOpenFilterDateFrom(e.target.value)}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">Date To</label>
                                <input
                                  type="date"
                                  value={openFilterDateTo}
                                  onChange={(e) => setOpenFilterDateTo(e.target.value)}
                                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                                />
                              </div>
                            </div>
                            {(openFilterQuery || openFilterDateFrom || openFilterDateTo) && (
                              <button
                                onClick={() => {
                                  setOpenFilterQuery('');
                                  setOpenFilterDateFrom('');
                                  setOpenFilterDateTo('');
                                }}
                                className="mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                              >
                                Clear Filters
                              </button>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="text-sm text-slate-600">
                              Showing {openLeadsList.filter(lead => {
                                // Apply filters
                                if (openFilterQuery && !lead.search_query?.toLowerCase().includes(openFilterQuery.toLowerCase())) {
                                  return false;
                                }
                                if (openFilterDateFrom && lead.search_date) {
                                  const leadDate = new Date(lead.search_date).setHours(0,0,0,0);
                                  const filterDate = new Date(openFilterDateFrom).setHours(0,0,0,0);
                                  if (leadDate < filterDate) return false;
                                }
                                if (openFilterDateTo && lead.search_date) {
                                  const leadDate = new Date(lead.search_date).setHours(0,0,0,0);
                                  const filterDate = new Date(openFilterDateTo).setHours(0,0,0,0);
                                  if (leadDate > filterDate) return false;
                                }
                                return true;
                              }).length} of {openLeadsList.length} leads
                              <span className="text-xs text-slate-500 ml-2">({selectedPlaces.size} selected)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (selectedPlaces.size === openLeadsList.length) {
                                    setSelectedPlaces(new Set());
                                  } else {
                                    setSelectedPlaces(new Set(openLeadsList.map(l => l.place_id)));
                                  }
                                }}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                              >
                                {selectedPlaces.size === openLeadsList.length ? 'Deselect All' : 'Select All'}
                              </button>
                              <button
                                onClick={async () => {
                                  if (selectedPlaces.size === 0) return;
                                  setIsCreatingLeadsFromPlaces(true);
                                  let createdCount = 0;
                                  for (const lead of openLeadsList.filter(l => selectedPlaces.has(l.place_id))) {
                                    try {
                                      const response = await fetch('/api/leads', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          name: lead.place_name,
                                          company: lead.place_name,
                                          website: lead.website,
                                          status: 'lead_collected',
                                          notes: `Source: Google Places\nAddress: ${lead.address}\nPhone: ${lead.phone}\nRating: ${lead.rating} (${lead.user_rating_count} reviews)\nGoogle Maps: ${lead.google_maps_uri}`,
                                        }),
                                      });
                                      if (response.ok) {
                                        const leadData = await response.json();
                                        await fetch('/api/promoted', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            userId: userEmail,
                                            campaignId: currentCampaign?.id || null,
                                            placeId: lead.place_id,
                                            placeName: lead.place_name,
                                            website: lead.website,
                                            address: lead.address,
                                            phone: lead.phone,
                                            rating: lead.rating,
                                            userRatingCount: lead.user_rating_count,
                                            googleMapsUri: lead.google_maps_uri,
                                            searchQuery: lead.search_query,
                                            searchLocation: lead.search_location,
                                            searchDate: lead.search_date,
                                            leadId: leadData.lead?.id || null,
                                          }),
                                        });
                                        createdCount++;
                                      }
                                    } catch (err) {}
                                  }
                                  await fetchLeads();
                                  await fetchPromotedLeads();
                                  await fetchOpenLeads();
                                  setSelectedPlaces(new Set());
                                  setIsCreatingLeadsFromPlaces(false);
                                  alert(`Successfully created ${createdCount} leads!`);
                                }}
                                disabled={selectedPlaces.size === 0 || isCreatingLeadsFromPlaces}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:bg-green-400 disabled:cursor-not-allowed"
                              >
                                {isCreatingLeadsFromPlaces ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Creating...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4" />
                                    Create {selectedPlaces.size} Lead{selectedPlaces.size !== 1 ? 's' : ''}
                                  </>
                                )}
                              </button>
                              <button
                                onClick={async () => {
                                  if (selectedPlaces.size === 0) return;
                                  if (!confirm(`Are you sure you want to dismiss ${selectedPlaces.size} lead${selectedPlaces.size !== 1 ? 's' : ''}?`)) return;
                                  
                                  let dismissedCount = 0;
                                  for (const lead of openLeadsList.filter(l => selectedPlaces.has(l.place_id))) {
                                    try {
                                      await fetch('/api/dismissed', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          userId: userEmail,
                                          campaignId: currentCampaign?.id || null,
                                          placeId: lead.place_id,
                                          placeName: lead.place_name,
                                          website: lead.website,
                                          address: lead.address,
                                          phone: lead.phone,
                                          reason: '', // No reason for bulk dismiss
                                        }),
                                      });
                                      dismissedCount++;
                                    } catch (err) {}
                                  }
                                  await fetchDismissedLeads();
                                  await fetchOpenLeads();
                                  setSelectedPlaces(new Set());
                                  alert(`Successfully dismissed ${dismissedCount} lead${dismissedCount !== 1 ? 's' : ''}!`);
                                }}
                                disabled={selectedPlaces.size === 0}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 disabled:bg-red-400 disabled:cursor-not-allowed"
                              >
                                <X className="w-4 h-4" />
                                Dismiss {selectedPlaces.size} Lead{selectedPlaces.size !== 1 ? 's' : ''}
                              </button>
                            </div>
                          </div>
                          {openLeadsList
                            .filter(lead => {
                              // Apply filters
                              if (openFilterQuery && !lead.search_query?.toLowerCase().includes(openFilterQuery.toLowerCase())) {
                                return false;
                              }
                              if (openFilterDateFrom && lead.search_date) {
                                const leadDate = new Date(lead.search_date).setHours(0,0,0,0);
                                const filterDate = new Date(openFilterDateFrom).setHours(0,0,0,0);
                                if (leadDate < filterDate) return false;
                              }
                              if (openFilterDateTo && lead.search_date) {
                                const leadDate = new Date(lead.search_date).setHours(0,0,0,0);
                                const filterDate = new Date(openFilterDateTo).setHours(0,0,0,0);
                                if (leadDate > filterDate) return false;
                              }
                              return true;
                            })
                            .map((lead) => (
                            <div
                              key={lead.id}
                              className={`border rounded-lg p-4 transition-all ${
                                selectedPlaces.has(lead.place_id)
                                  ? 'border-indigo-500 bg-indigo-50'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex items-start gap-3 flex-1">
                                  <div 
                                    className="flex-shrink-0 mt-1 cursor-pointer"
                                    onClick={() => {
                                      const newSelection = new Set(selectedPlaces);
                                      if (newSelection.has(lead.place_id)) {
                                        newSelection.delete(lead.place_id);
                                      } else {
                                        newSelection.add(lead.place_id);
                                      }
                                      setSelectedPlaces(newSelection);
                                    }}
                                  >
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                      selectedPlaces.has(lead.place_id)
                                        ? 'border-indigo-600 bg-indigo-600'
                                        : 'border-slate-300 bg-white'
                                    }`}>
                                      {selectedPlaces.has(lead.place_id) && (
                                        <Check className="w-3 h-3 text-white" />
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="font-semibold text-slate-900">{lead.place_name}</h4>
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                      Open
                                    </span>
                                  </div>
                                    {lead.address && (
                                      <p className="text-sm text-slate-600 mt-1">{lead.address}</p>
                                    )}
                                    {lead.phone && (
                                      <p className="text-sm text-slate-500 mt-1">📞 {lead.phone}</p>
                                    )}
                                    {lead.rating > 0 && (
                                      <p className="text-sm text-amber-600 mt-1">
                                        ⭐ {lead.rating.toFixed(1)} ({lead.user_rating_count} reviews)
                                      </p>
                                    )}
                                    <p className="text-xs text-slate-400 mt-2">
                                      Last shown: {new Date(lead.last_shown_at).toLocaleDateString('en-GB')}
                                    </p>
                                  </div>
                                </div>
                                {/* Query/Date on top right */}
                                {lead.search_query && (
                                  <div className="text-right text-xs text-slate-500 flex-shrink-0">
                                    <div>query: {lead.search_query}</div>
                                    {lead.search_location && <div>{lead.search_location}</div>}
                                    {lead.search_date && (
                                      <div>date: {new Date(lead.search_date).toLocaleDateString('en-GB')}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {lead.website && (
                                    <a
                                      href={lead.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                                    >
                                      <Globe className="w-4 h-4" />
                                      Visit Website
                                    </a>
                                  )}
                                  {lead.google_maps_uri && (
                                    <a
                                      href={lead.google_maps_uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-slate-600 hover:text-slate-700 font-medium flex items-center gap-1"
                                    >
                                      <Globe className="w-4 h-4" />
                                      Google Maps
                                    </a>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    const placeData = {
                                      id: lead.place_id,
                                      name: lead.place_name,
                                      website: lead.website,
                                      address: lead.address,
                                      phone: lead.phone,
                                    };
                                    openDismissDialog(placeData);
                                  }}
                                  className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                                >
                                  <X className="w-4 h-4" />
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Dismissed Leads View */}
              {googlePlacesView === 'dismissed' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h1 className="text-2xl font-bold text-slate-900">Dismissed Leads</h1>
                      <p className="text-slate-600 mt-1">Review all dismissed Google Places results</p>
                    </div>

                    <div className="p-6">
                      {dismissedLeadsList.length === 0 ? (
                        <div className="text-center py-12">
                          <X className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Dismissed Leads</h3>
                          <p className="text-slate-500">You haven't dismissed any leads yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-sm text-slate-600 mb-4">
                            Total dismissed: {dismissedLeadsList.length}
                          </div>
                          {dismissedLeadsList.map((dismissed) => (
                            <div
                              key={dismissed.id}
                              className="border rounded-lg p-4 bg-red-50 border-red-200"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-1">
                                  <div className="w-5 h-5 rounded border-2 border-red-400 bg-red-400 flex items-center justify-center">
                                    <X className="w-3 h-3 text-white" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-semibold text-slate-900">{dismissed.place_name}</h4>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                          <X className="w-3 h-3" />
                                          Dismissed
                                        </span>
                                      </div>
                                      {dismissed.address && (
                                        <p className="text-sm text-slate-600 mt-1">{dismissed.address}</p>
                                      )}
                                      {dismissed.phone && (
                                        <p className="text-sm text-slate-500 mt-1">📞 {dismissed.phone}</p>
                                      )}
                                      {dismissed.reason && (
                                        <div className="mt-2 p-2 bg-white rounded border border-red-200">
                                          <p className="text-xs font-semibold text-slate-700 mb-1">Reason:</p>
                                          <p className="text-sm text-slate-600">{dismissed.reason}</p>
                                        </div>
                                      )}
                                      <p className="text-xs text-slate-400 mt-2">
                                        Dismissed {new Date(dismissed.dismissed_at).toLocaleDateString()} at {new Date(dismissed.dismissed_at).toLocaleTimeString()}
                                      </p>
                                    </div>
                                    {/* Query/Date on top right */}
                                    {dismissed.search_query && (
                                      <div className="text-right text-xs text-slate-500 flex-shrink-0">
                                        <div>query: {dismissed.search_query}</div>
                                        {dismissed.search_location && <div>{dismissed.search_location}</div>}
                                        {dismissed.search_date && (
                                          <div>date: {new Date(dismissed.search_date).toLocaleDateString('en-GB')}</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    {dismissed.website && (
                                      <a
                                        href={dismissed.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                                      >
                                        <Globe className="w-4 h-4" />
                                        Visit Website
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Promoted Leads View */}
              {googlePlacesView === 'promoted' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h1 className="text-2xl font-bold text-slate-900">Promoted Leads</h1>
                      <p className="text-slate-600 mt-1">All businesses that were converted to leads</p>
                    </div>

                    <div className="p-6">
                      {promotedLeadsList.length === 0 ? (
                        <div className="text-center py-12">
                          <CheckCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Promoted Leads</h3>
                          <p className="text-slate-500">You haven't promoted any Google Places results yet.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-sm text-slate-600 mb-4">
                            Total promoted: {promotedLeadsList.length}
                          </div>
                          {promotedLeadsList.map((promoted) => (
                            <div
                              key={promoted.id}
                              className="border rounded-lg p-4 bg-green-50 border-green-200"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex-shrink-0 mt-1">
                                  <div className="w-5 h-5 rounded border-2 border-green-600 bg-green-600 flex items-center justify-center">
                                    <CheckCircle className="w-3 h-3 text-white" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-semibold text-slate-900">{promoted.place_name}</h4>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                          <CheckCircle className="w-3 h-3" />
                                          Promoted to Lead
                                        </span>
                                      </div>
                                      {promoted.address && (
                                        <p className="text-sm text-slate-600 mt-1">{promoted.address}</p>
                                      )}
                                      {promoted.phone && (
                                        <p className="text-sm text-slate-500 mt-1">📞 {promoted.phone}</p>
                                      )}
                                      {promoted.rating > 0 && (
                                        <p className="text-sm text-amber-600 mt-1">
                                          ⭐ {promoted.rating.toFixed(1)} ({promoted.user_rating_count} reviews)
                                        </p>
                                      )}
                                      <p className="text-xs text-slate-400 mt-2">
                                        Promoted {new Date(promoted.promoted_at).toLocaleDateString()} at {new Date(promoted.promoted_at).toLocaleTimeString()}
                                      </p>
                                    </div>
                                    {/* Query/Date on top right */}
                                    {promoted.search_query && (
                                      <div className="text-right text-xs text-slate-500 flex-shrink-0">
                                        <div>query: {promoted.search_query}</div>
                                        {promoted.search_location && <div>{promoted.search_location}</div>}
                                        {promoted.search_date && (
                                          <div>date: {new Date(promoted.search_date).toLocaleDateString('en-GB')}</div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    {promoted.website && (
                                      <a
                                        href={promoted.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                                      >
                                        <Globe className="w-4 h-4" />
                                        Visit Website
                                      </a>
                                    )}
                                    {promoted.google_maps_uri && (
                                      <a
                                        href={promoted.google_maps_uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-slate-600 hover:text-slate-700 font-medium flex items-center gap-1"
                                      >
                                        <Globe className="w-4 h-4" />
                                        Google Maps
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Dismiss Dialog Modal */}
      {showDismissDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Dismiss Lead</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-slate-600 mb-4">
                You're dismissing: <strong>{placeToDissmiss?.name}</strong>
              </p>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Reason for dismissing (optional)
                </label>
                <textarea
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  placeholder="e.g., Not relevant, already contacted, outside service area..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDismissDialog(false);
                  setPlaceToDissmiss(null);
                  setDismissReason('');
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={dismissPlace}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Dismiss Lead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
