/**
 * CRMTable Component
 * Displays and manages leads in a filterable table
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Filter, X } from 'lucide-react';
import { useLeads } from '@/lib/hooks';
import type { LeadStatus } from '@/lib/types';
import { FollowupTimeline } from '@/components/gmail/FollowupTimeline';

export function CRMTable() {
  const router = useRouter();
  const { leads, isLoading, fetchLeads, deleteLeads: deleteLead } = useLeads();
  
  // Selection state
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Filter state
  const [filterStatus, setFilterStatus] = useState<LeadStatus | ''>('');
  const [filterAutomationStage, setFilterAutomationStage] = useState<number | ''>('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Date editing state
  const [editingDateLeadId, setEditingDateLeadId] = useState<string | null>(null);
  const [tempDateValue, setTempDateValue] = useState('');
  
  // Bulk edit state
  const [bulkContactedDate, setBulkContactedDate] = useState('');
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const leadsPerPage = 50;

  // Fetch leads on mount
  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Apply filters
  const filteredLeads = useMemo(() => {
    let result = leads;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(lead => 
        lead.name.toLowerCase().includes(query) ||
        (lead.email && lead.email.toLowerCase().includes(query)) ||
        (lead.company && lead.company.toLowerCase().includes(query))
      );
    }

    if (filterStatus) {
      result = result.filter(lead => lead.status === filterStatus);
    }

    if (filterAutomationStage !== '') {
      result = result.filter(lead => (lead.automation_stage ?? 0) === filterAutomationStage);
    }

    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      result = result.filter(lead => {
        if (!lead.created_at) return false;
        const leadDate = new Date(lead.created_at);
        leadDate.setHours(0, 0, 0, 0);
        return leadDate >= fromDate;
      });
    }

    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter(lead => {
        if (!lead.created_at) return false;
        const leadDate = new Date(lead.created_at);
        return leadDate <= toDate;
      });
    }

    return result;
  }, [leads, filterStatus, filterAutomationStage, filterDateFrom, filterDateTo, searchQuery]);

  // Paginate filtered leads
  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
  const startIndex = (currentPage - 1) * leadsPerPage;
  const endIndex = startIndex + leadsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterDateFrom, filterDateTo, searchQuery]);

  const hasActiveFilters = filterStatus || filterAutomationStage !== '' || filterDateFrom || filterDateTo || searchQuery;

  const handleDeleteSelected = async () => {
    if (selectedLeads.size === 0) return;
    
    const confirmed = confirm(`Delete ${selectedLeads.size} lead(s)? This cannot be undone.`);
    if (!confirmed) return;

    const success = await deleteLead(Array.from(selectedLeads));
    if (success) {
      setSelectedLeads(new Set());
      setSelectAll(false);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    } else {
      setSelectedLeads(new Set());
    }
  };

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
      setSelectAll(false);
    }
    setSelectedLeads(newSelected);
  };

  const clearFilters = () => {
    setFilterStatus('');
    setFilterAutomationStage('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const handleUpdateContactedDate = async (leadId: string, dateValue: string) => {
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          date_contacted: dateValue || null 
        }),
      });

      if (response.ok) {
        await fetchLeads(); // Refresh the list
        setEditingDateLeadId(null);
        setTempDateValue('');
      } else {
        console.error('Failed to update contacted date');
      }
    } catch (error) {
      console.error('Error updating contacted date:', error);
    }
  };

  const handleDateCellClick = (leadId: string, currentDate: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingDateLeadId(leadId);
    // Convert ISO string to YYYY-MM-DD format for input
    if (currentDate) {
      const date = new Date(currentDate);
      const dateStr = date.toISOString().split('T')[0];
      setTempDateValue(dateStr || '');
    } else {
      setTempDateValue('');
    }
  };

  const handleDateInputBlur = (leadId: string) => {
    if (tempDateValue) {
      handleUpdateContactedDate(leadId, tempDateValue);
    } else {
      setEditingDateLeadId(null);
    }
  };

  const handleDateInputKeyDown = (e: React.KeyboardEvent, leadId: string) => {
    if (e.key === 'Enter') {
      handleUpdateContactedDate(leadId, tempDateValue);
    } else if (e.key === 'Escape') {
      setEditingDateLeadId(null);
      setTempDateValue('');
    }
  };

  const handleBulkSetContactedDate = async () => {
    if (selectedLeads.size === 0 || !bulkContactedDate) {
      alert('Please select leads and choose a date');
      return;
    }

    const confirmed = confirm(`Set contacted date for ${selectedLeads.size} lead(s)?`);
    if (!confirmed) return;

    setIsBulkUpdating(true);
    try {
      const updates = Array.from(selectedLeads).map(leadId =>
        fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date_contacted: bulkContactedDate }),
        })
      );

      await Promise.all(updates);
      await fetchLeads(); // Refresh the list
      setSelectedLeads(new Set());
      setSelectAll(false);
      setBulkContactedDate('');
      alert(`Successfully updated ${selectedLeads.size} lead(s)!`);
    } catch (error) {
      console.error('Error bulk updating contacted dates:', error);
      alert('Failed to update some leads. Please try again.');
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const getStatusColor = (status: LeadStatus) => {
    const colors: Record<LeadStatus, string> = {
      lead_collected: 'bg-slate-100 text-slate-800',
      email_1_sent: 'bg-blue-100 text-blue-800',
      email_bounced: 'bg-red-100 text-red-800',
      followup_1_sent: 'bg-indigo-100 text-indigo-800',
      followup_2_sent: 'bg-purple-100 text-purple-800',
      followup_3_sent: 'bg-fuchsia-100 text-fuchsia-800',
      replied_not_fit: 'bg-orange-100 text-orange-800',
      replied_interested: 'bg-cyan-100 text-cyan-800',
      call_booked: 'bg-teal-100 text-teal-800',
      call_done_thinking: 'bg-yellow-100 text-yellow-800',
      won: 'bg-green-100 text-green-800',
      lost: 'bg-red-100 text-red-800',
      site_live: 'bg-violet-100 text-violet-800',
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  const formatStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getAutomationStageInfo = (stage: number) => {
    switch (stage) {
      case -1:
        return { label: 'Error', color: 'bg-red-100 text-red-800', icon: '❌' };
      case 0:
        return { label: 'Queued', color: 'bg-slate-100 text-slate-600', icon: '⏳' };
      case 1:
        return { label: 'Scraped', color: 'bg-yellow-100 text-yellow-800', icon: '🔍' };
      case 2:
        return { label: 'Analyzed', color: 'bg-green-100 text-green-800', icon: '✅' };
      default:
        return { label: 'Unknown', color: 'bg-slate-100 text-slate-600', icon: '?' };
    }
  };

  if (isLoading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM / Leads</h1>
          <p className="text-slate-500 mt-1">
            {selectedLeads.size > 0 
              ? `${selectedLeads.size} selected`
              : `${filteredLeads.length} ${hasActiveFilters ? 'filtered' : 'total'} leads`}
          </p>
        </div>
        
        {/* Search Field */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search name, email, company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 w-80 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        {selectedLeads.size > 0 && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={bulkContactedDate}
                onChange={(e) => setBulkContactedDate(e.target.value)}
                className="px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Set contacted date"
              />
              <button
                onClick={handleBulkSetContactedDate}
                disabled={!bulkContactedDate || isBulkUpdating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBulkUpdating ? 'Updating...' : `Set Date (${selectedLeads.size})`}
              </button>
            </div>
            <button
              onClick={handleDeleteSelected}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Delete ({selectedLeads.size})
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-medium text-slate-700">Filters:</span>
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as LeadStatus | '')}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="lead_collected">Lead Collected</option>
            <option value="email_1_sent">Email 1 Sent</option>
            <option value="followup_1_sent">Follow-up #1 sent</option>
            <option value="followup_2_sent">Follow-up #2 sent</option>
            <option value="followup_3_sent">Follow-up #3 sent (final)</option>
            <option value="email_bounced">Email Bounced</option>
            <option value="replied_not_fit">Replied - not a fit</option>
            <option value="replied_interested">Replied - interested</option>
            <option value="call_booked">Call booked</option>
            <option value="call_done_thinking">Call done - thinking</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="site_live">Site Live</option>
          </select>

          <select
            value={filterAutomationStage}
            onChange={(e) => setFilterAutomationStage(e.target.value === '' ? '' : Number(e.target.value))}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Automation</option>
            <option value="-1">❌ Error</option>
            <option value="0">⏳ Queued</option>
            <option value="1">🔍 Scraped</option>
            <option value="2">✅ Analyzed</option>
          </select>

          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            placeholder="From"
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            placeholder="To"
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter results count */}
      {hasActiveFilters && (
        <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
          Showing <span className="font-semibold text-slate-900">{filteredLeads.length}</span> of{' '}
          <span className="font-semibold text-slate-900">{leads.length}</span> leads
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={selectAll}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                </th>
                <th className="px-6 py-4">Prospect</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Follow-up Timeline</th>
                <th className="px-6 py-4">Automation</th>
                <th className="px-6 py-4">Persona Score</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Contacted</th>
                <th className="px-6 py-4">Last Touch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    {leads.length === 0 
                      ? 'No leads yet. Run an analysis to get started!' 
                      : 'No leads match the selected filters.'}
                  </td>
                </tr>
              ) : (
                paginatedLeads.map(lead => (
                  <tr 
                    key={lead.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/lead/${lead.id}`)}
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={selectedLeads.has(lead.id)}
                        onChange={(e) => handleSelectLead(lead.id, e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                      />
                    </td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                        {formatStatusLabel(lead.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <FollowupTimeline
                        dateContacted={lead.date_contacted}
                        followup1SentAt={lead.followup_1_sent_at}
                        followup2SentAt={lead.followup_2_sent_at}
                        followup3SentAt={lead.followup_3_sent_at}
                        status={lead.status}
                        compact={true}
                      />
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const stageInfo = getAutomationStageInfo(lead.automation_stage ?? 0);
                        return (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stageInfo.color}`}>
                              <span className="mr-1">{stageInfo.icon}</span>
                              {stageInfo.label}
                            </span>
                            {lead.automation_error && (
                              <span 
                                className="text-red-500 cursor-help text-xs"
                                title={lead.automation_error}
                              >
                                ⚠️
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500" 
                            style={{
                              width: lead.persona_score === 'high' ? '90%' : 
                                     lead.persona_score === 'medium' ? '60%' : '30%'
                            }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 capitalize">{lead.persona_score || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-US', { 
                          month: 'short', day: 'numeric', year: 'numeric' 
                        }) : 'N/A'}
                      </div>
                    </td>
                    <td 
                      className="px-6 py-4 cursor-pointer hover:bg-slate-100"
                      onClick={(e) => handleDateCellClick(lead.id, lead.date_contacted, e)}
                    >
                      {editingDateLeadId === lead.id ? (
                        <input
                          type="date"
                          value={tempDateValue}
                          onChange={(e) => setTempDateValue(e.target.value)}
                          onBlur={() => handleDateInputBlur(lead.id)}
                          onKeyDown={(e) => handleDateInputKeyDown(e, lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                          className="px-2 py-1 text-xs border border-indigo-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="w-3.5 h-3.5" />
                          {lead.date_contacted ? new Date(lead.date_contacted).toLocaleDateString('en-US', { 
                            month: 'short', day: 'numeric', year: 'numeric' 
                          }) : '-'}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="w-3.5 h-3.5" />
                        {lead.last_touch_date ? new Date(lead.last_touch_date).toLocaleDateString('en-US', { 
                          month: 'short', day: 'numeric', year: 'numeric' 
                        }) : '-'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filteredLeads.length > 0 && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Showing <span className="font-semibold">{startIndex + 1}</span> to{' '}
              <span className="font-semibold">{Math.min(endIndex, filteredLeads.length)}</span> of{' '}
              <span className="font-semibold">{filteredLeads.length}</span> leads
            </div>
            
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, idx) => {
                    const pageNum = idx + 1;
                    // Show first page, last page, current page, and pages around current
                    if (
                      pageNum === 1 ||
                      pageNum === totalPages ||
                      (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg ${
                            currentPage === pageNum
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    } else if (
                      pageNum === currentPage - 2 ||
                      pageNum === currentPage + 2
                    ) {
                      return <span key={pageNum} className="px-2 text-slate-400">...</span>;
                    }
                    return null;
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
