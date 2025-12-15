/**
 * FollowupPipeline Component
 * Kanban-style view showing all leads organized by follow-up stage
 */

'use client';

import { useState, useEffect } from 'react';
import { Mail, Clock, Send, CheckCircle, ArrowRight } from 'lucide-react';
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
  profile_picture: string | null;
}

interface PipelineStage {
  id: string;
  title: string;
  description: string;
  leads: Lead[];
  color: string;
  icon: any;
}

export function FollowupPipeline() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  const fetchPipeline = async () => {
    try {
      const response = await fetch('/api/gmail/check-followups');
      if (response.ok) {
        const data = await response.json();
        
        // Also get leads that have sent all follow-ups
        const leadsResponse = await fetch('/api/leads');
        const leadsData = await leadsResponse.json();
        const allContactedLeads = leadsData.leads.filter((l: any) => l.date_contacted !== null);

        // Calculate upcoming leads (not ready yet)
        const now = new Date();
        const upcomingFu1 = allContactedLeads.filter((lead: Lead) => {
          if (lead.followup_1_sent_at) return false;
          const daysSince = Math.floor((now.getTime() - new Date(lead.date_contacted).getTime()) / (1000 * 60 * 60 * 24));
          return daysSince < 3;
        });

        const upcomingFu2 = allContactedLeads.filter((lead: Lead) => {
          if (!lead.followup_1_sent_at || lead.followup_2_sent_at) return false;
          const daysSince = Math.floor((now.getTime() - new Date(lead.followup_1_sent_at).getTime()) / (1000 * 60 * 60 * 24));
          return daysSince < 5;
        });

        const upcomingFu3 = allContactedLeads.filter((lead: Lead) => {
          if (!lead.followup_2_sent_at || lead.followup_3_sent_at) return false;
          const daysSince = Math.floor((now.getTime() - new Date(lead.followup_2_sent_at).getTime()) / (1000 * 60 * 60 * 24));
          return daysSince < 7;
        });

        const completed = allContactedLeads.filter((lead: Lead) => 
          lead.followup_3_sent_at !== null
        );

        setStages([
          {
            id: 'upcoming-fu1',
            title: 'Warming Up',
            description: 'Initial email sent, FU1 in a few days',
            leads: upcomingFu1,
            color: 'bg-slate-50 border-slate-200',
            icon: Clock,
          },
          {
            id: 'ready-fu1',
            title: 'Follow-up #1 Ready',
            description: '3+ days since initial email',
            leads: data.followups.followup_1,
            color: 'bg-indigo-50 border-indigo-300',
            icon: Mail,
          },
          {
            id: 'upcoming-fu2',
            title: 'Between FU1 & FU2',
            description: 'FU1 sent, FU2 soon',
            leads: upcomingFu2,
            color: 'bg-slate-50 border-slate-200',
            icon: Clock,
          },
          {
            id: 'ready-fu2',
            title: 'Follow-up #2 Ready',
            description: '5+ days since FU1',
            leads: data.followups.followup_2,
            color: 'bg-purple-50 border-purple-300',
            icon: Mail,
          },
          {
            id: 'upcoming-fu3',
            title: 'Between FU2 & FU3',
            description: 'FU2 sent, final FU soon',
            leads: upcomingFu3,
            color: 'bg-slate-50 border-slate-200',
            icon: Clock,
          },
          {
            id: 'ready-fu3',
            title: 'Follow-up #3 Ready',
            description: '7+ days since FU2 (Final)',
            leads: data.followups.followup_3,
            color: 'bg-orange-50 border-orange-300',
            icon: Mail,
          },
          {
            id: 'completed',
            title: 'Sequence Complete',
            description: 'All follow-ups sent',
            leads: completed,
            color: 'bg-green-50 border-green-300',
            icon: CheckCircle,
          },
        ]);
      }
    } catch (error) {
      console.error('Error fetching pipeline:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
    const interval = setInterval(fetchPipeline, 2 * 60 * 1000); // Refresh every 2 minutes
    return () => clearInterval(interval);
  }, []);

  const handleSendFollowup = async (lead: Lead, followupNumber: 1 | 2 | 3) => {
    const firstName = lead.name.split(' ')[0];
    const template = emailTemplates[`auto_followup_${followupNumber}` as keyof typeof emailTemplates] as any;
    
    let subject = template.subject;
    if (followupNumber === 1 && lead.initial_email_subject) {
      subject = `RE: ${lead.initial_email_subject}`;
    }
    
    const body = template.body
      .replace(/{firstName}/g, firstName)
      .replace(/{originalSubject}/g, lead.initial_email_subject || 'Quick note after seeing your work');

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');

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
      
      fetchPipeline();
      setSelectedLead(null);
    } catch (error) {
      console.error('Error marking follow-up as sent:', error);
    }
  };

  const getDaysInfo = (lead: Lead, stageId: string) => {
    const now = new Date();
    
    if (stageId === 'upcoming-fu1') {
      const daysSince = Math.floor((now.getTime() - new Date(lead.date_contacted).getTime()) / (1000 * 60 * 60 * 24));
      return `${3 - daysSince} days until FU1`;
    }
    
    if (stageId === 'ready-fu1') {
      const daysSince = Math.floor((now.getTime() - new Date(lead.date_contacted).getTime()) / (1000 * 60 * 60 * 24));
      return `Ready (${daysSince} days since initial)`;
    }
    
    if (stageId === 'upcoming-fu2' && lead.followup_1_sent_at) {
      const daysSince = Math.floor((now.getTime() - new Date(lead.followup_1_sent_at).getTime()) / (1000 * 60 * 60 * 24));
      return `${5 - daysSince} days until FU2`;
    }
    
    if (stageId === 'ready-fu2' && lead.followup_1_sent_at) {
      const daysSince = Math.floor((now.getTime() - new Date(lead.followup_1_sent_at).getTime()) / (1000 * 60 * 60 * 24));
      return `Ready (${daysSince} days since FU1)`;
    }
    
    if (stageId === 'upcoming-fu3' && lead.followup_2_sent_at) {
      const daysSince = Math.floor((now.getTime() - new Date(lead.followup_2_sent_at).getTime()) / (1000 * 60 * 60 * 24));
      return `${7 - daysSince} days until FU3`;
    }
    
    if (stageId === 'ready-fu3' && lead.followup_2_sent_at) {
      const daysSince = Math.floor((now.getTime() - new Date(lead.followup_2_sent_at).getTime()) / (1000 * 60 * 60 * 24));
      return `Ready (${daysSince} days since FU2)`;
    }
    
    if (stageId === 'completed' && lead.followup_3_sent_at) {
      return `Completed ${new Date(lead.followup_3_sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    
    return '';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  const totalLeads = stages.reduce((sum, stage) => sum + stage.leads.length, 0);
  const readyToSend = stages.filter(s => s.id.includes('ready')).reduce((sum, stage) => sum + stage.leads.length, 0);

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Follow-up Pipeline</h2>
            <p className="text-indigo-100">Track every lead through the follow-up sequence</p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold">{totalLeads}</div>
              <div className="text-sm text-indigo-100">Total in Pipeline</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-300">{readyToSend}</div>
              <div className="text-sm text-indigo-100">Ready to Send</div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Stages */}
      <div className="grid grid-cols-7 gap-4">
        {stages.map((stage) => {
          const Icon = stage.icon;
          const isReady = stage.id.includes('ready');
          
          return (
            <div
              key={stage.id}
              className={`rounded-xl border-2 ${stage.color} overflow-hidden transition-all ${
                isReady ? 'shadow-lg' : 'shadow-sm'
              }`}
            >
              {/* Stage Header */}
              <div className={`p-4 ${isReady ? 'bg-white bg-opacity-60' : 'bg-white bg-opacity-40'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-5 h-5 ${
                    stage.id === 'completed' ? 'text-green-600' :
                    isReady ? 'text-indigo-600' : 'text-slate-500'
                  }`} />
                  <h3 className="font-bold text-sm text-slate-900">{stage.title}</h3>
                </div>
                <p className="text-xs text-slate-600 mb-2">{stage.description}</p>
                <div className={`text-2xl font-bold ${
                  isReady ? 'text-indigo-600' : 'text-slate-700'
                }`}>
                  {stage.leads.length}
                </div>
              </div>

              {/* Leads */}
              <div className="p-2 space-y-2 max-h-96 overflow-y-auto">
                {stage.leads.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-sm">
                    No leads
                  </div>
                ) : (
                  stage.leads.map((lead) => (
                    <div
                      key={lead.id}
                      className="bg-white rounded-lg p-3 shadow-sm hover:shadow-md transition-all cursor-pointer border border-slate-100 group"
                      onClick={() => setSelectedLead(lead)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        {lead.profile_picture ? (
                          <img 
                            src={lead.profile_picture} 
                            alt={lead.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                            {lead.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-slate-900 truncate">
                            {lead.name}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {lead.company || 'No company'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">
                          {getDaysInfo(lead, stage.id)}
                        </span>
                        {isReady && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const fuNum = stage.id.includes('fu1') ? 1 : stage.id.includes('fu2') ? 2 : 3;
                              handleSendFollowup(lead, fuNum as 1 | 2 | 3);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" />
                            Send
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lead Detail Modal */}
      {selectedLead && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLead(null)}
        >
          <div 
            className="bg-white rounded-xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              {selectedLead.profile_picture ? (
                <img 
                  src={selectedLead.profile_picture} 
                  alt={selectedLead.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                  {selectedLead.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold text-slate-900">{selectedLead.name}</h3>
                <p className="text-slate-600">{selectedLead.company}</p>
                <p className="text-sm text-slate-500">{selectedLead.email}</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Initial Email</span>
                <span className="text-sm text-slate-600">
                  {new Date(selectedLead.date_contacted).toLocaleDateString()}
                </span>
              </div>
              
              {selectedLead.followup_1_sent_at && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-700">Follow-up #1</span>
                  <span className="text-sm text-green-600">
                    {new Date(selectedLead.followup_1_sent_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              {selectedLead.followup_2_sent_at && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-700">Follow-up #2</span>
                  <span className="text-sm text-green-600">
                    {new Date(selectedLead.followup_2_sent_at).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              {selectedLead.followup_3_sent_at && (
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-700">Follow-up #3</span>
                  <span className="text-sm text-green-600">
                    {new Date(selectedLead.followup_3_sent_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => window.location.href = `/lead/${selectedLead.id}`}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                View Details
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedLead(null)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
