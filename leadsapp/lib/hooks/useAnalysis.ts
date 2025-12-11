/**
 * useAnalysis Hook - Manages lead analysis and AI operations
 */

import { useState, useCallback } from 'react';
import type { AnalysisResult, GeneratedEmail } from '../types';
import { logger } from '../logger';

interface UseAnalysisReturn {
  analysisResults: AnalysisResult | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  generatedEmail: GeneratedEmail | null;
  isGeneratingEmail: boolean;
  runAnalysis: (formData: FormData) => Promise<string | null>;
  regenerateEmail: (leadId: string, template?: string) => Promise<void>;
  clearAnalysis: () => void;
}

export function useAnalysis(): UseAnalysisReturn {
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);

  const runAnalysis = useCallback(async (formData: FormData): Promise<string | null> => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisResults(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      
      if (data.leadId) {
        logger.info('Lead created successfully', { leadId: data.leadId });
        return data.leadId;
      }

      // If full analysis was returned (old flow)
      if (data.leadId || data.geminiAnalysis || data.openaiAnalysis) {
        setAnalysisResults(data);
        logger.info('Analysis completed successfully', { leadId: data.leadId });
        return data.leadId;
      }

      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setAnalysisError(errorMessage);
      logger.error('Failed to run analysis', err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const regenerateEmail = useCallback(async (leadId: string, template?: string) => {
    setIsGeneratingEmail(true);

    try {
      const response = await fetch('/api/emails/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId,
          emailType: 'initial',
          template,
          regenerate: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate email');
      }

      const data = await response.json();
      setGeneratedEmail(data.email);
      
      // Update analysis results if they exist
      if (analysisResults) {
        setAnalysisResults({
          ...analysisResults,
          email: data.email,
        });
      }
      
      logger.info('Email regenerated successfully', { leadId });
    } catch (err) {
      logger.error('Failed to regenerate email', err);
      setAnalysisError(err instanceof Error ? err.message : 'Email generation failed');
    } finally {
      setIsGeneratingEmail(false);
    }
  }, [analysisResults]);

  const clearAnalysis = useCallback(() => {
    setAnalysisResults(null);
    setAnalysisError(null);
    setGeneratedEmail(null);
  }, []);

  return {
    analysisResults,
    isAnalyzing,
    analysisError,
    generatedEmail,
    isGeneratingEmail,
    runAnalysis,
    regenerateEmail,
    clearAnalysis,
  };
}
