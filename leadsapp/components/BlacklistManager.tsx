'use client';

import { useState, useEffect } from 'react';
import { Shield, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface BlacklistedDomain {
  id: string;
  domain: string;
  reason: string;
  blacklisted_by: string;
  blacklisted_at: string;
}

export function BlacklistManager() {
  const [domains, setDomains] = useState<BlacklistedDomain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newReason, setNewReason] = useState('');

  useEffect(() => {
    fetchBlacklist();
  }, []);

  const fetchBlacklist = async () => {
    try {
      const response = await fetch('/api/blacklist');
      if (response.ok) {
        const data = await response.json();
        setDomains(data.domains || []);
      }
    } catch (error) {
      console.error('Failed to fetch blacklist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addDomain = async () => {
    if (!newDomain.trim()) return;

    setIsAdding(true);
    try {
      const response = await fetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newDomain.trim(),
          reason: newReason.trim() || 'No reason provided',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Domain blacklisted! ${data.updatedLeadsCount} existing lead(s) marked as Lost.`);
        setNewDomain('');
        setNewReason('');
        fetchBlacklist();
      } else {
        const error = await response.json();
        alert(`Failed to add domain: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to add domain:', error);
      alert('Error adding domain to blacklist');
    } finally {
      setIsAdding(false);
    }
  };

  const removeDomain = async (domain: string) => {
    if (!confirm(`Remove ${domain} from blacklist? Existing leads will NOT be updated.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/blacklist?domain=${encodeURIComponent(domain)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Domain removed from blacklist');
        fetchBlacklist();
      } else {
        alert('Failed to remove domain from blacklist');
      }
    } catch (error) {
      console.error('Failed to remove domain:', error);
      alert('Error removing domain from blacklist');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-red-600" />
        <h2 className="text-2xl font-bold text-slate-900">Domain Blacklist</h2>
      </div>

      {/* Warning */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
          <div className="text-sm text-orange-800">
            <p className="font-semibold mb-1">Blacklisting a domain will:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Automatically mark all existing leads with this domain as "Lost"</li>
              <li>Flag any future leads with this domain with a warning</li>
              <li>Prevent accidental outreach to blacklisted contacts</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Domain Form */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Domain to Blacklist</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Domain
            </label>
            <input
              type="text"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reason (optional)
            </label>
            <textarea
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              placeholder="Why is this domain being blacklisted?"
              rows={3}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={addDomain}
            disabled={isAdding || !newDomain.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            {isAdding ? 'Adding...' : 'Add to Blacklist'}
          </button>
        </div>
      </div>

      {/* Blacklisted Domains List */}
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">
            Blacklisted Domains ({domains.length})
          </h3>
        </div>
        {domains.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">
            No domains blacklisted yet
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {domains.map((domain) => (
              <div key={domain.id} className="px-6 py-4 hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-900">{domain.domain}</span>
                      <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded">
                        Blacklisted
                      </span>
                    </div>
                    {domain.reason && (
                      <p className="text-sm text-slate-600 mt-1">{domain.reason}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      <span>By: {domain.blacklisted_by}</span>
                      <span>
                        {new Date(domain.blacklisted_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeDomain(domain.domain)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    title="Remove from blacklist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
