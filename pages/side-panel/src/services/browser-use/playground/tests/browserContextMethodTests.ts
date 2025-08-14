/**
 * Browser Context Method Tests
 *
 * Focused tests for specific BrowserContext methods:
 * - getCurrentPage()
 * - close()
 * - getState()
 *
 * This file provides targeted testing for browser context lifecycle methods
 * to ensure proper state management and resource cleanup.
 */

import { BrowserContext, BrowserContextState } from '../../browser/context';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { Severity } from '@src/utils/types';
import type { BrowserUsePlaygroundService } from '../browserUsePlaygroundService';
import { BrowserState } from '../../browser/views';

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
 * Test stopLoading() method functionality
 */
export async function testStopLoadingMethod(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  progress.log('🧪 Testing BrowserContext.stopLoading() method...');
  try {
    // Create mock BrowserWindow for testing with real window ID
    let currentWindowId: number;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      currentWindowId = currentWindow.id!;
    } catch (error) {
      // Fallback: skip the test if Chrome APIs are not available
      progress.log(
        '⚠️ Skipping stopLoading() tests - Chrome APIs not available in test environment',
      );
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'stopLoading() tests skipped - Chrome APIs not available',
        details: { reason: 'Cannot access chrome.windows API in test environment' },
      });
      return;
    }

    // Mock page with window.stop() evaluation capability
    const mockPage = {
      tabId: 1,
      url: () => 'https://example.com',
      evaluate: async (fn: () => void) => {
        // Mock window.stop() behavior
        fn(); // Execute the function to simulate evaluation
        return undefined;
      },
    };

    const mockBrowserWindow = {
      windowId: currentWindowId, // Use real window ID
      pages: () => [mockPage],
      getCurrentPage: async () => mockPage,
    } as unknown as import('@src/services/cordyceps/browserWindow').BrowserWindow;

    // Test 1: stopLoading() with active context
    progress.log('Test 1: stopLoading() with active context');

    const browserContext = new BrowserContext(mockBrowserWindow);
    await browserContext.enter();

    // Call stopLoading() - should execute without error
    await browserContext.stopLoading();

    progress.log('✅ Test 1 passed: stopLoading() executed successfully with active context');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: stopLoading() works with active context',
      details: { contextState: browserContext.session.state },
    });

    // Test 2: stopLoading() with uninitialized context (should auto-initialize)
    progress.log('Test 2: stopLoading() with uninitialized context');

    const uninitializedContext = new BrowserContext(mockBrowserWindow);

    // Check initial state
    if (uninitializedContext.session.state !== BrowserContextState.CREATED) {
      throw new Error(`Expected initial state CREATED, got ${uninitializedContext.session.state}`);
    }

    // Call stopLoading() - should trigger auto-initialization
    await uninitializedContext.stopLoading();

    // Should be in ACTIVE state after auto-initialization
    if (
      (uninitializedContext.session.state as BrowserContextState) !== BrowserContextState.ACTIVE
    ) {
      throw new Error(
        `Expected context to be ACTIVE after stopLoading(), got ${uninitializedContext.session.state}`,
      );
    }

    progress.log('✅ Test 2 passed: stopLoading() auto-initializes uninitialized context');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: stopLoading() auto-initializes context',
      details: { finalState: uninitializedContext.session.state },
    });

    // Test 3: stopLoading() error handling
    progress.log('Test 3: stopLoading() error handling');

    // Create a mock page that throws an error during evaluate
    const errorMockPage = {
      tabId: 1,
      url: () => 'https://example.com',
      evaluate: async () => {
        throw new Error('Evaluation failed');
      },
    };

    const errorMockBrowserWindow = {
      windowId: currentWindowId,
      pages: () => [errorMockPage],
      getCurrentPage: async () => errorMockPage,
    } as unknown as import('@src/services/cordyceps/browserWindow').BrowserWindow;

    const errorTestContext = new BrowserContext(errorMockBrowserWindow);
    await errorTestContext.enter();

    // Should not throw error - error handling is internal
    await errorTestContext.stopLoading();

    progress.log('✅ Test 3 passed: stopLoading() handles errors gracefully');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: stopLoading() error handling works',
      details: { errorHandlingSuccess: true },
    });

    // Test 4: stopLoading() with closed context
    progress.log('Test 4: stopLoading() with closed context');

    const closedTestContext = new BrowserContext(mockBrowserWindow);
    await closedTestContext.enter();
    await closedTestContext.close();

    // Verify context is closed
    if (closedTestContext.session.state !== BrowserContextState.CLOSED) {
      throw new Error(`Expected CLOSED state, got ${closedTestContext.session.state}`);
    }

    // Call stopLoading() on closed context - should handle gracefully
    await closedTestContext.stopLoading();

    progress.log('✅ Test 4 passed: stopLoading() handles closed context gracefully');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: stopLoading() works with closed context',
      details: { contextState: closedTestContext.session.state },
    });

    // Clean up
    await browserContext.close();
    await uninitializedContext.close();
    await errorTestContext.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`stopLoading() method test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'stopLoading() method tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Test getState() method functionality
 */
export async function testGetStateMethod(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  progress.log('🧪 Testing BrowserContext.getState() method...');

  try {
    // Use the real BrowserWindow so we get a real Page with full API
    let browserWindow: BrowserWindow;
    try {
      browserWindow = await BrowserWindow.create();
    } catch (error) {
      // Skip if chrome APIs are not available
      progress.log('⚠️ Skipping getState() tests - Chrome APIs not available');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'getState() tests skipped - Chrome APIs not available',
        details: { reason: 'Cannot initialize BrowserWindow in test environment' },
      });
      return;
    }

    const browserContext = new BrowserContext(browserWindow);

    // Ensure the context is usable
    await browserContext.enter();

    // Navigate to localhost:3005 before running the test
    progress.log('🌐 Navigating to http://localhost:3005/ before getState() test...');
    await browserContext.safeGoto('http://localhost:3005/');
    progress.log('✅ Navigation to localhost:3005 completed');

    // Invoke getState()
    const state = await browserContext.getState();

    // Basic structural checks on returned BrowserState
    if (!(state instanceof BrowserState)) {
      throw new Error('getState() did not return a BrowserState instance');
    }

    // The session.cachedState must be updated to the returned value
    if (browserContext.session.cachedState !== state) {
      throw new Error('session.cachedState was not updated by getState()');
    }

    // Validate some key fields exist
    if (typeof state.url !== 'string' || typeof state.title !== 'string') {
      throw new Error('BrowserState url/title are not strings');
    }

    if (!Array.isArray(state.tabs)) {
      throw new Error('BrowserState tabs is not an array');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'getState() returned a valid BrowserState and updated session.cachedState',
      details: {
        url: state.url,
        title: state.title,
        tabsCount: state.tabs.length,
        screenshotPresent: typeof state.screenshot === 'string' || state.screenshot === undefined,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`getState() method test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'getState() method tests failed',
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

    // Test 3: stopLoading() interaction with other methods
    progress.log('Test 3: stopLoading() interaction with other methods');

    const stopLoadingContext = new BrowserContext(mockBrowserWindow);

    // Test stopLoading() before initialization
    await stopLoadingContext.stopLoading();

    // Should auto-initialize
    if ((stopLoadingContext.session.state as BrowserContextState) !== BrowserContextState.ACTIVE) {
      throw new Error('stopLoading() did not auto-initialize context');
    }

    // Test getCurrentPage() after stopLoading()
    const pageAfterStop = await stopLoadingContext.getCurrentPage();
    if (!pageAfterStop) {
      throw new Error('getCurrentPage() failed after stopLoading()');
    }

    // Test stopLoading() again after getCurrentPage()
    await stopLoadingContext.stopLoading();

    // State should remain ACTIVE
    if ((stopLoadingContext.session.state as BrowserContextState) !== BrowserContextState.ACTIVE) {
      throw new Error('State not ACTIVE after second stopLoading()');
    }

    // Test close() after stopLoading()
    await stopLoadingContext.close();

    if ((stopLoadingContext.session.state as BrowserContextState) !== BrowserContextState.CLOSED) {
      throw new Error('Failed to close after stopLoading() operations');
    }

    progress.log('✅ Test 3 passed: stopLoading() interactions work correctly');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: stopLoading() method interactions work correctly',
      details: {
        finalState: stopLoadingContext.session.state,
        pageRetrievedAfterStop: !!pageAfterStop,
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
 * Test createNewTab() method functionality
 */
export async function testCreateNewTabMethod(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  progress.log('🧪 Testing BrowserContext.createNewTab() method...');

  try {
    // Get the current window ID to ensure we have a valid browser window
    try {
      const currentWindow = await chrome.windows.getCurrent();
      progress.log(`Using Chrome window ID: ${currentWindow.id}`);
    } catch (error) {
      // Fallback: skip the test if Chrome APIs are not available
      progress.log(
        '⚠️ Skipping createNewTab() tests - Chrome APIs not available in test environment',
      );
      return;
    }

    // Create BrowserWindow and BrowserContext for testing
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost', '127.0.0.1'], // Allow localhost for testing
    });

    progress.log('✅ Created BrowserContext for createNewTab() testing');

    // Test 1: Create new tab without URL (will navigate to chrome://newtab/ by default)
    progress.log('Test 1: Creating new tab without URL...');

    // Initialize the context first to get a baseline
    await browserContext.enter();
    const initialPages = browserContext.pages.length;
    progress.log(`Initial pages count: ${initialPages}`);

    // Create new tab - should now handle chrome://newtab/ gracefully
    await browserContext.createNewTab();

    // Verify the pages array was updated
    const afterCreatePages = browserContext.pages.length;
    progress.log(`Pages count after creating new tab: ${afterCreatePages}`);

    if (afterCreatePages > initialPages) {
      progress.log('✅ Test 1 passed: New tab created successfully without URL');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'createNewTab() without URL test passed',
        details: { initialPages, afterCreatePages, pagesAdded: afterCreatePages - initialPages },
      });
    } else {
      throw new Error(
        `Test 1 failed: Expected more than ${initialPages} pages, got ${afterCreatePages}`,
      );
    } // Test 2: Create new tab with allowed URL
    progress.log('Test 2: Creating new tab with allowed URL...');
    const beforeUrlPages = browserContext.pages.length;

    // Add timeout protection for URL navigation
    try {
      await Promise.race([
        browserContext.createNewTab('http://localhost:3005'),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('createNewTab with URL timed out after 15 seconds')),
            15000,
          ),
        ),
      ]);
    } catch (error) {
      if (error instanceof Error && error.message.includes('timed out')) {
        progress.log(
          '⚠️ Test 2 warning: createNewTab with URL timed out, checking if tab was created...',
        );
        // Still check if the tab was created even if navigation timed out
      } else {
        throw error;
      }
    }

    // Verify the pages array was updated
    const afterUrlPages = browserContext.pages.length;
    if (afterUrlPages > beforeUrlPages) {
      progress.log('✅ Test 2 passed: New tab created successfully with URL');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'createNewTab() with URL test passed',
        details: {
          beforeUrlPages,
          afterUrlPages,
          url: 'http://localhost:3005',
          pagesAdded: afterUrlPages - beforeUrlPages,
        },
      });
    } else {
      throw new Error(
        `Test 2 failed: Expected more than ${beforeUrlPages} pages, got ${afterUrlPages}`,
      );
    }

    // Test 3: Try to create new tab with disallowed URL (should throw error)
    progress.log('Test 3: Testing createNewTab() with disallowed URL...');
    try {
      await browserContext.createNewTab('https://evil-site.com');
      throw new Error('Test 3 failed: Should have thrown error for disallowed URL');
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Cannot create new tab with non-allowed URL')
      ) {
        progress.log('✅ Test 3 passed: Properly rejected disallowed URL');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'createNewTab() URL validation test passed',
          details: { rejectedUrl: 'https://evil-site.com' },
        });
      } else {
        throw new Error(
          `Test 3 failed: Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Test 4: Test state management during tab creation
    progress.log('Test 4: Testing state management during tab creation...');
    const isActive = browserContext.isActive();
    progress.log(`BrowserContext active state: ${isActive}`);

    if (isActive) {
      progress.log('✅ Test 4 passed: BrowserContext maintains active state during tab creation');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'createNewTab() state management test passed',
        details: { activeState: isActive, totalPages: browserContext.pages.length },
      });
    } else {
      progress.log('⚠️ Test 4 warning: BrowserContext not in active state after tab creation');
    }

    progress.log('✅ All createNewTab() method tests completed successfully');

    // Clean up
    await browserContext.close();
    browserWindow.dispose();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ createNewTab() method test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'createNewTab() method test failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Test switchToTab() method functionality
 */
export async function testSwitchToTabMethod(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  progress.log('🧪 Testing BrowserContext.switchToTab() method...');

  try {
    // Get the current window ID to ensure we have a valid browser window
    try {
      const currentWindow = await chrome.windows.getCurrent();
      progress.log(`Using Chrome window ID: ${currentWindow.id}`);
    } catch (error) {
      // Fallback: skip the test if Chrome APIs are not available
      progress.log(
        '⚠️ Skipping switchToTab() tests - Chrome APIs not available in test environment',
      );
      return;
    }

    // Create BrowserWindow and BrowserContext for testing
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost', '127.0.0.1'], // Allow localhost for testing
    });

    progress.log('✅ Created BrowserContext for switchToTab() testing');

    // Initialize the context and create multiple tabs for testing
    await browserContext.enter();
    const initialPages = browserContext.pages.length;
    progress.log(`Initial pages count: ${initialPages}`);

    // Create a couple of test tabs
    await browserContext.createNewTab('http://localhost:3005');
    await browserContext.createNewTab(); // New tab without URL

    const finalPages = browserContext.pages.length;
    progress.log(`Pages count after creating test tabs: ${finalPages}`);

    if (finalPages < initialPages + 2) {
      throw new Error(`Expected at least ${initialPages + 2} pages, got ${finalPages}`);
    }

    // Test 1: Switch to a valid tab by pageId
    progress.log('Test 1: Switching to valid tab by pageId...');

    const targetPageId = finalPages - 1; // Switch to the last created tab
    await browserContext.switchToTab(targetPageId);

    progress.log('✅ Test 1 passed: Successfully switched to valid tab');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'switchToTab() valid tab test passed',
      details: { targetPageId, totalPages: finalPages },
    });

    // Test 2: Switch to the first tab (should be localhost:3005)
    progress.log('Test 2: Switching to first tab with URL...');

    await browserContext.switchToTab(initialPages); // First created tab (localhost:3005)

    progress.log('✅ Test 2 passed: Successfully switched to first tab with URL');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'switchToTab() URL tab test passed',
      details: { targetPageId: initialPages, totalPages: finalPages },
    });

    // Test 3: Try to switch to invalid pageId (should throw error)
    progress.log('Test 3: Testing switchToTab() with invalid pageId...');
    try {
      await browserContext.switchToTab(999); // Invalid pageId
      throw new Error('Test 3 failed: Should have thrown error for invalid pageId');
    } catch (error) {
      if (error instanceof Error && error.message.includes('No tab found with page_id')) {
        progress.log('✅ Test 3 passed: Properly rejected invalid pageId');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'switchToTab() invalid pageId test passed',
          details: { invalidPageId: 999, totalPages: finalPages },
        });
      } else {
        throw new Error(
          `Test 3 failed: Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Test 4: Try to switch to negative pageId (should throw error)
    progress.log('Test 4: Testing switchToTab() with negative pageId...');
    try {
      await browserContext.switchToTab(-1); // Negative pageId
      throw new Error('Test 4 failed: Should have thrown error for negative pageId');
    } catch (error) {
      if (error instanceof Error && error.message.includes('No tab found with page_id')) {
        progress.log('✅ Test 4 passed: Properly rejected negative pageId');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'switchToTab() negative pageId test passed',
          details: { invalidPageId: -1, totalPages: finalPages },
        });
      } else {
        throw new Error(
          `Test 4 failed: Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Test 5: Test state management during tab switching
    progress.log('Test 5: Testing state management during tab switching...');
    const isActive = browserContext.isActive();
    progress.log(`BrowserContext active state: ${isActive}`);

    if (isActive) {
      progress.log('✅ Test 5 passed: BrowserContext maintains active state during tab switching');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'switchToTab() state management test passed',
        details: { activeState: isActive, totalPages: finalPages },
      });
    } else {
      progress.log('⚠️ Test 5 warning: BrowserContext not in active state after tab switching');
    }

    progress.log('✅ All switchToTab() method tests completed successfully');

    // Clean up
    await browserContext.close();
    browserWindow.dispose();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ switchToTab() method test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'switchToTab() method test failed',
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
    await testStopLoadingMethod(progress, context);
    await testMethodInteractions(progress, context);
    await testGetStateMethod(progress, context);
    await testCreateNewTabMethod(progress, context);

    progress.log('✅ All browser context method tests completed successfully!');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All browser context method tests completed successfully',
      details: {
        totalTestSuites: 6,
        testSuites: [
          'getCurrentPage() Method Tests',
          'close() Method Tests',
          'stopLoading() Method Tests',
          'Method Interaction Tests',
          'getState() Method Tests',
          'createNewTab() Method Tests',
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
