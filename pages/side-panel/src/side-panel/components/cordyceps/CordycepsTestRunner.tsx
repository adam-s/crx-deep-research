import React from 'react';
import { Button } from '@fluentui/react-components';
import { useCordycepsPlayground } from '../../hooks/useCordycepsPlayground';
import { DarkScrollContainer } from '../common/DarkScrollContainer';

export const CordycepsTestRunner: React.FC = () => {
  const {
    runAllTests,
    runNavigationTest,
    runDOMInteractionTest,
    runPerformanceTest,
    runLocatorTest,
    isRunning,
    error,
    clearEvents,
    clearError,
  } = useCordycepsPlayground();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3>Cordyceps Test Runner</h3>

      {error && (
        <div
          style={{
            position: 'relative',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#d00',
            maxHeight: '150px',
          }}
        >
          <Button
            appearance="subtle"
            size="small"
            onClick={clearError}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              zIndex: 1,
              minWidth: '24px',
              height: '24px',
              padding: 0,
              fontSize: '12px',
              color: '#d00',
              background: 'transparent',
              border: 'none',
            }}
          >
            ✕
          </Button>
          <DarkScrollContainer
            style={{
              padding: '12px',
              paddingRight: '36px', // Make room for close button
              maxHeight: '150px',
              overflow: 'auto',
              background: 'transparent',
            }}
          >
            <strong>Error:</strong> {error}
          </DarkScrollContainer>
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
          }}
        >
          🔄 Tests are running...
        </div>
      )}
    </div>
  );
};
