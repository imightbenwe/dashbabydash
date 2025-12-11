import { useEffect, useState, useCallback } from 'react';
import { logger } from '@/lib/logger';

interface AutomationStatus {
  isRunning: boolean;
  lastCheck: Date | null;
  lastResults: {
    stage0Processed: number;
    stage1Processed: number;
    errors: string[];
  } | null;
}

/**
 * Hook to manage automation polling
 * Checks for leads needing automation every minute
 */
export function useAutomation(enabled: boolean = true) {
  const [status, setStatus] = useState<AutomationStatus>({
    isRunning: false,
    lastCheck: null,
    lastResults: null,
  });

  const processAutomation = useCallback(async () => {
    if (!enabled) return;

    setStatus(prev => ({ ...prev, isRunning: true }));

    try {
      logger.log('🤖 Triggering automation check...');
      
      const response = await fetch('/api/automation/process', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Automation API failed: ${response.statusText}`);
      }

      const data = await response.json();

      setStatus({
        isRunning: false,
        lastCheck: new Date(),
        lastResults: {
          stage0Processed: data.stage0Processed || 0,
          stage1Processed: data.stage1Processed || 0,
          errors: data.errors || [],
        },
      });

      // Log results if any work was done
      if (data.stage0Processed > 0 || data.stage1Processed > 0) {
        logger.log('✅ Automation processed:', {
          scraped: data.stage0Processed,
          analyzed: data.stage1Processed,
        });
      }

      // Log errors if any
      if (data.errors && data.errors.length > 0) {
        logger.error('❌ Automation errors:', data.errors);
      }

    } catch (error) {
      logger.error('Automation polling error:', error);
      setStatus(prev => ({
        ...prev,
        isRunning: false,
        lastCheck: new Date(),
      }));
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Run immediately on mount
    processAutomation();

    // Then run every 60 seconds
    const interval = setInterval(processAutomation, 60000);

    return () => clearInterval(interval);
  }, [enabled, processAutomation]);

  return {
    status,
    triggerManually: processAutomation,
  };
}
