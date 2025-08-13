/**
 * Browser-Use _getScrollInfo functionality tests
 *
 * This file contains comprehensive tests for the BrowserContext._getScrollInfo method
 * designed to run within the Chrome extension side panel playground.
 */

import { BrowserContext } from '../../browser/context';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
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
 * Interface for test context to maintain consistency with other playground tests
 */
interface ScrollInfoTestContext {
  events: {
    emit: (event: {
      timestamp: number;
      severity: Severity;
      message: string;
      details?: Record<string, unknown>;
      error?: Error;
    }) => void;
  };
  browserUseService: BrowserUsePlaygroundService;
}

/**
 * Test _getScrollInfo with a page at the top (no scroll)
 */
export async function testGetScrollInfoAtTop(
  progress: TestProgress,
  context: ScrollInfoTestContext,
  browserWindow: BrowserWindow,
): Promise<void> {
  let browserContext: BrowserContext | undefined;
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _getScrollInfo test at page top',
    });

    progress.log('Creating BrowserContext for scroll info testing...');
    browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    // Navigate to the test server's main page which has scrollable content
    progress.log('Navigating to test server page...');
    const page = await browserContext.getCurrentPage();
    await page.goto('http://localhost:3005');

    // Wait for page to load and ensure we're at the top
    await new Promise(resolve => setTimeout(resolve, 500));

    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    // Wait a moment for the scroll to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    progress.log('Testing _getScrollInfo at page top...');
    const [pixelsAbove, pixelsBelow] = await browserContext._getScrollInfo(page);

    progress.log(`Scroll info results: pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`);

    // At the top of the page, pixelsAbove should be 0 or very close to 0
    // pixelsBelow should be positive (indicating content below)
    if (pixelsAbove <= 5 && pixelsBelow > 0) {
      // Allow small margin for browser differences
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: _getScrollInfo correctly detected page top position',
        details: { pixelsAbove, pixelsBelow, url: page.url() },
      });
      progress.log('✅ Test 1 passed: Correctly detected page top position');
    } else {
      throw new Error(
        `Test 1 failed: Expected pixelsAbove ≤ 5 and pixelsBelow > 0, got pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 1 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 1 failed: _getScrollInfo at page top',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    if (browserContext) {
      await browserContext.close();
    }
  }
}

/**
 * Test _getScrollInfo after scrolling down the page
 */
export async function testGetScrollInfoAfterScroll(
  progress: TestProgress,
  context: ScrollInfoTestContext,
  browserWindow: BrowserWindow,
): Promise<void> {
  let browserContext: BrowserContext | undefined;
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _getScrollInfo test after scrolling',
    });

    progress.log('Creating BrowserContext for scroll test...');
    browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    const page = await browserContext.getCurrentPage();

    // Navigate to the test server page
    await page.goto('http://localhost:3005');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Scroll down a specific amount (500 pixels)
    progress.log('Scrolling down 500 pixels...');
    await page.evaluate(() => {
      window.scrollTo(0, 500);
    });

    // Wait a moment for the scroll to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    progress.log('Testing _getScrollInfo after scroll...');
    const [pixelsAbove, pixelsBelow] = await browserContext._getScrollInfo(page);

    progress.log(`Scroll info results: pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`);

    // After scrolling 500px down:
    // - pixelsAbove should be around 500 (±50 for browser differences)
    // - pixelsBelow should be positive (remaining content)
    if (pixelsAbove >= 450 && pixelsAbove <= 550 && pixelsBelow > 0) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: _getScrollInfo correctly detected scroll position',
        details: { pixelsAbove, pixelsBelow, expectedPixelsAbove: 500, url: page.url() },
      });
      progress.log('✅ Test 2 passed: Correctly detected scroll position');
    } else {
      throw new Error(
        `Test 2 failed: Expected pixelsAbove ~500 (450-550) and pixelsBelow > 0, got pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 2 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 2 failed: _getScrollInfo after scrolling',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    if (browserContext) {
      await browserContext.close();
    }
  }
}

/**
 * Test _getScrollInfo at the bottom of the page
 */
