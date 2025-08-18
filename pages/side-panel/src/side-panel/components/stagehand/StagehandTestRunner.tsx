import React from 'react';
import { Button, Spinner } from '@fluentui/react-components';
import { useStagehandPlayground } from '@src/side-panel/hooks/useStagehandPlayground';

export const StagehandTestRunner: React.FC = () => {
  const { runAllTests, isRunning, error, clearError } = useStagehandPlayground();

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3>Stagehand Test Runner</h3>

      {error && (
        <div
          style={{
            padding: '8px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            color: '#721c24',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{error}</span>
          <Button appearance="subtle" size="small" onClick={clearError}>
            ×
          </Button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'row', gap: '12px', alignItems: 'center' }}>
        <Button
          appearance="primary"
          onClick={runAllTests}
          disabled={isRunning}
          style={{ minWidth: '120px' }}
        >
          {isRunning ? 'Running...' : 'Run All Tests'}
        </Button>

        {isRunning && <Spinner size="small" label="Executing tests..." />}
      </div>

      <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
        <p style={{ margin: 0 }}>
          <strong>Stagehand Tests:</strong> Run a simple test that demonstrates Stagehand
          functionality
        </p>
      </div>
    </div>
  );
};
