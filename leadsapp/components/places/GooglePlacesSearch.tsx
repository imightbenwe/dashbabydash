/**
 * GooglePlacesSearch Component
 * Search for businesses using Google Places API
 * Track open, dismissed, and promoted leads
 */

'use client';

import { useState, useEffect } from 'react';
import { MapPin, Search, Globe, X, CheckCircle, Check, TrendingUp } from 'lucide-react';

type PlacesView = 'search' | 'open' | 'dismissed' | 'promoted';

interface GooglePlacesSearchProps {
  onLeadsCreated?: (count: number) => void;
}

export function GooglePlacesSearch({ onLeadsCreated }: GooglePlacesSearchProps) {
  // View State
  const [googlePlacesView, setGooglePlacesView] = useState<PlacesView>('search');

  // Search Parameters
  const [placesQuery, setPlacesQuery] = useState('');
  const [placesLocation, setPlacesLocation] = useState('');
  const [minReviews, setMinReviews] = useState('');
  const [maxReviews, setMaxReviews] = useState('');
  const [placesMaxResults, setPlacesMaxResults] = useState(10);

  // Search Results & History
  const [searchHistory, setSearchHistory] = useState<Array<{ query: string; location: string }>>([]);
  
  // Filters (for Open view)
  const [openFilterQuery, setOpenFilterQuery] = useState('');
  const [openFilterDateFrom, setOpenFilterDateFrom] = useState('');
  const [openFilterDateTo, setOpenFilterDateTo] = useState('');

  // Selection
  const [selectedPlaces, setSelectedPlaces] = useState<Set<string>>(new Set());

  // Dismiss Dialog
  const [showDismissDialog, setShowDismissDialog] = useState(false);
  const [placeToDissmiss, setPlaceToDissmiss] = useState<{ id: string; name: string } | null>(null);
  const [dismissReason, setDismissReason] = useState('');

  // State for API operations
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [openLeadsList, setOpenLeadsList] = useState<any[]>([]);
  const [dismissedLeadsList, setDismissedLeadsList] = useState<any[]>([]);
  const [promotedLeadsList, setPromotedLeadsList] = useState<any[]>([]);
  const [campaignStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchOpenLeads(),
        fetchDismissedLeads(),
        fetchPromotedLeads(),
      ]);
    };
    loadData();
  }, []);

  const fetchOpenLeads = async () => {
    try {
      const response = await fetch('/api/open?userId=demo-user');
      const data = await response.json();
      if (response.ok) {
        console.log('Open leads fetched:', data.openLeads?.length);
        setOpenLeadsList(data.openLeads || []);
      }
    } catch (err) {
      console.error('Failed to fetch open leads', err);
    }
  };

  const fetchDismissedLeads = async () => {
    try {
      const response = await fetch('/api/dismissed?userId=demo-user');
      const data = await response.json();
      if (response.ok) {
        setDismissedLeadsList(data.dismissed || []);
      }
    } catch (err) {
      console.error('Failed to fetch dismissed leads', err);
    }
  };

  const fetchPromotedLeads = async () => {
    try {
      const response = await fetch('/api/promoted?userId=demo-user');
      const data = await response.json();
      if (response.ok) {
        console.log('Promoted leads fetched:', data.promoted?.length);
        setPromotedLeadsList(data.promoted || []);
      }
    } catch (err) {
      console.error('Failed to fetch promoted leads', err);
    }
  };

  const handleSearch = async () => {
    if (!placesQuery.trim() || !placesLocation.trim()) {
      alert('Please provide both query and location');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: placesQuery,
          location: placesLocation,
          minReviews: minReviews ? parseInt(minReviews) : undefined,
          maxReviews: maxReviews ? parseInt(maxReviews) : undefined,
          maxResults: placesMaxResults,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      const places = data.places || [];
      setSearchResults(places);
      
      // Auto-save all results to Open (using demo userId)
      if (places.length > 0) {
        await fetch('/api/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'demo-user',  // TODO: Get from auth session
            places: places,
            searchQuery: placesQuery,
            searchLocation: placesLocation,
          }),
        });
        
        // Refresh Open leads and switch to Open tab
        await fetchOpenLeads();
        setGooglePlacesView('open');
      }
      
      // Add to history
      const newHistory = [
        { query: placesQuery, location: placesLocation },
        ...searchHistory.filter((h) => !(h.query === placesQuery && h.location === placesLocation)),
      ].slice(0, 5);
      setSearchHistory(newHistory);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSelected = async () => {
    if (selectedPlaces.size === 0) return;

    const selectedResults = searchResults.filter((r: any) => selectedPlaces.has(r.id));
    
    try {
      await fetch('/api/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          places: selectedResults,
          searchQuery: placesQuery,
          searchLocation: placesLocation,
        }),
      });
      
      setSelectedPlaces(new Set());
      await fetchOpenLeads();
    } catch (err) {
      alert('Failed to save places');
    }
  };

  const handleCreateLeadsFromSelected = async () => {
    if (selectedPlaces.size === 0) return;

    const placeIds = Array.from(selectedPlaces);
    
    try {
      const response = await fetch('/api/leads/create-from-places', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeIds, userId: 'demo-user' }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create leads');
      }
      
      // Clear selection and refresh data
      setSelectedPlaces(new Set());
      await Promise.all([fetchOpenLeads(), fetchPromotedLeads()]);
      
      // Notify parent component
      onLeadsCreated?.(placeIds.length);
      
      alert(`${data.leadsCreated} lead(s) created and added to CRM!`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create leads';
      alert(errorMessage);
    }
  };

  const openDismissDialog = (place: { id: string; name: string }) => {
    setPlaceToDissmiss(place);
    setShowDismissDialog(true);
  };

  const handleDismiss = async () => {
    if (!placeToDissmiss) return;

    try {
      await fetch('/api/dismissed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo-user',
          placeId: placeToDissmiss.id,
          placeName: placeToDissmiss.name,
          reason: dismissReason || null,
        }),
      });

      setShowDismissDialog(false);
      setPlaceToDissmiss(null);
      setDismissReason('');
      setSelectedPlaces((prev) => {
        const newSet = new Set(prev);
        newSet.delete(placeToDissmiss.id);
        return newSet;
      });
      
      await Promise.all([fetchOpenLeads(), fetchDismissedLeads()]);
    } catch (err) {
      alert('Failed to dismiss place');
    }
  };

  // Filter open leads
  const filteredOpenLeads = openLeadsList.filter((lead) => {
    if (openFilterQuery && !lead.place_name.toLowerCase().includes(openFilterQuery.toLowerCase())) {
      return false;
    }
    if (openFilterDateFrom && new Date(lead.search_date) < new Date(openFilterDateFrom)) {
      return false;
    }
    if (openFilterDateTo && new Date(lead.search_date) > new Date(openFilterDateTo)) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Tabs */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 py-3">
            {[
              { id: 'search', label: 'Search', icon: Search },
              { id: 'open', label: 'Open', icon: MapPin, count: openLeadsList.length },
              { id: 'dismissed', label: 'Dismissed', icon: X, count: dismissedLeadsList.length },
              { id: 'promoted', label: 'Promoted', icon: CheckCircle, count: promotedLeadsList.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setGooglePlacesView(tab.id as PlacesView)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  googlePlacesView === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    googlePlacesView === tab.id ? 'bg-indigo-500' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* SEARCH VIEW */}
        {googlePlacesView === 'search' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Search Google Places</h2>
                <a 
                  href="/api/places/search-log" 
                  target="_blank"
                  className="text-xs text-slate-500 hover:text-indigo-600 underline"
                >
                  View search log
                </a>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <input
                  type="text"
                  value={placesQuery}
                  onChange={(e) => setPlacesQuery(e.target.value)}
                  placeholder="e.g., yoga studio, wellness coach"
                  className="px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="text"
                  value={placesLocation}
                  onChange={(e) => setPlacesLocation(e.target.value)}
                  placeholder="e.g., Austin, Texas"
                  className="px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <input
                  type="number"
                  value={minReviews}
                  onChange={(e) => setMinReviews(e.target.value)}
                  placeholder="Min reviews"
                  className="px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="number"
                  value={maxReviews}
                  onChange={(e) => setMaxReviews(e.target.value)}
                  placeholder="Max reviews"
                  className="px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <select
                  value={placesMaxResults}
                  onChange={(e) => setPlacesMaxResults(parseInt(e.target.value))}
                  className="px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={5}>5 results</option>
                  <option value={10}>10 results</option>
                  <option value={20}>20 results</option>
                </select>
              </div>

              <button
                onClick={handleSearch}
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Search Places
                  </>
                )}
              </button>
            </div>

            {/* Search History */}
            {searchHistory.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <h3 className="font-semibold text-slate-700 text-sm mb-3">Recent Searches</h3>
                <div className="flex gap-2 flex-wrap">
                  {searchHistory.map((hist, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setPlacesQuery(hist.query);
                        setPlacesLocation(hist.location);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700"
                    >
                      {hist.query} in {hist.location}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Campaign Stats */}
            {campaignStats && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="text-3xl font-bold text-blue-900">{campaignStats.fetched}</div>
                  <div className="text-sm text-blue-700">Total Fetched</div>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="text-3xl font-bold text-red-900">{campaignStats.dismissed}</div>
                  <div className="text-sm text-red-700">Dismissed</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="text-3xl font-bold text-green-900">{campaignStats.converted}</div>
                  <div className="text-sm text-green-700">Converted</div>
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900">{searchResults.length} Results (Saved to Open)</h3>
                </div>
                <div className="space-y-3">
                  {searchResults.map((place) => (
                    <div
                      key={place.id}
                      className="border border-slate-200 rounded-lg p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{place.displayName?.text || place.id}</h4>
                          {place.formattedAddress && (
                            <p className="text-sm text-slate-600 mt-1">{place.formattedAddress}</p>
                          )}
                          {place.nationalPhoneNumber && (
                            <p className="text-sm text-slate-500 mt-1">📞 {place.nationalPhoneNumber}</p>
                          )}
                          {place.rating && (
                            <p className="text-sm text-amber-600 mt-1">
                              ⭐ {place.rating.toFixed(1)} ({place.userRatingCount || 0} reviews)
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-3">
                            {place.websiteUri && (
                              <a
                                href={place.websiteUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                              >
                                <Globe className="w-4 h-4" />
                                Website
                              </a>
                            )}
                            {place.googleMapsUri && (
                              <a
                                href={place.googleMapsUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-slate-600 hover:text-slate-700 font-medium"
                              >
                                Maps
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* OPEN VIEW */}
        {googlePlacesView === 'open' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Open Leads ({filteredOpenLeads.length})</h2>
                <button
                  onClick={async () => {
                    if (confirm('Delete all open leads? This cannot be undone.')) {
                      await fetch('/api/open/clear?userId=demo-user', { method: 'DELETE' });
                      await fetchOpenLeads();
                    }
                  }}
                  className="text-xs text-red-600 hover:text-red-700 underline"
                >
                  Clear All
                </button>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <input
                  type="text"
                  value={openFilterQuery}
                  onChange={(e) => setOpenFilterQuery(e.target.value)}
                  placeholder="Filter by name..."
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={openFilterDateFrom}
                  onChange={(e) => setOpenFilterDateFrom(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
                />
                <input
                  type="date"
                  value={openFilterDateTo}
                  onChange={(e) => setOpenFilterDateTo(e.target.value)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-sm"
                />
              </div>

              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => {
                    const allPlaceIds = new Set(filteredOpenLeads.map(lead => lead.place_id));
                    setSelectedPlaces(allPlaceIds);
                  }}
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Select All ({filteredOpenLeads.length})
                </button>
                {selectedPlaces.size > 0 && (
                  <>
                    <button
                      onClick={() => setSelectedPlaces(new Set())}
                      className="text-sm text-slate-600 hover:text-slate-700 font-medium"
                    >
                      Deselect All
                    </button>
                    <button
                      onClick={handleCreateLeadsFromSelected}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Create {selectedPlaces.size} Leads
                    </button>
                  </>
                )}
              </div>

              <div className="space-y-3">
                {filteredOpenLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className={`border rounded-lg p-4 ${
                      selectedPlaces.has(lead.place_id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
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
                          {selectedPlaces.has(lead.place_id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{lead.place_name}</h4>
                        {lead.address && <p className="text-sm text-slate-600 mt-1">{lead.address}</p>}
                        {lead.phone && <p className="text-sm text-slate-500 mt-1">📞 {lead.phone}</p>}
                        {lead.rating && (
                          <p className="text-sm text-amber-600 mt-1">
                            ⭐ {lead.rating.toFixed(1)} ({lead.user_rating_count || 0} reviews)
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-3">
                            {lead.website && (
                              <a
                                href={lead.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                              >
                                <Globe className="w-4 h-4" />
                                Website
                              </a>
                            )}
                            {lead.google_maps_uri && (
                              <a
                                href={lead.google_maps_uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-slate-600 hover:text-slate-700 font-medium"
                              >
                                Maps
                              </a>
                            )}
                          </div>
                          <button
                            onClick={() => openDismissDialog({ id: lead.place_id, name: lead.place_name })}
                            className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
                          >
                            <X className="w-4 h-4" />
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DISMISSED VIEW */}
        {googlePlacesView === 'dismissed' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Dismissed ({dismissedLeadsList.length})</h2>
            <div className="space-y-3">
              {dismissedLeadsList.map((lead) => (
                <div key={lead.id} className="border border-red-200 bg-red-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900">{lead.place_name}</h4>
                  {lead.address && <p className="text-sm text-slate-600 mt-1">{lead.address}</p>}
                  {lead.reason && (
                    <div className="mt-2 p-2 bg-white rounded border border-red-200">
                      <p className="text-xs font-semibold text-slate-700">Reason:</p>
                      <p className="text-sm text-slate-600">{lead.reason}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROMOTED VIEW */}
        {googlePlacesView === 'promoted' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Promoted ({promotedLeadsList.length})</h2>
            <div className="space-y-3">
              {promotedLeadsList.map((lead) => (
                <div key={lead.id} className="border border-green-200 bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-slate-900">{lead.place_name}</h4>
                  {lead.address && <p className="text-sm text-slate-600 mt-1">{lead.address}</p>}
                  {lead.phone && <p className="text-sm text-slate-500 mt-1">📞 {lead.phone}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dismiss Dialog */}
      {showDismissDialog && placeToDissmiss && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">Dismiss Lead</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-slate-600 mb-4">
                Dismissing: <strong>{placeToDissmiss.name}</strong>
              </p>
              <textarea
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                placeholder="Reason (optional)..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg resize-none"
                rows={3}
              />
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDismissDialog(false);
                  setPlaceToDissmiss(null);
                  setDismissReason('');
                }}
                className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
