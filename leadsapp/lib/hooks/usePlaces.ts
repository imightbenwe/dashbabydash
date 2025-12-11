/**
 * usePlaces Hook - Manages Google Places search and lead management
 */

import { useState, useCallback } from 'react';
import type {
  PlaceResult,
  PlacesSearchParams,
  OpenLead,
  DismissedLead,
  PromotedLead,
} from '../types/index';
import { logger } from '../logger';

interface UsePlacesReturn {
  // Search state
  searchResults: PlaceResult[];
  isSearching: boolean;
  searchError: string | null;
  nextPageToken: string | null;
  
  // Open leads state
  openLeads: OpenLead[];
  isLoadingOpen: boolean;
  
  // Dismissed leads state
  dismissedLeads: DismissedLead[];
  isLoadingDismissed: boolean;
  
  // Promoted leads state
  promotedLeads: PromotedLead[];
  isLoadingPromoted: boolean;
  
  // Existing place IDs (for filtering)
  existingPlaceIds: Set<string>;
  openPlaceIds: Set<string>;
  
  // Actions
  searchPlaces: (params: PlacesSearchParams) => Promise<void>;
  saveToOpen: (places: PlaceResult[], query: string, location: string) => Promise<void>;
  dismissPlace: (place: PlaceResult, reason?: string) => Promise<void>;
  promoteToLead: (placeIds: string[]) => Promise<void>;
  fetchOpenLeads: () => Promise<void>;
  fetchDismissedLeads: () => Promise<void>;
  fetchPromotedLeads: () => Promise<void>;
  fetchExistingPlaceIds: () => Promise<void>;
}

export function usePlaces(userId: string | null): UsePlacesReturn {
  // Search state
  const [searchResults, setSearchResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);

  // Open leads state
  const [openLeads, setOpenLeads] = useState<OpenLead[]>([]);
  const [isLoadingOpen, setIsLoadingOpen] = useState(false);

  // Dismissed leads state
  const [dismissedLeads, setDismissedLeads] = useState<DismissedLead[]>([]);
  const [isLoadingDismissed, setIsLoadingDismissed] = useState(false);

  // Promoted leads state
  const [promotedLeads, setPromotedLeads] = useState<PromotedLead[]>([]);
  const [isLoadingPromoted, setIsLoadingPromoted] = useState(false);

  // Existing place IDs (for filtering duplicates)
  const [existingPlaceIds, setExistingPlaceIds] = useState<Set<string>>(new Set());
  const [openPlaceIds, setOpenPlaceIds] = useState<Set<string>>(new Set());

  const searchPlaces = useCallback(async (params: PlacesSearchParams) => {
    setIsSearching(true);
    setSearchError(null);

    try {
      const response = await fetch('/api/places/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error('Failed to search places');
      }

      const data = await response.json();
      setSearchResults(data.places || []);
      setNextPageToken(data.nextPageToken || null);
      
      logger.info('Places search completed', {
        query: params.query,
        location: params.location,
        resultsCount: data.places?.length || 0,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      setSearchError(errorMessage);
      logger.error('Failed to search places', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const saveToOpen = useCallback(
    async (places: PlaceResult[], query: string, location: string) => {
      if (!userId || places.length === 0) return;

      try {
        await fetch('/api/open', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            places,
            searchQuery: query,
            searchLocation: location,
          }),
        });

        // Refresh existing place IDs
        await fetchExistingPlaceIds();
        
        logger.info('Saved places to open leads', { count: places.length });
      } catch (err) {
        logger.error('Failed to save to open leads', err);
      }
    },
    [userId]
  );

  const dismissPlace = useCallback(
    async (place: PlaceResult, reason?: string) => {
      if (!userId) return;

      try {
        const response = await fetch('/api/dismissed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            placeId: place.id,
            placeName: place.name,
            website: place.website,
            address: place.address,
            phone: place.phone,
            reason: reason || null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to dismiss place');
        }

        // Refresh all lists
        await Promise.all([
          fetchDismissedLeads(),
          fetchOpenLeads(),
          fetchExistingPlaceIds(),
        ]);
        
        logger.info('Place dismissed', { placeId: place.id, placeName: place.name });
      } catch (err) {
        logger.error('Failed to dismiss place', err);
      }
    },
    [userId]
  );

  const promoteToLead = useCallback(
    async (placeIds: string[]) => {
      if (!userId || placeIds.length === 0) return;

      try {
        // This would typically create actual leads in the CRM
        // Implementation depends on your API structure
        logger.info('Promoting places to leads', { count: placeIds.length });
        
        // Refresh promoted leads
        await fetchPromotedLeads();
      } catch (err) {
        logger.error('Failed to promote places to leads', err);
      }
    },
    [userId]
  );

  const fetchOpenLeads = useCallback(async () => {
    if (!userId) return;

    setIsLoadingOpen(true);
    try {
      const response = await fetch(`/api/open?userId=${userId}`);
      const data = await response.json();
      
      if (response.ok) {
        setOpenLeads(data.openLeads || []);
      }
    } catch (err) {
      logger.error('Failed to fetch open leads', err);
    } finally {
      setIsLoadingOpen(false);
    }
  }, [userId]);

  const fetchDismissedLeads = useCallback(async () => {
    if (!userId) return;

    setIsLoadingDismissed(true);
    try {
      const response = await fetch(`/api/dismissed?userId=${userId}`);
      const data = await response.json();
      
      if (response.ok) {
        setDismissedLeads(data.dismissed || []);
      }
    } catch (err) {
      logger.error('Failed to fetch dismissed leads', err);
    } finally {
      setIsLoadingDismissed(false);
    }
  }, [userId]);

  const fetchPromotedLeads = useCallback(async () => {
    if (!userId) return;

    setIsLoadingPromoted(true);
    try {
      const response = await fetch(`/api/promoted?userId=${userId}`);
      const data = await response.json();
      
      if (response.ok) {
        setPromotedLeads(data.promoted || []);
      }
    } catch (err) {
      logger.error('Failed to fetch promoted leads', err);
    } finally {
      setIsLoadingPromoted(false);
    }
  }, [userId]);

  const fetchExistingPlaceIds = useCallback(async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/existing-places?userId=${userId}`);
      const data = await response.json();
      
      if (response.ok) {
        setExistingPlaceIds(new Set(data.existingPlaceIds || []));
        setOpenPlaceIds(new Set(data.openPlaceIds || []));
      }
    } catch (err) {
      logger.error('Failed to fetch existing place IDs', err);
    }
  }, [userId]);

  return {
    // Search state
    searchResults,
    isSearching,
    searchError,
    nextPageToken,
    
    // Open leads state
    openLeads,
    isLoadingOpen,
    
    // Dismissed leads state
    dismissedLeads,
    isLoadingDismissed,
    
    // Promoted leads state
    promotedLeads,
    isLoadingPromoted,
    
    // Existing place IDs
    existingPlaceIds,
    openPlaceIds,
    
    // Actions
    searchPlaces,
    saveToOpen,
    dismissPlace,
    promoteToLead,
    fetchOpenLeads,
    fetchDismissedLeads,
    fetchPromotedLeads,
    fetchExistingPlaceIds,
  };
}
