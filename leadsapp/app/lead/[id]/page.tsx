'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, ArrowLeft, Sparkles, Database, Mail, Save, Edit2, ExternalLink, Instagram, Facebook, Linkedin, FileText, MessageSquare, Globe } from 'lucide-react';

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [leadId, setLeadId] = useState<string>('');
  const [lead, setLead] = useState<any>(null);
  const [leadAnalysis, setLeadAnalysis] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  
  // Editable fields
  const [editedName, setEditedName] = useState('');
  const [editedCompany, setEditedCompany] = useState('');
  const [editedEmail, setEditedEmail] = useState('');
  const [editedWebsite, setEditedWebsite] = useState('');
  const [editedInstagram, setEditedInstagram] = useState('');
  const [editedFacebook, setEditedFacebook] = useState('');
  const [editedSubstack, setEditedSubstack] = useState('');
  const [editedThreads, setEditedThreads] = useState('');
  const [editedLinkedIn, setEditedLinkedIn] = useState('');
  const [editedStatus, setEditedStatus] = useState('');
  const [editedNextAction, setEditedNextAction] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [generatedEmails, setGeneratedEmails] = useState<any[]>([]);
  
  // Cold email personalization fields
  const [editedMutualConnection, setEditedMutualConnection] = useState('');
  const [editedHookStory, setEditedHookStory] = useState('');
  const [editedProblemStatement, setEditedProblemStatement] = useState('');
  const [editedCaseStudy, setEditedCaseStudy] = useState('');
  const [editedPdfUrl, setEditedPdfUrl] = useState('');
  const [editedMockupSiteUrl, setEditedMockupSiteUrl] = useState('');
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);

  useEffect(() => {
    params.then(p => {
      setLeadId(p.id);
      fetchLeadData(p.id);
      fetchLeadAnalysis(p.id);
    });
  }, []);

  const fetchLeadData = async (id: string) => {
    try {
      const response = await fetch(`/api/leads/${id}`);
      if (response.ok) {
        const data = await response.json();
        setLead(data.lead);
        setGeneratedEmails(data.emails || []);
        setEditedName(data.lead.name || '');
        setEditedCompany(data.lead.company || '');
        setEditedEmail(data.lead.email || '');
        setEditedWebsite(data.lead.website || '');
        setEditedInstagram(data.lead.instagram || '');
        setEditedFacebook(data.lead.facebook || '');
        setEditedSubstack(data.lead.substack || '');
        setEditedThreads(data.lead.threads || '');
        setEditedLinkedIn(data.lead.linkedin || '');
        setEditedStatus(data.lead.status || 'new');
        setEditedNextAction(data.lead.next_action || '');
        setProfilePictureUrl(data.lead.profile_picture || '');
        
        // Set personalization fields
        setEditedMutualConnection(data.lead.mutual_connection_name || '');
        setEditedHookStory(data.lead.specific_hook_story || '');
        setEditedProblemStatement(data.lead.problem_statement || '');
        setEditedCaseStudy(data.lead.case_study_reference || '');
        setEditedPdfUrl(data.lead.pdf_url || '');
        setEditedMockupSiteUrl(data.lead.mockup_site_url || '');
      }
    } catch (err) {
      console.error('Failed to fetch lead:', err);
    }
  };

  const fetchLeadAnalysis = async (id: string) => {
    try {
      const response = await fetch(`/api/leads/${id}/analysis`);
      if (response.ok) {
        const data = await response.json();
        setLeadAnalysis(data);
      }
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
    }
  };

  const uploadProfilePicture = async (imageUrl: string) => {
    if (!imageUrl.trim() || !leadId) return;
    
    setIsUploadingPicture(true);
    try {
      const response = await fetch('/api/leads/profile-picture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          imageUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setProfilePictureUrl(data.profilePictureUrl);
        // Update lead data
        fetchLeadData(leadId);
      } else {
        alert('Failed to upload profile picture');
      }
    } catch (err) {
      console.error('Failed to upload picture:', err);
      alert('Error uploading profile picture');
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const saveLead = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedName,
          company: editedCompany,
          email: editedEmail,
          website: editedWebsite,
          instagram: editedInstagram,
          facebook: editedFacebook,
          substack: editedSubstack,
          threads: editedThreads,
          linkedin: editedLinkedIn,
          status: editedStatus,
          next_action: editedNextAction,
          mutual_connection_name: editedMutualConnection,
          specific_hook_story: editedHookStory,
          problem_statement: editedProblemStatement,
          case_study_reference: editedCaseStudy,
          pdf_url: editedPdfUrl,
          mockup_site_url: editedMockupSiteUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLead(data.lead);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Failed to save lead:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const generateEmail = async () => {
    setIsGeneratingEmail(true);
    try {
      const response = await fetch('/api/emails/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          emailType: 'initial',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Email generated:', data);
        // Refresh to show new email
        fetchLeadData(leadId);
        alert('Initial email generated successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to generate email: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to generate email:', err);
      alert('Error generating email. Check console for details.');
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const generateFollowUpEmail = async () => {
    setIsGeneratingFollowUp(true);
    try {
      const response = await fetch('/api/emails/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          emailType: 'follow_up_1',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Follow-up email generated:', data);
        fetchLeadData(leadId);
        alert('Follow-up email generated successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to generate follow-up: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to generate follow-up:', err);
      alert('Error generating follow-up email. Check console for details.');
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  const copyRawLeadData = () => {
    if (!lead) return;

    const socialsList = [
      lead.instagram ? `Instagram: @${lead.instagram}` : null,
      lead.facebook ? `Facebook: ${lead.facebook}` : null,
      lead.linkedin ? `LinkedIn: ${lead.linkedin}` : null,
      lead.substack ? `Substack: ${lead.substack}` : null,
      lead.threads ? `Threads: @${lead.threads}` : null,
      lead.website ? `Website: ${lead.website}` : null,
    ].filter(Boolean).join('\n');

    const engagementSection = (lead.total_posts_analyzed > 0 || lead.top_commenter_username) ? `

=== INSTAGRAM ENGAGEMENT ANALYTICS ===
Total Posts Analyzed: ${lead.total_posts_analyzed || 0}
Top Commenter: ${lead.top_commenter_username ? `@${lead.top_commenter_username}` : 'N/A'}
Average Likes: ~${Math.round(lead.engagement_avg_likes || 0)}~
Average Comments: ~${Math.round(lead.engagement_avg_comments || 0)}~
${lead.engagement_avg_views ? `Average Video Views: ~${Math.round(lead.engagement_avg_views)}~` : ''}
Most Engaging Topic: ${lead.most_engaging_topic || 'N/A'}
Recent Post Date: ${lead.recent_post_date ? new Date(lead.recent_post_date).toLocaleDateString() : 'N/A'}
` : '';

    const personalStorySection = lead.personal_story_hook ? `

=== PERSONAL STORY HOOK (Use in Email Opening) ===
"${lead.personal_story_hook}"

Email Example: "Ever since I heard your story about ${lead.personal_story_hook.toLowerCase()}..."
` : '';

    const audiencePainSection = (lead.audience_pain_points && lead.audience_pain_points.length > 0) ? `

=== AUDIENCE PAIN POINTS (from Comments) ===
${lead.audience_pain_points.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}

Insight: Highly engaged audience that may be under-monetized or not effectively captured.
` : '';

    const specificTopicsSection = (lead.specific_post_topics && lead.specific_post_topics.length > 0) ? `

=== SPECIFIC POST TOPICS (for Email Subject Lines) ===
${lead.specific_post_topics.map((t: any, i: number) => `${i + 1}. "${t.topic}" (${t.engagement} engagement)\n   Posted: ${new Date(t.timestamp).toLocaleDateString()}`).join('\n')}

Email Subject Line Examples:
- "Your post about ${lead.specific_post_topics[0]?.topic.toLowerCase()}"
- "Quick question re: ${lead.specific_post_topics[1]?.topic.toLowerCase() || lead.specific_post_topics[0]?.topic.toLowerCase()}"
` : '';

    const personalDetailsSection = (lead.personal_location || lead.personal_hobbies?.length > 0 || lead.personal_pets?.length > 0 || lead.personal_struggles?.length > 0) ? `

=== PERSONAL DETAILS ===
${lead.personal_location ? `Location: ${lead.personal_location}` : ''}
${lead.personal_hobbies?.length > 0 ? `\nHobbies: ${lead.personal_hobbies.join(', ')}` : ''}
${lead.personal_pets?.length > 0 ? `\nPets: ${lead.personal_pets.join(', ')}` : ''}
${lead.personal_struggles?.length > 0 ? `\n\nSTRUGGLES (Critical for Email Hooks):\n${lead.personal_struggles.map((s: string, i: number) => `${i + 1}. "${s}"`).join('\n')}` : ''}
` : '';

    const openaiSection = leadAnalysis?.openai ? `

=== OPENAI ANALYSIS ===
Story Arc: ${leadAnalysis.openai.story_arc || 'N/A'}

Key Triggers: ${leadAnalysis.openai.key_triggers?.join(', ') || 'N/A'}

Tone Keywords: ${leadAnalysis.openai.tone_keywords?.join(', ') || 'N/A'}
` : '';

    const geminiSection = leadAnalysis?.gemini ? `

=== GEMINI ANALYSIS ===
Story Arc: ${leadAnalysis.gemini.story_arc || 'N/A'}

Key Triggers: ${leadAnalysis.gemini.key_triggers?.join(', ') || 'N/A'}

Tone Keywords: ${leadAnalysis.gemini.tone_keywords?.join(', ') || 'N/A'}
` : '';

    const rawData = `=== RAW LEAD DATA ===

Name: ${lead.name}
Company: ${lead.company || 'N/A'}
Email: ${lead.email || 'N/A'}
Status: ${lead.status}
Persona Score: ${lead.persona_score || 'N/A'}

=== SOCIAL PROFILES ===
${socialsList || 'None'}
${engagementSection}
${personalStorySection}
${audiencePainSection}
${specificTopicsSection}
${personalDetailsSection}
${openaiSection}
${geminiSection}

=== WORKFLOW TRACKING ===
Next Action: ${lead.next_action || 'N/A'}
Date Contacted: ${lead.date_contacted ? new Date(lead.date_contacted).toLocaleDateString() : 'N/A'}
PDF Sent: ${lead.pdf_sent_date ? new Date(lead.pdf_sent_date).toLocaleDateString() : 'Not sent'}
Site Live: ${lead.site_live_date ? new Date(lead.site_live_date).toLocaleDateString() : 'Not live'}

Created: ${new Date(lead.created_at).toLocaleString()}
Last Updated: ${new Date(lead.updated_at).toLocaleString()}
`;

    navigator.clipboard.writeText(rawData);
    alert('✅ Raw lead data copied to clipboard!');
  };

  if (!lead) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.push('/')}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{lead.name}</h1>
              <p className="text-sm text-slate-500">{lead.company || 'No company'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyRawLeadData}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg flex items-center gap-2"
            >
              <Database className="w-4 h-4" /> Copy Raw Lead Data
            </button>
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            ) : (
              <>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    // Reset to original values
                    setEditedName(lead.name);
                    setEditedCompany(lead.company || '');
                    setEditedEmail(lead.email || '');
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveLead}
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Lead Information */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-start gap-6 mb-6">
            {/* Profile Picture */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-200">
                {profilePictureUrl ? (
                  <img src={profilePictureUrl} alt={lead.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-slate-400">
                    {lead.name?.[0]?.toUpperCase() || 'L'}
                  </div>
                )}
              </div>
              {isEditing && (
                <div className="mt-3">
                  <input
                    type="text"
                    placeholder="Paste image URL"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        uploadProfilePicture(e.currentTarget.value);
                        e.currentTarget.value = '';
                      }
                    }}
                  />
                  <p className="text-xs text-slate-500 mt-1">Press Enter to upload</p>
                  {isUploadingPicture && <p className="text-xs text-indigo-600 mt-1">Uploading...</p>}
                </div>
              )}
            </div>

            {/* Lead Details */}
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Lead Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <p className="text-sm font-medium text-slate-900">{lead.name}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Company</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedCompany}
                  onChange={(e) => setEditedCompany(e.target.value)}
                  placeholder="Company name"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <p className="text-sm text-slate-900">{lead.company || '—'}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Email</label>
              {isEditing ? (
                <input
                  type="email"
                  value={editedEmail}
                  onChange={(e) => setEditedEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <p className="text-sm text-slate-900">{lead.email || '—'}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Status</label>
              {isEditing ? (
                <select
                  value={editedStatus}
                  onChange={(e) => setEditedStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="new">New</option>
                  <option value="analysis_done">Analysis Done</option>
                  <option value="pdf_sent">PDF Sent</option>
                  <option value="site_live">Site Live</option>
                  <option value="follow_up_sent">Follow-up Sent</option>
                  <option value="closed_won">Closed Won</option>
                  <option value="closed_lost">Closed Lost</option>
                </select>
              ) : (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  lead.status === 'analysis_done' ? 'bg-blue-100 text-blue-800' :
                  lead.status === 'pdf_sent' ? 'bg-purple-100 text-purple-800' :
                  lead.status === 'site_live' ? 'bg-yellow-100 text-yellow-800' :
                  lead.status === 'follow_up_sent' ? 'bg-orange-100 text-orange-800' :
                  lead.status === 'closed_won' ? 'bg-green-100 text-green-800' :
                  lead.status === 'closed_lost' ? 'bg-red-100 text-red-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {lead.status.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
              )}
            </div>
            <div className="col-span-2">
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1">Next Action</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedNextAction}
                  onChange={(e) => setEditedNextAction(e.target.value)}
                  placeholder="What's the next step?"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <p className="text-sm text-slate-900">{lead.next_action || '—'}</p>
              )}
            </div>
          </div>
            </div>
          </div>
        </div>

        {/* Social Profiles */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Social Profiles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1 flex items-center gap-1">
                <Globe className="w-3 h-3" /> Website
              </label>
              {isEditing ? (
                <input
                  type="url"
                  value={editedWebsite}
                  onChange={(e) => setEditedWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                lead.website ? (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    {lead.website} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1 flex items-center gap-1">
                <Instagram className="w-3 h-3" /> Instagram
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedInstagram}
                  onChange={(e) => setEditedInstagram(e.target.value)}
                  placeholder="@username"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                lead.instagram ? (
                  <a href={`https://instagram.com/${lead.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    @{lead.instagram.replace('@', '')} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1 flex items-center gap-1">
                <Facebook className="w-3 h-3" /> Facebook
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedFacebook}
                  onChange={(e) => setEditedFacebook(e.target.value)}
                  placeholder="username or page"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                lead.facebook ? (
                  <a href={`https://facebook.com/${lead.facebook}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    {lead.facebook} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Substack
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedSubstack}
                  onChange={(e) => setEditedSubstack(e.target.value)}
                  placeholder="username.substack.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                lead.substack ? (
                  <a href={lead.substack.startsWith('http') ? lead.substack : `https://${lead.substack}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    {lead.substack} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1 flex items-center gap-1">
                <MessageSquare className="w-3 h-3" /> Threads
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedThreads}
                  onChange={(e) => setEditedThreads(e.target.value)}
                  placeholder="@username"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                lead.threads ? (
                  <a href={`https://threads.net/@${lead.threads.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    @{lead.threads.replace('@', '')} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase block mb-1 flex items-center gap-1">
                <Linkedin className="w-3 h-3" /> LinkedIn
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedLinkedIn}
                  onChange={(e) => setEditedLinkedIn(e.target.value)}
                  placeholder="in/username"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                lead.linkedin ? (
                  <a href={`https://linkedin.com/${lead.linkedin.startsWith('in/') ? lead.linkedin : 'in/' + lead.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                    {lead.linkedin} <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <p className="text-sm text-slate-400">—</p>
                )
              )}
            </div>
          </div>
        </div>

        {/* Instagram Engagement Analytics */}
        {(lead.total_posts_analyzed > 0 || lead.top_commenter_username) && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm border border-purple-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Instagram className="w-5 h-5 text-purple-600" />
              Instagram Engagement Analytics
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Top Commenter */}
              {lead.top_commenter_username && (
                <div className="bg-white rounded-lg p-4 border border-purple-100">
                  <label className="text-xs font-bold text-purple-600 uppercase block mb-2">
                    Most Engaged Follower
                  </label>
                  <div className="flex items-center gap-3">
                    {lead.top_commenter_profile_pic && (
                      <img 
                        src={lead.top_commenter_profile_pic} 
                        alt={lead.top_commenter_username}
                        className="w-10 h-10 rounded-full border-2 border-purple-200"
                      />
                    )}
                    <div>
                      <a 
                        href={`https://instagram.com/${lead.top_commenter_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
                      >
                        @{lead.top_commenter_username} <ExternalLink className="w-3 h-3" />
                      </a>
                      <p className="text-xs text-slate-500">Top Commenter</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Engagement Metrics */}
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <label className="text-xs font-bold text-purple-600 uppercase block mb-2">
                  Average Engagement
                </label>
                <div className="space-y-2">
                  {lead.engagement_avg_likes > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Likes:</span>
                      <span className="text-sm font-bold text-slate-900">~{Math.round(lead.engagement_avg_likes)}~</span>
                    </div>
                  )}
                  {lead.engagement_avg_comments > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Comments:</span>
                      <span className="text-sm font-bold text-slate-900">~{Math.round(lead.engagement_avg_comments)}~</span>
                    </div>
                  )}
                  {lead.engagement_avg_views > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Video Views:</span>
                      <span className="text-sm font-bold text-slate-900">~{Math.round(lead.engagement_avg_views)}~</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Insights */}
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <label className="text-xs font-bold text-purple-600 uppercase block mb-2">
                  Content Insights
                </label>
                <div className="space-y-2">
                  {lead.total_posts_analyzed > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Posts Analyzed:</span>
                      <span className="text-sm font-bold text-slate-900">{lead.total_posts_analyzed}</span>
                    </div>
                  )}
                  {lead.most_engaging_topic && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Top Topic:</span>
                      <span className="text-sm font-bold text-purple-600">{lead.most_engaging_topic}</span>
                    </div>
                  )}
                  {lead.recent_post_date && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-600">Last Post:</span>
                      <span className="text-sm font-medium text-slate-900">
                        {new Date(lead.recent_post_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-purple-100 rounded-lg">
              <p className="text-xs text-purple-800">
                <strong>💡 Tip:</strong> Use this data in your cold emails to show you've done your research. 
                Mention the top commenter as a mutual connection or reference specific engagement metrics.
              </p>
            </div>

            {/* Personal Details Section */}
            {(lead.personal_location || lead.personal_hobbies?.length > 0 || lead.personal_pets?.length > 0 || lead.personal_struggles?.length > 0 || lead.personal_mentions?.length > 0) && (
              <div className="mt-6 border-t border-purple-200 pt-6">
                <h3 className="text-md font-bold text-purple-900 mb-4 flex items-center gap-2">
                  🎯 Personal Details from Posts
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {lead.personal_location && (
                    <div className="bg-white rounded-lg p-4 border border-purple-100">
                      <label className="text-xs font-bold text-purple-600 uppercase block mb-2">📍 Location</label>
                      <p className="text-sm text-slate-900 font-medium">{lead.personal_location}</p>
                    </div>
                  )}

                  {lead.personal_hobbies?.length > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-purple-100">
                      <label className="text-xs font-bold text-purple-600 uppercase block mb-2">🎨 Hobbies & Interests</label>
                      <div className="flex flex-wrap gap-1">
                        {lead.personal_hobbies.map((hobby: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                            {hobby}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {lead.personal_pets?.length > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-purple-100">
                      <label className="text-xs font-bold text-purple-600 uppercase block mb-2">🐾 Pets</label>
                      <div className="flex flex-wrap gap-1">
                        {lead.personal_pets.map((pet: string, idx: number) => (
                          <span key={idx} className="px-2 py-1 text-xs bg-pink-100 text-pink-700 rounded-full">
                            {pet}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Struggles Section - Most Important */}
                {lead.personal_struggles?.length > 0 && (
                  <div className="mt-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 border-2 border-red-200">
                    <label className="text-xs font-bold text-red-700 uppercase block mb-3 flex items-center gap-2">
                      🎯 STRUGGLES & CHALLENGES (USE THESE IN EMAILS!)
                    </label>
                    <ul className="space-y-2">
                      {lead.personal_struggles.map((struggle: string, idx: number) => (
                        <li key={idx} className="text-sm text-slate-800 pl-4 border-l-2 border-red-300">
                          "{struggle}"
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 p-2 bg-red-100 rounded">
                      <p className="text-xs text-red-800">
                        <strong>💥 EMAIL HOOK:</strong> These are gold for personalization. Reference their specific struggle in your opening line.
                      </p>
                    </div>
                  </div>
                )}

                {/* Personal Story Hook - For Email Opening */}
                {lead.personal_story_hook && (
                  <div className="mt-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-300">
                    <label className="text-xs font-bold text-blue-700 uppercase block mb-3 flex items-center gap-2">
                      💬 PERSONAL STORY HOOK (First-Person Narrative)
                    </label>
                    <blockquote className="text-sm text-slate-800 italic border-l-4 border-blue-400 pl-4 mb-3">
                      "{lead.personal_story_hook}"
                    </blockquote>
                    <div className="p-2 bg-blue-100 rounded">
                      <p className="text-xs text-blue-900">
                        <strong>📧 EMAIL USAGE:</strong> "Ever since I heard your story about {lead.personal_story_hook.toLowerCase()}..."
                      </p>
                    </div>
                  </div>
                )}

                {/* Audience Pain Points */}
                {lead.audience_pain_points && lead.audience_pain_points.length > 0 && (
                  <div className="mt-4 bg-gradient-to-br from-amber-50 to-yellow-50 rounded-lg p-4 border-2 border-amber-300">
                    <label className="text-xs font-bold text-amber-700 uppercase block mb-3 flex items-center gap-2">
                      💭 AUDIENCE PAIN POINTS (from Comments)
                    </label>
                    <ul className="space-y-2 mb-3">
                      {lead.audience_pain_points.slice(0, 8).map((painPoint: string, idx: number) => (
                        <li key={idx} className="text-xs text-slate-700 pl-3 border-l-2 border-amber-300">
                          {painPoint}
                        </li>
                      ))}
                    </ul>
                    <div className="p-2 bg-amber-100 rounded">
                      <p className="text-xs text-amber-900">
                        <strong>🎯 INSIGHT:</strong> Highly engaged audience that may be under-monetized or not effectively captured—perfect angle for your pitch.
                      </p>
                    </div>
                  </div>
                )}

                {/* Specific Post Topics for Email Subject Lines */}
                {lead.specific_post_topics && lead.specific_post_topics.length > 0 && (
                  <div className="mt-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-300">
                    <label className="text-xs font-bold text-green-700 uppercase block mb-3 flex items-center gap-2">
                      🎯 SPECIFIC POST TOPICS (For Email Subject Lines)
                    </label>
                    <div className="space-y-2 mb-3">
                      {lead.specific_post_topics.map((topicObj: any, idx: number) => (
                        <div key={idx} className="bg-white rounded p-2 border border-green-200">
                          <p className="text-sm text-slate-800 font-medium">"{topicObj.topic}"</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {topicObj.engagement} engagement • {new Date(topicObj.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 bg-green-100 rounded">
                      <p className="text-xs text-green-900 mb-2">
                        <strong>📧 EMAIL SUBJECT LINE IDEAS:</strong>
                      </p>
                      <ul className="text-xs text-green-800 space-y-1 pl-4">
                        <li>• "Your post about {lead.specific_post_topics[0]?.topic.toLowerCase()}"</li>
                        <li>• "Quick question re: {lead.specific_post_topics[1]?.topic.toLowerCase() || lead.specific_post_topics[0]?.topic.toLowerCase()}"</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Personal Story Moments */}
                {lead.personal_mentions?.length > 0 && (
                  <div className="mt-4 bg-white rounded-lg p-4 border border-purple-100">
                    <label className="text-xs font-bold text-purple-600 uppercase block mb-3">📖 Personal Story Moments</label>
                    <ul className="space-y-2">
                      {lead.personal_mentions.slice(0, 3).map((mention: string, idx: number) => (
                        <li key={idx} className="text-xs text-slate-600 pl-3 border-l-2 border-purple-200">
                          {mention}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cold Email Personalization */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm border border-indigo-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" /> Cold Email Personalization
          </h2>
          <p className="text-xs text-slate-600 mb-4">Optional fields to enhance email personalization (AI will use analysis data if these are empty)</p>
          <div className="grid grid-cols-1 gap-4">
            {(isEditing || lead.mutual_connection_name) && (
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Mutual Connection (Optional)</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedMutualConnection}
                    onChange={(e) => setEditedMutualConnection(e.target.value)}
                    placeholder="e.g., Jessica Smith (for subject line: 'I found you through...')"
                    className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                  />
                ) : (
                  <p className="text-sm text-slate-900">{lead.mutual_connection_name}</p>
                )}
              </div>
            )}
            {(isEditing || lead.specific_hook_story) && (
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Specific Hook Story Override (Optional)</label>
                {isEditing ? (
                  <textarea
                    value={editedHookStory}
                    onChange={(e) => setEditedHookStory(e.target.value)}
                    placeholder="Leave empty to let AI extract from analysis. Or override with: 'I heard your story about 2010 when...'"
                    className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white h-20 resize-none"
                  />
                ) : (
                  <p className="text-sm text-slate-900 whitespace-pre-wrap">{lead.specific_hook_story}</p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(isEditing || lead.pdf_url) && (
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">PDF URL</label>
                  {isEditing ? (
                    <input
                      type="url"
                      value={editedPdfUrl}
                      onChange={(e) => setEditedPdfUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  ) : (
                    <a href={lead.pdf_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                      View PDF <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
              {(isEditing || lead.mockup_site_url) && (
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Mockup Site URL</label>
                  {isEditing ? (
                    <input
                      type="url"
                      value={editedMockupSiteUrl}
                      onChange={(e) => setEditedMockupSiteUrl(e.target.value)}
                      placeholder="https://mockup-site.com"
                      className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  ) : (
                    <a href={lead.mockup_site_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                      View Live Site <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* AI Analysis Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-slate-900">AI Analysis</h2>
            <button
              onClick={() => setShowFullAnalysis(!showFullAnalysis)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {showFullAnalysis ? 'Hide Details' : 'Show Full Analysis'}
            </button>
          </div>

          {leadAnalysis && (
            <div className="space-y-4">
              {/* Quick Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 rounded-lg p-3">
                  <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Persona Score</span>
                  <span className="text-lg font-bold capitalize">{lead.persona_score || 'N/A'}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Tone</span>
                  <span className="text-sm">{leadAnalysis.openai?.tone_keywords?.join(', ') || leadAnalysis.gemini?.tone_keywords?.join(', ') || '—'}</span>
                </div>
                <div className="bg-slate-50 rounded-lg p-3">
                  <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Created</span>
                  <span className="text-sm">{new Date(lead.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Full Analysis Details */}
              {showFullAnalysis && (
                <div className="space-y-4 mt-4">
                  {leadAnalysis.openai && (
                    <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50">
                      <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" /> OpenAI Analysis
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold">Story Arc:</span> {leadAnalysis.openai.story_arc}
                        </div>
                        <div>
                          <span className="font-semibold">Key Triggers:</span> {leadAnalysis.openai.key_triggers?.join(', ')}
                        </div>
                      </div>
                    </div>
                  )}

                  {leadAnalysis.gemini && (
                    <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
                      <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                        <Brain className="w-5 h-5" /> Gemini Analysis
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="font-semibold">Story Arc:</span> {leadAnalysis.gemini.story_arc}
                        </div>
                        <div>
                          <span className="font-semibold">Key Triggers:</span> {leadAnalysis.gemini.key_triggers?.join(', ')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {!leadAnalysis && (
            <p className="text-sm text-slate-500">No analysis available yet. Run an analysis to see insights.</p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={generateEmail}
              disabled={isGeneratingEmail}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" /> {isGeneratingEmail ? 'Generating...' : 'Generate Initial Email'}
            </button>
            <button
              onClick={generateFollowUpEmail}
              disabled={isGeneratingFollowUp}
              className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" /> {isGeneratingFollowUp ? 'Generating...' : 'Generate Follow-up Email'}
            </button>
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
              Generate Website Mockup
            </button>
            <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg">
              Export to PDF
            </button>
          </div>
        </div>

        {/* Generated Emails Section */}
        {generatedEmails.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Generated Emails</h2>
            <div className="space-y-4">
              {generatedEmails.map((email, index) => (
                <div key={email.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase">
                        {email.email_type?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-500 ml-3">
                        {new Date(email.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
                        alert('Email copied to clipboard!');
                      }}
                      className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs font-bold text-slate-600">Subject:</span>
                      <p className="text-sm font-medium text-slate-900">{email.subject}</p>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-600">Body:</span>
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{email.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
