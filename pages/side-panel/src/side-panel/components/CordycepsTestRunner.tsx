import React from 'react';
import { Button } from '@fluentui/react-components';
import { useCordycepsPlayground } from '../hooks/useCordycepsPlayground';

export const CordycepsTestRunner: React.FC = () => {
  const {
    runAllTests,
    runNavigationTest,
    runFrameExecutionTest,
    runDOMInteractionTest,
    runPerformanceTest,
    runLocatorTest,
    isRunning,
    error,
    clearEvents,
  } = useCordycepsPlayground();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3>Cordyceps Test Runner</h3>

      {error && (
        <div
          style={{
            padding: '12px',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#d00',
          }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button appearance="primary" disabled={isRunning} onClick={runAllTests}>
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </Button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <Button appearance="secondary" disabled={isRunning} onClick={runNavigationTest}>
            Navigation Test
          </Button>

          <Button appearance="secondary" disabled={isRunning} onClick={runFrameExecutionTest}>
            Frame Execution Test
          </Button>

          <Button appearance="secondary" disabled={isRunning} onClick={runDOMInteractionTest}>
            DOM Interaction Test
          </Button>

          <Button appearance="secondary" disabled={isRunning} onClick={runPerformanceTest}>
            Performance Test
          </Button>

          <Button appearance="secondary" disabled={isRunning} onClick={runLocatorTest}>
            Locator Test
          </Button>
        </div>

        <Button appearance="outline" onClick={clearEvents} disabled={isRunning}>
          Clear Events
        </Button>
      </div>

      {isRunning && (
        <div
          style={{
            padding: '12px',
            background: '#e7f3ff',
            border: '1px solid #b3d9ff',
            borderRadius: '4px',
            color: '#0066cc',
          }}>
          🔄 Tests are running...
        </div>
      )}
    </div>
  );
};
