import { useCallback, useEffect, useState } from 'react';
import { EventMessage, Severity } from '../../utils/types';
import { IBrowserUsePlaygroundService } from '../../services/browser-use/playground/browserUsePlaygroundService';
import { useService } from './useService';

export const useBrowserUsePlayground = () => {
  const browserUsePlaygroundService = useService(IBrowserUsePlaygroundService);
  const [events, setEvents] = useState<EventMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    const disposable = browserUsePlaygroundService.onEvent(event => {
      setEvents(prev => [...prev, event]);
    });

    return () => disposable.dispose();
  }, [browserUsePlaygroundService]);

  const runAgentTest = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    try {
      await browserUsePlaygroundService.runAgentTest();
    } catch (error) {
      console.error('Agent test failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [browserUsePlaygroundService, isRunning]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  const runPhase1Tests = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    try {
      await browserUsePlaygroundService.runPhase1CoreMethodsTests();
    } catch (error) {
      console.error('Phase 1 tests failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [browserUsePlaygroundService, isRunning]);

  const runPhase2Tests = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    try {
      await browserUsePlaygroundService.runPhase2NavigationMethodsTests();
    } catch (error) {
      console.error('Phase 2 tests failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [browserUsePlaygroundService, isRunning]);

  const runPhase3Tests = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    try {
      await browserUsePlaygroundService.runPhase3DOMInteractionTests();
    } catch (error) {
      console.error('Phase 3 tests failed:', error);
    } finally {
      setIsRunning(false);
    }
  }, [browserUsePlaygroundService, isRunning]);

  const getEventsBySeverity = useCallback(
    (severity: Severity) => {
      return events.filter(event => event.severity === severity);
    },
    [events],
  );

  return {
    events,
    isRunning,
    runAgentTest,
    runPhase1Tests,
    runPhase2Tests,
    runPhase3Tests,
    clearEvents,
    getEventsBySeverity,
  };
};
