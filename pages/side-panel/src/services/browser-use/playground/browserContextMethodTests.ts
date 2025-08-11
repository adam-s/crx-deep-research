/**
 * Browser Context Method Tests
 *
 * Focused tests for specific BrowserContext methods:
 * - getCurrentPage()
 * - close()
 *
 * This file provides targeted testing for browser context lifecycle methods
 * to ensure proper state management and resource cleanup.
 */

import { BrowserContext, BrowserContextState } from '../browser/contex';
import { Severity } from '@src/utils/types';
import type { BrowserUsePlaygroundService } from './browserUsePlaygroundService';

/**
 * Simple progress tracker for testing
 */
export class TestProgress {
  constructor(private name: string) {}

  log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

/**
 * Test getCurrentPage() method functionality
 */
export async function testGetCurrentPageMethod(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  progress.log('🧪 Testing BrowserContext.getCurrentPage() method...');

  try {
    // Create mock BrowserWindow for testing that uses a real window ID
    // Get the current window ID from Chrome to avoid "No window with id: 123" error
    let currentWindowId: number;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      currentWindowId = currentWindow.id!;
    } catch (error) {
      // Fallback: skip the test if Chrome APIs are not available
      progress.log(
        '⚠️ Skipping getCurrentPage() tests - Chrome APIs not available in test environment',
      );
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'getCurrentPage() tests skipped - Chrome APIs not available',
        details: { reason: 'Cannot access chrome.windows API in test environment' },
      });
      return;
    }

    const mockPage = { tabId: 1, url: () => 'https://example.com' };
    const mockBrowserWindow = {
      windowId: currentWindowId, // Use real window ID
      pages: () => [mockPage],
      getCurrentPage: async () => mockPage,
    } as unknown as import('@src/services/cordyceps/browserWindow').BrowserWindow;

    // Test 1: getCurrentPage() with uninitialized context
    progress.log('Test 1: getCurrentPage() with uninitialized context');

    const browserContext = new BrowserContext(mockBrowserWindow);

    // Check initial state
    if (browserContext.session.state !== BrowserContextState.CREATED) {
      throw new Error(`Expected initial state CREATED, got ${browserContext.session.state}`);
    }

    // Call getCurrentPage() - should trigger enter() automatically
    const page1 = await browserContext.getCurrentPage();

    if (!page1) {
      throw new Error('getCurrentPage() returned null or undefined');
    }

    progress.log('✅ Test 1 passed: getCurrentPage() works with uninitialized context');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: getCurrentPage() auto-initialization works',
      details: { pageExists: !!page1, sessionState: browserContext.session.state },
    });

    // Test 2: getCurrentPage() with already active context
    progress.log('Test 2: getCurrentPage() with already active context');

    const page2 = await browserContext.getCurrentPage();

    if (!page2) {
      throw new Error('getCurrentPage() returned null for active context');
    }

    // Should return the same page instance or manage pages correctly
    progress.log('✅ Test 2 passed: getCurrentPage() works with active context');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: getCurrentPage() works with active context',
      details: { pageExists: !!page2, pagesArrayLength: browserContext.pages.length },
    });

    // Test 3: Verify session state after getCurrentPage()
    progress.log('Test 3: Session state validation after getCurrentPage()');

    const sessionState: BrowserContextState = browserContext.session.state;
    if ((sessionState as BrowserContextState) !== BrowserContextState.ACTIVE) {
      throw new Error(`Expected session state ACTIVE after getCurrentPage(), got ${sessionState}`);
    }

    progress.log('✅ Test 3 passed: Session state correctly updated to ACTIVE');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Session state properly managed',
      details: { sessionState: sessionState },
    });

    // Test 4: Pages array management
    progress.log('Test 4: Pages array management validation');

    if (!Array.isArray(browserContext.pages)) {
      throw new Error('Pages property is not an array');
    }

    if (browserContext.pages.length === 0) {
      throw new Error('Pages array is empty after getCurrentPage()');
    }

    progress.log('✅ Test 4 passed: Pages array properly managed');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Pages array management works',
      details: { pagesCount: browserContext.pages.length },
    });

    // Clean up for next test
    await browserContext.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`getCurrentPage() method test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'getCurrentPage() method tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Test close() method functionality
 */
export async function testCloseMethod(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  progress.log('🧪 Testing BrowserContext.close() method...');

  try {
    // Create mock BrowserWindow for testing with real window ID
    let currentWindowId: number;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      currentWindowId = currentWindow.id!;
    } catch (error) {
      // Fallback: skip the test if Chrome APIs are not available
      progress.log('⚠️ Skipping close() tests - Chrome APIs not available in test environment');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'close() tests skipped - Chrome APIs not available',
        details: { reason: 'Cannot access chrome.windows API in test environment' },
      });
      return;
    }

    const mockPage = { tabId: 1, url: () => 'https://example.com' };
    const mockBrowserWindow = {
      windowId: currentWindowId, // Use real window ID
      pages: () => [mockPage],
      getCurrentPage: async () => mockPage,
    } as unknown as import('@src/services/cordyceps/browserWindow').BrowserWindow;

    // Test 1: close() with active context
    progress.log('Test 1: close() with active context');

    const browserContext = new BrowserContext(mockBrowserWindow);

    // Initialize the context
    await browserContext.enter();
    await browserContext.getCurrentPage();

    // Verify context is active before closing
    if ((browserContext.session.state as BrowserContextState) !== BrowserContextState.ACTIVE) {
      throw new Error(`Expected ACTIVE state before close, got ${browserContext.session.state}`);
    }

    const pagesBeforeClose = browserContext.pages.length;
    if (pagesBeforeClose === 0) {
      throw new Error('No pages found before close() - test setup issue');
    }

    // Close the context
    await browserContext.close();

    // Verify state after close
    if ((browserContext.session.state as BrowserContextState) !== BrowserContextState.CLOSED) {
      throw new Error(`Expected CLOSED state after close(), got ${browserContext.session.state}`);
    }

    if (browserContext.pages.length !== 0) {
      throw new Error(
        `Expected pages array to be empty after close(), got ${browserContext.pages.length} pages`,
      );
    }

    if (!browserContext.session.endTime) {
      throw new Error('Session endTime not set after close()');
    }

    progress.log('✅ Test 1 passed: close() properly cleans up active context');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: close() method works with active context',
      details: {
        pagesBeforeClose,
        pagesAfterClose: browserContext.pages.length,
        sessionState: browserContext.session.state,
        endTime: browserContext.session.endTime,
      },
    });

    // Test 2: close() with already closed context (should be safe)
    progress.log('Test 2: close() with already closed context');

    const stateBeforeSecondClose: BrowserContextState = browserContext.session.state;
    const endTimeBeforeSecondClose = browserContext.session.endTime;

    // Close again - should be safe and not error
    await browserContext.close();

    // State should remain CLOSED
    if ((browserContext.session.state as BrowserContextState) !== BrowserContextState.CLOSED) {
      throw new Error(
        `Expected state to remain CLOSED after second close(), got ${browserContext.session.state}`,
      );
    }

    // End time should remain the same (not be updated)
    if (browserContext.session.endTime !== endTimeBeforeSecondClose) {
      throw new Error('Session endTime was modified on second close() call');
    }

    progress.log('✅ Test 2 passed: close() is safe to call multiple times');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: close() method is idempotent',
      details: {
        stateBeforeSecondClose,
        stateAfterSecondClose: browserContext.session.state,
        endTimeChanged: browserContext.session.endTime !== endTimeBeforeSecondClose,
      },
    });

    // Test 3: close() with uninitialized context
    progress.log('Test 3: close() with uninitialized context');

    const uninitializedContext = new BrowserContext(mockBrowserWindow);

    // Should be in CREATED state
    if (
      (uninitializedContext.session.state as BrowserContextState) !== BrowserContextState.CREATED
    ) {
      throw new Error(
        `Expected CREATED state for new context, got ${uninitializedContext.session.state}`,
      );
    }

    // Close should work even on uninitialized context
    await uninitializedContext.close();

    // Should transition to CLOSED
    if (
      (uninitializedContext.session.state as BrowserContextState) !== BrowserContextState.CLOSED
    ) {
      throw new Error(
        `Expected CLOSED state after closing uninitialized context, got ${uninitializedContext.session.state}`,
      );
    }

    progress.log('✅ Test 3 passed: close() works with uninitialized context');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: close() works with uninitialized context',
      details: { finalState: uninitializedContext.session.state },
    });

    // Test 4: Resource cleanup validation
    progress.log('Test 4: Resource cleanup validation');

    const testContext = new BrowserContext(mockBrowserWindow);
    await testContext.enter();
    await testContext.getCurrentPage();

    // Verify we have resources before cleanup
    const hasResourcesBeforeClose = testContext.pages.length > 0;

    // Close and verify cleanup
    await testContext.close();

    const resourcesAfterClose = {
      pagesArrayEmpty: testContext.pages.length === 0,
      sessionClosed: testContext.session.state === BrowserContextState.CLOSED,
      endTimeSet: !!testContext.session.endTime,
    };

    if (
      !resourcesAfterClose.pagesArrayEmpty ||
      !resourcesAfterClose.sessionClosed ||
      !resourcesAfterClose.endTimeSet
    ) {
      throw new Error('Resource cleanup incomplete after close()');
    }

    progress.log('✅ Test 4 passed: Resource cleanup working correctly');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Resource cleanup validation successful',
      details: {
        hasResourcesBeforeClose,
        ...resourcesAfterClose,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`close() method test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'close() method tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Test method interaction patterns
 */
