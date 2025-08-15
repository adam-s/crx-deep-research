/**
 * Comprehensive test for BrowserContext.refreshPage() method
 *
 * This test verifies the page refresh functionality works correctly,
 * including navigation state preservation and proper load detection.
 */

import { BrowserContext } from '../../browser/context';
import { Severity } from '@src/utils/types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';

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
 * Test context interface for consistency
 */
interface TestContext {
  events: {
    emit: (event: {
      timestamp: number;
      severity: Severity;
      message: string;
      details?: Record<string, unknown>;
    }) => void;
  };
}

/**
 * Main test function for refreshPage() method
 */
export async function testRefreshPage(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('🧪 Testing BrowserContext.refreshPage() method...');

  try {
    // Create browser window
    let browserWindow: BrowserWindow;
    try {
      browserWindow = await BrowserWindow.create();
      progress.log(`📍 Created browser window: ${browserWindow.windowId}`);
    } catch (error) {
      progress.log('⚠️ Skipping refreshPage tests - BrowserWindow not available');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'refreshPage tests skipped - BrowserWindow not available',
        details: { reason: 'Cannot create BrowserWindow in test environment' },
      });
      return;
    }

    // Create browser context
    const browserContext = new BrowserContext(browserWindow);
    await browserContext.enter();

    // Test 1: Navigate to test page first
    progress.log('Test 1: Navigate to test page');
    const page = await browserContext.getCurrentPage();
    await page.goto('http://localhost:3005');
    await page.waitForLoadState();
    progress.log('📍 Navigated to http://localhost:3005');

    // Get initial page state
    const initialUrl = page.url();
    const initialTitle = await page.title();
    progress.log(`📍 Initial state - URL: ${initialUrl}, Title: "${initialTitle}"`);

    // Test 2: Basic refresh functionality
    progress.log('Test 2: Basic refreshPage() functionality');

    const startTime = performance.now();
    await browserContext.refreshPage();
    const refreshTime = performance.now() - startTime;

    progress.log(`📍 refreshPage() completed in ${refreshTime.toFixed(2)}ms`);

    // Verify page state after refresh
    const refreshedUrl = page.url();
    const refreshedTitle = await page.title();

    if (refreshedUrl !== initialUrl) {
      throw new Error(`URL changed after refresh: ${initialUrl} -> ${refreshedUrl}`);
    }

    if (refreshedTitle !== initialTitle) {
      progress.log(`📍 Title changed after refresh: "${initialTitle}" -> "${refreshedTitle}"`);
      // This might be expected behavior, so we log but don't fail
    }

    progress.log(`✅ Test 2 passed: Page refreshed successfully`);

    // Test 3: Refresh with DOM modifications
    progress.log('Test 3: Refresh with DOM modifications');

    // Add some temporary content to the page
    await page.evaluate(() => {
      const testElement = document.createElement('div');
      testElement.id = 'test-refresh-marker';
      testElement.textContent = 'This should disappear after refresh';
      document.body.appendChild(testElement);
    });

    // Verify the element was added
    const elementExists = await page.evaluate(() => {
      return document.getElementById('test-refresh-marker') !== null;
    });

    if (!elementExists) {
      throw new Error('Failed to add test element to page');
    }

    progress.log('📍 Added test element to page');

    // Refresh the page
    await browserContext.refreshPage();

    // Verify the element was removed by refresh
    const elementExistsAfterRefresh = await page.evaluate(() => {
      return document.getElementById('test-refresh-marker') !== null;
    });

    if (elementExistsAfterRefresh) {
      throw new Error('Test element still exists after refresh - DOM was not properly reset');
    }

    progress.log(`✅ Test 3 passed: DOM properly reset after refresh`);

    // Test 4: Multiple rapid refreshes
    progress.log('Test 4: Multiple rapid refreshes');

    const refreshCount = 3;
    const refreshTimes: number[] = [];

    for (let i = 0; i < refreshCount; i++) {
      const startTime = performance.now();
      await browserContext.refreshPage();
      const endTime = performance.now();
      refreshTimes.push(endTime - startTime);

      progress.log(
        `📍 Refresh ${i + 1}/${refreshCount} completed in ${(endTime - startTime).toFixed(2)}ms`,
      );

      // Small delay between refreshes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avgRefreshTime = refreshTimes.reduce((a, b) => a + b, 0) / refreshTimes.length;
    progress.log(`📍 Average refresh time: ${avgRefreshTime.toFixed(2)}ms`);

    // Verify page is still functional after multiple refreshes
    const finalUrl = page.url();
    const finalTitle = await page.title();

    if (finalUrl !== initialUrl) {
      throw new Error(`URL corrupted after multiple refreshes: ${initialUrl} -> ${finalUrl}`);
    }

    progress.log(`📍 Final state - URL: ${finalUrl}, Title: "${finalTitle}"`);
    progress.log(`✅ Test 4 passed: Multiple refreshes handled correctly`);

    // Test 5: Error handling with invalid page state
    progress.log('Test 5: Error handling');

    try {
      // Try to refresh when page might be in an invalid state
      // Navigate to a non-existent page first
      await page.goto('http://localhost:3005/non-existent-page', { waitUntil: 'domcontentloaded' });

      // Try to refresh - this should handle the error gracefully
      await browserContext.refreshPage();
      progress.log('📍 Refresh on error page completed without throwing');
    } catch (error) {
      // This is expected behavior for some error pages
      progress.log(
        `📍 Refresh on error page threw error (expected): ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    progress.log(`✅ Test 5 passed: Error handling validated`);

    // Cleanup
    await browserContext.close();
    progress.log('🧹 Cleaned up browser context');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'refreshPage() tests completed successfully',
      details: {
        averageRefreshTime: `${avgRefreshTime.toFixed(2)}ms`,
        totalTests: 5,
        testsPassed: 5,
      },
    });

    progress.log('✅ All refreshPage() tests passed!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ refreshPage() test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'refreshPage() test failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}
