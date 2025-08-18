import React from 'react';
import { Button } from '@fluentui/react-components';

export const StagehandTestRunner: React.FC = () => {
  const [isRunning, setIsRunning] = React.useState(false);

  const handleRunTest = () => {
    setIsRunning(true);
    // Simulate a test run
    setTimeout(() => {
      setIsRunning(false);
      console.log('Stagehand test completed');
    }, 2000);
  };

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <h3>Stagehand Test Runner</h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <Button
          appearance="primary"
          onClick={handleRunTest}
          disabled={isRunning}
          style={{ minWidth: '120px' }}
        >
          {isRunning ? 'Running...' : 'Run Stagehand Test'}
        </Button>
      </div>

      <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
        <p style={{ margin: 0 }}>
          <strong>Stagehand Test:</strong> Basic test runner for Stagehand functionality
        </p>
      </div>
    </div>
  );
};
