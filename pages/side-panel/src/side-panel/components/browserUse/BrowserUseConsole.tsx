import React from 'react';
import { DarkScrollContainer } from '../common/DarkScrollContainer';

export const BrowserUseConsole: React.FC = () => {
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
      </div>

      {/* Console Output */}
      <DarkScrollContainer
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
        <div style={{ color: '#6c757d', fontStyle: 'italic' }}>
          Browser Use console output will appear here when the example runs...
        </div>
      </DarkScrollContainer>
    </div>
  );
};
