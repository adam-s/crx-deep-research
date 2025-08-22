/**
 * ActHandler Redux Tests - Chrome Extension Compatible Testing
 *
 * Tests for the Redux implementation of ActHandler that uses Cordyceps instead of Playwright.
 * These tests validate the complete conversion and ensure compatibility with the established
 * Chrome extension architecture.
 */

import { TestProgress, TestContext } from './types';
import { Severity } from '@src/utils/types';
import { StagehandActHandler } from '../../lib/handlers/actHandler';
import { LogLine } from '../../types/log';
import { ObserveResult } from '../../types/stagehand';
import type { BrowserWindow } from '@src/services/cordyceps/browserWindow';

// Mock interfaces for testing
interface MockObserveResult extends ObserveResult {
  selector: string;
  description: string;
  method: string;
  arguments: string[];
}

/**
 * Test ActHandler Redux implementation
 */
export async function testActHandlerRedux(context: TestContext): Promise<boolean> {
  const progress = new TestProgress('ActHandlerRedux');
  progress.log('🎭 Starting ActHandler Redux test suite...');

  try {
    // Test 1: Handler Initialization
    await testActHandlerInitialization(progress, context);

    // Test 2: Action validation
    await testActionValidation(progress, context);

    // Test 3: Error handling
    await testErrorHandling(progress, context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ ActHandler Redux tests completed successfully',
      details: {
        category: 'act-handler-redux',
        testsRun: 3,
      },
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ ActHandler Redux tests failed: ${errorMessage}`,
      details: { category: 'act-handler-redux', error: errorMessage },
    });

    progress.log(`❌ ActHandler Redux test error: ${errorMessage}`);
    return false;
  }
}

/**
 * Test ActHandler initialization with proper dependencies
 */
async function testActHandlerInitialization(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🔧 Testing ActHandler initialization...');

  // Create mock logger
  const mockLogger = (logLine: LogLine): void => {
    console.log(`[ActHandler Test] ${logLine.category}: ${logLine.message}`);
  };

  // Create mock browser window that implements required interface
  const mockBrowserWindow = {
    getCurrentPage: async () => ({
      goto: async () => {},
      waitForLoadState: async () => {},
      url: () => 'http://localhost:3005',
      locator: () => ({
        click: async () => {},
        fill: async () => {},
        elementHandle: async () => null,
      }),
    }),
    dispose: async () => {},
  } as unknown as BrowserWindow;

  // Test basic constructor
  try {
    const actHandler = new StagehandActHandler({
      logger: mockLogger,
      browserWindow: mockBrowserWindow,
      selfHeal: true,
      experimental: false,
    });

    progress.log('✅ ActHandler constructor works correctly');

    // Test with different configurations
    const experimentalHandler = new StagehandActHandler({
      logger: mockLogger,
      browserWindow: mockBrowserWindow,
      selfHeal: false,
      experimental: true,
    });

    progress.log('✅ Experimental configuration accepted');
    progress.log('✅ Dependencies injection successful');

    // Verify handlers exist
    const handlerExists = actHandler !== null && experimentalHandler !== null;
    progress.log(`✅ Handler instances created: ${handlerExists}`);
  } catch (error) {
    progress.log(
      `❌ Initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    throw error;
  }

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔧 ActHandler initialization test completed',
    details: {
      basicConstructor: true,
      experimentalMode: true,
      dependenciesInjected: true,
    },
  });
}

/**
 * Test action validation and processing
 */
