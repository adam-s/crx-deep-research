/**
 * Simple logger tests for Chrome extension compatible logging
 */

import { StagehandLogger, createLogger } from '../../lib/logger';
import { appendSummary, writeTimestampedTxtFile } from '../../lib/inferenceLogUtils';

export function runLoggerTests(): void {
  console.group('🧪 Logger Tests');

  testStagehandLogger();
  testCreateLogger();
  testInferenceLogUtils();

  console.groupEnd();
}

function testStagehandLogger(): void {
  console.log('Testing StagehandLogger...');

  const logger = new StagehandLogger({ level: 'debug' });

  // Test different log levels
  logger.error('Test error message', { errorCode: 500 });
  logger.warn('Test warning message', { retry: true });
  logger.info('Test info message', { status: 'active' });
  logger.debug('Test debug message', { trace: 'step1' });

  // Test verbosity levels
  logger.setVerbosity(0); // Only errors
  logger.info('This should not appear');
  logger.error('This error should appear');

  logger.setVerbosity(2); // All levels
  logger.debug('This debug should appear');

  console.log('✓ StagehandLogger tests completed');
}

function testCreateLogger(): void {
  console.log('Testing createLogger...');

  const logger = createLogger({ level: 'info' });

  logger.error({ test: 'data' }, 'Error with data');
  logger.info({ test: 'info' }, 'Info with data');
  logger.debug({ test: 'debug' }, 'Debug with data');

  console.log('✓ createLogger tests completed');
}

function testInferenceLogUtils(): void {
  console.log('Testing inference log utils...');

  // Test writeTimestampedTxtFile
  const { fileName, timestamp } = writeTimestampedTxtFile('test_summary', 'test_call', {
    requestId: 'req_12345678',
    messages: ['test message'],
  });

  console.log(`Generated file: ${fileName}, timestamp: ${timestamp}`);

  // Test appendSummary
  appendSummary('extract', {
    inferenceType: 'extract',
    requestId: 'req_87654321',
    promptTokens: 100,
    completionTokens: 50,
    inferenceTimeMs: 1250,
  });

  appendSummary('observe', {
    inferenceType: 'observe',
    requestId: 'req_11223344',
    promptTokens: 75,
    completionTokens: 25,
    inferenceTimeMs: 800,
  });

  appendSummary('act', {
    inferenceType: 'act',
    requestId: 'req_55667788',
    promptTokens: 120,
    completionTokens: 80,
    inferenceTimeMs: 2100,
  });

  console.log('✓ Inference log utils tests completed');
}
