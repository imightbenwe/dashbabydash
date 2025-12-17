/**
 * useLeads Hook - Manages lead data fetching and mutations
 */

import { useState, useCallback } from 'react';
import type { Lead, LeadStatus } from '../types/index';
import { logger } from '../logger';

interface LeadFilters {
  status?: LeadStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface UseLeadsReturn {
  leads: Lead[];
  isLoading: boolean;
  error: string | null;
  fetchLeads: (filters?: LeadFilters) => Promise<void>;
  updateLeadStatus: (leadId: string, status: LeadStatus) => Promise<boolean>;
  deleteLead: (leadId: string) => Promise<boolean>;
  deleteLeads: (leadIds: string[]) => Promise<boolean>;
  refreshLeads: () => Promise<void>;
}

export function useLeads(): UseLeadsReturn {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = useCallback(async (filters?: LeadFilters) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.search) params.set('search', filters.search);
      // Use reasonable limit to prevent memory/performance issues
      params.set('limit', '500');

      const response = await fetch(`/api/leads?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch leads');
      }

      const result = await response.json();
      // API returns { success: true, data: { leads: [...], pagination: {...} } }
      setLeads(result.data?.leads || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      logger.error('Failed to fetch leads', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateLeadStatus = useCallback(async (leadId: string, status: LeadStatus): Promise<boolean> => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error('Failed to update lead status');
      }

      // Update local state
      setLeads((prevLeads) =>
        prevLeads.map((lead) =>
          lead.id === leadId ? { ...lead, status } : lead
        )
      );

      return true;
    } catch (err) {
      logger.error('Failed to update lead status', err, { leadId, status });
      setError(err instanceof Error ? err.message : 'Failed to update lead');
      return false;
    }
  }, []);

  const deleteLead = useCallback(async (leadId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete lead');
      }

      // Remove from local state
      setLeads((prevLeads) => prevLeads.filter((lead) => lead.id !== leadId));

      return true;
    } catch (err) {
      logger.error('Failed to delete lead', err, { leadId });
      setError(err instanceof Error ? err.message : 'Failed to delete lead');
      return false;
    }
  }, []);

  const deleteLeads = useCallback(async (leadIds: string[]): Promise<boolean> => {
    try {
      const deletePromises = leadIds.map((leadId) =>
        fetch(`/api/leads/${leadId}`, { method: 'DELETE' })
      );

      const results = await Promise.all(deletePromises);
      const allSucceeded = results.every((res) => res.ok);

      if (!allSucceeded) {
        throw new Error('Some leads failed to delete');
      }

      // Remove from local state
      setLeads((prevLeads) =>
        prevLeads.filter((lead) => !leadIds.includes(lead.id))
      );

      return true;
    } catch (err) {
      logger.error('Failed to delete leads', err, { count: leadIds.length });
      setError(err instanceof Error ? err.message : 'Failed to delete leads');
      return false;
    }
  }, []);

  const refreshLeads = useCallback(async () => {
    await fetchLeads();
  }, [fetchLeads]);

  return {
    leads,
    isLoading,
    error,
    fetchLeads,
    updateLeadStatus,
    deleteLead,
    deleteLeads,
    refreshLeads,
  };
}
