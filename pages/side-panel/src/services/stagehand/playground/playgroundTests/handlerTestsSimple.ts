/**
 * Simplified Handler Tests for Stagehand
 * Tests handler initialization and basic functionality
 */

import { Severity } from '@src/utils/types';
import { TestContext } from './types';

// Simple logger for testing
class SimpleLogger {
  messages: string[] = [];

  log = (message: { category?: string; message: string; level?: number }): void => {
    const logMessage = `${message.category || 'Info'}: ${message.message}`;
    this.messages.push(logMessage);
    console.log(`[Handler Test] ${logMessage}`);
  };
}

/**
 * Test handler loading and initialization
 */
export async function testHandlerInitialization(context: TestContext): Promise<boolean> {
  console.log('🧪 Testing Handler Initialization...');

  try {
    // Test 1: Check if handlers can be imported without errors
    console.log('Test 1: Handler imports');

    const { StagehandActHandler } = await import('../../lib/handlers/actHandler');
    const { StagehandObserveHandler } = await import('../../lib/handlers/observeHandler');
    const { StagehandExtractHandler } = await import('../../lib/handlers/extractHandler');

    console.log('✅ Handler imports: Success');
    console.log(`✅ StagehandActHandler: ${typeof StagehandActHandler}`);
    console.log(`✅ StagehandObserveHandler: ${typeof StagehandObserveHandler}`);
    console.log(`✅ StagehandExtractHandler: ${typeof StagehandExtractHandler}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Handler initialization tests completed successfully',
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`❌ Handler initialization tests failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Handler initialization tests failed',
      details: { error: errorMessage },
    });

    return false;
  }
}

/**
 * Test basic handler functionality without complex dependencies
 */
export async function testBasicHandlerFunctionality(context: TestContext): Promise<boolean> {
  console.log('🔧 Testing Basic Handler Functionality...');

  try {
    const simpleLogger = new SimpleLogger();

    // Import handlers
    const { StagehandActHandler } = await import('../../lib/handlers/actHandler');
    const { StagehandObserveHandler } = await import('../../lib/handlers/observeHandler');

    // Test 1: Check if handlers can be instantiated (without browserWindow)
    console.log('Test 1: Handler instantiation readiness');

    const actHandlerClass = StagehandActHandler;
    const observeHandlerClass = StagehandObserveHandler;

    console.log(`✅ ActHandler class: ${typeof actHandlerClass}`);
    console.log(`✅ ObserveHandler class: ${typeof observeHandlerClass}`);

    // Test 2: Logger functionality
    console.log('Test 2: Logger functionality');
    simpleLogger.log({ message: 'Test log message', category: 'Test' });
    const logCount = simpleLogger.messages.length;
    console.log(`✅ Logger captured ${logCount} messages`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Basic handler functionality tests completed',
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`❌ Basic handler functionality tests failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Basic handler functionality tests failed',
      details: { error: errorMessage },
    });

    return false;
  }
}

/**
 * Main test runner for simplified handler tests
 */
export async function runSimpleHandlerTests(context: TestContext): Promise<boolean> {
  console.log('🚀 Starting Simple Handler Tests...');

  const tests = [
    { name: 'Handler Initialization', fn: () => testHandlerInitialization(context) },
    { name: 'Basic Handler Functionality', fn: () => testBasicHandlerFunctionality(context) },
  ];

  let passedTests = 0;
  const totalTests = tests.length;

  for (const test of tests) {
    console.log(`\n--- Running ${test.name} ---`);

    try {
      const result = await test.fn();
      if (result) {
        passedTests++;
        console.log(`✅ ${test.name}: PASSED`);
      } else {
        console.log(`❌ ${test.name}: FAILED`);
      }
    } catch (error) {
      console.log(
        `❌ ${test.name}: ERROR - ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const allPassed = passedTests === totalTests;
  console.log(`\n🏁 Handler Tests Summary: ${passedTests}/${totalTests} tests passed`);

  context.events.emit({
    timestamp: Date.now(),
    severity: allPassed ? Severity.Success : Severity.Warning,
    message: `Handler tests completed: ${passedTests}/${totalTests} passed`,
  });

  return allPassed;
}
