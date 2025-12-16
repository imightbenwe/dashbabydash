'use client';

import { useState, useEffect } from 'react';
import { Mail, RefreshCw, CheckCircle, XCircle, Link, Unlink, AlertTriangle, ToggleLeft, ToggleRight, Clock, Zap, Info } from 'lucide-react';

interface GmailStatus {
  connected: boolean;
  userEmail: string | null;
  lastSync: {
    completedAt: string;
    emailsProcessed: number;
    leadsUpdated: number;
  } | null;
}

// Sync interval options (in minutes)
const SYNC_INTERVAL_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
];

// Email rate limit options
const EMAIL_RATE_OPTIONS = [
  { value: 1, label: '1 email/hour (Testing)' },
  { value: 5, label: '5 emails/hour (Very Safe)' },
  { value: 10, label: '10 emails/hour (Safe)' },
  { value: 15, label: '15 emails/hour (Moderate)' },
  { value: 20, label: '20 emails/hour (Standard)' },
  { value: 30, label: '30 emails/hour (Aggressive)' },
];

// Sending schedule options
const SENDING_SCHEDULE_OPTIONS = [
  { value: 'business', label: 'Business hours only (9 AM - 6 PM)' },
  { value: 'extended', label: 'Extended hours (7 AM - 9 PM)' },
  { value: 'around_clock', label: 'Around the clock (24/7)' },
];

// Timezone options for sending schedule
const TIMEZONE_OPTIONS = [
  { value: 'America/New_York', label: 'US Eastern (ET)' },
  { value: 'America/Chicago', label: 'US Central (CT)' },
  { value: 'America/Denver', label: 'US Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (PT)' },
  { value: 'America/Anchorage', label: 'US Alaska (AKT)' },
  { value: 'Pacific/Honolulu', label: 'US Hawaii (HT)' },
  { value: 'Europe/London', label: 'UK (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Central Europe (CET)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Australia Eastern (AEST)' },
];

