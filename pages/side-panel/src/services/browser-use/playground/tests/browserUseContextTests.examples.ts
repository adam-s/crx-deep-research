/**
 * Example usage of Browser-Use Context tests
 *
 * This file shows how to run the browser-use context tests in your Chrome extension playground.
 */

import { runBrowserUseContextTests, quickBrowserUseContextTest } from './browserUseContextTests';
import type { BrowserUsePlaygroundService } from '../browserUsePlaygroundService';

/**
 * Run context tests from the browser console or UI
 *
 * Usage:
 * 1. Get the service from your DI container
 * 2. Call one of these test functions
 */

// Example 1: Run comprehensive context tests
export async function runBrowserUseContextTestSuite(
  service?: BrowserUsePlaygroundService,
): Promise<void> {
  console.log('🧪 Running browser-use context test suite...');

  try {
    await runBrowserUseContextTests(service);
    console.log('✅ Context tests completed successfully!');
  } catch (error) {
    console.error('❌ Context tests failed:', error);
  }
}

// Example 2: Run quick smoke test
export async function runQuickContextTests(): Promise<void> {
  console.log('⚡ Running quick context tests...');

  try {
    const result = await quickBrowserUseContextTest();
    if (result) {
      console.log('✅ Quick context tests passed!');
    } else {
      console.log('❌ Quick context tests failed!');
    }
  } catch (error) {
    console.error('❌ Quick context tests failed:', error);
  }
}

// Example 3: Manual testing with error handling and progress reporting
export async function runManualContextTests(service?: BrowserUsePlaygroundService): Promise<void> {
  console.log('🔧 Running manual context tests...');

  // Test 1: Quick smoke test
  try {
    console.log('1/2 Running quick smoke test...');
    const quickResult = await quickBrowserUseContextTest();
    console.log(`Quick test result: ${quickResult ? 'PASSED' : 'FAILED'}`);
  } catch (error) {
    console.warn('⚠️ Quick test failed:', error);
  }

  // Test 2: Full test suite
  try {
    console.log('2/2 Running full test suite...');
    await runBrowserUseContextTests(service);
    console.log('✅ Full test suite completed');
  } catch (error) {
    console.warn('⚠️ Full test suite failed:', error);
  }

  console.log('🏁 Manual context tests completed');
}

/**
 * Test with timeout and progress reporting
 */
export async function testContextWithProgress(
  service?: BrowserUsePlaygroundService,
  timeoutMs: number = 15000,
): Promise<void> {
  console.log(`⏱️ Running context tests with ${timeoutMs}ms timeout...`);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Context test timeout')), timeoutMs);
  });

  const testPromise = (async () => {
    console.log('1/2 Testing CSS selector generation...');
    await quickBrowserUseContextTest();

    console.log('2/2 Testing full context functionality...');
    await runBrowserUseContextTests(service);

    console.log('All context tests completed!');
  })();

  try {
    await Promise.race([testPromise, timeoutPromise]);
    console.log('✅ Timed context tests completed successfully!');
  } catch (error) {
    console.error('❌ Timed context tests failed:', error);
    throw error;
  }
}

/**
 * Integration with BrowserUsePlaygroundService
 */
export async function integrateBrowserUseContextTests(
  service: BrowserUsePlaygroundService,
): Promise<void> {
  console.log('🔗 Integrating context tests with playground service...');

  try {
    // Listen to service events for context about the running tests
    const disposable = service.onEvent(event => {
      console.log(`[SERVICE EVENT] ${event.severity}: ${event.message}`);
    });

    // Run context tests
    await runBrowserUseContextTests(service);

    console.log('✅ Context tests integrated successfully with playground service');

    // Clean up event listener
    disposable.dispose();
  } catch (error) {
    console.error('❌ Context test integration failed:', error);
    throw error;
  }
}

// Browser console helpers
declare global {
  interface Window {
    testBrowserUseContext?: () => Promise<boolean>;
    runBrowserUseContextSuite?: (service?: BrowserUsePlaygroundService) => Promise<void>;
  }
}

// Expose to browser console for manual testing
if (typeof window !== 'undefined') {
  window.testBrowserUseContext = async () => {
    return await quickBrowserUseContextTest();
  };

  window.runBrowserUseContextSuite = async (service?: BrowserUsePlaygroundService) => {
    await runBrowserUseContextTestSuite(service);
  };
}

/**
 * Example of how to call these tests from your playground UI
 */
export const contextTestExamples = {
  // For a quick test button
  quickTest: () => quickBrowserUseContextTest(),

  // For a comprehensive test button
  fullTest: (service?: BrowserUsePlaygroundService) => runBrowserUseContextTests(service),

  // For a test with timeout
  timedTest: (service?: BrowserUsePlaygroundService) => testContextWithProgress(service, 10000),

  // For manual testing
  manualTest: (service?: BrowserUsePlaygroundService) => runManualContextTests(service),
};
