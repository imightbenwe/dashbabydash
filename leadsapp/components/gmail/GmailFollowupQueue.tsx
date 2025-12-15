/**
 * GmailFollowupQueue Component
 * Displays leads that need automated follow-ups and provides Gmail links
 */

'use client';

import { useState, useEffect } from 'react';
import { Mail, Clock, Send } from 'lucide-react';
import emailTemplates from '@/lib/email-templates.json';

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  date_contacted: string;
  initial_email_subject: string | null;
  followup_1_sent_at: string | null;
  followup_2_sent_at: string | null;
  followup_3_sent_at: string | null;
}

interface FollowupData {
  followup_1: Lead[];
  followup_2: Lead[];
  followup_3: Lead[];
}

export function GmailFollowupQueue() {
  const [followups, setFollowups] = useState<FollowupData>({
    followup_1: [],
    followup_2: [],
    followup_3: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const fetchFollowups = async () => {
    try {
      const response = await fetch('/api/gmail/check-followups');
      if (response.ok) {
        const data = await response.json();
        setFollowups(data.followups);
      }
    } catch (error) {
      console.error('Error fetching follow-ups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFollowups();
    // Refresh every 5 minutes
    const interval = setInterval(fetchFollowups, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSendFollowup = async (lead: Lead, followupNumber: 1 | 2 | 3) => {
    const firstName = lead.name.split(' ')[0];
    const template = emailTemplates[`auto_followup_${followupNumber}` as keyof typeof emailTemplates] as any;
    
    // For followup #1, use RE: original subject. For others, use template subject.
    let subject = template.subject;
    if (followupNumber === 1 && lead.initial_email_subject) {
      subject = `RE: ${lead.initial_email_subject}`;
    }
    
    const body = template.body
      .replace(/{firstName}/g, firstName)
      .replace(/{originalSubject}/g, lead.initial_email_subject || 'Quick note after seeing your work');

    // Open Gmail with pre-filled data
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');

    // Mark as sent in database
    try {
      await fetch('/api/gmail/mark-followup-sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          followupNumber,
          subject,
        }),
      });
      
      // Refresh the list
      fetchFollowups();
    } catch (error) {
      console.error('Error marking follow-up as sent:', error);
    }
  };

  const totalFollowups = followups.followup_1.length + followups.followup_2.length + followups.followup_3.length;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-center">
          <div className="w-6 h-6 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (totalFollowups === 0) {
    return null; // Don't show if no follow-ups needed
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
      {/* Header */}
      <div 
        className="bg-white border-b border-indigo-200 p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Gmail Follow-ups Ready</h2>
            <p className="text-sm text-slate-600">
              {totalFollowups} lead{totalFollowups !== 1 ? 's' : ''} need{totalFollowups === 1 ? 's' : ''} follow-up
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-semibold">
            {totalFollowups}
          </span>
          <button className="text-slate-400 hover:text-slate-600">
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Follow-up #1 (3 days) */}
          {followups.followup_1.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Follow-up #1 (3 days after initial) • {followups.followup_1.length}
              </h3>
              <div className="space-y-2">
                {followups.followup_1.map(lead => (
                  <div 
                    key={lead.id}
                    className="bg-white rounded-lg p-3 border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{lead.name}</div>
                        <div className="text-xs text-slate-500">
                          {lead.company && `${lead.company} • `}
                          Contacted: {new Date(lead.date_contacted).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendFollowup(lead, 1)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Send via Gmail
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up #2 (5 days after #1) */}
          {followups.followup_2.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Follow-up #2 (5 days after #1) • {followups.followup_2.length}
              </h3>
              <div className="space-y-2">
                {followups.followup_2.map(lead => (
                  <div 
                    key={lead.id}
                    className="bg-white rounded-lg p-3 border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{lead.name}</div>
                        <div className="text-xs text-slate-500">
                          {lead.company && `${lead.company} • `}
                          Follow-up #1: {new Date(lead.followup_1_sent_at!).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendFollowup(lead, 2)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Send via Gmail
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Follow-up #3 (7 days after #2) */}
          {followups.followup_3.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Follow-up #3 - Final (7 days after #2) • {followups.followup_3.length}
              </h3>
              <div className="space-y-2">
                {followups.followup_3.map(lead => (
                  <div 
                    key={lead.id}
                    className="bg-white rounded-lg p-3 border border-slate-200 hover:border-indigo-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-slate-900">{lead.name}</div>
                        <div className="text-xs text-slate-500">
                          {lead.company && `${lead.company} • `}
                          Follow-up #2: {new Date(lead.followup_2_sent_at!).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendFollowup(lead, 3)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Send via Gmail
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
