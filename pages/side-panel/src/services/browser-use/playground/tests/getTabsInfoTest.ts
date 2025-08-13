/**
 * Standalone test for BrowserContext._getTabsInfo() method
 *
 * This test file provides focused testing for the _getTabsInfo() method
 * to ensure proper tab information collection and async title handling.
 */

import { BrowserContext } from '../../browser/context';
import { Severity } from '@src/utils/types';
import type { BrowserUsePlaygroundService } from '../browserUsePlaygroundService';

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
 * Standalone test for _getTabsInfo() method
 */
export async function runGetTabsInfoTest(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  progress.log('🧪 Running standalone _getTabsInfo() test...');

  try {
    // Get the current window ID from Chrome
    let currentWindowId: number;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      currentWindowId = currentWindow.id!;
    } catch (error) {
      progress.log('⚠️ Skipping test - Chrome APIs not available in test environment');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Standalone _getTabsInfo() test skipped - Chrome APIs not available',
        details: { reason: 'Cannot access chrome.windows API in test environment' },
      });
      return;
    }

    // Create comprehensive test scenario with multiple tabs
    const mockPages = [
      {
        tabId: 1,
        url: () => 'http://localhost:3005',
        title: async () => 'Local Test Server',
      },
      {
        tabId: 2,
        url: () => 'http://localhost:3005/nav-page-1.html',
        title: async () => 'Navigation Page 1',
      },
      {
        tabId: 3,
        url: () => 'http://localhost:3005/nav-page-2.html',
        title: async () => 'Navigation Page 2',
      },
      {
        tabId: 4,
        url: () => 'http://localhost:3005/iframe1.html',
        title: async () => {
          // Simulate async delay to test proper async handling
          await new Promise(resolve => setTimeout(resolve, 20));
          return 'Iframe Test Page';
        },
      },
    ];

    const mockBrowserWindow = {
      windowId: currentWindowId,
      pages: () => mockPages,
      getCurrentPage: async () => mockPages[0],
    } as unknown as import('@src/services/cordyceps/browserWindow').BrowserWindow;

    const browserContext = new BrowserContext(mockBrowserWindow);

    // Measure execution time to ensure async operations work properly
    const startTime = Date.now();
    const tabsInfo = await browserContext._getTabsInfo();
    const endTime = Date.now();
    const executionTime = endTime - startTime;

    // Validate results
    if (!Array.isArray(tabsInfo)) {
      throw new Error('_getTabsInfo() should return an array');
    }

    if (tabsInfo.length !== 4) {
      throw new Error(`Expected 4 tabs, got ${tabsInfo.length}`);
    }

    // Validate each tab
    const expectedTabs = [
      { pageId: 0, url: 'http://localhost:3005', title: 'Local Test Server' },
      { pageId: 1, url: 'http://localhost:3005/nav-page-1.html', title: 'Navigation Page 1' },
      { pageId: 2, url: 'http://localhost:3005/nav-page-2.html', title: 'Navigation Page 2' },
      { pageId: 3, url: 'http://localhost:3005/iframe1.html', title: 'Iframe Test Page' },
    ];

    for (let i = 0; i < expectedTabs.length; i++) {
      const actual = tabsInfo[i];
      const expected = expectedTabs[i];

      if (actual.pageId !== expected.pageId) {
        throw new Error(`Tab ${i}: Expected pageId ${expected.pageId}, got ${actual.pageId}`);
      }

      if (actual.url !== expected.url) {
        throw new Error(`Tab ${i}: Expected URL '${expected.url}', got '${actual.url}'`);
      }

      if (actual.title !== expected.title) {
        throw new Error(`Tab ${i}: Expected title '${expected.title}', got '${actual.title}'`);
      }
    }

    // Validate async handling (should take at least 20ms due to mock delay)
    if (executionTime < 15) {
      throw new Error('Async title() calls may not have been properly awaited');
    }

    progress.log(`✅ Test passed: All ${tabsInfo.length} tabs processed correctly`);
    progress.log(`⏱️ Execution time: ${executionTime}ms (includes async title calls)`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Standalone _getTabsInfo() test passed',
      details: {
        tabsCount: tabsInfo.length,
        executionTime,
        tabs: tabsInfo,
      },
    });

    // Clean up
    await browserContext.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ Standalone _getTabsInfo() test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Standalone _getTabsInfo() test failed',
      details: { error: errorMessage },
    });

    throw new Error(errorMessage);
  }
}

/**
 * Quick test for basic _getTabsInfo() functionality
 */
export async function runQuickGetTabsInfoTest(): Promise<boolean> {
  console.log('🧪 Running quick _getTabsInfo() test...');

  try {
    // Get the current window ID from Chrome
    let currentWindowId: number;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      currentWindowId = currentWindow.id!;
    } catch (error) {
      console.log('⚠️ Skipping quick test - Chrome APIs not available');
      return true; // Return true to indicate test was skipped, not failed
    }

    // Simple single tab test
    const mockPage = {
      tabId: 1,
      url: () => 'http://localhost:3005',
      title: async () => 'Quick Test Page',
    };

    const mockBrowserWindow = {
      windowId: currentWindowId,
      pages: () => [mockPage],
      getCurrentPage: async () => mockPage,
    } as unknown as import('@src/services/cordyceps/browserWindow').BrowserWindow;

    const browserContext = new BrowserContext(mockBrowserWindow);
    const tabsInfo = await browserContext._getTabsInfo();

    // Basic validation
    const success =
      Array.isArray(tabsInfo) &&
      tabsInfo.length === 1 &&
      tabsInfo[0].pageId === 0 &&
      tabsInfo[0].url === 'http://localhost:3005' &&
      tabsInfo[0].title === 'Quick Test Page';

    if (success) {
      console.log('✅ Quick _getTabsInfo() test passed');
    } else {
      console.log('❌ Quick _getTabsInfo() test failed - validation error');
    }

    await browserContext.close();
    return success;
  } catch (error) {
    console.log(`❌ Quick _getTabsInfo() test failed: ${error}`);
    return false;
  }
}
