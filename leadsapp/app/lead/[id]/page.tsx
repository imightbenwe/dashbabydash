'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, ArrowLeft, Sparkles, Database, Mail, Save, Edit2, ExternalLink, Instagram, Facebook, Linkedin, FileText, MessageSquare, Globe, ChevronDown, ChevronUp } from 'lucide-react';

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [leadId, setLeadId] = useState<string>('');
  const [lead, setLead] = useState<any>(null);
  const [leadAnalysis, setLeadAnalysis] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [activeAnalysisView, setActiveAnalysisView] = useState<'openai' | 'gemini'>('openai');
  
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
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [additionalData, setAdditionalData] = useState('');
  const [isSavingAdditionalData, setIsSavingAdditionalData] = useState(false);
  const [rawDataSources, setRawDataSources] = useState<any[]>([]);
  const [isScrapingWebsite, setIsScrapingWebsite] = useState(false);
  
  // Collapsible section states
  const [isDataSourcesExpanded, setIsDataSourcesExpanded] = useState(true);
  const [isAdditionalDataExpanded, setIsAdditionalDataExpanded] = useState(false);
  
  // Instagram data upload state
  const [isUploadingInstagram, setIsUploadingInstagram] = useState(false);
  
  // Website mockup generator state
  const [showMockupModal, setShowMockupModal] = useState(false);
  const [mockupWebsiteUrls, setMockupWebsiteUrls] = useState('');
  const [isGeneratingMockup, setIsGeneratingMockup] = useState(false);
  const [mockupResult, setMockupResult] = useState<any>(null);

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
        // Also fetch raw data sources
        setRawDataSources(data.rawDataSources || []);
      }
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
    }
  };

  const fetchRawDataSources = async () => {
    try {
      const response = await fetch(`/api/leads/${leadId}/analysis`);
      if (response.ok) {
        const data = await response.json();
        setRawDataSources(data.rawDataSources || []);
      }
    } catch (err) {
      console.error('Failed to fetch raw data sources:', err);
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
          emailType: 'follow-up',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Follow-up email generated:', data);
        fetchLeadData(leadId);
        alert('Follow-up email generated successfully!');
      } else {
        const errorData = await response.json();
        alert(`Failed to generate follow-up email: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to generate follow-up email:', err);
      alert('Error generating follow-up email. Check console for details.');
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  const scrapeWebsiteData = async () => {
    if (!lead?.website) {
      alert('No website URL available to scrape');
      return;
    }

    setIsScrapingWebsite(true);
    try {
      // 1. Scrape the website
      const scrapeResponse = await fetch('/api/scraper/deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: lead.website }),
      });

      if (!scrapeResponse.ok) {
        throw new Error('Failed to scrape website');
      }

      const scrapeData = await scrapeResponse.json();
      const scrapedContent = scrapeData.content || '';

      // 2. Extract email from scraped content (priority #1)
      // Look for email patterns in the entire scraped content
      const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
      const emails = scrapedContent.match(emailRegex);
      // Filter out common false positives
      const validEmails = emails?.filter(email => 
        !email.includes('example.com') && 
        !email.includes('domain.com') &&
        !email.includes('yourdomain.com') &&
        !email.includes('wix.com') &&
        !email.includes('wordpress.com')
      );
      
      // Prioritize emails from "EMAILS FOUND:" section (from mailto: links)
      let extractedEmail = null;
      const emailsFoundMatch = scrapedContent.match(/EMAILS FOUND:\s*([^\n]+)/);
      if (emailsFoundMatch && emailsFoundMatch[1]) {
        const foundEmails = emailsFoundMatch[1].split(',').map(e => e.trim());
        extractedEmail = foundEmails[0];
      } else if (validEmails && validEmails.length > 0) {
        extractedEmail = validEmails[0];
      }

      // 3. Extract Instagram handle
      let extractedInstagram = null;
      
      // Prioritize "INSTAGRAM FOUND:" section (from href attributes)
      const instaFoundMatch = scrapedContent.match(/INSTAGRAM FOUND:\s*([^\n]+)/);
      if (instaFoundMatch && instaFoundMatch[1]) {
        extractedInstagram = instaFoundMatch[1].trim();
      } else {
        // Method 1: Look for instagram.com/username pattern (most reliable)
        const instaUrlMatch = scrapedContent.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
        if (instaUrlMatch && instaUrlMatch[1]) {
          const username = instaUrlMatch[1];
          // Filter out common paths that aren't usernames
          if (!['explore', 'p', 'tv', 'reels', 'accounts', 'direct'].includes(username.toLowerCase())) {
            extractedInstagram = username;
          }
        }
        
        // Method 2: If not found, look for @username in contact section
        if (!extractedInstagram) {
          // Look for patterns like "@username" followed by context clues
          const handleMatches = scrapedContent.match(/@([a-zA-Z0-9._]{3,30})/g);
          if (handleMatches && handleMatches.length > 0) {
            // Take the first one that appears near "instagram" or in contact/social sections
            const lowerContent = scrapedContent.toLowerCase();
            for (const match of handleMatches) {
              const handle = match.substring(1); // Remove @
              const index = lowerContent.indexOf(match.toLowerCase());
              const context = lowerContent.substring(Math.max(0, index - 100), index + 100);
              
              if (context.includes('instagram') || context.includes('insta') || 
                  context.includes('social') || context.includes('follow')) {
                extractedInstagram = handle;
                break;
              }
            }
          }
        }
      }

      // Extract Facebook if available
      let extractedFacebook = null;
      const fbFoundMatch = scrapedContent.match(/FACEBOOK FOUND:\s*([^\n]+)/);
      if (fbFoundMatch && fbFoundMatch[1]) {
        extractedFacebook = fbFoundMatch[1].trim();
      }

      // 4. Save full scraped content to Additional Data
      const additionalDataResponse = await fetch(`/api/leads/${leadId}/additional-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: scrapedContent,
        }),
      });

      if (!additionalDataResponse.ok) {
        const errorData = await additionalDataResponse.json();
        console.error('Failed to save scraped content:', errorData);
        // Don't throw - continue with extraction even if save fails
      } else {
        console.log('✅ Scraped content saved to additional data');
      }

      // 5. Update lead with extracted email and Instagram
      const updatePayload: any = {};
      if (extractedEmail && !lead.email) {
        updatePayload.email = extractedEmail;
      }
      if (extractedInstagram && !lead.instagram) {
        updatePayload.instagram = extractedInstagram;
      }
      if (extractedFacebook && !lead.facebook) {
        updatePayload.facebook = extractedFacebook;
      }

      if (Object.keys(updatePayload).length > 0) {
        const updateResponse = await fetch(`/api/leads/${leadId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload),
        });

        if (updateResponse.ok) {
          const updatedData = await updateResponse.json();
          setLead(updatedData.lead);
          setEditedEmail(updatedData.lead.email || '');
          setEditedInstagram(updatedData.lead.instagram || '');
          setEditedFacebook(updatedData.lead.facebook || '');
        }
      }

      // Refresh raw data sources to show new website data
      fetchRawDataSources();

      let message = '✅ Website scraped successfully!';
      if (extractedEmail) message += `\n📧 Email: ${extractedEmail}`;
      if (extractedInstagram) message += `\n📱 Instagram: @${extractedInstagram}`;
      if (extractedFacebook) message += `\n👥 Facebook: ${extractedFacebook}`;
      if (!extractedEmail && !extractedInstagram && !extractedFacebook) {
        message += '\n⚠️ No email, Instagram, or Facebook found in content';
        message += '\n💡 Content saved - check Additional Data section';
      }

      alert(message);
    } catch (err) {
      console.error('Failed to scrape website:', err);
      alert('Error scraping website. Check console for details.');
    } finally {
      setIsScrapingWebsite(false);
    }
  };

  const generateWebsiteMockup = async () => {
    if (!mockupWebsiteUrls.trim() && !editedWebsite) {
      alert('Please provide at least one website URL');
      return;
    }

    setIsGeneratingMockup(true);
    setMockupResult(null);

    try {
      // Parse URLs (can be comma or newline separated)
      const urls = mockupWebsiteUrls
        .split(/[,\n]/)
        .map(url => url.trim())
        .filter(url => url.length > 0);

      // Add the lead's website if no URLs provided
      if (urls.length === 0 && editedWebsite) {
        urls.push(editedWebsite);
      }

      console.log(`🎨 Generating mockup with URLs:`, urls);

      const response = await fetch('/api/mockup/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          websiteUrls: urls,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMockupResult(data);
        alert(`✅ Website mockup generated!\n\n${data.message}`);
      } else {
        throw new Error(data.error || 'Failed to generate mockup');
      }
    } catch (err) {
      console.error('Failed to generate mockup:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingMockup(false);
    }
  };

  const runAnalysis = async () => {
    setRunningAnalysis(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/run-analysis`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to run analysis');
      }

      const data = await response.json();
      console.log('✅ Analysis complete:', data);
      
      // Refresh the page data
      fetchLeadData(leadId);
      alert('Analysis completed successfully!');
    } catch (error) {
      console.error('Error running analysis:', error);
      alert('Failed to run analysis. Please try again.');
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setAdditionalData(content);
    };
    reader.readAsText(file);
  };

  const deleteDataSource = async (sourceId: string) => {
    if (!confirm('Are you sure you want to delete this data source? This will affect future AI analyses.')) {
      return;
    }

    try {
      const response = await fetch(`/api/leads/${leadId}/data-sources/${sourceId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('Data source deleted successfully!');
        // Refresh the analysis data to update the list
        fetchLeadAnalysis(leadId);
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      console.error('Error deleting data source:', error);
      alert('Failed to delete data source. Please try again.');
    }
  };

  const saveAdditionalData = async () => {
    if (!additionalData.trim()) {
      alert('No additional data to save');
      return;
    }

    setIsSavingAdditionalData(true);
    try {
      console.log('Sending additional data to:', `/api/leads/${leadId}/additional-data`);
      console.log('Data length:', additionalData.length);
      
      const response = await fetch(`/api/leads/${leadId}/additional-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: additionalData }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Error response:', errorData);
        throw new Error(`Failed to save: ${errorData.error || errorData.details || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log('Success response:', result);
      
      alert('Additional data saved successfully!');
      setAdditionalData('');
    } catch (error) {
      console.error('Error saving additional data:', error);
      alert(`Failed to save additional data: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setIsSavingAdditionalData(false);
    }
  };

  const handleInstagramFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingInstagram(true);
    try {
      // Read the file content
      const fileContent = await file.text();
      
      // Try to parse as JSON to validate
      try {
        JSON.parse(fileContent);
      } catch (parseError) {
        alert('Invalid JSON file. Please upload a valid Instagram data export (JSON format).');
        setIsUploadingInstagram(false);
        return;
      }

      // Send to API
      const response = await fetch(`/api/leads/${leadId}/additional-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          data: fileContent,
          sourceType: 'instagram'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to upload Instagram data');
      }

      alert('✅ Instagram data uploaded successfully!\n\nClick "Run AI Analysis" to analyze this data.');
      
      // Refresh raw data sources to show the new upload
      fetchRawDataSources();
      
      // Clear the file input
      e.target.value = '';
    } catch (error) {
      console.error('Error uploading Instagram data:', error);
      alert(`Failed to upload: ${error instanceof Error ? error.message : 'Please try again.'}`);
    } finally {
      setIsUploadingInstagram(false);
    }
  };

  const copyRawLeadData = () => {
    if (!lead) return;

    const socialsList = [
      lead.website ? `Website: ${lead.website}` : null,
      lead.instagram ? `Instagram: @${lead.instagram}` : null,
      lead.facebook ? `Facebook: ${lead.facebook}` : null,
      lead.linkedin ? `LinkedIn: ${lead.linkedin}` : null,
      lead.substack ? `Substack: ${lead.substack}` : null,
      lead.threads ? `Threads: @${lead.threads}` : null,
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

=== PERSONAL STORY HOOK ===
"${lead.personal_story_hook}"
` : '';

    const audiencePainSection = (lead.audience_pain_points && lead.audience_pain_points.length > 0) ? `

=== AUDIENCE PAIN POINTS ===
${lead.audience_pain_points.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}
` : '';

    const specificTopicsSection = (lead.specific_post_topics && lead.specific_post_topics.length > 0) ? `

=== SPECIFIC POST TOPICS ===
${lead.specific_post_topics.map((t: any, i: number) => `${i + 1}. "${t.topic}" (${t.engagement} engagement) - ${new Date(t.timestamp).toLocaleDateString()}`).join('\n')}
` : '';

    const personalDetailsSection = (lead.personal_location || lead.personal_hobbies?.length > 0 || lead.personal_pets?.length > 0 || lead.personal_struggles?.length > 0) ? `

=== PERSONAL DETAILS ===
${lead.personal_location ? `Location: ${lead.personal_location}` : ''}
${lead.personal_hobbies?.length > 0 ? `Hobbies: ${lead.personal_hobbies.join(', ')}` : ''}
${lead.personal_pets?.length > 0 ? `Pets: ${lead.personal_pets.join(', ')}` : ''}
${lead.personal_struggles?.length > 0 ? `\nStruggles:\n${lead.personal_struggles.map((s: string, i: number) => `${i + 1}. "${s}"`).join('\n')}` : ''}
` : '';

    const notesSection = lead.notes ? `

=== NOTES ===
${lead.notes}
` : '';

    // Add ALL data sources (Instagram, website, Substack, Threads, other)
    const dataSourcesSection = rawDataSources.length > 0 ? `

=== ALL DATA SOURCES (What the AI Knows) ===

${rawDataSources.map((source, idx) => {
  const content = typeof source.raw_content === 'string' 
    ? source.raw_content 
    : source.raw_content?.text || JSON.stringify(source.raw_content, null, 2);
  
  const sourceTypeLabel = source.source_type === 'other' ? 'Additional Data' : source.source_type.toUpperCase();
  
  return `--- DATA SOURCE ${idx + 1}: ${sourceTypeLabel} ---
File: ${source.file_name || 'N/A'}
Uploaded: ${new Date(source.uploaded_at).toLocaleString()}

${content}
${'='.repeat(80)}`;
}).join('\n\n')}
` : '';

    const rawData = `=== RAW LEAD DATA ===

Name: ${lead.name}
Company: ${lead.company || 'N/A'}
Email: ${lead.email || 'N/A'}
Phone: ${lead.phone || 'N/A'}
Status: ${lead.status}
Next Action: ${lead.next_action || 'N/A'}

=== SOCIAL PROFILES ===
${socialsList || 'None'}
${engagementSection}
${personalStorySection}
${audiencePainSection}
${specificTopicsSection}
${personalDetailsSection}
${notesSection}
${dataSourcesSection}

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
              onClick={runAnalysis}
              disabled={runningAnalysis}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {runningAnalysis ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" /> Running Analysis...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Run AI Analysis
                </>
              )}
            </button>
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
              <select
                value={isEditing ? editedStatus : lead.status}
                onChange={async (e) => {
                  const newStatus = e.target.value;
                  if (isEditing) {
                    setEditedStatus(newStatus);
                  } else {
                    // Auto-save status change
                    try {
                      const response = await fetch(`/api/leads/${leadId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus }),
                      });
                      if (response.ok) {
                        const data = await response.json();
                        setLead(data.lead);
                      }
                    } catch (err) {
                      console.error('Failed to update status:', err);
                    }
                  }
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="lead_collected">Lead collected</option>
                <option value="email_1_sent">Email 1 sent</option>
                <option value="email_2_sent">Email 2 sent</option>
                <option value="email_3_sent">Email 3 sent</option>
                <option value="replied_not_fit">Replied - not a fit</option>
                <option value="replied_interested">Replied - interested</option>
                <option value="call_booked">Call booked</option>
                <option value="call_done_thinking">Call done - thinking</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="site_live">Site Live</option>
              </select>
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
                <div className="flex items-center gap-2">
                  {lead.website ? (
                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                      {lead.website} <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                  {lead.website && (
                    <button
                      onClick={scrapeWebsiteData}
                      disabled={isScrapingWebsite}
                      className="px-2 py-1 text-xs bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      title="Scrape website for email and Instagram"
                    >
                      {isScrapingWebsite ? (
                        <>
                          <span className="animate-spin">⏳</span> Scraping...
                        </>
                      ) : (
                        <>
                          <Database className="w-3 h-3" /> Scrape
                        </>
                      )}
                    </button>
                  )}
                </div>
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

        {/* Data Upload Section - Instagram & Additional Data Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Instagram Data Upload */}
          <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-xl shadow-sm border border-pink-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Instagram className="w-5 h-5 text-pink-600" /> Upload Instagram Data
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              Upload your Instagram data export (JSON file) for AI analysis. Get your data from Instagram → Settings → Privacy → Download Your Information.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Instagram JSON File
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleInstagramFileUpload}
                  disabled={isUploadingInstagram}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-pink-50 file:text-pink-700
                    hover:file:bg-pink-100
                    disabled:opacity-50 disabled:cursor-not-allowed
                    cursor-pointer"
                />
                {isUploadingInstagram && (
                  <p className="text-xs text-pink-600 mt-2 flex items-center gap-2">
                    <span className="animate-spin">⏳</span> Uploading Instagram data...
                  </p>
                )}
              </div>
              
              <div className="p-3 bg-pink-100 rounded-lg">
                <p className="text-xs text-pink-900">
                  <strong>💡 Tip:</strong> After uploading, click "Run AI Analysis" below to analyze your Instagram data.
                </p>
              </div>
            </div>
          </div>

          {/* Additional Data Upload */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div 
              onClick={() => setIsAdditionalDataExpanded(!isAdditionalDataExpanded)}
              className="flex items-center justify-between cursor-pointer hover:bg-slate-50 -m-6 p-6 rounded-t-xl transition-colors"
            >
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" /> Add Additional Data
                </h2>
                <p className="text-xs text-slate-600">Upload a file or paste additional information for AI analysis</p>
              </div>
              {isAdditionalDataExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-600 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-600 flex-shrink-0" />
              )}
            </div>
            
            {isAdditionalDataExpanded && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Upload File (.txt, .json)</label>
                  <input
                    type="file"
                    accept=".txt,.json"
                    onChange={handleFileUpload}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Or Paste Content</label>
                  <textarea
                    value={additionalData}
                    onChange={(e) => setAdditionalData(e.target.value)}
                    rows={10}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-xs"
                    placeholder="Paste website content, social media posts, or any other relevant information here..."
                  />
                </div>

                <button
                  onClick={saveAdditionalData}
                  disabled={isSavingAdditionalData || !additionalData.trim()}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSavingAdditionalData ? 'Saving...' : 'Save Additional Data'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Raw Data Sources - What the AI Knows */}
        <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl shadow-sm border border-slate-200 p-6">
          <div 
            onClick={() => setIsDataSourcesExpanded(!isDataSourcesExpanded)}
            className="flex items-center justify-between cursor-pointer hover:bg-slate-100 -m-6 p-6 rounded-t-xl transition-colors"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Database className="w-5 h-5 text-slate-600" /> Data Sources (What the AI Knows About {lead?.name?.split(' ')[0]})
              </h2>
              <p className="text-xs text-slate-600">All data that will be used when you click "Run AI Analysis" or "Generate Initial Email"</p>
            </div>
            {isDataSourcesExpanded ? (
              <ChevronUp className="w-5 h-5 text-slate-600 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-600 flex-shrink-0" />
            )}
          </div>
          
          {isDataSourcesExpanded && (
            <div className="mt-4">
              {rawDataSources.length > 0 ? (
                <div className="space-y-3">
                  {rawDataSources.map((source, idx) => (
                <div key={idx} className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        source.source_type === 'instagram' ? 'bg-pink-100 text-pink-700' :
                        source.source_type === 'website' ? 'bg-blue-100 text-blue-700' :
                        source.source_type === 'substack' ? 'bg-orange-100 text-orange-700' :
                        source.source_type === 'threads' ? 'bg-purple-100 text-purple-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {source.source_type === 'other' ? 'Additional Data' : source.source_type}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(source.uploaded_at).toLocaleDateString()} at {new Date(source.uploaded_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteDataSource(source.id)}
                      className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 hover:border-red-300 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                  <pre className="text-xs text-slate-600 font-mono bg-slate-50 p-3 rounded border border-slate-100 max-h-96 overflow-y-auto whitespace-pre-wrap">
                    {typeof source.raw_content === 'string' 
                      ? source.raw_content
                      : source.raw_content?.text || JSON.stringify(source.raw_content, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg p-8 border border-slate-200 text-center">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-600">No data sources found. Add data using the "Additional Data" section below.</p>
            </div>
          )}

              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-800">
                  <strong>💡 How it works:</strong> When you click "Run AI Analysis", the system combines ALL data sources above and generates fresh insights. 
                  If you added new data, click "Run AI Analysis" → then "Generate Initial Email" to use the updated information.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* AI Analysis Results */}
        {leadAnalysis && leadAnalysis.openai && (
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm border border-purple-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" /> AI Analysis Results
            </h2>
            <p className="text-xs text-slate-600 mb-4">
              What the AI extracted from {lead?.name?.split(' ')[0]}'s data - these insights are used in email generation
            </p>

            {/* Toggle Button */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setShowFullAnalysis(!showFullAnalysis)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                  showFullAnalysis
                    ? 'bg-purple-600 text-white'
                    : 'bg-white border border-purple-200 hover:bg-purple-50'
                }`}
              >
                {showFullAnalysis ? 'Hide' : 'Show'} Analysis
              </button>
            </div>

            {/* Analysis Display */}
            {showFullAnalysis && (
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <h3 className="text-sm font-bold text-purple-900 mb-3 flex items-center gap-2">
                  🤖 OpenAI Analysis
                </h3>
                
                {/* Email Opening - First Paragraph */}
                {leadAnalysis.openai.full_response?.emailOpening && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 mb-4 border-2 border-indigo-200">
                    <label className="text-xs font-bold text-indigo-700 uppercase block mb-2">📧 EMAIL OPENING (First 1-2 Sentences)</label>
                    <p className="text-sm text-slate-900 italic leading-relaxed">"{leadAnalysis.openai.full_response.emailOpening}"</p>
                    <div className="mt-3 p-2 bg-indigo-100 rounded">
                      <p className="text-xs text-indigo-900">
                        <strong>💡 Usage:</strong> This is your warm, natural email opener. Copy this directly into your cold email to start the conversation.
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {leadAnalysis.openai.full_response?.topCommenter && (
                        <div className="bg-purple-50 rounded p-3">
                          <label className="text-xs font-bold text-purple-700 uppercase block mb-1">Top Commenter (Mutual Connection)</label>
                          <p className="text-sm text-slate-900">@{leadAnalysis.openai.full_response.topCommenter}</p>
                        </div>
                      )}
                      {leadAnalysis.openai.full_response?.specificAchievement && (
                        <div className="bg-pink-50 rounded p-3">
                          <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Specific Achievement</label>
                          <p className="text-sm text-slate-900">{leadAnalysis.openai.full_response.specificAchievement}</p>
                        </div>
                      )}
                      {leadAnalysis.openai.full_response?.specificHookStory && (
                        <div className="bg-purple-50 rounded p-3 md:col-span-2">
                          <label className="text-xs font-bold text-purple-700 uppercase block mb-1">Personal Story Hook</label>
                          <p className="text-sm text-slate-900 italic">"{leadAnalysis.openai.full_response.specificHookStory}"</p>
                        </div>
                      )}
                      {leadAnalysis.openai.full_response?.toneKeywords && leadAnalysis.openai.full_response.toneKeywords.length > 0 && (
                        <div className="bg-blue-50 rounded p-3">
                          <label className="text-xs font-bold text-blue-700 uppercase block mb-2">Tone & Style</label>
                          <div className="flex flex-wrap gap-1">
                            {leadAnalysis.openai.full_response.toneKeywords.map((keyword: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {leadAnalysis.openai.full_response?.keyTriggers && leadAnalysis.openai.full_response.keyTriggers.length > 0 && (
                        <div className="bg-red-50 rounded p-3">
                          <label className="text-xs font-bold text-red-700 uppercase block mb-2">Pain Points & Triggers</label>
                          <ul className="space-y-1">
                            {leadAnalysis.openai.full_response.keyTriggers.map((trigger: string, idx: number) => (
                              <li key={idx} className="text-xs text-slate-800">• {trigger}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {leadAnalysis.openai.full_response?.storyArc && (
                        <div className="bg-purple-50 rounded p-3 md:col-span-2">
                          <label className="text-xs font-bold text-purple-700 uppercase block mb-1">Overall Story Arc</label>
                          <p className="text-sm text-slate-900">{leadAnalysis.openai.full_response.storyArc}</p>
                        </div>
                      )}
                      {leadAnalysis.openai.full_response?.websiteProblem && (
                        <div className="bg-orange-50 rounded p-3 md:col-span-2">
                          <label className="text-xs font-bold text-orange-700 uppercase block mb-1">Website/Online Presence Issue</label>
                          <p className="text-sm text-slate-900">{leadAnalysis.openai.full_response.websiteProblem}</p>
                        </div>
                      )}
                      {leadAnalysis.openai.full_response?.engagementInsights && (
                        <div className="bg-green-50 rounded p-3 md:col-span-2">
                          <label className="text-xs font-bold text-green-700 uppercase block mb-1">Engagement Pattern</label>
                          <p className="text-sm text-slate-900">{leadAnalysis.openai.full_response.engagementInsights}</p>
                        </div>
                      )}
                    </div>
                  </div>
            )}

            {!showFullAnalysis && (
              <div className="bg-white rounded-lg p-4 border border-purple-200 text-center">
                <p className="text-sm text-slate-600">Click "Show Analysis" to see all extracted insights</p>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={runAnalysis}
              disabled={runningAnalysis}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Brain className="w-4 h-4" /> {runningAnalysis ? 'Analyzing...' : 'Run AI Analysis'}
            </button>
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

      {/* Website Mockup Generator Modal */}
      {showMockupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Globe className="w-6 h-6 text-purple-600" />
                  Generate Website Mockup
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  AI will scrape their website(s) and create a beautiful new mockup
                </p>
              </div>
              <button
                onClick={() => setShowMockupModal(false)}
                className="text-slate-400 hover:text-slate-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              {mockupResult && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-green-600 text-2xl">✅</div>
                    <div className="flex-1">
                      <p className="font-semibold text-green-900">Mockup Generated!</p>
                      <p className="text-sm text-green-700 mt-1">{mockupResult.message}</p>
                      <div className="mt-3 space-y-2">
                        <a
                          href={mockupResult.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-green-800 hover:text-green-900 underline block"
                        >
                          {mockupResult.url}
                        </a>
                        <p className="text-xs text-green-600">
                          Local file: {mockupResult.filePath}
                        </p>
                        <p className="text-xs text-green-600 font-semibold">
                          Remember to commit and push to make it live!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Website URLs to scrape
                </label>
                <textarea
                  value={mockupWebsiteUrls}
                  onChange={(e) => setMockupWebsiteUrls(e.target.value)}
                  placeholder={`Enter website URLs (one per line or comma-separated)\n\nExample:\nhttps://example.com\nhttps://example.com/about\n\nLeave empty to use lead's website: ${editedWebsite || 'None set'}`}
                  rows={6}
                  className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-2">
                  The AI will analyze these pages along with the lead's Instagram data and AI analysis to generate a custom mockup.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 text-sm mb-2">How it works:</h3>
                <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                  <li>Scrapes the provided website(s) for content and structure</li>
                  <li>Fetches lead's Instagram posts and AI personality analysis</li>
                  <li>Sends curated data to Gemini AI</li>
                  <li>Generates a complete, beautiful HTML website mockup</li>
                  <li>Saves to /demos/{lead?.name?.toLowerCase().replace(/[^a-z0-9-]/g, '-')}/</li>
                </ul>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={generateWebsiteMockup}
                  disabled={isGeneratingMockup}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-purple-200 transition-all flex items-center justify-center gap-2 disabled:bg-purple-400 disabled:cursor-not-allowed"
                >
                  {isGeneratingMockup ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Generating... (this may take 30-60 seconds)
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Generate Mockup with AI
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowMockupModal(false)}
                  className="px-6 py-3 text-slate-600 hover:text-slate-900 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
