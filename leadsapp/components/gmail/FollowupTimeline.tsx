/**
 * FollowupTimeline Component
 * Visual timeline showing lead's progress through follow-up stages
 */

'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, Circle, Mail, XCircle, AlertTriangle, Phone, ThumbsDown, ThumbsUp, Trophy, Rocket } from 'lucide-react';

interface TimelineProps {
  dateContacted: string | null;
  followup1SentAt: string | null;
  followup2SentAt: string | null;
  followup3SentAt: string | null;
  status: string;
  compact?: boolean;
  leadId?: string; // Optional - if provided, shows email count
}

interface TimelineStage {
  name: string;
  daysAfter: number;
  sentAt: string | null;
  status: 'completed' | 'ready' | 'upcoming' | 'blocked' | 'bounced' | 'cancelled' | 'terminal';
  daysUntil: number;
  icon: any;
  terminalReason?: string;
}

export function FollowupTimeline({
  dateContacted,
  followup1SentAt,
  followup2SentAt,
  followup3SentAt,
  status,
  compact = false,
  leadId,
}: TimelineProps) {
  const [emailCount, setEmailCount] = useState<number | null>(null);
  
  // Fetch email count if leadId is provided
  useEffect(() => {
    if (leadId && !compact) {
      fetch(`/api/leads/${leadId}/activity`)
        .then(res => res.json())
        .then(data => setEmailCount(data.emailsCached || 0))
        .catch(() => setEmailCount(null));
    }
  }, [leadId, compact]);

  if (!dateContacted) {
    return null;
  }

  const now = new Date();
  const contactedDate = new Date(dateContacted);
  const daysSinceContacted = Math.floor((now.getTime() - contactedDate.getTime()) / (1000 * 60 * 60 * 24));

  // Define terminal statuses that should stop all follow-ups
  const TERMINAL_STATUSES = {
    'email_bounced': { label: 'Email Bounced', icon: XCircle, color: 'red', reason: 'Invalid email address' },
    'replied_not_fit': { label: 'Reply: Not a Fit', icon: ThumbsDown, color: 'orange', reason: 'Lead replied - not interested' },
    'replied_interested': { label: 'Reply: Interested', icon: ThumbsUp, color: 'blue', reason: 'Lead replied - moving to next stage' },
    'call_booked': { label: 'Call Booked', icon: Phone, color: 'purple', reason: 'Call scheduled' },
    'call_done_thinking': { label: 'Call Done - Thinking', icon: Clock, color: 'yellow', reason: 'Call completed, prospect thinking' },
    'won': { label: 'Won', icon: Trophy, color: 'green', reason: 'Deal closed successfully' },
    'lost': { label: 'Lost', icon: XCircle, color: 'gray', reason: 'Deal lost' },
    'site_live': { label: 'Site Live', icon: Rocket, color: 'green', reason: 'Project completed' },
  };

  // Check if current status is terminal
  const terminalStatus = TERMINAL_STATUSES[status as keyof typeof TERMINAL_STATUSES];
  const isTerminal = !!terminalStatus;

  // Calculate stages
  const stages: TimelineStage[] = [
    {
      name: 'Initial Email',
      daysAfter: 0,
      sentAt: dateContacted,
      status: 'completed',
      daysUntil: 0,
      icon: Mail,
    },
    {
      name: 'Follow-up #1',
      daysAfter: 3,
      sentAt: followup1SentAt,
      status: isTerminal && !followup1SentAt
        ? 'cancelled'
        : followup1SentAt 
          ? 'completed' 
          : daysSinceContacted >= 3 
            ? 'ready' 
            : 'upcoming',
      daysUntil: followup1SentAt ? 0 : Math.max(0, 3 - daysSinceContacted),
      icon: Mail,
    },
    {
      name: 'Follow-up #2',
      daysAfter: 5,
      sentAt: followup2SentAt,
      status: isTerminal && !followup2SentAt
        ? 'cancelled'
        : !followup1SentAt 
          ? 'blocked'
          : followup2SentAt
            ? 'completed'
            : Math.floor((now.getTime() - new Date(followup1SentAt).getTime()) / (1000 * 60 * 60 * 24)) >= 5
              ? 'ready'
              : 'upcoming',
      daysUntil: !followup1SentAt 
        ? -1 
        : followup2SentAt 
          ? 0 
          : Math.max(0, 5 - Math.floor((now.getTime() - new Date(followup1SentAt).getTime()) / (1000 * 60 * 60 * 24))),
      icon: Mail,
    },
    {
      name: 'Follow-up #3',
      daysAfter: 7,
      sentAt: followup3SentAt,
      status: isTerminal && !followup3SentAt
        ? 'cancelled'
        : !followup2SentAt
          ? 'blocked'
          : followup3SentAt
            ? 'completed'
            : Math.floor((now.getTime() - new Date(followup2SentAt).getTime()) / (1000 * 60 * 60 * 24)) >= 7
              ? 'ready'
              : 'upcoming',
      daysUntil: !followup2SentAt
        ? -1
        : followup3SentAt
          ? 0
          : Math.max(0, 7 - Math.floor((now.getTime() - new Date(followup2SentAt).getTime()) / (1000 * 60 * 60 * 24))),
      icon: Mail,
    },
    // Add terminal status event if applicable
    ...(isTerminal ? [{
      name: terminalStatus.label,
      daysAfter: 0,
      sentAt: null,
      status: 'terminal' as const,
      daysUntil: 0,
      icon: terminalStatus.icon,
      terminalReason: terminalStatus.reason,
    }] : []),
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500 border-green-600';
      case 'ready': return 'bg-indigo-500 border-indigo-600 animate-pulse';
      case 'upcoming': return 'bg-slate-300 border-slate-400';
      case 'blocked': return 'bg-slate-200 border-slate-300';
      case 'bounced': return 'bg-red-500 border-red-600';
      case 'cancelled': return 'bg-slate-100 border-slate-200';
      case 'terminal': return 'bg-orange-500 border-orange-600';
      default: return 'bg-slate-300 border-slate-400';
    }
  };

  const getTextColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-700';
      case 'ready': return 'text-indigo-700 font-semibold';
      case 'upcoming': return 'text-slate-600';
      case 'blocked': return 'text-slate-400';
      case 'bounced': return 'text-red-700';
      case 'cancelled': return 'text-slate-400 line-through';
      case 'terminal': return 'text-orange-700 font-semibold';
      default: return 'text-slate-600';
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {stages.map((stage, index) => {
          const Icon = stage.status === 'completed' 
            ? CheckCircle 
            : stage.status === 'bounced'
              ? XCircle
              : stage.status === 'cancelled'
                ? XCircle
                : stage.status === 'terminal'
                  ? stage.icon
                  : Circle;
          return (
            <div key={index} className="flex items-center">
              <div 
                className={`relative group cursor-pointer`}
                title={`${stage.name}: ${
                  stage.status === 'completed' 
                    ? `Sent ${new Date(stage.sentAt!).toLocaleDateString()}`
                    : stage.status === 'ready'
                      ? 'Ready to send!'
                      : stage.status === 'upcoming'
                        ? `In ${stage.daysUntil} day${stage.daysUntil !== 1 ? 's' : ''}`
                        : stage.status === 'bounced'
                          ? 'Email bounced - invalid address'
                          : stage.status === 'cancelled'
                            ? 'Cancelled - outcome reached'
                            : stage.status === 'terminal'
                              ? stage.terminalReason || 'Outcome reached'
                              : 'Waiting on previous step'
                }`}
              >
                <Icon 
                  className={`w-4 h-4 ${
                    stage.status === 'completed' 
                      ? 'text-green-500' 
                      : stage.status === 'ready'
                        ? 'text-indigo-500'
                        : stage.status === 'bounced'
                          ? 'text-red-500'
                          : stage.status === 'cancelled'
                            ? 'text-slate-300'
                            : stage.status === 'terminal'
                              ? 'text-orange-500'
                              : 'text-slate-300'
                  }`}
                />
                {stage.status === 'ready' && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                )}
              </div>
              {index < stages.length - 1 && (
                <div className={`w-8 h-0.5 ${
                  stages[index + 1]?.status === 'completed' 
                    ? 'bg-green-500' 
                    : stages[index + 1]?.status === 'bounced'
                      ? 'bg-red-500'
                      : stages[index + 1]?.status === 'terminal'
                        ? 'bg-orange-500'
                        : 'bg-slate-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-900">Follow-up Timeline</h3>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          {emailCount !== null && (
            <span className="flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded">
              <Mail className="w-3 h-3" />
              {emailCount} email{emailCount !== 1 ? 's' : ''} synced
            </span>
          )}
          <span>
            {daysSinceContacted} day{daysSinceContacted !== 1 ? 's' : ''} since initial contact
          </span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />

        {/* Stages */}
        <div className="space-y-6">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <div key={index} className="relative flex items-start gap-4">
                {/* Node */}
                <div className={`relative z-10 w-12 h-12 rounded-full border-4 ${getStatusColor(stage.status)} flex items-center justify-center shrink-0 shadow-sm`}>
                  {stage.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-white" />
                  ) : (
                    <Icon className="w-5 h-5 text-white" />
                  )}
                  {stage.status === 'ready' && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-2">
                  <div className="flex items-start justify-between mb-1">
                    <h4 className={`font-semibold ${getTextColor(stage.status)}`}>
                      {stage.name}
                    </h4>
                    {stage.status === 'ready' && (
                      <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full animate-pulse">
                        READY NOW
                      </span>
                    )}
                  </div>

                  {/* Status info */}
                  <div className="text-sm text-slate-600 space-y-1">
                    {stage.status === 'completed' && stage.sentAt && (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span>Sent {new Date(stage.sentAt).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}</span>
                      </div>
                    )}

                    {stage.status === 'ready' && (
                      <div className="flex items-center gap-2 text-indigo-600">
                        <Clock className="w-4 h-4" />
                        <span className="font-medium">Ready to send now!</span>
                      </div>
                    )}

                    {stage.status === 'upcoming' && stage.daysUntil >= 0 && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>
                          Send in <strong>{stage.daysUntil}</strong> day{stage.daysUntil !== 1 ? 's' : ''}
                          {stage.daysUntil > 0 && (
                            <span className="text-slate-400 ml-1">
                              ({new Date(Date.now() + stage.daysUntil * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric' 
                              })})
                            </span>
                          )}
                        </span>
                      </div>
                    )}

                    {stage.status === 'blocked' && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Circle className="w-4 h-4" />
                        <span className="italic">Waiting on previous follow-up</span>
                      </div>
                    )}

                    {stage.status === 'bounced' && (
                      <div className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">Email bounced - invalid address</span>
                      </div>
                    )}

                    {stage.status === 'cancelled' && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <XCircle className="w-4 h-4" />
                        <span className="italic">Cancelled - outcome reached</span>
                      </div>
                    )}

                    {stage.status === 'terminal' && (
                      <div className="flex items-center gap-2 text-orange-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">{stage.terminalReason}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
