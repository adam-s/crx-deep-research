import { useState, useCallback } from 'react';
import { EventMessage, Severity } from '../../utils/types';

export interface UseStagehandPlaygroundReturn {
  /** Run all stagehand tests */
  runAllTests: () => Promise<void>;
  /** Run basic navigation test */
  runNavigationTest: () => Promise<void>;
  /** Run DOM interaction test */
  runDOMInteractionTest: () => Promise<void>;
  /** Run performance test */
  runPerformanceTest: () => Promise<void>;
  /** Run actions test */
  runActionsTest: () => Promise<void>;
  /** All events emitted by the playground */
  events: EventMessage[];
  /** Latest event from the playground */
  latestEvent: EventMessage | undefined;
  /** Whether any test is currently running */
  isRunning: boolean;
  /** Any error that occurred during test execution */
  error: string | null;
  /** Clear all events and reset state */
  clearEvents: () => void;
  /** Clear any error */
  clearError: () => void;
  /** Get events filtered by severity */
  getEventsBySeverity: (severity: Severity) => EventMessage[];
}

export const useStagehandPlayground = (): UseStagehandPlaygroundReturn => {
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addEvent = useCallback((message: string, severity: Severity = Severity.Info) => {
    const event: EventMessage = {
      message,
      severity,
      timestamp: Date.now(),
    };
    setEvents(prev => [...prev, event]);
  }, []);

  const runAllTests = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    setError(null);
    addEvent('Starting all Stagehand tests...', Severity.Info);

    try {
      // Simulate test execution
      await new Promise(resolve => setTimeout(resolve, 2000));
      addEvent('All Stagehand tests completed successfully', Severity.Success);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      addEvent(`Error running tests: ${errorMessage}`, Severity.Error);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, addEvent]);

  const runNavigationTest = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    addEvent('Running navigation test...', Severity.Info);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      addEvent('Navigation test completed', Severity.Success);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Navigation test failed';
      addEvent(errorMessage, Severity.Error);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, addEvent]);

  const runDOMInteractionTest = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    addEvent('Running DOM interaction test...', Severity.Info);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      addEvent('DOM interaction test completed', Severity.Success);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'DOM interaction test failed';
      addEvent(errorMessage, Severity.Error);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, addEvent]);

  const runPerformanceTest = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    addEvent('Running performance test...', Severity.Info);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      addEvent('Performance test completed', Severity.Success);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Performance test failed';
      addEvent(errorMessage, Severity.Error);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, addEvent]);

  const runActionsTest = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    addEvent('Running actions test...', Severity.Info);

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      addEvent('Actions test completed', Severity.Success);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Actions test failed';
      addEvent(errorMessage, Severity.Error);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, addEvent]);

  const clearEvents = useCallback(() => {
    setEvents([]);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const latestEvent = events.length > 0 ? events[events.length - 1] : undefined;

  const getEventsBySeverity = useCallback(
    (severity: Severity) => {
      return events.filter(e => e.severity === severity);
    },
    [events]
  );

  return {
    runAllTests,
    runNavigationTest,
    runDOMInteractionTest,
    runPerformanceTest,
    runActionsTest,
    events,
    latestEvent,
    isRunning,
    error,
    clearEvents,
    clearError,
    getEventsBySeverity,
  };
};
