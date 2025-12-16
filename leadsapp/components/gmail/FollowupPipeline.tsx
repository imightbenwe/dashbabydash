/**
 * FollowupPipeline Component
 * Kanban-style view showing all leads organized by follow-up stage
 * Now includes email queue with estimated send times based on rate settings
 */

'use client';

import { useState, useEffect } from 'react';
import { Mail, Clock, Send, CheckCircle, ArrowRight, Zap, Play, Calendar, User, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
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
  gmail_thread_id: string | null;
  gmail_message_id: string | null;
}

interface PipelineStage {
  id: string;
  title: string;
  description: string;
  leads: Lead[];
  color: string;
  icon: any;
}

interface QueueItem {
  lead: Lead;
  queueType: 'initial' | 'followup_1' | 'followup_2' | 'followup_3';
  estimatedSendTime: Date;
  position: number;
}

export function FollowupPipeline() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  // Email queue state
  const [emailQueue, setEmailQueue] = useState<QueueItem[]>([]);
  const [newLeads, setNewLeads] = useState<Lead[]>([]); // Leads not yet contacted
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set()); // Track expanded queue items
  
  // Load settings from localStorage
  const [emailsPerHour, setEmailsPerHour] = useState(10);
  const [sendingSchedule, setSendingSchedule] = useState('business');
  const [sendingTimezone, setSendingTimezone] = useState('America/New_York');
  const [testMode, setTestMode] = useState(true);
  
  useEffect(() => {
    const savedEmailsPerHour = localStorage.getItem('gmail_emails_per_hour');
    if (savedEmailsPerHour) setEmailsPerHour(parseInt(savedEmailsPerHour, 10));
    
    const savedSchedule = localStorage.getItem('gmail_sending_schedule');
    if (savedSchedule) setSendingSchedule(savedSchedule);
    
    const savedTimezone = localStorage.getItem('gmail_sending_timezone');
    if (savedTimezone) setSendingTimezone(savedTimezone);
    
    const savedTestMode = localStorage.getItem('gmail_test_mode');
    if (savedTestMode !== null) setTestMode(savedTestMode === 'true');
  }, []);
  
  // Calculate estimated send time based on position in queue and rate settings
  // This calculates when the email will be sent in the TARGET timezone (e.g., US Eastern)
  const calculateSendTime = (position: number, perHour: number, schedule: string, timezone: string): Date => {
    const minutesBetweenEmails = 60 / perHour;
    
    // Start from now
    let currentTime = new Date();
    let emailsScheduled = 0;
    
    // Keep advancing time until we've scheduled enough emails
    while (emailsScheduled <= position) {
      // Get the hour in the target timezone
      const tzHour = parseInt(currentTime.toLocaleString('en-US', { 
        timeZone: timezone, 
        hour: 'numeric', 
        hour12: false 
      }));
      
      // Determine if we're in sending hours
      let inSendingHours = true;
      if (schedule === 'business') {
        inSendingHours = tzHour >= 9 && tzHour < 18; // 9 AM - 6 PM
      } else if (schedule === 'extended') {
        inSendingHours = tzHour >= 7 && tzHour < 21; // 7 AM - 9 PM
      }
      // 'around_clock' is always true
      
      if (inSendingHours) {
        if (emailsScheduled === position) {
          return currentTime;
        }
        emailsScheduled++;
      }
      
      // Advance time
      currentTime = new Date(currentTime.getTime() + minutesBetweenEmails * 60 * 1000);
      
      // If we've gone a full day without finding a slot, something's wrong
      if (currentTime.getTime() - Date.now() > 48 * 60 * 60 * 1000) {
        return currentTime; // Safety break
      }
    }
    
    return currentTime;
  };

  // Toggle expanded state for a queue item
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Get email preview for a queue item
  const getEmailPreview = (item: QueueItem) => {
    const templates = emailTemplates as any;
    let template;
    
    switch (item.queueType) {
      case 'initial':
        template = templates.initial;
        break;
      case 'followup_1':
        template = templates.auto_followup_1;
        break;
      case 'followup_2':
        template = templates.auto_followup_2;
        break;
      case 'followup_3':
        template = templates.auto_followup_3;
        break;
      default:
        template = templates.initial;
    }
    
    const firstName = item.lead.name.split(' ')[0];
    let subject = template.subject || 'No subject';
    let body = template.body || '';
    
    // Replace placeholders
    body = body.replace(/{firstName}/g, firstName);
    subject = subject.replace(/{firstName}/g, firstName);
    
    // For RE: subjects, add the original subject
    if (subject === 'RE:' && item.lead.initial_email_subject) {
      subject = `RE: ${item.lead.initial_email_subject}`;
    }
    
    return { subject, body };
  };

  const fetchPipeline = async () => {
    try {
      // Read settings directly from localStorage to ensure we have latest values
      const currentEmailsPerHour = parseInt(localStorage.getItem('gmail_emails_per_hour') || '10', 10);
      const currentSchedule = localStorage.getItem('gmail_sending_schedule') || 'business';
      const currentTimezone = localStorage.getItem('gmail_sending_timezone') || 'America/New_York';
      
      // Update state to reflect current settings
      setEmailsPerHour(currentEmailsPerHour);
      setSendingSchedule(currentSchedule);
      setSendingTimezone(currentTimezone);
      
      const response = await fetch('/api/gmail/check-followups');
      if (response.ok) {
        const data = await response.json();
        
        // Also get leads that have sent all follow-ups
        const leadsResponse = await fetch('/api/leads');
        const leadsData = await leadsResponse.json();
        const allLeads = leadsData.leads || [];
        const allContactedLeads = allLeads.filter((l: any) => l.date_contacted !== null);
        
        // Get leads that haven't been contacted yet (for Initial Email queue)
        const notContactedLeads = allLeads.filter((l: any) => 
          l.date_contacted === null && 
          l.email && 
          !['replied_not_fit', 'replied_interested', 'call_booked', 'call_done_thinking', 'won', 'lost', 'site_live', 'email_bounced'].includes(l.status)
        );
        setNewLeads(notContactedLeads);

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
        
        // Build email queue with estimated send times
        const queueItems: QueueItem[] = [];
        let position = 0;
        
        // Add initial emails (new leads)
        notContactedLeads.forEach((lead: Lead) => {
          queueItems.push({
            lead,
            queueType: 'initial',
            estimatedSendTime: calculateSendTime(position, currentEmailsPerHour, currentSchedule, currentTimezone),
            position: position++,
          });
        });
        
        // Add followup_1 ready leads
        (data.followups.followup_1 || []).forEach((lead: Lead) => {
          queueItems.push({
            lead,
            queueType: 'followup_1',
            estimatedSendTime: calculateSendTime(position, currentEmailsPerHour, currentSchedule, currentTimezone),
            position: position++,
          });
        });
        
        // Add followup_2 ready leads
        (data.followups.followup_2 || []).forEach((lead: Lead) => {
          queueItems.push({
            lead,
            queueType: 'followup_2',
            estimatedSendTime: calculateSendTime(position, currentEmailsPerHour, currentSchedule, currentTimezone),
            position: position++,
          });
        });
        
        // Add followup_3 ready leads
        (data.followups.followup_3 || []).forEach((lead: Lead) => {
          queueItems.push({
            lead,
            queueType: 'followup_3',
            estimatedSendTime: calculateSendTime(position, currentEmailsPerHour, currentSchedule, currentTimezone),
            position: position++,
          });
        });
        
        setEmailQueue(queueItems);

        setStages([
          {
            id: 'new-leads',
            title: 'Initial Email',
            description: 'Not yet contacted',
            leads: notContactedLeads,
            color: 'bg-blue-50 border-blue-300',
            icon: User,
          },
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
    const interval = setInterval(fetchPipeline, 30 * 1000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Approval queue state
  const [approvedQueue, setApprovedQueue] = useState<any[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');

  // Fetch approved queue
  const fetchApprovedQueue = async () => {
    try {
      const response = await fetch('/api/gmail/process-queue');
      if (response.ok) {
        const data = await response.json();
        setApprovedQueue(data.queue || []);
      }
    } catch (error) {
      console.error('Error fetching approved queue:', error);
    }
  };

  useEffect(() => {
    fetchApprovedQueue();
    const interval = setInterval(fetchApprovedQueue, 30 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Approve all items in queue for sending
  const handleApproveAll = async () => {
    if (emailQueue.length === 0) return;
    
    setIsApproving(true);
    setApprovalMessage('');
    
    try {
      const items = emailQueue.map(q => ({
        leadId: q.lead.id,
        emailType: q.queueType,
      }));

      const response = await fetch('/api/gmail/approve-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          emailsPerHour,
          sendingSchedule,
          sendingTimezone,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setApprovalMessage(`✅ Approved ${result.totalApproved} emails for sending`);
        if (result.totalSkipped > 0) {
          setApprovalMessage(prev => `${prev} (${result.totalSkipped} skipped)`);
        }
        fetchPipeline();
        fetchApprovedQueue();
      } else {
        setApprovalMessage(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      setApprovalMessage(`❌ Error: ${error}`);
    } finally {
      setIsApproving(false);
    }
  };

  // Approve a single item
  const handleApproveSingle = async (leadId: string, emailType: string) => {
    try {
      const response = await fetch('/api/gmail/approve-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ leadId, emailType }],
          emailsPerHour,
          sendingSchedule,
          sendingTimezone,
        }),
      });

      const result = await response.json();
      if (result.success && result.totalApproved > 0) {
        fetchPipeline();
        fetchApprovedQueue();
      }
    } catch (error) {
      console.error('Error approving:', error);
    }
  };

  // Automation state - DISABLED for safety
  // Now requires manual approval via the approve-queue API
  const [automationStatus] = useState<string>('Manual Approval Required');
  const [lastAutomationRun] = useState<Date | null>(null);

  // NOTE: Automatic sending is DISABLED
  // The process-queue endpoint now only sends from the approved email_send_queue table
  // Use /api/gmail/approve-queue to:
  // - GET: See what emails are ready to be queued
  // - POST: Approve items and add to send queue with scheduled times
  // - DELETE: Remove items from the queue

  const handleSendFollowup = async (lead: Lead, followupNumber: 1 | 2 | 3) => {
    const firstName = lead.name.split(' ')[0];
    const template = emailTemplates[`auto_followup_${followupNumber}` as keyof typeof emailTemplates] as any;
    const originalSubject = lead.initial_email_subject || 'Quick note after seeing your work';
    
    // Replace placeholders in subject and body
    const subject = template.subject
      .replace(/{originalSubject}/g, originalSubject);
    
    const body = template.body
      .replace(/{firstName}/g, firstName)
      .replace(/{originalSubject}/g, originalSubject);

    // Get stored Gmail user email
    const userEmail = localStorage.getItem('gmail_user_email');
    
    if (!userEmail) {
      // Fall back to opening Gmail in browser
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailUrl, '_blank');
      
      // Mark as sent manually
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
      return;
    }

    // Send via Gmail API with proper threading
    try {
      const response = await fetch('/api/gmail/send-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': userEmail,
        },
        body: JSON.stringify({
          leadId: lead.id,
          to: lead.email,
          subject,
          body,
          followupNumber,
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(`✅ Follow-up #${followupNumber} sent successfully to ${lead.name}! (Threaded reply)`);
        fetchPipeline();
        setSelectedLead(null);
      } else {
        // If API fails, fall back to Gmail URL
        console.error('Gmail API send failed:', result.error);
        alert(`⚠️ Could not send via API: ${result.error}\n\nOpening Gmail to send manually...`);
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.open(gmailUrl, '_blank');
      }
    } catch (error) {
      console.error('Error sending follow-up:', error);
      // Fall back to Gmail URL
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(lead.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(gmailUrl, '_blank');
    }
  };

  const getDaysInfo = (lead: Lead, stageId: string) => {
    const now = new Date();
    
    if (stageId === 'new-leads') {
      return 'Ready for initial email';
    }
    
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
  const readyToSend = stages.filter(s => s.id.includes('ready') || s.id === 'new-leads').reduce((sum, stage) => sum + stage.leads.length, 0);
  
  // Helper to format queue type for display
  const getQueueTypeName = (type: string) => {
    switch(type) {
      case 'initial': return 'Initial Email';
      case 'followup_1': return 'Follow-up #1';
      case 'followup_2': return 'Follow-up #2';
      case 'followup_3': return 'Follow-up #3';
      default: return type;
    }
  };
  
  const getQueueTypeColor = (type: string) => {
    switch(type) {
      case 'initial': return 'bg-blue-100 text-blue-700';
      case 'followup_1': return 'bg-indigo-100 text-indigo-700';
      case 'followup_2': return 'bg-purple-100 text-purple-700';
      case 'followup_3': return 'bg-orange-100 text-orange-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };
  
  // Group queue by type for the display
  const initialQueue = emailQueue.filter(q => q.queueType === 'initial');
  const fu1Queue = emailQueue.filter(q => q.queueType === 'followup_1');
  const fu2Queue = emailQueue.filter(q => q.queueType === 'followup_2');
  const fu3Queue = emailQueue.filter(q => q.queueType === 'followup_3');

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
            <div className="text-center">
              <div className={`text-3xl font-bold ${testMode ? 'text-amber-300' : 'text-green-300'}`}>
                {testMode ? 'TEST' : 'LIVE'}
              </div>
              <div className="text-sm text-indigo-100">Mode</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Email Queue Section - Direct View */}
      {emailQueue.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6" />
                <div>
                  <h3 className="font-bold text-lg">Emails Ready to Send</h3>
                  <p className="text-amber-100 text-sm">
                    {emailQueue.length} emails scheduled - cron sends automatically
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{emailQueue.length}</div>
                <div className="text-sm text-amber-100">in queue</div>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100">
            {/* Initial Email Queue */}
            {initialQueue.length > 0 && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <h4 className="font-semibold text-slate-800">Initial Email</h4>
                  <span className="text-sm text-slate-500">({initialQueue.length} leads)</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {initialQueue.map((item, idx) => {
                    const itemId = `initial-${item.lead.id}`;
                    const isExpanded = expandedItems.has(itemId);
                    const preview = isExpanded ? getEmailPreview(item) : null;
                    return (
                      <div key={item.lead.id} className="bg-slate-50 rounded-lg overflow-hidden">
                        <div 
                          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleExpanded(itemId)}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            <span className="text-xs font-medium text-slate-400 w-6">#{idx + 1}</span>
                            <Link href={`/lead/${item.lead.id}`} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                              {item.lead.name}
                            </Link>
                            <span className="text-sm text-slate-500">{item.lead.company || ''}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            Est. {item.estimatedSendTime.toLocaleString('en-US', { 
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                            })}
                          </div>
                        </div>
                        {isExpanded && preview && (
                          <div className="px-4 py-3 bg-white border-t border-slate-100">
                            <div className="text-xs text-slate-500 mb-1">Subject:</div>
                            <div className="text-sm font-medium text-slate-800 mb-2">{preview.subject}</div>
                            <div className="text-xs text-slate-500 mb-1">Body:</div>
                            <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-2 max-h-32 overflow-y-auto">{preview.body}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Follow-up #1 Queue */}
            {fu1Queue.length > 0 && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                  <h4 className="font-semibold text-slate-800">Follow-up #1</h4>
                  <span className="text-sm text-slate-500">({fu1Queue.length} leads)</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {fu1Queue.map((item, idx) => {
                    const itemId = `fu1-${item.lead.id}`;
                    const isExpanded = expandedItems.has(itemId);
                    const preview = isExpanded ? getEmailPreview(item) : null;
                    return (
                      <div key={item.lead.id} className="bg-slate-50 rounded-lg overflow-hidden">
                        <div 
                          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleExpanded(itemId)}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            <span className="text-xs font-medium text-slate-400 w-6">#{initialQueue.length + idx + 1}</span>
                            <Link href={`/lead/${item.lead.id}`} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                              {item.lead.name}
                            </Link>
                            <span className="text-sm text-slate-500">{item.lead.company || ''}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            Est. {item.estimatedSendTime.toLocaleString('en-US', { 
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                            })}
                          </div>
                        </div>
                        {isExpanded && preview && (
                          <div className="px-4 py-3 bg-white border-t border-slate-100">
                            <div className="text-xs text-slate-500 mb-1">Subject:</div>
                            <div className="text-sm font-medium text-slate-800 mb-2">{preview.subject}</div>
                            <div className="text-xs text-slate-500 mb-1">Body:</div>
                            <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-2 max-h-32 overflow-y-auto">{preview.body}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Follow-up #2 Queue */}
            {fu2Queue.length > 0 && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <h4 className="font-semibold text-slate-800">Follow-up #2</h4>
                  <span className="text-sm text-slate-500">({fu2Queue.length} leads)</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {fu2Queue.map((item, idx) => {
                    const itemId = `fu2-${item.lead.id}`;
                    const isExpanded = expandedItems.has(itemId);
                    const preview = isExpanded ? getEmailPreview(item) : null;
                    return (
                      <div key={item.lead.id} className="bg-slate-50 rounded-lg overflow-hidden">
                        <div 
                          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleExpanded(itemId)}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            <span className="text-xs font-medium text-slate-400 w-6">#{initialQueue.length + fu1Queue.length + idx + 1}</span>
                            <Link href={`/lead/${item.lead.id}`} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                              {item.lead.name}
                            </Link>
                            <span className="text-sm text-slate-500">{item.lead.company || ''}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            Est. {item.estimatedSendTime.toLocaleString('en-US', { 
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                            })}
                          </div>
                        </div>
                        {isExpanded && preview && (
                          <div className="px-4 py-3 bg-white border-t border-slate-100">
                            <div className="text-xs text-slate-500 mb-1">Subject:</div>
                            <div className="text-sm font-medium text-slate-800 mb-2">{preview.subject}</div>
                            <div className="text-xs text-slate-500 mb-1">Body:</div>
                            <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-2 max-h-32 overflow-y-auto">{preview.body}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Follow-up #3 Queue */}
            {fu3Queue.length > 0 && (
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <h4 className="font-semibold text-slate-800">Follow-up #3</h4>
                  <span className="text-sm text-slate-500">({fu3Queue.length} leads)</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {fu3Queue.map((item, idx) => {
                    const itemId = `fu3-${item.lead.id}`;
                    const isExpanded = expandedItems.has(itemId);
                    const preview = isExpanded ? getEmailPreview(item) : null;
                    return (
                      <div key={item.lead.id} className="bg-slate-50 rounded-lg overflow-hidden">
                        <div 
                          className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleExpanded(itemId)}
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            <span className="text-xs font-medium text-slate-400 w-6">#{initialQueue.length + fu1Queue.length + fu2Queue.length + idx + 1}</span>
                            <Link href={`/lead/${item.lead.id}`} className="font-medium text-slate-900 hover:text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                              {item.lead.name}
                            </Link>
                            <span className="text-sm text-slate-500">{item.lead.company || ''}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Calendar className="w-3 h-3" />
                            Est. {item.estimatedSendTime.toLocaleString('en-US', { 
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                            })}
                          </div>
                        </div>
                        {isExpanded && preview && (
                          <div className="px-4 py-3 bg-white border-t border-slate-100">
                            <div className="text-xs text-slate-500 mb-1">Subject:</div>
                            <div className="text-sm font-medium text-slate-800 mb-2">{preview.subject}</div>
                            <div className="text-xs text-slate-500 mb-1">Body:</div>
                            <div className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded p-2 max-h-32 overflow-y-auto">{preview.body}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pipeline Stages */}
      <div className="grid grid-cols-8 gap-4">
        {stages.map((stage) => {
          const Icon = stage.icon;
          const isReady = stage.id.includes('ready') || stage.id === 'new-leads';
          
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
                    stage.id === 'new-leads' ? 'text-blue-600' :
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
                              if (stage.id === 'new-leads') {
                                // Go to lead page to send initial email
                                window.location.href = `/lead/${lead.id}`;
                              } else {
                                const fuNum = stage.id.includes('fu1') ? 1 : stage.id.includes('fu2') ? 2 : 3;
                                handleSendFollowup(lead, fuNum as 1 | 2 | 3);
                              }
                            }}
                            className={`opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-white rounded text-xs font-medium flex items-center gap-1 ${
                              stage.id === 'new-leads' 
                                ? 'bg-blue-600 hover:bg-blue-700' 
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
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