export function GmailSync() {
  const [status, setStatus] = useState<GmailStatus>({ connected: false, userEmail: null, lastSync: null });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  
  // Test Mode - prevents automatic email sending
  const [testMode, setTestMode] = useState(true); // Default to safe mode
  
  // Sync interval setting (in minutes)
  const [syncInterval, setSyncInterval] = useState(60); // Default 1 hour
  
  // Email rate limiting settings
  const [emailsPerHour, setEmailsPerHour] = useState(10); // Default 10 per hour
  const [sendingSchedule, setSendingSchedule] = useState('business'); // Default business hours
  const [sendingTimezone, setSendingTimezone] = useState('America/New_York'); // Default US Eastern
  
  // Load all settings from localStorage
  useEffect(() => {
    const savedTestMode = localStorage.getItem('gmail_test_mode');
    if (savedTestMode !== null) {
      setTestMode(savedTestMode === 'true');
    }
    
    const savedSyncInterval = localStorage.getItem('gmail_sync_interval');
    if (savedSyncInterval !== null) {
      setSyncInterval(parseInt(savedSyncInterval, 10));
    }
    
    const savedEmailsPerHour = localStorage.getItem('gmail_emails_per_hour');
    if (savedEmailsPerHour !== null) {
      setEmailsPerHour(parseInt(savedEmailsPerHour, 10));
    }
    
    const savedSendingSchedule = localStorage.getItem('gmail_sending_schedule');
    if (savedSendingSchedule !== null) {
      setSendingSchedule(savedSendingSchedule);
    }
    
    const savedTimezone = localStorage.getItem('gmail_sending_timezone');
    if (savedTimezone !== null) {
      setSendingTimezone(savedTimezone);
    }
  }, []);
  
  // Save test mode preference
  const toggleTestMode = () => {
    const newValue = !testMode;
    setTestMode(newValue);
    localStorage.setItem('gmail_test_mode', String(newValue));
  };
  
  // Save sync interval
  const handleSyncIntervalChange = (value: number) => {
    setSyncInterval(value);
    localStorage.setItem('gmail_sync_interval', String(value));
  };
  
  // Save emails per hour
  const handleEmailsPerHourChange = (value: number) => {
    setEmailsPerHour(value);
    localStorage.setItem('gmail_emails_per_hour', String(value));
  };
  
  // Save sending schedule
  const handleSendingScheduleChange = (value: string) => {
    setSendingSchedule(value);
    localStorage.setItem('gmail_sending_schedule', value);
  };
  
  // Save sending timezone
  const handleTimezoneChange = (value: string) => {
    setSendingTimezone(value);
    localStorage.setItem('gmail_sending_timezone', value);
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

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail? You will need to reconnect and re-authorize to use Gmail features again.')) {
      return;
    }
    
    try {
      // Clear local storage
      localStorage.removeItem('gmail_user_email');
      
      // Clear server-side tokens (if API exists)
      if (userEmail) {
        await fetch('/api/gmail/disconnect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userEmail }),
        }).catch(() => {}); // Don't fail if API doesn't exist
      }
      
      // Reset state
      setStatus({ connected: false, userEmail: null, lastSync: null });
      setUserEmail('');
      
      alert('Gmail disconnected. Click "Connect Gmail" to reconnect with updated permissions.');
    } catch (error) {
      console.error('Disconnect error:', error);
      // Still reset local state even if server call fails
      localStorage.removeItem('gmail_user_email');
      setStatus({ connected: false, userEmail: null, lastSync: null });
      setUserEmail('');
    }
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
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-600 mb-1">Connected Account</div>
                <div className="font-medium text-slate-900">{status.userEmail}</div>
              </div>
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                title="Disconnect Gmail account"
              >
                <Unlink className="w-4 h-4" />
                Disconnect
              </button>
            </div>
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

          {/* Sync Interval Setting */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-slate-600" />
              <span className="font-medium text-slate-900">Auto-Sync Interval</span>
            </div>
            <select
              value={syncInterval}
              onChange={(e) => handleSyncIntervalChange(Number(e.target.value))}
              className="w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {SYNC_INTERVAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2">
              Gmail will sync automatically at this interval to track sent emails and detect replies.
            </p>
          </div>

          {/* Email Rate Limiting - Only show if NOT in test mode */}
          {!testMode && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-indigo-600" />
                <span className="font-medium text-indigo-900">Automatic Email Rate Limits</span>
              </div>
              
              {/* Emails per hour */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">Maximum emails per hour</label>
                  <select
                    value={emailsPerHour}
                    onChange={(e) => handleEmailsPerHourChange(Number(e.target.value))}
                    className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    {EMAIL_RATE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sending schedule */}
                <div>
                  <label className="text-sm text-slate-700 mb-1 block">Sending schedule</label>
                  <select
                    value={sendingSchedule}
                    onChange={(e) => handleSendingScheduleChange(e.target.value)}
                    className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                  >
                    {SENDING_SCHEDULE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Timezone - only show if not 24/7 */}
                {sendingSchedule !== 'around_clock' && (
                  <div>
                    <label className="text-sm text-slate-700 mb-1 block">Timezone for sending hours</label>
                    <select
                      value={sendingTimezone}
                      onChange={(e) => handleTimezoneChange(e.target.value)}
                      className="w-full p-2.5 border border-indigo-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      {TIMEZONE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Daily estimate */}
                <div className="bg-white/70 rounded-lg p-3 mt-2">
                  <div className="flex items-center gap-2 text-sm text-indigo-800">
                    <Info className="w-4 h-4" />
                    <span className="font-medium">Daily email estimate:</span>
                    <span>
                      {sendingSchedule === 'business' 
                        ? `~${emailsPerHour * 9} emails/day`
                        : sendingSchedule === 'extended'
                        ? `~${emailsPerHour * 14} emails/day`
                        : `~${emailsPerHour * 24} emails/day`
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Best Practices Info */}
              <div className="mt-4 pt-3 border-t border-indigo-200">
                <div className="text-xs text-indigo-800 space-y-1.5">
                  <p className="font-semibold flex items-center gap-1">📧 Email Sending Best Practices:</p>
                  <ul className="list-disc list-inside space-y-1 text-indigo-700">
                    <li><strong>New accounts:</strong> Start with 5-10 emails/hour, increase gradually over 2-4 weeks</li>
                    <li><strong>Established accounts:</strong> 15-20 emails/hour is generally safe</li>
                    <li><strong>Business hours:</strong> Emails sent 9 AM - 6 PM have 23% higher open rates</li>
                    <li><strong>Daily limit:</strong> Keep under 100-150 emails/day to avoid spam filters</li>
                    <li><strong>Warm-up period:</strong> If sending to cold leads, ramp up slowly over time</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

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
                <span>Sync happens automatically at your chosen interval</span>
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
