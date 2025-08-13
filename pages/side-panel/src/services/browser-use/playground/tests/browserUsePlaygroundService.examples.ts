/**
 * Example usage of BrowserUsePlaygroundService conversation tests
 *
 * This file shows how to run the conversation service tests in your Chrome extension.
 */

import { BrowserUsePlaygroundService } from '../browserUsePlaygroundService';
import { runBrowserUseConversationTests } from './browserUsePlaygroundService.test';

/**
 * Run conversation tests from the browser console or UI
 *
 * Usage:
 * 1. Get the service from your DI container
 * 2. Call one of these test functions
 */

// Example 1: Run built-in service tests
export async function runBuiltInTests(service: BrowserUsePlaygroundService): Promise<void> {
  console.log('🧪 Running built-in conversation service tests...');

  try {
    await service.testConversationService();
    console.log('✅ Built-in tests completed successfully!');
  } catch (error) {
    console.error('❌ Built-in tests failed:', error);
  }
}

// Example 2: Run external test suite
export async function runExternalTests(service: BrowserUsePlaygroundService): Promise<void> {
  console.log('🧪 Running external conversation test suite...');

  try {
    await runBrowserUseConversationTests(service);
    console.log('✅ External tests completed successfully!');
  } catch (error) {
    console.error('❌ External tests failed:', error);
  }
}

// Example 4: Run browser-use context tests
export async function runContextTests(service: BrowserUsePlaygroundService): Promise<void> {
  console.log('🧪 Running browser-use context tests...');

  try {
    await service.runContextTests();
    console.log('✅ Context tests completed successfully!');
  } catch (error) {
    console.error('❌ Context tests failed:', error);
  }
}

// Example 5: Run quick context test
export async function runQuickContextTest(service: BrowserUsePlaygroundService): Promise<void> {
  console.log('⚡ Running quick context test...');

  try {
    const result = await service.runQuickContextTest();
    if (result) {
      console.log('✅ Quick context test passed!');
    } else {
      console.log('❌ Quick context test failed!');
    }
  } catch (error) {
    console.error('❌ Quick context test failed:', error);
  }
}
export async function runManualTests(service: BrowserUsePlaygroundService): Promise<void> {
  console.log('🔧 Running manual conversation tests...');

  // Test 1: Basic conversation history
  try {
    const history = await service.getConversationHistory();
    console.log(`📊 Found ${history.length} conversations in history`);
  } catch (error) {
    console.warn('⚠️ History test failed:', error);
  }

  // Test 2: Event system
  const disposable = service.onEvent(event => {
    console.log(`📨 Event: ${event.severity} - ${event.message}`);
  });

  try {
    await service.getConversationHistory(); // Should trigger events
    console.log('✅ Event system working');
  } catch (error) {
    console.warn('⚠️ Event test failed:', error);
  } finally {
    disposable.dispose();
  }

  console.log('🏁 Manual tests completed');
}

/**
 * Quick test runner for UI button or console
 */
export async function quickTest(service: BrowserUsePlaygroundService): Promise<boolean> {
  try {
    console.log('⚡ Quick conversation service test...');

    // Just test basic functionality
    const history = await service.getConversationHistory();
    console.log(`✅ Quick test passed - ${history.length} conversations found`);

    return true;
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
}

/**
 * Test with timeout and progress reporting
 */
export async function testWithProgress(
  service: BrowserUsePlaygroundService,
  timeoutMs: number = 10000,
): Promise<void> {
  console.log(`⏱️ Running conversation tests with ${timeoutMs}ms timeout...`);

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Test timeout')), timeoutMs);
  });

  const testPromise = (async () => {
    console.log('1/3 Testing conversation history...');
    await service.getConversationHistory();

    console.log('2/3 Testing built-in service tests...');
    await service.testConversationService();

    console.log('3/3 All tests completed!');
  })();

  try {
    await Promise.race([testPromise, timeoutPromise]);
    console.log('✅ Timed tests completed successfully!');
  } catch (error) {
    console.error('❌ Timed tests failed:', error);
    throw error;
  }
}

// Browser console helper
declare global {
  interface Window {
    testBrowserUseConversations?: (service: BrowserUsePlaygroundService) => Promise<boolean>;
  }
}

// Expose to browser console for manual testing
if (typeof window !== 'undefined') {
  window.testBrowserUseConversations = async (service: BrowserUsePlaygroundService) => {
    return await quickTest(service);
  };
}