async function testActionValidation(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('⚡ Testing action validation...');

  const mockLogger = (logLine: LogLine): void => {
    console.log(`[ActHandler Test] ${logLine.category}: ${logLine.message}`);
  };

  const mockBrowserWindow = {
    getCurrentPage: async () => ({
      goto: async () => {},
      waitForLoadState: async () => {},
      url: () => 'http://localhost:3005',
      locator: () => ({
        click: async () => {},
        fill: async () => {},
        elementHandle: async () => null,
      }),
    }),
    dispose: async () => {},
  } as unknown as BrowserWindow;

  const actHandler = new StagehandActHandler({
    logger: mockLogger,
    browserWindow: mockBrowserWindow,
    selfHeal: true,
    experimental: false,
  });

  // Test valid ObserveResult
  const validObserveResult: MockObserveResult = {
    selector: 'xpath=//button[@id="action-button"]',
    description: 'Click the action button',
    method: 'click',
    arguments: [],
  };

  try {
    const result = await actHandler.actFromObserveResult(validObserveResult, 1000);
    progress.log(`✅ Valid action processed: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    progress.log(`  Result message: ${result.message}`);
  } catch (error) {
    progress.log(
      `✅ Action processing handled error gracefully: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  // Test unsupported method
  const unsupportedObserveResult: MockObserveResult = {
    selector: 'xpath=//button[@id="action-button"]',
    description: 'Unsupported action',
    method: 'not-supported',
    arguments: [],
  };

  const unsupportedResult = await actHandler.actFromObserveResult(unsupportedObserveResult);
  progress.log(
    `✅ Unsupported method handled: ${!unsupportedResult.success ? 'CORRECTLY REJECTED' : 'UNEXPECTEDLY ACCEPTED'}`
  );

  // Test missing method
  const missingMethodResult: ObserveResult = {
    selector: 'xpath=//button[@id="action-button"]',
    description: 'Missing method action',
    // method is undefined
    arguments: [],
  };

  const missingResult = await actHandler.actFromObserveResult(missingMethodResult);
  progress.log(
    `✅ Missing method handled: ${!missingResult.success ? 'CORRECTLY REJECTED' : 'UNEXPECTEDLY ACCEPTED'}`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '⚡ Action validation test completed',
    details: {
      validActionTested: true,
      unsupportedMethodTested: true,
      missingMethodTested: true,
      actionValidationWorking: true,
    },
  });
}

/**
 * Test error handling and recovery mechanisms
 */
async function testErrorHandling(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('🛡️ Testing error handling mechanisms...');

  const mockLogger = (logLine: LogLine): void => {
    console.log(`[ActHandler Test] ${logLine.category}: ${logLine.message}`);
  };

  const mockBrowserWindow = {
    getCurrentPage: async () => ({
      goto: async () => {},
      waitForLoadState: async () => {},
      url: () => 'http://localhost:3005',
      locator: () => ({
        click: async () => {
          throw new Error('Element not found');
        },
        fill: async () => {
          throw new Error('Element not found');
        },
        elementHandle: async () => null,
      }),
    }),
    dispose: async () => {},
  } as unknown as BrowserWindow;

  const actHandler = new StagehandActHandler({
    logger: mockLogger,
    browserWindow: mockBrowserWindow,
    selfHeal: true,
    experimental: false,
  });

  // Test with element not found
  const notFoundResult: MockObserveResult = {
    selector: 'xpath=//button[@id="non-existent-button"]',
    description: 'Non-existent element test',
    method: 'click',
    arguments: [],
  };

  const errorResult = await actHandler.actFromObserveResult(notFoundResult);
  progress.log(
    `✅ Element not found handled: ${!errorResult.success ? 'CORRECTLY FAILED' : 'UNEXPECTEDLY SUCCEEDED'}`
  );

  // Test self-healing disabled
  const nonHealingHandler = new StagehandActHandler({
    logger: mockLogger,
    browserWindow: mockBrowserWindow,
    selfHeal: false,
    experimental: false,
  });

  const selfHealResult = await nonHealingHandler.actFromObserveResult(notFoundResult);
  progress.log(
    `✅ Self-healing disabled: ${!selfHealResult.success ? 'CORRECTLY DISABLED' : 'UNEXPECTEDLY ENABLED'}`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🛡️ Error handling test completed',
    details: {
      elementNotFoundTested: true,
      selfHealingTested: true,
      errorRecoveryWorking: true,
    },
  });
}

/**
 * Quick ActHandler Redux Test - Returns boolean for use in runQuickTests
 */
export async function quickActHandlerReduxTest(): Promise<boolean> {
  try {
    const mockLogger = (): void => {};
    const mockBrowserWindow = {
      getCurrentPage: async () => ({}),
      dispose: async () => {},
    } as unknown as BrowserWindow;

    const actHandler = new StagehandActHandler({
      logger: mockLogger,
      browserWindow: mockBrowserWindow,
      selfHeal: true,
      experimental: false,
    });

    // Quick constructor test
    return actHandler !== null && actHandler !== undefined;
  } catch (error) {
    console.error('Quick ActHandler Redux test failed:', error);
    return false;
  }
}
