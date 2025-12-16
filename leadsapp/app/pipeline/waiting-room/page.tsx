'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Mail, Clock, AlertTriangle, Check, X, RefreshCw, 
  Trash2, XCircle, Play, Pause, Timer, Eye, Settings
} from 'lucide-react';
import Link from 'next/link';

interface QueueItem {
  id: string;
  lead_id: string;
  email_type: string;
  to_email: string;
  subject: string;
  body: string;
  scheduled_for: string;
  status: string;
  minutesRemaining: number;
  isOverdue: boolean;
  leads?: {
    id: string;
    name: string;
    email: string;
    company: string | null;
    status: string;
  };
}

interface FailedItem {
  id: string;
  lead_id: string;
  email_type: string;
  to_email: string;
  subject: string;
  error_message: string;
  retry_count: number;
  leads?: {
    name: string;
    company: string | null;
  };
}

type TabType = 'countdown' | 'failed';

export default function WaitingRoomPage() {
  const [activeTab, setActiveTab] = useState<TabType>('countdown');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [failedQueue, setFailedQueue] = useState<FailedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoQueueing, setIsAutoQueueing] = useState(false);
  const [message, setMessage] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  // Settings
  const [delayMinutes, setDelayMinutes] = useState(60);
  const [emailsPerHour, setEmailsPerHour] = useState(10);
  const [sendingSchedule, setSendingSchedule] = useState('business');
  const [sendingTimezone, setSendingTimezone] = useState('America/New_York');
  const [showSettings, setShowSettings] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedDelay = localStorage.getItem('gmail_delay_minutes');
    if (savedDelay) setDelayMinutes(parseInt(savedDelay, 10));
    
    const savedEmailsPerHour = localStorage.getItem('gmail_emails_per_hour');
    if (savedEmailsPerHour) setEmailsPerHour(parseInt(savedEmailsPerHour, 10));
    
    const savedSchedule = localStorage.getItem('gmail_sending_schedule');
    if (savedSchedule) setSendingSchedule(savedSchedule);
    
    const savedTimezone = localStorage.getItem('gmail_sending_timezone');
    if (savedTimezone) setSendingTimezone(savedTimezone);
  }, []);

  // Save delay setting when changed
  const handleDelayChange = (minutes: number) => {
    setDelayMinutes(minutes);
    localStorage.setItem('gmail_delay_minutes', minutes.toString());
  };

  // Fetch current queue with countdown
  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch('/api/gmail/auto-queue');
      if (response.ok) {
        const data = await response.json();
        setQueue(data.queue || []);
      }
    } catch (error) {
      console.error('Error fetching queue:', error);
    }
  }, []);

  // Fetch failed emails
  const fetchFailedQueue = useCallback(async () => {
    try {
      const response = await fetch('/api/gmail/process-queue?status=failed');
      if (response.ok) {
        const data = await response.json();
        const failed = (data.queue || []).filter((q: any) => q.status === 'failed');
        setFailedQueue(failed.map((f: any) => ({
          id: f.id,
          lead_id: f.lead_id,
          email_type: f.email_type,
          to_email: f.to_email,
          subject: f.subject,
          error_message: f.error_message || 'Unknown error',
          retry_count: f.retry_count || 0,
          leads: f.leads,
        })));
      }
    } catch (error) {
      console.error('Error fetching failed:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchQueue(), fetchFailedQueue()]);
      setIsLoading(false);
    };
    loadData();

    // Refresh every 10 seconds to update countdowns
    const interval = setInterval(() => {
      fetchQueue();
      fetchFailedQueue();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchQueue, fetchFailedQueue]);

  // Auto-queue all ready emails with the configured delay
  const handleAutoQueue = async () => {
    setIsAutoQueueing(true);
    setMessage('');

    try {
      const response = await fetch('/api/gmail/auto-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delayMinutes,
          emailsPerHour,
          sendingSchedule,
          sendingTimezone,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.total > 0) {
          setMessage(`🔥 ${result.total} emails queued! They will send in ${delayMinutes} minutes (review below to cancel any)`);
        } else {
          setMessage(`✓ No new emails to queue. All leads are up to date.`);
        }
        fetchQueue();
      } else {
        setMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      setIsAutoQueueing(false);
    }
  };

  // Cancel/remove from queue
  const handleCancel = async (queueId: string) => {
    try {
      const response = await fetch('/api/gmail/approve-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueIds: [queueId] }),
      });

      if (response.ok) {
        setMessage('✅ Email cancelled - will not send');
        fetchQueue();
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  // Cancel all queued emails
  const handleCancelAll = async () => {
    if (!confirm(`Are you sure you want to cancel all ${queue.length} queued emails?`)) return;

    const queueIds = queue.map(q => q.id);
    try {
      const response = await fetch('/api/gmail/approve-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueIds }),
      });

      if (response.ok) {
        setMessage(`✅ Cancelled ${queueIds.length} emails`);
        fetchQueue();
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  // Retry a failed email
  const handleRetryFailed = async (queueId: string) => {
    setRetrying(new Set(retrying.add(queueId)));
    
    try {
      const response = await fetch('/api/gmail/approve-queue', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queueIds: [queueId],
          emailsPerHour,
          sendingSchedule,
          sendingTimezone,
        }),
      });

      if (response.ok) {
        setMessage('✅ Email scheduled for retry');
        fetchQueue();
        fetchFailedQueue();
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      const newRetrying = new Set(retrying);
      newRetrying.delete(queueId);
      setRetrying(newRetrying);
    }
  };

  // Dismiss failed email
  const handleDismissFailed = async (queueId: string) => {
    try {
      const response = await fetch('/api/gmail/approve-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueIds: [queueId] }),
      });

      if (response.ok) {
        setMessage('✅ Dismissed failed email');
        fetchFailedQueue();
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (expandedItems.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getEmailTypeName = (type: string) => {
    switch (type) {
      case 'initial': return 'Initial Email';
      case 'followup_1': return 'Follow-up #1';
      case 'followup_2': return 'Follow-up #2';
      case 'followup_3': return 'Follow-up #3';
      default: return type;
    }
  };

  const getEmailTypeColor = (type: string) => {
    switch (type) {
      case 'initial': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'followup_1': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'followup_2': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'followup_3': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const formatTimeRemaining = (minutes: number) => {
    if (minutes <= 0) return 'Sending now...';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getCountdownColor = (minutes: number) => {
    if (minutes <= 0) return 'text-red-600 bg-red-50';
    if (minutes <= 10) return 'text-orange-600 bg-orange-50';
    if (minutes <= 30) return 'text-amber-600 bg-amber-50';
    return 'text-emerald-600 bg-emerald-50';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">⏱️ Email Waiting Room</h1>
          <p className="text-slate-600 mt-1">
            Inspection area — emails auto-send after the delay countdown
          </p>
        </div>
        <Link 
          href="/" 
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
        >
          ← Back to Pipeline
        </Link>
      </div>

      {/* Main Action: Auto-Queue with Delay */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <Timer className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Delayed Fuse Automation</h2>
              <p className="text-orange-100">
                Queue all ready emails with a {delayMinutes}-minute delay. 
                Cancel any before countdown ends.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={handleAutoQueue}
              disabled={isAutoQueueing}
              className="px-6 py-3 bg-white text-orange-600 rounded-xl font-bold hover:bg-orange-50 disabled:opacity-50 flex items-center gap-2"
            >
              {isAutoQueueing ? (
                <>
                  <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
                  Queueing...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Queue All Ready Emails
                </>
              )}
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-orange-100 mb-1">Delay (minutes)</label>
              <select
                value={delayMinutes}
                onChange={(e) => handleDelayChange(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value={15} className="text-slate-900">15 minutes</option>
                <option value={30} className="text-slate-900">30 minutes</option>
                <option value={60} className="text-slate-900">60 minutes (default)</option>
                <option value={120} className="text-slate-900">2 hours</option>
                <option value={240} className="text-slate-900">4 hours</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-orange-100 mb-1">Rate Limit</label>
              <select
                value={emailsPerHour}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setEmailsPerHour(val);
                  localStorage.setItem('gmail_emails_per_hour', val.toString());
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value={5} className="text-slate-900">5 per hour</option>
                <option value={10} className="text-slate-900">10 per hour</option>
                <option value={15} className="text-slate-900">15 per hour</option>
                <option value={20} className="text-slate-900">20 per hour</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-orange-100 mb-1">Schedule</label>
              <select
                value={sendingSchedule}
                onChange={(e) => {
                  setSendingSchedule(e.target.value);
                  localStorage.setItem('gmail_sending_schedule', e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="business" className="text-slate-900">Business (9am-6pm)</option>
                <option value="extended" className="text-slate-900">Extended (7am-9pm)</option>
                <option value="around_clock" className="text-slate-900">24/7</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-orange-100 mb-1">Timezone</label>
              <select
                value={sendingTimezone}
                onChange={(e) => {
                  setSendingTimezone(e.target.value);
                  localStorage.setItem('gmail_sending_timezone', e.target.value);
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
              >
                <option value="America/New_York" className="text-slate-900">Eastern</option>
                <option value="America/Chicago" className="text-slate-900">Central</option>
                <option value="America/Denver" className="text-slate-900">Mountain</option>
                <option value="America/Los_Angeles" className="text-slate-900">Pacific</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          message.includes('❌') ? 'bg-red-50 border border-red-200 text-red-700' :
          message.includes('🔥') ? 'bg-orange-50 border border-orange-200 text-orange-700' :
          'bg-slate-100 border border-slate-200 text-slate-700'
        }`}>
          {message}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('countdown')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'countdown'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <Timer className="w-4 h-4" />
            Countdown Queue ({queue.length})
          </span>
        </button>
        <button
          onClick={() => setActiveTab('failed')}
          className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'failed'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Failed ({failedQueue.length})
          </span>
        </button>
      </div>

      {/* Countdown Queue Tab */}
      {activeTab === 'countdown' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-orange-600 to-amber-500 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Timer className="w-5 h-5" />
                Emails in Countdown ({queue.length})
              </h2>
              <p className="text-orange-100 text-sm">
                These emails will auto-send when their countdown reaches zero
              </p>
            </div>
            {queue.length > 0 && (
              <button
                onClick={handleCancelAll}
                className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 font-medium text-sm flex items-center gap-2"
              >
                <Pause className="w-4 h-4" />
                Cancel All
              </button>
            )}
          </div>
          
          {queue.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Timer className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium">No emails in queue</p>
              <p className="text-sm mt-1">
                Click &quot;Queue All Ready Emails&quot; above to start the countdown
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {queue.map((item) => {
                const isExpanded = expandedItems.has(item.id);
                
                return (
                  <div key={item.id} className="bg-white">
                    {/* Row */}
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        {/* Countdown Badge */}
                        <div className={`px-3 py-2 rounded-lg font-mono font-bold text-lg min-w-[80px] text-center ${getCountdownColor(item.minutesRemaining)}`}>
                          {formatTimeRemaining(item.minutesRemaining)}
                        </div>
                        
                        {/* Email Type */}
                        <div className={`px-2 py-1 rounded text-xs font-medium border ${getEmailTypeColor(item.email_type)}`}>
                          {getEmailTypeName(item.email_type)}
                        </div>
                        
                        {/* Lead Info */}
                        <div className="flex-1">
                          <div className="font-medium text-slate-900">{item.leads?.name || 'Unknown'}</div>
                          <div className="text-sm text-slate-500">{item.to_email}</div>
                        </div>
                        
                        {/* Scheduled Time */}
                        <div className="text-right text-sm">
                          <div className="text-slate-600">
                            Sends at {new Date(item.scheduled_for).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </div>
                          <div className="text-slate-400 text-xs">
                            {new Date(item.scheduled_for).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            })}
                          </div>
                        </div>
                      </div>
                      
                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={() => toggleExpand(item.id)}
                          className="p-2 text-slate-500 hover:bg-slate-100 rounded"
                          title="Preview email"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCancel(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"
                          title="Cancel - will not send"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Expanded Preview */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden mt-3">
                          <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                            <h4 className="font-semibold text-slate-700 text-sm">📧 Email Preview</h4>
                          </div>
                          <div className="p-4 space-y-2 text-sm">
                            <div>
                              <span className="text-slate-500">To:</span>{' '}
                              <span className="text-slate-900">{item.to_email}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Subject:</span>{' '}
                              <span className="text-slate-900 font-medium">{item.subject}</span>
                            </div>
                            <div className="border-t border-slate-200 pt-2 mt-2">
                              <span className="text-slate-500">Body:</span>
                              <pre className="mt-2 text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-200 text-sm font-sans">
                                {item.body}
                              </pre>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          <Link 
                            href={`/lead/${item.lead_id}`}
                            className="text-sm text-indigo-600 hover:underline"
                          >
                            View Lead Details →
                          </Link>
                          <button
                            onClick={() => handleCancel(item.id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Cancel Send
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Failed Tab */}
      {activeTab === 'failed' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Failed Emails ({failedQueue.length})
              </h2>
              <p className="text-red-100 text-sm">These emails failed to send. Retry or dismiss them.</p>
            </div>
          </div>
          
          {failedQueue.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Check className="w-12 h-12 mx-auto mb-3 text-emerald-300" />
              <p>No failed emails! 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-red-100">
              {failedQueue.map((item) => (
                <div key={item.id} className="p-4 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`px-2 py-1 rounded text-xs font-medium ${getEmailTypeColor(item.email_type)}`}>
                        {getEmailTypeName(item.email_type)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-900">{item.leads?.name || 'Unknown'}</div>
                        <div className="text-sm text-slate-500">{item.to_email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-red-600 font-medium">
                        {item.retry_count > 0 ? `${item.retry_count} retries` : 'First attempt'}
                      </div>
                      <button
                        onClick={() => handleRetryFailed(item.id)}
                        disabled={retrying.has(item.id)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded disabled:opacity-50"
                        title="Retry now"
                      >
                        {retrying.has(item.id) ? (
                          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDismissFailed(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded"
                        title="Dismiss"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                    <div className="text-red-700 font-medium mb-1">Error:</div>
                    <div className="text-red-600">{item.error_message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* How it works */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
        <h3 className="font-bold text-slate-900 mb-3">ℹ️ How the Waiting Room Works</h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm text-slate-600">
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-orange-600 font-bold">1</span>
            </div>
            <div>
              <div className="font-medium text-slate-900">Queue with Delay</div>
              <div>Click &quot;Queue All Ready&quot; to add emails with a {delayMinutes}-minute countdown</div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-orange-600 font-bold">2</span>
            </div>
            <div>
              <div className="font-medium text-slate-900">Inspect & Review</div>
              <div>Preview each email. Cancel any that look wrong before the countdown ends</div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-orange-600 font-bold">3</span>
            </div>
            <div>
              <div className="font-medium text-slate-900">Auto-Send</div>
              <div>When countdown hits zero, the cron job sends the email automatically</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