export async function testGetScrollInfoAtBottom(
  progress: TestProgress,
  context: ScrollInfoTestContext,
  browserWindow: BrowserWindow,
): Promise<void> {
  let browserContext: BrowserContext | undefined;
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _getScrollInfo test at page bottom',
    });

    progress.log('Creating BrowserContext for bottom scroll test...');
    browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    const page = await browserContext.getCurrentPage();

    // Navigate to the test server page
    await page.goto('http://localhost:3005');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Scroll to the bottom of the page
    progress.log('Scrolling to page bottom...');
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight);
    });

    // Wait a moment for the scroll to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    progress.log('Testing _getScrollInfo at page bottom...');
    const [pixelsAbove, pixelsBelow] = await browserContext._getScrollInfo(page);

    progress.log(`Scroll info results: pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`);

    // At the bottom of the page:
    // - pixelsAbove should be positive (content above)
    // - pixelsBelow should be 0 or very close to 0
    if (pixelsAbove > 0 && pixelsBelow <= 5) {
      // Allow small margin for browser differences
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: _getScrollInfo correctly detected page bottom position',
        details: { pixelsAbove, pixelsBelow, url: page.url() },
      });
      progress.log('✅ Test 3 passed: Correctly detected page bottom position');
    } else {
      throw new Error(
        `Test 3 failed: Expected pixelsAbove > 0 and pixelsBelow ≤ 5, got pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 3 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 3 failed: _getScrollInfo at page bottom',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    if (browserContext) {
      await browserContext.close();
    }
  }
}

/**
 * Test _getScrollInfo with different page types and error handling
 */
export async function testGetScrollInfoErrorHandling(
  progress: TestProgress,
  context: ScrollInfoTestContext,
  browserWindow: BrowserWindow,
): Promise<void> {
  let browserContext: BrowserContext | undefined;
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _getScrollInfo error handling test',
    });

    progress.log('Creating BrowserContext for error handling test...');
    browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    const page = await browserContext.getCurrentPage();

    // First test with an iframe page which might have different scroll behavior
    progress.log('Testing _getScrollInfo with iframe page...');
    try {
      await page.goto('http://localhost:3005/iframe1');
      await new Promise(resolve => setTimeout(resolve, 500));

      const [pixelsAbove, pixelsBelow] = await browserContext._getScrollInfo(page);
      progress.log(`Iframe page results: pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`);

      // iframe1 page should also work normally
      if (pixelsAbove >= 0 && pixelsBelow >= 0) {
        progress.log('✅ _getScrollInfo worked correctly with iframe page');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.log(
        `⚠️ Iframe page test encountered error (continuing with restricted page test): ${errorMessage}`,
      );
    }

    // Now test with a potentially restricted page
    progress.log('Testing with chrome:// page for error handling...');
    try {
      await page.goto('chrome://version/');
      await new Promise(resolve => setTimeout(resolve, 500));
      progress.log('✅ Successfully navigated to chrome://version/ page');
    } catch (error) {
      progress.log('Navigation to chrome:// page failed (expected), continuing with test...');
    }

    progress.log('Testing _getScrollInfo error handling...');
    const [pixelsAbove, pixelsBelow] = await browserContext._getScrollInfo(page);

    progress.log(`Error handling results: pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`);

    // Since chrome://version/ is accessible, we should get valid scroll info
    // The page typically doesn't have much scrollable content, so pixelsBelow might be 0
    const isValidResult = pixelsAbove >= 0 && pixelsBelow >= 0;

    if (isValidResult) {
      // Check if it's the expected fallback values or actual scroll info
      const isFallbackValues = pixelsAbove === 0 && pixelsBelow === 0;

      if (isFallbackValues) {
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message:
            'Test 4 passed: _getScrollInfo returned fallback values (no scrollable content or restricted access)',
          details: { pixelsAbove, pixelsBelow, pageType: 'chrome://version/' },
        });
        progress.log(
          '✅ Test 4 passed: Got fallback values - no scrollable content or restricted access',
        );
      } else {
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 4 passed: _getScrollInfo worked correctly on chrome:// page',
          details: { pixelsAbove, pixelsBelow, pageType: 'chrome://version/' },
        });
        progress.log('✅ Test 4 passed: Got valid scroll info from chrome:// page');
      }
    } else {
      throw new Error(
        `Test 4 failed: Invalid scroll info results: pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 4 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 4 failed: _getScrollInfo error handling',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    if (browserContext) {
      await browserContext.close();
    }
  }
}

/**
 * Quick standalone test for _getScrollInfo functionality
 */
export async function quickGetScrollInfoTest(browserWindow: BrowserWindow): Promise<boolean> {
  console.log('🚀 Running quick _getScrollInfo test...');

  let browserContext: BrowserContext | undefined;
  try {
    browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    const page = await browserContext.getCurrentPage();

    // Navigate to the test server page
    await page.goto('http://localhost:3005');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Ensure we're at the top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    const [pixelsAbove, pixelsBelow] = await browserContext._getScrollInfo(page);

    console.log(`Quick test results: pixelsAbove=${pixelsAbove}, pixelsBelow=${pixelsBelow}`);

    // Basic validation: at top, should have 0 pixels above and some below
    const isValid = pixelsAbove <= 5 && pixelsBelow > 0;

    if (isValid) {
      console.log('✅ Quick _getScrollInfo test passed');
    } else {
      console.log('❌ Quick _getScrollInfo test failed');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Quick _getScrollInfo test failed with error:', error);
    return false;
  } finally {
    if (browserContext) {
      await browserContext.close();
    }
  }
}

/**
 * Run all _getScrollInfo tests
 */
export async function runAllGetScrollInfoTests(context: ScrollInfoTestContext): Promise<void> {
  const progress = new TestProgress('_getScrollInfo Tests');
  let browserWindow: BrowserWindow | undefined;

  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting comprehensive _getScrollInfo tests',
    });

    // Create browser window for testing
    browserWindow = await BrowserWindow.create();

    // Run all tests in sequence
    await testGetScrollInfoAtTop(progress, context, browserWindow);
    await testGetScrollInfoAfterScroll(progress, context, browserWindow);
    await testGetScrollInfoAtBottom(progress, context, browserWindow);
    await testGetScrollInfoErrorHandling(progress, context, browserWindow);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '🎉 All _getScrollInfo tests completed successfully!',
    });

    progress.log('🎉 All _getScrollInfo tests passed successfully!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ _getScrollInfo tests failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '_getScrollInfo tests failed',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    if (browserWindow) {
      await browserWindow.dispose();
    }
  }
}