export async function testMethodInteractions(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  progress.log('🧪 Testing BrowserContext method interactions...');

  try {
    // Create mock BrowserWindow for testing with real window ID
    let currentWindowId: number;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      currentWindowId = currentWindow.id!;
    } catch (error) {
      // Fallback: skip the test if Chrome APIs are not available
      progress.log(
        '⚠️ Skipping method interaction tests - Chrome APIs not available in test environment',
      );
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Method interaction tests skipped - Chrome APIs not available',
        details: { reason: 'Cannot access chrome.windows API in test environment' },
      });
      return;
    }

    const mockPage = { tabId: 1, url: () => 'https://example.com' };
    const mockBrowserWindow = {
      windowId: currentWindowId, // Use real window ID
      pages: () => [mockPage],
      getCurrentPage: async () => mockPage,
    } as unknown as import('@src/services/cordyceps/browserWindow').BrowserWindow;

    // Test 1: getCurrentPage() followed by close() lifecycle
    progress.log('Test 1: Complete lifecycle - getCurrentPage() then close()');

    const browserContext = new BrowserContext(mockBrowserWindow);

    // Full lifecycle test
    const initialState: BrowserContextState = browserContext.session.state;

    // Get current page (should auto-initialize)
    const page = await browserContext.getCurrentPage();
    const activeState: BrowserContextState = browserContext.session.state;

    // Close the context
    await browserContext.close();
    const closedState: BrowserContextState = browserContext.session.state;

    // Verify state transitions
    if ((initialState as BrowserContextState) !== BrowserContextState.CREATED) {
      throw new Error(`Expected initial state CREATED, got ${initialState}`);
    }

    if ((activeState as BrowserContextState) !== BrowserContextState.ACTIVE) {
      throw new Error(`Expected active state ACTIVE, got ${activeState}`);
    }

    if ((closedState as BrowserContextState) !== BrowserContextState.CLOSED) {
      throw new Error(`Expected closed state CLOSED, got ${closedState}`);
    }

    if (!page) {
      throw new Error('getCurrentPage() returned null');
    }

    progress.log('✅ Test 1 passed: Complete lifecycle works correctly');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: Method interaction lifecycle complete',
      details: {
        stateTransitions: {
          initial: initialState,
          active: activeState,
          closed: closedState,
        },
        pageRetrieved: !!page,
      },
    });

    // Test 2: Multiple getCurrentPage() calls before close()
    progress.log('Test 2: Multiple getCurrentPage() calls before close()');

    const multiCallContext = new BrowserContext(mockBrowserWindow);

    const page1 = await multiCallContext.getCurrentPage();
    const page2 = await multiCallContext.getCurrentPage();
    const page3 = await multiCallContext.getCurrentPage();

    // All should succeed
    if (!page1 || !page2 || !page3) {
      throw new Error('One or more getCurrentPage() calls failed');
    }

    // State should remain ACTIVE
    if ((multiCallContext.session.state as BrowserContextState) !== BrowserContextState.ACTIVE) {
      throw new Error('Session state not ACTIVE after multiple getCurrentPage() calls');
    }

    // Close should still work
    await multiCallContext.close();

    if ((multiCallContext.session.state as BrowserContextState) !== BrowserContextState.CLOSED) {
      throw new Error('Failed to close after multiple getCurrentPage() calls');
    }

    progress.log('✅ Test 2 passed: Multiple getCurrentPage() calls handled correctly');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: Multiple getCurrentPage() calls work correctly',
      details: {
        callsSuccessful: 3,
        finalState: multiCallContext.session.state,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Method interaction test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Method interaction tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Main test runner for browser context method tests
 */
export async function runBrowserContextMethodTests(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  progress.log('🚀 Starting Browser Context Method Tests...');

  try {
    // Run all method test suites
    await testGetCurrentPageMethod(progress, context);
    await testCloseMethod(progress, context);
    await testMethodInteractions(progress, context);

    progress.log('✅ All browser context method tests completed successfully!');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All browser context method tests completed successfully',
      details: {
        totalTestSuites: 3,
        testSuites: [
          'getCurrentPage() Method Tests',
          'close() Method Tests',
          'Method Interaction Tests',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ Browser context method tests failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Browser context method tests failed',
      details: { error: errorMessage },
    });

    throw new Error(errorMessage);
  }
}
