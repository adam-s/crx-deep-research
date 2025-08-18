import React, { useEffect, useRef } from 'react';
import { Button } from '@fluentui/react-components';
import { Severity } from '../../../utils/types';
import { DarkScrollContainer } from '../common/DarkScrollContainer';
import { useStagehandPlayground } from '@src/side-panel/hooks/useStagehandPlayground';

const getSeverityColor = (severity: Severity): string => {
  switch (severity) {
    case Severity.Success:
      return '#28a745';
    case Severity.Info:
      return '#17a2b8';
    case Severity.Warning:
      return '#ffc107';
    case Severity.Error:
      return '#dc3545';
    default:
      return '#6c757d';
  }
};

const getSeverityIcon = (severity: Severity): string => {
  switch (severity) {
    case Severity.Success:
      return '✅';
    case Severity.Info:
      return 'ℹ️';
    case Severity.Warning:
      return '⚠️';
    case Severity.Error:
      return '❌';
    default:
      return '📝';
  }
};

export const StagehandConsole: React.FC = () => {
  const { events, clearEvents, getEventsBySeverity } = useStagehandPlayground();
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [events]);

  const successEvents = getEventsBySeverity(Severity.Success);
  const infoEvents = getEventsBySeverity(Severity.Info);
  const warningEvents = getEventsBySeverity(Severity.Warning);
  const errorEvents = getEventsBySeverity(Severity.Error);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid #333' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ margin: 0 }}>Stagehand Console</h3>
          <Button appearance="subtle" onClick={clearEvents} disabled={events.length === 0}>
            Clear
          </Button>
        </div>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#999' }}>
          <span>
            {getSeverityIcon(Severity.Success)} Success: {successEvents.length}
          </span>
          <span>
            {getSeverityIcon(Severity.Info)} Info: {infoEvents.length}
          </span>
          <span>
            {getSeverityIcon(Severity.Warning)} Warning: {warningEvents.length}
          </span>
          <span>
            {getSeverityIcon(Severity.Error)} Error: {errorEvents.length}
          </span>
        </div>
      </div>
      <DarkScrollContainer>
        <div
          ref={consoleRef}
          style={{
            height: '100%',
            overflow: 'auto',
            fontFamily: 'Monaco, Consolas, "Courier New", monospace',
            fontSize: '12px',
          }}
        >
          {events.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666',
                fontSize: '14px',
              }}
            >
              No events to display. Run a test to see output.
            </div>
          ) : (
            events.map((event, index) => (
              <div
                key={index}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid #2a2a2a',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <span style={{ color: getSeverityColor(event.severity), minWidth: '16px' }}>
                  {getSeverityIcon(event.severity)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: getSeverityColor(event.severity), fontWeight: 'bold' }}>
                    {event.message}
                  </div>
                  {event.details && (
                    <div style={{ color: '#ccc', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                      {typeof event.details === 'string'
                        ? event.details
                        : JSON.stringify(event.details, null, 2)}
                    </div>
                  )}
                  <div style={{ color: '#666', fontSize: '10px', marginTop: '4px' }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DarkScrollContainer>
    </div>
  );
};
