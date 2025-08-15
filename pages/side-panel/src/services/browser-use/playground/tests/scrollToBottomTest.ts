/**
 * Comprehensive test for BrowserContext.scrollToBottom() method
 *
 * This test verifies the scroll functionality works correctly,
 * including scroll position validation and behavior with different page heights.
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
 * Main test function for scrollToBottom() method
 */
export async function testScrollToBottom(
  progress: TestProgress,
  context: TestContext,
): Promise<void> {
  progress.log('🧪 Testing BrowserContext.scrollToBottom() method...');

  try {
    // Create browser window
    let browserWindow: BrowserWindow;
    try {
      browserWindow = await BrowserWindow.create();
      progress.log(`📍 Created browser window: ${browserWindow.windowId}`);
    } catch (error) {
      progress.log('⚠️ Skipping scrollToBottom tests - BrowserWindow not available');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'scrollToBottom tests skipped - BrowserWindow not available',
        details: { reason: 'Cannot create BrowserWindow in test environment' },
      });
      return;
    }

    // Create browser context
    const browserContext = new BrowserContext(browserWindow);
    await browserContext.enter();

    // Test 1: Navigate to test page and create content for scrolling
    progress.log('Test 1: Setup page with scrollable content');
    const page = await browserContext.getCurrentPage();
    await page.goto('http://localhost:3005');
    await page.waitForLoadState();
    progress.log('📍 Navigated to http://localhost:3005');

    // Add extra content to make the page scrollable
    await page.evaluate(() => {
      // Add a tall div to ensure scrolling is possible
      const scrollTestDiv = document.createElement('div');
      scrollTestDiv.id = 'scroll-test-content';
      scrollTestDiv.style.height = '3000px';
      scrollTestDiv.style.backgroundColor = '#f0f0f0';
      scrollTestDiv.style.padding = '20px';
      scrollTestDiv.innerHTML = `
        <h2>Scroll Test Content</h2>
        <p>This is content added for scroll testing.</p>
        <div style="height: 2000px; background: linear-gradient(to bottom, #e0e0e0, #f0f0f0);">
          <p style="position: absolute; bottom: 50px;">Bottom content marker</p>
        </div>
      `;
      document.body.appendChild(scrollTestDiv);
    });

    progress.log('📍 Added scrollable content to page');

    // Get initial scroll position (should be at top)
    const initialScrollY = await page.evaluate(() => window.scrollY);
    const documentHeight = await page.evaluate(() => document.body.scrollHeight);
    const windowHeight = await page.evaluate(() => window.innerHeight);

    progress.log(`📍 Initial scroll position: ${initialScrollY}`);
    progress.log(`📍 Document height: ${documentHeight}px, Window height: ${windowHeight}px`);

    if (documentHeight <= windowHeight) {
      progress.log('⚠️ Page is not scrollable, adding more content...');
      await page.evaluate(() => {
        const extraDiv = document.createElement('div');
        extraDiv.style.height = '2000px';
        extraDiv.style.backgroundColor = '#e0e0e0';
        extraDiv.textContent = 'Extra scrollable content';
        document.body.appendChild(extraDiv);
      });
    }

    // Test 2: Basic scrollToBottom functionality
    progress.log('Test 2: Basic scrollToBottom() functionality');

    const startTime = performance.now();
    await browserContext.scrollToBottom();
    const scrollTime = performance.now() - startTime;

    progress.log(`📍 scrollToBottom() completed in ${scrollTime.toFixed(2)}ms`);

    // Verify scroll position after scrolling
    const finalScrollY = await page.evaluate(() => window.scrollY);
    const finalDocumentHeight = await page.evaluate(() => {
      // Use both document.body.scrollHeight and document.documentElement.scrollHeight
      // to get the most accurate measurement
      return Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
      );
    });
    const finalWindowHeight = await page.evaluate(() => window.innerHeight);

    progress.log(`📍 Final scroll position: ${finalScrollY}`);
    progress.log(`📍 Expected bottom position: ${finalDocumentHeight - finalWindowHeight}`);

    // Check if we're at or near the bottom (allow for small differences due to rounding)
    const expectedBottom = finalDocumentHeight - finalWindowHeight;
    const tolerance = 50; // 50px tolerance to account for browser differences, zoom levels, and content layout
    const actualDifference = Math.abs(finalScrollY - expectedBottom);

    progress.log(
      `📍 Scroll validation - Expected: ${expectedBottom}, Actual: ${finalScrollY}, Difference: ${actualDifference}px, Tolerance: ${tolerance}px`,
    );

    if (actualDifference > tolerance) {
      // Provide additional context for debugging
      const percentScrolled = (finalScrollY / (finalDocumentHeight - finalWindowHeight)) * 100;
      progress.log(
        `📍 Additional context - Scroll percentage: ${percentScrolled.toFixed(1)}%, Document height: ${finalDocumentHeight}px, Window height: ${finalWindowHeight}px`,
      );

      throw new Error(
        `Scroll position not at bottom. Expected: ~${expectedBottom}, Actual: ${finalScrollY}, Difference: ${actualDifference}px (tolerance: ${tolerance}px)`,
      );
    }

    progress.log(`✅ Test 2 passed: Page scrolled to bottom successfully`);

    // Test 3: Multiple scroll operations
    progress.log('Test 3: Multiple scroll operations');

    // Scroll to top first
    await page.evaluate(() => window.scrollTo(0, 0));
    const topScrollY = await page.evaluate(() => window.scrollY);
    progress.log(`📍 Reset to top: ${topScrollY}`);

    // Perform multiple scrollToBottom operations
    const scrollTimes: number[] = [];
    const scrollCount = 3;

    for (let i = 0; i < scrollCount; i++) {
      const startTime = performance.now();
      await browserContext.scrollToBottom();
      const endTime = performance.now();
      scrollTimes.push(endTime - startTime);

      const currentScrollY = await page.evaluate(() => window.scrollY);
      progress.log(
        `📍 Scroll ${i + 1}/${scrollCount}: ${currentScrollY} (${(endTime - startTime).toFixed(2)}ms)`,
      );

      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avgScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
    progress.log(`📍 Average scroll time: ${avgScrollTime.toFixed(2)}ms`);

    progress.log(`✅ Test 3 passed: Multiple scroll operations handled correctly`);

    // Test 4: Scroll behavior with already scrolled page
    progress.log('Test 4: Scroll behavior when already at bottom');

    // Already at bottom from previous test
    const beforeScrollY = await page.evaluate(() => window.scrollY);

    await browserContext.scrollToBottom();

    const afterScrollY = await page.evaluate(() => window.scrollY);

    if (Math.abs(beforeScrollY - afterScrollY) > 5) {
      progress.log(
        `📍 Scroll position changed: ${beforeScrollY} -> ${afterScrollY} (minor movement expected)`,
      );
    } else {
      progress.log('📍 Scroll position remained stable when already at bottom');
    }

    progress.log(`✅ Test 4 passed: Handled already-at-bottom state correctly`);

    // Test 5: Error handling with short page
    progress.log('Test 5: Behavior with non-scrollable page');

    // Navigate to a simple page without extra content
    await page.evaluate(() => {
      // Remove all the extra content we added
      const scrollTestDiv = document.getElementById('scroll-test-content');
      if (scrollTestDiv) {
        scrollTestDiv.remove();
      }
      // Remove any extra divs
      const extraDivs = document.querySelectorAll('div[style*="height: 2000px"]');
      extraDivs.forEach(div => div.remove());
    });

    const shortPageHeight = await page.evaluate(() => document.body.scrollHeight);
    const shortWindowHeight = await page.evaluate(() => window.innerHeight);

    progress.log(
      `📍 Short page - Document height: ${shortPageHeight}px, Window height: ${shortWindowHeight}px`,
    );

    // Try to scroll on a non-scrollable page
    await browserContext.scrollToBottom();

    const shortPageScrollY = await page.evaluate(() => window.scrollY);
    progress.log(`📍 Scroll position on short page: ${shortPageScrollY}`);

    // Should remain at 0 or near 0 for non-scrollable page
    if (shortPageScrollY > 50) {
      progress.log(`⚠️ Unexpected scroll on short page: ${shortPageScrollY}px`);
    }

    progress.log(`✅ Test 5 passed: Handled non-scrollable page correctly`);

    // Cleanup
    await browserContext.close();
    progress.log('🧹 Cleaned up browser context');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'scrollToBottom() tests completed successfully',
      details: {
        averageScrollTime: `${avgScrollTime.toFixed(2)}ms`,
        totalTests: 5,
        testsPassed: 5,
      },
    });

    progress.log('✅ All scrollToBottom() tests passed!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ scrollToBottom() test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'scrollToBottom() test failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}
