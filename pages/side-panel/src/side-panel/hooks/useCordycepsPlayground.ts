import { useState, useEffect, useCallback } from 'react';
import { IDisposable } from 'vs/base/common/lifecycle';
import { useService } from './useService';
import { ICordycepsPlaygroundService } from '../../services/cordyceps/cordycepsPlaygroundService';
import { EventMessage, Severity } from '../../utils/types';

export interface UseCordycepsPlaygroundReturn {
  /** Run all playground tests */
  runAllTests: () => Promise<void>;
  /** Run basic navigation test */
  runNavigationTest: () => Promise<void>;
  /** Run frame execution context test */
  runFrameExecutionTest: () => Promise<void>;
  /** Run DOM interaction test */
  runDOMInteractionTest: () => Promise<void>;
  /** Run performance test */
  runPerformanceTest: () => Promise<void>;
  /** Run locator test */
  runLocatorTest: () => Promise<void>;
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
  /** Filter events by severity */
  getEventsBySeverity: (severity: Severity) => EventMessage[];
}

export const useCordycepsPlayground = (): UseCordycepsPlaygroundReturn => {
  const cordycepsPlaygroundService = useService(ICordycepsPlaygroundService);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [latestEvent, setLatestEvent] = useState<EventMessage | undefined>(undefined);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cordycepsPlaygroundService) return;

    const disposables: IDisposable[] = [];

    // Listen to playground events
    disposables.push(
      cordycepsPlaygroundService.onEvent((event: EventMessage) => {
        setLatestEvent(event);
        setEvents(prevEvents => [...prevEvents, event]);

        // Track running state based on events
        if (
          event.severity === Severity.Info &&
          (event.message === 'Playground starting' ||
            event.message.includes('Starting') ||
            event.message === 'Starting all playground tests')
        ) {
          setIsRunning(true);
          setError(null);
        } else if (
          event.severity === Severity.Success &&
          (event.message === 'Playground complete' ||
            event.message.includes('completed') ||
            event.message === 'All playground tests completed successfully')
        ) {
          setIsRunning(false);
        } else if (event.severity === Severity.Error) {
          setIsRunning(false);
          setError(event.error?.message || event.message);
        }
      }),
    );

    return () => {
      disposables.forEach(disposable => disposable.dispose());
    };
  }, [cordycepsPlaygroundService]);

  const runAllTests = useCallback(async (): Promise<void> => {
    if (!cordycepsPlaygroundService) {
      setError('Cordyceps playground service not available');
      return;
    }

    try {
      setError(null);
      await cordycepsPlaygroundService.runAllTests();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run all tests';
      setError(errorMessage);
      console.error('useCordycepsPlayground: Failed to run all tests:', err);
    }
  }, [cordycepsPlaygroundService]);

  const runNavigationTest = useCallback(async (): Promise<void> => {
    if (!cordycepsPlaygroundService) {
      setError('Cordyceps playground service not available');
      return;
    }

    try {
      setError(null);
      await cordycepsPlaygroundService.runNavigationTest();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run navigation test';
      setError(errorMessage);
      console.error('useCordycepsPlayground: Failed to run navigation test:', err);
    }
  }, [cordycepsPlaygroundService]);

  const runFrameExecutionTest = useCallback(async (): Promise<void> => {
    if (!cordycepsPlaygroundService) {
      setError('Cordyceps playground service not available');
      return;
    }

    try {
      setError(null);
      await cordycepsPlaygroundService.runFrameExecutionTest();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to run frame execution test';
      setError(errorMessage);
      console.error('useCordycepsPlayground: Failed to run frame execution test:', err);
    }
  }, [cordycepsPlaygroundService]);

  const runDOMInteractionTest = useCallback(async (): Promise<void> => {
    if (!cordycepsPlaygroundService) {
      setError('Cordyceps playground service not available');
      return;
    }

    try {
      setError(null);
      await cordycepsPlaygroundService.runDOMInteractionTest();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to run DOM interaction test';
      setError(errorMessage);
      console.error('useCordycepsPlayground: Failed to run DOM interaction test:', err);
    }
  }, [cordycepsPlaygroundService]);

  const runLocatorTest = useCallback(async (): Promise<void> => {
    if (!cordycepsPlaygroundService) {
      setError('Cordyceps playground service not available');
      return;
    }

    try {
      setError(null);
      await cordycepsPlaygroundService.runLocatorTest();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run locator test';
      setError(errorMessage);
      console.error('useCordycepsPlayground: Failed to run locator test:', err);
    }
  }, [cordycepsPlaygroundService]);

  const runPerformanceTest = useCallback(async (): Promise<void> => {
    if (!cordycepsPlaygroundService) {
      setError('Cordyceps playground service not available');
      return;
    }

    try {
      setError(null);
      await cordycepsPlaygroundService.runPerformanceTest();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to run performance test';
      setError(errorMessage);
      console.error('useCordycepsPlayground: Failed to run performance test:', err);
    }
  }, [cordycepsPlaygroundService]);

  const clearEvents = useCallback((): void => {
    setEvents([]);
    setLatestEvent(undefined);
    setError(null);
  }, []);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const getEventsBySeverity = useCallback(
    (severity: Severity): EventMessage[] => {
      return events.filter(event => event.severity === severity);
    },
    [events],
  );

  return {
    runAllTests,
    runNavigationTest,
    runFrameExecutionTest,
    runDOMInteractionTest,
    runLocatorTest,
    runPerformanceTest,
    events,
    latestEvent,
    isRunning,
    error,
    clearEvents,
    clearError,
    getEventsBySeverity,
  };
};
