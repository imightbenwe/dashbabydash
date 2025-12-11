/**
 * NewAnalysisForm Component
 * Form for creating new lead analyses with file uploads
 */

'use client';

import { useState } from 'react';
import { Users, Globe, Mail, AtSign, Upload } from 'lucide-react';
import { useAnalysis } from '@/lib/hooks';

interface NewAnalysisFormProps {
  onSuccess?: (leadId: string) => void;
  onError?: (error: string) => void;
}

export function NewAnalysisForm({ onSuccess, onError }: NewAnalysisFormProps) {
  const { runAnalysis, isAnalyzing, analysisError } = useAnalysis();
  
  // Form state
  const [prospectName, setProspectName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [igHandle, setIgHandle] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [uploadedProfilePicUrl, setUploadedProfilePicUrl] = useState('');
  const [isUploadingProfilePic, setIsUploadingProfilePic] = useState(false);
  const [websiteData, setWebsiteData] = useState('');
  const [igFile, setIgFile] = useState<File | null>(null);
  const [substackFile, setSubstackFile] = useState<File | null>(null);
  const [threadsFile, setThreadsFile] = useState<File | null>(null);
  const [otherFile, setOtherFile] = useState<File | null>(null);

  const handleSubmit = async () => {
    if (!prospectName.trim()) {
      onError?.('Please enter a prospect name');
      return;
    }

    const formData = new FormData();
    formData.append('prospectName', prospectName);
    if (company) formData.append('company', company);
    if (email) formData.append('email', email);
    if (igHandle) formData.append('igHandle', igHandle);
    if (websiteUrl) formData.append('websiteUrl', websiteUrl);
    if (uploadedProfilePicUrl) formData.append('profilePictureUrl', uploadedProfilePicUrl);
    if (websiteData) formData.append('websiteData', websiteData);
    if (igFile) formData.append('igFile', igFile);
    if (substackFile) formData.append('substackFile', substackFile);
    if (threadsFile) formData.append('threadsFile', threadsFile);
    if (otherFile) formData.append('otherFile', otherFile);

    const leadId = await runAnalysis(formData);
    
    if (leadId) {
      onSuccess?.(leadId);
      clearForm();
    } else if (analysisError) {
      onError?.(analysisError);
    }
  };

  const clearForm = () => {
    setProspectName('');
    setCompany('');
    setEmail('');
    setIgHandle('');
    setWebsiteUrl('');
    setProfilePictureUrl('');
    setUploadedProfilePicUrl('');
    setWebsiteData('');
    setIgFile(null);
    setSubstackFile(null);
    setThreadsFile(null);
    setOtherFile(null);
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingProfilePic(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('prospectName', prospectName || 'prospect');

      const response = await fetch('/api/leads/profile-picture', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload profile picture');
      }

      const data = await response.json();
      setUploadedProfilePicUrl(data.url);
      onError?.('');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setIsUploadingProfilePic(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Prospect Analysis</h1>
        <p className="text-slate-500 mt-1">Feed data to generate a tone profile and draft emails.</p>
      </div>

      {/* Basic Info Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" /> Basic Info
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Prospect Name (e.g. Sarah Jones)" 
              value={prospectName}
              onChange={(e) => setProspectName(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Company / Brand Name" 
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div className="relative">
            <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Instagram handle (e.g. @username)" 
              value={igHandle}
              onChange={(e) => setIgHandle(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Website URL" 
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          </div>
          <div className="relative">
            <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Profile Picture URL" 
              value={profilePictureUrl}
              onChange={(e) => setProfilePictureUrl(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
            />
          </div>
        </div>

        {/* Profile Picture Upload */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Or upload profile picture
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleProfilePicUpload}
            disabled={isUploadingProfilePic}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 disabled:opacity-50"
          />
          {isUploadingProfilePic && (
            <p className="mt-2 text-sm text-indigo-600">Uploading...</p>
          )}
          {uploadedProfilePicUrl && (
            <p className="mt-2 text-sm text-green-600">✓ Uploaded successfully</p>
          )}
        </div>
      </div>

      {/* Data Sources Section */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-indigo-500" /> Data Sources
        </h2>
        
        <div className="space-y-4">
          {/* Instagram JSON */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Instagram JSON (full.json)
            </label>
            <input
              type="file"
              accept=".json"
              onChange={(e) => setIgFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {igFile && <p className="mt-1 text-sm text-green-600">✓ {igFile.name}</p>}
          </div>

          {/* Substack */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Substack Export
            </label>
            <input
              type="file"
              onChange={(e) => setSubstackFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {substackFile && <p className="mt-1 text-sm text-green-600">✓ {substackFile.name}</p>}
          </div>

          {/* Threads */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Threads Export
            </label>
            <input
              type="file"
              onChange={(e) => setThreadsFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {threadsFile && <p className="mt-1 text-sm text-green-600">✓ {threadsFile.name}</p>}
          </div>

          {/* Other File */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Other Data
            </label>
            <input
              type="file"
              onChange={(e) => setOtherFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            />
            {otherFile && <p className="mt-1 text-sm text-green-600">✓ {otherFile.name}</p>}
          </div>

          {/* Website Data Textarea */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Website Content (paste text)
            </label>
            <textarea
              value={websiteData}
              onChange={(e) => setWebsiteData(e.target.value)}
              placeholder="Paste website content, about page, blog posts, etc."
              rows={6}
              className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isAnalyzing || !prospectName.trim()}
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isAnalyzing ? (
          <>
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Creating Lead...
          </>
        ) : (
          <>
            <Upload className="w-5 h-5" />
            Create Lead (Analysis Run via "Run AI Analysis" button)
          </>
        )}
      </button>
    </div>
  );
}
