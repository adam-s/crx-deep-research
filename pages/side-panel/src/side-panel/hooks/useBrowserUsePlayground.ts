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
    clearEvents,
    getEventsBySeverity,
  };
};
