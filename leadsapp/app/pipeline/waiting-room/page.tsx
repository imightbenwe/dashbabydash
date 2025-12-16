'use client';

import { useState, useEffect } from 'react';
import { Mail, User, Building, AlertTriangle, Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import emailTemplates from '@/lib/email-templates.json';

interface PreviewItem {
  leadId: string;
  leadName: string;
  email: string;
  company: string | null;
  emailType: 'initial' | 'followup_1' | 'followup_2' | 'followup_3';
  reason: string;
}

interface AttentionItem extends PreviewItem {
  issues: string[];
  queueId?: string;
  isFailed?: boolean;
}

interface EmailPreview {
  to: string;
  subject: string;
  body: string;
  leadId: string;
  leadName: string;
  emailType: string;
}

export default function WaitingRoomPage() {
  const [previewQueue, setPreviewQueue] = useState<PreviewItem[]>([]);
  const [requiresAttention, setRequiresAttention] = useState<AttentionItem[]>([]);
  const [approvedQueue, setApprovedQueue] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [emailPreviews, setEmailPreviews] = useState<Map<string, EmailPreview>>(new Map());
  const [approving, setApproving] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');

  // Settings from localStorage
  const [emailsPerHour, setEmailsPerHour] = useState(10);
  const [sendingSchedule, setSendingSchedule] = useState('business');
  const [sendingTimezone, setSendingTimezone] = useState('America/New_York');

  useEffect(() => {
    const savedEmailsPerHour = localStorage.getItem('gmail_emails_per_hour');
    if (savedEmailsPerHour) setEmailsPerHour(parseInt(savedEmailsPerHour, 10));
    
    const savedSchedule = localStorage.getItem('gmail_sending_schedule');
    if (savedSchedule) setSendingSchedule(savedSchedule);
    
    const savedTimezone = localStorage.getItem('gmail_sending_timezone');
    if (savedTimezone) setSendingTimezone(savedTimezone);
  }, []);

  // Fetch preview queue (what COULD be sent)
  const fetchPreviewQueue = async () => {
    try {
      const response = await fetch('/api/gmail/approve-queue');
      if (response.ok) {
        const data = await response.json();
        setPreviewQueue(data.preview || []);
        setRequiresAttention(data.requiresAttention || []);
      }
    } catch (error) {
      console.error('Error fetching preview:', error);
    }
  };

  // Fetch approved queue (what's waiting to send)
  const fetchApprovedQueue = async () => {
    try {
      const response = await fetch('/api/gmail/process-queue');
      if (response.ok) {
        const data = await response.json();
        setApprovedQueue(data.queue || []);
      }
    } catch (error) {
      console.error('Error fetching approved:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchPreviewQueue(), fetchApprovedQueue()]);
      setIsLoading(false);
    };
    loadData();

    const interval = setInterval(() => {
      fetchPreviewQueue();
      fetchApprovedQueue();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Generate email preview for an item
  const generateEmailPreview = async (item: PreviewItem): Promise<EmailPreview> => {
    // Fetch lead details INCLUDING generated emails
    const response = await fetch(`/api/leads/${item.leadId}`);
    const leadData = response.ok ? await response.json() : null;
    const lead = leadData?.lead || { name: item.leadName, initial_email_subject: null };
    const emails = leadData?.emails || [];

    const firstName = item.leadName.split(' ')[0];
    const originalSubject = lead.initial_email_subject || 'Quick note after seeing your work';

    let subject = '';
    let body = '';

    if (item.emailType === 'initial') {
      // For initial email, use the GENERATED email from AI analysis (has emailOpening replaced)
      const generatedInitial = emails.find((e: any) => e.email_type === 'initial');
      if (generatedInitial) {
        subject = generatedInitial.subject;
        body = generatedInitial.body;
      } else {
        // Fallback to template (will show {emailOpening} placeholder - not ideal)
        const template = (emailTemplates as any).initial;
        subject = template.subject;
        body = template.body.replace(/{firstName}/g, firstName);
      }
    } else {
      // For follow-ups, use the template (no emailOpening needed)
      const templateKey = `auto_${item.emailType}` as keyof typeof emailTemplates;
      const template = (emailTemplates as any)[templateKey];
      
      if (!template) {
        console.error(`Template not found for: auto_${item.emailType}`);
        return {
          to: item.email,
          subject: 'ERROR: Template not found',
          body: `Could not find template for ${item.emailType}`,
          leadId: item.leadId,
          leadName: item.leadName,
          emailType: item.emailType,
        };
      }
      
      subject = template.subject === 'RE:' ? `Re: ${originalSubject}` : template.subject;
      body = template.body
        .replace(/{firstName}/g, firstName)
        .replace(/{originalSubject}/g, originalSubject);
    }

    return {
      to: item.email,
      subject,
      body,
      leadId: item.leadId,
      leadName: item.leadName,
      emailType: item.emailType,
    };
  };

  // Toggle expanded view for an item
  const toggleExpand = async (item: PreviewItem) => {
    const key = `${item.leadId}:${item.emailType}`;
    const newExpanded = new Set(expandedItems);

    if (expandedItems.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
      // Generate preview if not already done
      if (!emailPreviews.has(key)) {
        const preview = await generateEmailPreview(item);
        setEmailPreviews(new Map(emailPreviews.set(key, preview)));
      }
    }

    setExpandedItems(newExpanded);
  };

  // Approve a single item
  const handleApprove = async (item: PreviewItem) => {
    const key = `${item.leadId}:${item.emailType}`;
    setApproving(new Set(approving.add(key)));

    try {
      const response = await fetch('/api/gmail/approve-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ leadId: item.leadId, emailType: item.emailType }],
          emailsPerHour,
          sendingSchedule,
          sendingTimezone,
        }),
      });

      const result = await response.json();

      if (result.success && result.totalApproved > 0) {
        setMessage(`✅ Approved: ${item.leadName} - ${getEmailTypeName(item.emailType)}`);
        fetchPreviewQueue();
        fetchApprovedQueue();
      } else if (result.skipped?.length > 0) {
        setMessage(`⚠️ Skipped: ${result.skipped[0].reason}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    } finally {
      const newApproving = new Set(approving);
      newApproving.delete(key);
      setApproving(newApproving);
    }
  };

  // Remove from approved queue
  const handleRemoveApproved = async (queueId: string) => {
    try {
      const response = await fetch('/api/gmail/approve-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueIds: [queueId] }),
      });

      if (response.ok) {
        setMessage('✅ Removed from queue');
        fetchApprovedQueue();
        fetchPreviewQueue();
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
  };

  // Dismiss failed item (remove from attention queue)
  const handleDismissFailed = async (queueId: string) => {
    try {
      const response = await fetch('/api/gmail/approve-queue', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueIds: [queueId] }),
      });

      if (response.ok) {
        setMessage('✅ Dismissed failed email');
        fetchPreviewQueue();
      }
    } catch (error) {
      setMessage(`❌ Error: ${error}`);
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Email Waiting Room</h1>
          <p className="text-slate-600 mt-1">Review exact email content before approving for send</p>
        </div>
        <Link 
          href="/" 
          className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200"
        >
          ← Back to Pipeline
        </Link>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {/* Approved Queue (Ready to Send) */}
      {approvedQueue.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl overflow-hidden">
          <div className="bg-emerald-600 text-white px-6 py-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Check className="w-5 h-5" />
              Approved & Scheduled ({approvedQueue.length})
            </h2>
            <p className="text-emerald-100 text-sm">These emails will send at their scheduled times</p>
          </div>
          <div className="divide-y divide-emerald-200">
            {approvedQueue.map((item) => (
              <div key={item.id} className="p-4 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`px-2 py-1 rounded text-xs font-medium ${getEmailTypeColor(item.email_type)}`}>
                      {getEmailTypeName(item.email_type)}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{item.leads?.name}</div>
                      <div className="text-sm text-slate-500">{item.to_email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-700">
                        {new Date(item.scheduled_for).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                        })}
                      </div>
                      <div className="text-xs text-slate-500">Scheduled</div>
                    </div>
                    <button
                      onClick={() => handleRemoveApproved(item.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {/* Show email content */}
                <div className="mt-3 bg-slate-50 rounded-lg p-3 text-sm">
                  <div className="text-slate-500 mb-1">Subject: <span className="text-slate-900 font-medium">{item.subject}</span></div>
                  <div className="text-slate-700 whitespace-pre-wrap">{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Review Queue */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-amber-500 text-white px-6 py-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Pending Review ({previewQueue.length})
          </h2>
          <p className="text-amber-100 text-sm">Click to expand and see exact email content before approving</p>
        </div>

        {previewQueue.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>No emails pending review</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {previewQueue.map((item) => {
              const key = `${item.leadId}:${item.emailType}`;
              const isExpanded = expandedItems.has(key);
              const preview = emailPreviews.get(key);
              const isApproving = approving.has(key);

              return (
                <div key={key} className="bg-white">
                  {/* Collapsed Row */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-slate-50 flex items-center justify-between"
                    onClick={() => toggleExpand(item)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`px-2 py-1 rounded text-xs font-medium border ${getEmailTypeColor(item.emailType)}`}>
                        {getEmailTypeName(item.emailType)}
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="font-medium text-slate-900">{item.leadName}</span>
                      </div>
                      {item.company && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <Building className="w-4 h-4" />
                          <span>{item.company}</span>
                        </div>
                      )}
                      <span className="text-sm text-slate-400">{item.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-500">{item.reason}</span>
                      <button className="p-1 text-slate-400">
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-50 border-t border-slate-100">
                      {preview ? (
                        <div className="space-y-4">
                          {/* Raw Email Data */}
                          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
                              <h4 className="font-semibold text-slate-700 text-sm">📧 EXACT EMAIL TO BE SENT</h4>
                            </div>
                            <div className="p-4 space-y-3 font-mono text-sm">
                              <div>
                                <span className="text-slate-500">To:</span>{' '}
                                <span className="text-slate-900 font-medium">{preview.to}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Subject:</span>{' '}
                                <span className="text-slate-900 font-medium">{preview.subject}</span>
                              </div>
                              <div className="border-t border-slate-200 pt-3">
                                <span className="text-slate-500">Body:</span>
                                <pre className="mt-2 text-slate-900 whitespace-pre-wrap bg-slate-50 p-3 rounded border border-slate-200">
                                  {preview.body}
                                </pre>
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center justify-between">
                            <Link 
                              href={`/lead/${item.leadId}`}
                              className="text-sm text-indigo-600 hover:underline"
                            >
                              View Lead Details →
                            </Link>
                            <div className="flex gap-3">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpand(item);
                                }}
                                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApprove(item);
                                }}
                                disabled={isApproving}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                              >
                                {isApproving ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Approving...
                                  </>
                                ) : (
                                  <>
                                    <Check className="w-4 h-4" />
                                    Approve & Schedule
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4 text-center">
                          <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto" />
                          <p className="text-sm text-slate-500 mt-2">Loading email preview...</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SKIPPED / MISFITS - Collapsed section at the bottom */}
      {requiresAttention.length > 0 && (
        <details className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
          <summary className="bg-slate-200 text-slate-700 px-6 py-3 cursor-pointer hover:bg-slate-300 flex items-center justify-between">
            <span className="font-medium">
              Skipped ({requiresAttention.length}) — missing data, can't send
            </span>
          </summary>
          <div className="divide-y divide-slate-200">
            {requiresAttention.map((item) => {
              const key = `skipped:${item.leadId}:${item.emailType}`;
              return (
                <div key={key} className="p-3 bg-white flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-0.5 rounded text-xs font-medium border ${getEmailTypeColor(item.emailType)}`}>
                      {getEmailTypeName(item.emailType)}
                    </div>
                    <span className="font-medium text-slate-700">{item.leadName}</span>
                    {item.company && <span className="text-slate-400">• {item.company}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-xs">{item.issues.join(', ')}</span>
                    <Link 
                      href={`/lead/${item.leadId}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </Link>
                    {item.isFailed && item.queueId && (
                      <button
                        onClick={() => handleDismissFailed(item.queueId!)}
                        className="text-xs text-slate-500 hover:text-slate-700"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
