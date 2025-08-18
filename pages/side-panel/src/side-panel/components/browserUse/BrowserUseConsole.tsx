import React, { useEffect, useRef } from 'react';
import { Button } from '@fluentui/react-components';
import { Severity } from '@src/utils/types';
import { useBrowserUsePlayground } from '@src/side-panel/hooks/useBrowserUsePlayground';
import { DarkScrollContainer } from '../common/DarkScrollContainer';

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

export const BrowserUseConsole: React.FC = () => {
  const { events, isRunning, runAgentTest, clearEvents, getEventsBySeverity } =
    useBrowserUsePlayground();
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
    <div
      style={{
        padding: '0 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Browser Use Console</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button appearance="primary" onClick={runAgentTest} disabled={isRunning} size="small">
            {isRunning ? 'Running Agent...' : 'Run Agent Test'}
          </Button>
          <Button appearance="outline" onClick={clearEvents} size="small">
            Clear Console
          </Button>
        </div>
      </div>

      {/* Event Summary */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          padding: '12px',
          borderRadius: '4px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: getSeverityColor(Severity.Success) }}>✅</span>
          <span>Success: {successEvents.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: getSeverityColor(Severity.Info) }}>ℹ️</span>
          <span>Info: {infoEvents.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: getSeverityColor(Severity.Warning) }}>⚠️</span>
          <span>Warning: {warningEvents.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ color: getSeverityColor(Severity.Error) }}>❌</span>
          <span>Error: {errorEvents.length}</span>
        </div>
      </div>

      {/* Console Output */}
      <DarkScrollContainer
        ref={consoleRef}
        style={{
          flex: 1,
          background: '#1e1e1e',
          color: '#d4d4d4',
          padding: '12px',
          borderRadius: '4px',
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: '13px',
          lineHeight: '1.4',
          overflow: 'auto',
          minHeight: '0',
          border: '1px solid #333',
        }}
      >
        {events.length === 0 ? (
          <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
            No events yet. Run an agent test to see output...
          </div>
        ) : (
          events.map((event, index) => (
            <div
              key={index}
              style={{
                marginBottom: '8px',
                paddingBottom: '8px',
                borderBottom: index < events.length - 1 ? '1px solid #333' : 'none',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}
              >
                <span>{getSeverityIcon(event.severity)}</span>
                <span style={{ color: getSeverityColor(event.severity), fontWeight: 'bold' }}>
                  {event.severity.toUpperCase()}
                </span>
                <span style={{ color: '#888', fontSize: '11px' }}>
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                {event.source && (
                  <span style={{ color: '#6c757d', fontSize: '11px' }}>[{event.source}]</span>
                )}
                {event.duration && (
                  <span style={{ color: '#17a2b8', fontSize: '11px' }}>({event.duration}ms)</span>
                )}
              </div>
              <div style={{ marginLeft: '20px' }}>{event.message}</div>
              {event.thumbnail && (
                <div style={{ marginLeft: '20px', marginTop: '8px' }}>
                  <img
                    src={event.thumbnail}
                    alt="Screenshot thumbnail"
                    onError={e => {
                      // Hide broken images
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                    style={{
                      maxWidth: '300px',
                      maxHeight: '200px',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      display: 'block',
                      background: '#2a2a2a',
                    }}
                  />
                  <div
                    style={{
                      fontSize: '10px',
                      color: '#888',
                      marginTop: '2px',
                      fontStyle: 'italic',
                    }}
                  >
                    📷 Screenshot thumbnail
                  </div>
                </div>
              )}
              {event.details && Object.keys(event.details).length > 0 && (
                <div
                  style={{
                    marginLeft: '20px',
                    marginTop: '4px',
                    color: '#888',
                    fontSize: '11px',
                    background: '#2a2a2a',
                    padding: '4px 8px',
                    borderRadius: '3px',
                  }}
                >
                  {JSON.stringify(event.details, null, 2)}
                </div>
              )}
              {event.error && (
                <div
                  style={{
                    marginLeft: '20px',
                    marginTop: '4px',
                    color: '#ff6b6b',
                    fontSize: '11px',
                  }}
                >
                  Error: {event.error.message}
                  {event.stackTrace && (
                    <pre
                      style={{
                        marginTop: '4px',
                        fontSize: '10px',
                        color: '#ccc',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {event.stackTrace}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </DarkScrollContainer>
    </div>
  );
};
