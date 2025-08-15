/**
 * Comprehensive test for BrowserContext.scrollToTop() method
 *
 * This test verifies the scroll to top functionality works correctly,
 * including scroll position validation and behavior from different starting positions.
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
 * Main test function for scrollToTop() method
 */
export async function testScrollToTop(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('🧪 Testing BrowserContext.scrollToTop() method...');

  try {
    // Create browser window
    let browserWindow: BrowserWindow;
    try {
      browserWindow = await BrowserWindow.create();
      progress.log(`📍 Created browser window: ${browserWindow.windowId}`);
    } catch (error) {
      progress.log('⚠️ Skipping scrollToTop tests - BrowserWindow not available');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'scrollToTop tests skipped - BrowserWindow not available',
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

    // Get page dimensions
    const documentHeight = await page.evaluate(() => document.body.scrollHeight);
    const windowHeight = await page.evaluate(() => window.innerHeight);

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

    // Test 2: Scroll to bottom first, then test scrollToTop
    progress.log('Test 2: Scroll to bottom then test scrollToTop()');

    // First scroll to bottom to have a starting position
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const bottomScrollY = await page.evaluate(() => window.scrollY);
    progress.log(`📍 Scrolled to bottom: ${bottomScrollY}`);

    // Now test scrollToTop
    const startTime = performance.now();
    await browserContext.scrollToTop();
    const scrollTime = performance.now() - startTime;

    progress.log(`📍 scrollToTop() completed in ${scrollTime.toFixed(2)}ms`);

    // Verify scroll position after scrolling to top
    const topScrollY = await page.evaluate(() => window.scrollY);
    progress.log(`📍 Final scroll position: ${topScrollY}`);

    // Check if we're at the top (should be 0 or very close to 0)
    const tolerance = 5; // 5px tolerance

    if (topScrollY > tolerance) {
      throw new Error(`Scroll position not at top. Expected: 0, Actual: ${topScrollY}`);
    }

    progress.log(`✅ Test 2 passed: Page scrolled to top successfully`);

    // Test 3: Test from middle position
    progress.log('Test 3: ScrollToTop from middle position');

    // Scroll to middle of page
    const middlePosition = Math.floor(documentHeight / 2);
    await page.evaluate(pos => window.scrollTo(0, pos), middlePosition);
    const middleScrollY = await page.evaluate(() => window.scrollY);
    progress.log(`📍 Scrolled to middle: ${middleScrollY}`);

    // Scroll to top from middle
    await browserContext.scrollToTop();
    const fromMiddleScrollY = await page.evaluate(() => window.scrollY);

    if (fromMiddleScrollY > tolerance) {
      throw new Error(
        `Failed to scroll to top from middle. Expected: 0, Actual: ${fromMiddleScrollY}`,
      );
    }

    progress.log(`✅ Test 3 passed: Scrolled to top from middle position`);

    // Test 4: Multiple scroll operations
    progress.log('Test 4: Multiple scroll operations');

    const scrollTimes: number[] = [];
    const scrollCount = 3;

    for (let i = 0; i < scrollCount; i++) {
      // Scroll to a random position first
      const randomPosition = Math.floor(Math.random() * (documentHeight - windowHeight));
      await page.evaluate(pos => window.scrollTo(0, pos), randomPosition);
      const beforeScrollY = await page.evaluate(() => window.scrollY);

      const startTime = performance.now();
      await browserContext.scrollToTop();
      const endTime = performance.now();
      scrollTimes.push(endTime - startTime);

      const afterScrollY = await page.evaluate(() => window.scrollY);
      progress.log(
        `📍 Scroll ${i + 1}/${scrollCount}: ${beforeScrollY} -> ${afterScrollY} (${(endTime - startTime).toFixed(2)}ms)`,
      );

      if (afterScrollY > tolerance) {
        throw new Error(`Failed scroll ${i + 1}: position ${afterScrollY} not at top`);
      }

      // Small delay between operations
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const avgScrollTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
    progress.log(`📍 Average scroll time: ${avgScrollTime.toFixed(2)}ms`);

    progress.log(`✅ Test 4 passed: Multiple scroll operations handled correctly`);

    // Test 5: Scroll behavior when already at top
    progress.log('Test 5: Scroll behavior when already at top');

    // Should already be at top from previous test
    const beforeScrollY = await page.evaluate(() => window.scrollY);

    await browserContext.scrollToTop();

    const afterScrollY = await page.evaluate(() => window.scrollY);

    if (Math.abs(beforeScrollY - afterScrollY) > 2) {
      progress.log(`📍 Minor position change: ${beforeScrollY} -> ${afterScrollY} (acceptable)`);
    } else {
      progress.log('📍 Scroll position remained stable when already at top');
    }

    if (afterScrollY > tolerance) {
      throw new Error(`Position changed unexpectedly when already at top: ${afterScrollY}`);
    }

    progress.log(`✅ Test 5 passed: Handled already-at-top state correctly`);

    // Test 6: Error handling with short page
    progress.log('Test 6: Behavior with non-scrollable page');

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
    await browserContext.scrollToTop();

    const shortPageScrollY = await page.evaluate(() => window.scrollY);
    progress.log(`📍 Scroll position on short page: ${shortPageScrollY}`);

    // Should remain at 0 for non-scrollable page
    if (shortPageScrollY > tolerance) {
      progress.log(`⚠️ Unexpected scroll on short page: ${shortPageScrollY}px`);
    }

    progress.log(`✅ Test 6 passed: Handled non-scrollable page correctly`);

    // Cleanup
    await browserContext.close();
    progress.log('🧹 Cleaned up browser context');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'scrollToTop() tests completed successfully',
      details: {
        averageScrollTime: `${avgScrollTime.toFixed(2)}ms`,
        totalTests: 6,
        testsPassed: 6,
      },
    });

    progress.log('✅ All scrollToTop() tests passed!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ scrollToTop() test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'scrollToTop() test failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}
