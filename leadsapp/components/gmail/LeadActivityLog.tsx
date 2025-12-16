'use client';

import { useState, useEffect } from 'react';
import { History, ChevronDown, ChevronUp, User, Mail, Bot, Zap, Server, Clock, AlertCircle } from 'lucide-react';

interface Activity {
  id: string;
  action_type: string;
  source: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  description?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

interface LeadActivityLogProps {
  leadId: string;
}

const sourceIcons: Record<string, React.ElementType> = {
  user: User,
  gmail_sync: Mail,
  automation: Zap,
  ai_agent: Bot,
  api: Server,
  system: AlertCircle,
};

const sourceColors: Record<string, string> = {
  user: 'text-blue-600 bg-blue-100',
  gmail_sync: 'text-red-600 bg-red-100',
  automation: 'text-amber-600 bg-amber-100',
  ai_agent: 'text-purple-600 bg-purple-100',
  api: 'text-slate-600 bg-slate-100',
  system: 'text-slate-600 bg-slate-100',
};

const sourceLabels: Record<string, string> = {
  user: 'User (UI)',
  gmail_sync: 'Gmail Sync',
  automation: 'Automation',
  ai_agent: 'AI Agent',
  api: 'API',
  system: 'System',
};

const actionTypeLabels: Record<string, string> = {
  status_change: 'Status Changed',
  field_update: 'Field Updated',
  email_sent: 'Email Sent',
  email_received: 'Email Received',
  email_bounced: 'Email Bounced',
  followup_detected: 'Follow-up Detected',
  analysis_run: 'Analysis Run',
  lead_created: 'Lead Created',
  lead_scraped: 'Lead Scraped',
  note_added: 'Note Added',
};

export function LeadActivityLog({ leadId }: LeadActivityLogProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [emailsCached, setEmailsCached] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [leadId]);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/leads/${leadId}/activity`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        setEmailsCached(data.emailsCached || 0);
      }
    } catch (error) {
      console.error('Failed to fetch activity log:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 text-slate-600">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          Loading activity log...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 rounded-lg">
            <History className="w-5 h-5 text-slate-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">Activity Log</h3>
            <p className="text-sm text-slate-500">
              {activities.length} events • {emailsCached} emails synced
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-slate-200">
          {activities.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              No activity recorded yet
            </div>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {activities.map((activity, index) => {
                const Icon = sourceIcons[activity.source] || AlertCircle;
                const colorClass = sourceColors[activity.source] || 'text-slate-600 bg-slate-100';
                
                return (
                  <div
                    key={activity.id}
                    className={`flex gap-3 p-4 ${index !== activities.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    {/* Source icon */}
                    <div className={`p-2 rounded-full ${colorClass} h-fit`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-medium text-slate-900">
                            {actionTypeLabels[activity.action_type] || activity.action_type}
                          </span>
                          <span className="text-slate-400 mx-2">•</span>
                          <span className={`text-sm px-2 py-0.5 rounded-full ${colorClass}`}>
                            {sourceLabels[activity.source] || activity.source}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400 whitespace-nowrap">
                          <Clock className="w-3 h-3" />
                          {formatDate(activity.created_at)}
                        </div>
                      </div>
                      
                      {/* Description */}
                      {activity.description && (
                        <p className="text-sm text-slate-600 mt-1">
                          {activity.description}
                        </p>
                      )}
                      
                      {/* Field change details */}
                      {activity.field_name && activity.old_value && activity.new_value && (
                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <span className="px-1.5 py-0.5 bg-red-50 text-red-700 rounded line-through">
                            {activity.old_value}
                          </span>
                          <span>→</span>
                          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 rounded">
                            {activity.new_value}
                          </span>
                        </div>
                      )}
                      
                      {/* Metadata */}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <div className="text-xs text-slate-400 mt-1">
                          {activity.metadata.emailSubject && (
                            <span>Subject: "{activity.metadata.emailSubject}"</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
