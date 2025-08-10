import { useState, useCallback } from 'react';
import { useService } from './useService';
import { IBrowserUseService } from '@src/services/browser-use/browserUse.service';

export interface UseBrowserUseReturn {
  /** Run the browser use example */
  runExample: () => Promise<void>;
  /** Whether the example is currently running */
  isRunning: boolean;
  /** Any error that occurred during example execution */
  error: string | null;
  /** Clear any error */
  clearError: () => void;
}

export const useBrowserUse = (): UseBrowserUseReturn => {
  const browserUseService = useService(IBrowserUseService);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runExample = useCallback(async (): Promise<void> => {
    if (!browserUseService) {
      setError('Browser Use service not available');
      return;
    }

    try {
      setError(null);
      setIsRunning(true);
      await browserUseService.runExample();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run browser use example';
      setError(errorMessage);
      console.error('useBrowserUse: Failed to run example:', err);
    } finally {
      setIsRunning(false);
    }
  }, [browserUseService]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  return {
    runExample,
    isRunning,
    error,
    clearError,
  };
};
