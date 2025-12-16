'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCw, CheckCircle, XCircle, Link, Unlink, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';

interface GmailStatus {
  connected: boolean;
  userEmail: string | null;
  lastSync: {
    completedAt: string;
    emailsProcessed: number;
    leadsUpdated: number;
  } | null;
}

export function GmailSync() {
  const [status, setStatus] = useState<GmailStatus>({ connected: false, userEmail: null, lastSync: null });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  
  // Test Mode - prevents automatic email sending
  const [testMode, setTestMode] = useState(true); // Default to safe mode
  
  // Load test mode preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gmail_test_mode');
    if (saved !== null) {
      setTestMode(saved === 'true');
    }
  }, []);
  
  // Save test mode preference
  const toggleTestMode = () => {
    const newValue = !testMode;
    setTestMode(newValue);
    localStorage.setItem('gmail_test_mode', String(newValue));
  };

  useEffect(() => {
    // Check for URL parameters (after OAuth redirect)
    const params = new URLSearchParams(window.location.search);
    const connectedEmail = params.get('gmail_connected');
    const error = params.get('gmail_error');

    if (connectedEmail) {
      setUserEmail(connectedEmail);
      // Save to localStorage immediately
      localStorage.setItem('gmail_user_email', connectedEmail);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (error) {
      alert(`Gmail connection error: ${error}`);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Load initial status
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setIsLoading(true);
      
      // Try to get email from localStorage or use provided
      const email = userEmail || localStorage.getItem('gmail_user_email');
      if (!email) {
        setStatus({ connected: false, userEmail: null, lastSync: null });
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/gmail/sync?userEmail=${encodeURIComponent(email)}`);
      const data = await response.json();
      
      setStatus(data);
      
      if (data.connected && data.userEmail) {
        setUserEmail(data.userEmail);
        localStorage.setItem('gmail_user_email', data.userEmail);
      }
    } catch (error) {
      console.error('Failed to check Gmail status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    // Redirect to OAuth flow
    window.location.href = '/api/gmail/auth';
  };

  const handleSync = async (reset: boolean = false) => {
    if (!userEmail) return;

    try {
      setIsSyncing(true);
      
      if (reset && !confirm('This will clear all cached email data and re-sync from Gmail. Follow-up dates will be recalculated. Continue?')) {
        setIsSyncing(false);
        return;
      }
      
      const response = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail, reset }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ Synced ${data.result.emailsProcessed} emails, updated ${data.result.leadsUpdated} leads!`);
        checkStatus(); // Refresh status
      } else {
        alert(`❌ Sync failed: ${data.error}`);
      }
    } catch (error) {
      alert('❌ Failed to sync Gmail');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-sm border border-blue-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-slate-900">Gmail Integration</h2>
        </div>
        
        {status.connected ? (
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-700">Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <XCircle className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-500">Not Connected</span>
          </div>
        )}
      </div>

      {status.connected ? (
        <div className="space-y-4">
          {/* Connected status */}
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-slate-600 mb-1">Connected Account</div>
            <div className="font-medium text-slate-900">{status.userEmail}</div>
          </div>

          {/* Last sync info */}
          {status.lastSync && (
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <div className="text-sm text-slate-600 mb-2">Last Sync</div>
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-slate-600">Time:</span>{' '}
                  <span className="font-medium text-slate-900">
                    {new Date(status.lastSync.completedAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-600">Emails Processed:</span>{' '}
                  <span className="font-medium text-slate-900">{status.lastSync.emailsProcessed}</span>
                </div>
                <div>
                  <span className="text-slate-600">Leads Updated:</span>{' '}
                  <span className="font-medium text-slate-900">{status.lastSync.leadsUpdated}</span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => handleSync(false)}
              disabled={isSyncing}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isSyncing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Sync Now
                </>
              )}
            </button>
            <button
              onClick={() => handleSync(true)}
              disabled={isSyncing}
              className="flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-3 rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              title="Clear cache and re-sync all emails from scratch"
            >
              Reset & Re-sync
            </button>
          </div>

          {/* Info */}
          <div className="text-xs text-slate-600 bg-blue-50 rounded-lg p-3 border border-blue-100">
            <p className="font-medium mb-1">Automatic Sync</p>
            <p>Gmail syncs automatically every hour to:</p>
            <ul className="list-disc list-inside mt-1 space-y-0.5">
              <li>Track sent follow-ups and update lead status</li>
              <li>Detect replies from prospects</li>
              <li>Update last touch dates</li>
            </ul>
          </div>
          
          {/* Test Mode Toggle */}
          <div className={`rounded-lg p-4 border ${
            testMode 
              ? 'bg-amber-50 border-amber-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {testMode ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                )}
                <div>
                  <div className={`font-medium ${
                    testMode ? 'text-amber-900' : 'text-green-900'
                  }`}>
                    {testMode ? 'Test Mode' : 'Live Mode'}
                  </div>
                  <div className={`text-sm ${
                    testMode ? 'text-amber-700' : 'text-green-700'
                  }`}>
                    {testMode 
                      ? 'Emails will NOT be sent automatically' 
                      : 'Automatic email sending is enabled'}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleTestMode}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  testMode
                    ? 'bg-amber-200 text-amber-800 hover:bg-amber-300'
                    : 'bg-green-200 text-green-800 hover:bg-green-300'
                }`}
              >
                {testMode ? (
                  <>
                    <ToggleLeft className="w-5 h-5" />
                    <span>Enable Live</span>
                  </>
                ) : (
                  <>
                    <ToggleRight className="w-5 h-5" />
                    <span>Switch to Test</span>
                  </>
                )}
              </button>
            </div>
            {testMode && (
              <p className="text-xs text-amber-600 mt-2">
                💡 While in Test Mode, follow-up emails will be prepared but you must manually send them. Turn off Test Mode when you're ready for full automation.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-slate-600 text-sm">
            Connect your Gmail account to automatically sync sent and received emails with your leads.
          </p>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="text-sm font-medium text-slate-900 mb-2">What happens when you connect:</div>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Automatically track when follow-ups are sent</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Detect replies and update lead status</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Keep last touch dates accurate</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Sync happens automatically every hour</span>
              </li>
            </ul>
          </div>

          <button
            onClick={handleConnect}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Link className="w-4 h-4" />
            Connect Gmail
          </button>

          <p className="text-xs text-slate-500 text-center">
            We only access emails sent to/from your leads. Your data is secure.
          </p>
        </div>
      )}
    </div>
  );
}
