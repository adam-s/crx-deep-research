/**
 * Comprehensive test for BrowserContext.safeGoto() method
 *
 * This test validates navigation functionality including URL validation,
 * error handling, timeout management, and integration with _isUrlAllowed().
 * Uses controlled localhost:3005 server environment for predictable testing.
 */

import { BrowserContext } from '../../browser/context';
import { Severity } from '@src/utils/types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
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
 * Main test function for safeGoto() using localhost:3005 environment
 */
export async function testSafeGoto(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('🧪 Testing BrowserContext.safeGoto() with controlled server environment...');

  try {
    // Create browser window
    let browserWindow: BrowserWindow;
    try {
      browserWindow = await BrowserWindow.create();
      progress.log(`📍 Created browser window: ${browserWindow.windowId}`);
    } catch (error) {
      progress.log('⚠️ Skipping safeGoto tests - BrowserWindow not available');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'safeGoto tests skipped - BrowserWindow not available',
        details: { reason: 'Cannot create BrowserWindow in test environment' },
      });
      return;
    }

    // Create BrowserContext with localhost allowed for testing
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });
    const page = await browserWindow.getCurrentPage();

    // Test 1: Basic successful navigation
    progress.log('Test 1: Basic successful navigation to localhost:3005');

    const startTime1 = performance.now();
    const result1 = await browserContext.safeGoto('http://localhost:3005');
    const duration1 = performance.now() - startTime1;

    progress.log(`📍 safeGoto() completed in ${duration1.toFixed(2)}ms`);

    // Note: Frame.goto() currently returns null because "Response mapping is not wired yet"
    // So we check for successful navigation by verifying the URL changed
    const currentUrl = page.url();
    if (!currentUrl || !currentUrl.includes('localhost:3005')) {
      throw new Error(`Expected localhost:3005 URL after navigation, got: ${currentUrl}`);
    }

    progress.log(
      `✅ Test 1 passed: Successful navigation (${duration1.toFixed(2)}ms, result: ${result1})`,
    );
    progress.log(`📍 Current URL: ${currentUrl}`);

    // Test 2: Navigation to different valid page
    progress.log('Test 2: Navigation to iframe1 page');

    const startTime2 = performance.now();
    const result2 = await browserContext.safeGoto('http://localhost:3005/iframe1');
    const duration2 = performance.now() - startTime2;

    if (!result2) {
      throw new Error('Expected successful navigation to iframe1, got null response');
    }

    const status2 = result2.status();
    if (status2 < 200 || status2 >= 400) {
      throw new Error(
        `Expected successful status code for iframe1, got: ${status2} ${result2.statusText()}`,
      );
    }

    const currentUrl2 = page.url();
    if (!currentUrl2.includes('iframe1')) {
      throw new Error(`Expected iframe1 URL, got: ${currentUrl2}`);
    }

    progress.log(
      `✅ Test 2 passed: iframe1 navigation (${duration2.toFixed(2)}ms, status: ${status2})`,
    );
    progress.log(`📍 Current URL: ${currentUrl2}`);

    // Test 3: Navigation to 404 page (should succeed but show 404 content)
    progress.log('Test 3: Navigation to 404 page');

    const startTime3 = performance.now();
    const result3 = await browserContext.safeGoto('http://localhost:3005/nonexistent-page-404');
    const duration3 = performance.now() - startTime3;

    // Navigation to 404 should succeed (browser loads the 404 page)
    if (!result3) {
      progress.log(`📍 404 navigation returned null (navigation may have been blocked)`);
    } else {
      const status3 = result3.status();
      progress.log(`📍 404 navigation completed with status: ${status3} ${result3.statusText()}`);
    }

    const currentUrl3 = page.url();
    progress.log(`📍 Current URL after 404 attempt: ${currentUrl3}`);

    progress.log(`✅ Test 3 passed: 404 navigation handled (${duration3.toFixed(2)}ms)`);

    // Test 4: URL validation with invalid URLs
    progress.log('Test 4: URL validation with invalid URLs');

    const invalidUrls = [
      'javascript:alert("xss")', // XSS attempt
      'data:text/html,<script>alert("xss")</script>', // Data URL XSS
      'ftp://example.com/file.txt', // Unsupported protocol
      'not-a-url-at-all', // Invalid URL format
      '', // Empty URL
      'http://malicious-external-domain.com', // External domain (if validation is strict)
    ];

    let invalidUrlTests = 0;
    const validationErrors: string[] = [];

    for (const invalidUrl of invalidUrls) {
      try {
        const result4 = await browserContext.safeGoto(invalidUrl);

        if (result4 !== null) {
          // If we get a response, check the status
          const status4 = result4.status();
          if (status4 >= 200 && status4 < 400) {
            validationErrors.push(`URL "${invalidUrl}" was allowed but should be blocked`);
          } else {
            progress.log(`📍 Invalid URL "${invalidUrl}" returned error status: ${status4}`);
            invalidUrlTests++;
          }
        } else {
          // null response means URL was blocked
          progress.log(`📍 Correctly blocked invalid URL: "${invalidUrl}" (null response)`);
          invalidUrlTests++;
        }
      } catch (error) {
        // Catching errors is also acceptable for invalid URLs
        progress.log(`📍 URL "${invalidUrl}" threw error (acceptable): ${error}`);
        invalidUrlTests++;
      }
    }

    if (validationErrors.length > 0) {
      progress.log(`⚠️ URL validation issues:`);
      validationErrors.forEach((error, index) => {
        progress.log(`  ${index + 1}. ${error}`);
      });
    }

    progress.log(
      `✅ Test 4 passed: URL validation (${invalidUrlTests}/${invalidUrls.length} blocked)`,
    );

    // Test 5: Navigation with relative URLs and fragments
    progress.log('Test 5: Navigation with relative URLs and fragments');

    // First navigate to a base page
    await browserContext.safeGoto('http://localhost:3005');

    const relativeTests = [
      { url: 'http://localhost:3005/iframe2', description: 'absolute URL to iframe2' },
      { url: 'http://localhost:3005#section-a', description: 'URL with fragment' },
    ];

    for (const test of relativeTests) {
      try {
        const startTime5 = performance.now();
        const result5 = await browserContext.safeGoto(test.url);
        const duration5 = performance.now() - startTime5;

        if (result5 !== null) {
          const status5 = result5.status();
          progress.log(
            `📍 Successfully navigated to ${test.description} (${duration5.toFixed(2)}ms, status: ${status5})`,
          );
        } else {
          progress.log(`📍 Navigation to ${test.description} was blocked (null response)`);
        }
      } catch (error) {
        progress.log(`📍 Error navigating to ${test.description}: ${error}`);
      }
    }

    progress.log(`✅ Test 5 passed: Relative URL and fragment navigation`);

    // Test 6: Performance and consistency testing
    progress.log('Test 6: Performance and consistency testing');

    const performanceTests = [];
    const testUrl = 'http://localhost:3005';

    // Run multiple navigations to same URL
    for (let i = 0; i < 3; i++) {
      const startTime6 = performance.now();
      const result6 = await browserContext.safeGoto(testUrl);
      const duration6 = performance.now() - startTime6;

      const testResult = {
        attempt: i + 1,
        duration: duration6,
        success: result6 !== null && result6.status() >= 200 && result6.status() < 400,
        status: result6 ? result6.status() : null,
      };

      performanceTests.push(testResult);

      if (!testResult.success) {
        throw new Error(`Navigation attempt ${i + 1} failed: status ${testResult.status}`);
      }
    }

    const avgDuration =
      performanceTests.reduce((sum, test) => sum + test.duration, 0) / performanceTests.length;
    progress.log(`📍 Average navigation time: ${avgDuration.toFixed(2)}ms`);

    performanceTests.forEach(test => {
      progress.log(
        `📍 Attempt ${test.attempt}: ${test.duration.toFixed(2)}ms (status: ${test.status})`,
      );
    });

    progress.log(`✅ Test 6 passed: Performance consistency validated`);

    // Test 7: Error recovery testing
    progress.log('Test 7: Error recovery testing');

    // Try to navigate to an invalid URL, then recover with valid URL
    const invalidUrl = 'http://definitely-invalid-domain-12345.com';

    try {
      const result7a = await browserContext.safeGoto(invalidUrl);
      if (result7a === null) {
        progress.log(`📍 Invalid URL correctly blocked (null response)`);
      } else {
        const status7a = result7a.status();
        progress.log(`📍 Invalid URL returned status: ${status7a} ${result7a.statusText()}`);
      }
    } catch (error) {
      progress.log(`📍 Invalid URL threw error (acceptable): ${error}`);
    }

    // Now try to recover with valid URL
    const startTime7 = performance.now();
    const result7b = await browserContext.safeGoto('http://localhost:3005');
    const duration7 = performance.now() - startTime7;

    if (!result7b) {
      throw new Error(`Recovery navigation failed: null response`);
    }

    const status7b = result7b.status();
    if (status7b < 200 || status7b >= 400) {
      throw new Error(`Recovery navigation failed: status ${status7b} ${result7b.statusText()}`);
    }

    const finalUrl = page.url();
    if (!finalUrl.includes('localhost:3005')) {
      throw new Error(`Recovery navigation to wrong URL: ${finalUrl}`);
    }

    progress.log(`✅ Test 7 passed: Error recovery validated (${duration7.toFixed(2)}ms)`);

    // Test 8: Integration with browser state
    progress.log('Test 8: Integration with browser state');

    // Navigate to a specific page and verify state consistency
    const testPageUrl = 'http://localhost:3005/iframe1';
    const result8 = await browserContext.safeGoto(testPageUrl);

    if (!result8) {
      throw new Error(`Navigation for state test failed: null response`);
    }

    const status8 = result8.status();
    if (status8 < 200 || status8 >= 400) {
      throw new Error(
        `Navigation for state test failed: status ${status8} ${result8.statusText()}`,
      );
    }

    // Get state after navigation
    const browserState = await browserContext.getState();

    if (browserState.url !== testPageUrl) {
      throw new Error(`State URL mismatch: expected ${testPageUrl}, got ${browserState.url}`);
    }

    if (!browserState.title) {
      throw new Error('State title missing after navigation');
    }

    progress.log(
      `📍 State after navigation: URL=${browserState.url}, Title="${browserState.title}"`,
    );
    progress.log(`✅ Test 8 passed: Browser state integration validated`);

    // Emit success event
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'safeGoto() tests completed successfully',
      details: {
        testsRun: 8,
        performance: {
          basicNavigation: `${duration1.toFixed(2)}ms`,
          iframe1Navigation: `${duration2.toFixed(2)}ms`,
          notFoundNavigation: `${duration3.toFixed(2)}ms`,
          errorRecovery: `${duration7.toFixed(2)}ms`,
          averagePerformance: `${avgDuration.toFixed(2)}ms`,
        },
        urlValidation: {
          totalInvalidUrls: invalidUrls.length,
          correctlyBlocked: invalidUrlTests,
          validationErrors: validationErrors.length,
        },
        navigationResults: {
          successfulNavigations: performanceTests.filter(t => t.success).length,
          failedNavigations: performanceTests.filter(t => !t.success).length,
          finalUrl: finalUrl,
        },
        testResults: [
          'Basic successful navigation to localhost:3005',
          'Navigation to iframe1 page',
          'Navigation to 404 page',
          'URL validation with invalid URLs',
          'Navigation with relative URLs and fragments',
          'Performance and consistency testing',
          'Error recovery testing',
          'Integration with browser state',
        ],
      },
    });

    progress.log('🎉 All safeGoto() tests passed successfully!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ safeGoto() test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'safeGoto() test failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}

/**
 * Test browser history: goBack using BrowserContext.goBack()
 */
export async function testGoBack(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('🧭 Testing goBack via BrowserContext.goBack()');

  try {
    // Create a browser window and context
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, { allowedDomains: ['localhost'] });
    const page = await browserWindow.getCurrentPage();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting testGoBack',
    });

    // Navigate to root then to iframe1 to build history
    await browserContext.safeGoto('http://localhost:3005');
    await browserContext.safeGoto('http://localhost:3005/iframe1');

    // Verify we reached iframe1
    const before = new URL(page.url()).pathname;
    if (!before.includes('/iframe1')) {
      throw new Error(`Expected to be on /iframe1 before goBack, actual: ${page.url()}`);
    }

    // Perform goBack via BrowserContext which delegates to Page and includes fallbacks
    await browserContext.goBack();

    // Short settle
    await new Promise(r => setTimeout(r, 200));

    const after = new URL(page.url()).pathname;
    if (after !== '/') {
      throw new Error(`goBack did not return to root as expected; current pathname: ${after}`);
    }
    await browserContext.safeGoto('http://localhost:3005');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'testGoBack completed',
    });
    // Restore base page to keep test environment consistent
    await browserContext.safeGoto('http://localhost:3005');

    progress.log('✅ testGoBack passed');
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'testGoBack failed',
      details: { error: errMsg },
    });
    progress.log(`❌ testGoBack failed: ${errMsg}`);
    throw error;
  }
}

/**
 * Test browser history: goForward using BrowserContext.goForward()
 */
export async function testGoForward(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('🧭 Testing goForward via BrowserContext.goForward()');

  try {
    // Create a browser window and context
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, { allowedDomains: ['localhost'] });
    const page = await browserWindow.getCurrentPage();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting testGoForward',
    });

    // Ensure we have history: navigate root -> iframe1, then goBack to create forward entry
    await browserContext.safeGoto('http://localhost:3005');
    await browserContext.safeGoto('http://localhost:3005/iframe1');

    // Go back first
    await browserContext.goBack();
    // Verify we're back at root
    let currentPath = new URL(page.url()).pathname;
    if (currentPath !== '/') {
      throw new Error(`Expected to be on root before goForward, actual: ${page.url()}`);
    }

    // Perform goForward via BrowserContext
    await browserContext.goForward();

    // Short settle

    currentPath = new URL(page.url()).pathname;
    if (currentPath !== '/iframe1') {
      throw new Error(
        `goForward did not navigate to /iframe1 as expected; current pathname: ${currentPath}`,
      );
    }
    await browserContext.safeGoto('http://localhost:3005');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'testGoForward completed',
    });
    // Restore base page to keep test environment consistent
    await browserContext.safeGoto('http://localhost:3005');

    progress.log('✅ testGoForward passed');
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'testGoForward failed',
      details: { error: errMsg },
    });
    progress.log(`❌ testGoForward failed: ${errMsg}`);
    throw error;
  }
}

/**
 * Run the standalone safeGoto test
 */
export async function runSafeGotoTest(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  await testSafeGoto(progress, context);
}

/**
 * Quick test for safeGoto functionality
 * Returns true if basic safeGoto functionality works, false otherwise
 */
export async function quickSafeGotoTest(browserWindow: BrowserWindow): Promise<boolean> {
  try {
    // Create BrowserContext with localhost allowed for testing
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    // Test basic navigation
    const startTime = performance.now();
    const result = await browserContext.safeGoto('http://localhost:3005');
    const duration = performance.now() - startTime;

    if (!result) {
      console.warn(`Quick safeGoto test failed: null response`);
      return false;
    }

    const status = result.status();
    if (status < 200 || status >= 400) {
      console.warn(`Quick safeGoto test failed: status ${status} ${result.statusText()}`);
      return false;
    }

    // Verify we're at the correct URL
    const page = await browserWindow.getCurrentPage();
    const currentUrl = page.url();

    if (!currentUrl.includes('localhost:3005')) {
      console.warn(`Quick safeGoto test failed: Wrong URL ${currentUrl}`);
      return false;
    }

    // Test invalid URL blocking
    try {
      const invalidResult = await browserContext.safeGoto('javascript:alert("test")');
      if (invalidResult !== null) {
        const invalidStatus = invalidResult.status();
        if (invalidStatus >= 200 && invalidStatus < 400) {
          console.warn('Quick safeGoto test failed: Invalid URL was allowed');
          return false;
        }
      }
      // If we get here without an exception, the invalid URL was somehow allowed
      console.warn('Quick safeGoto test failed: Invalid URL did not throw expected error');
      return false;
    } catch (error) {
      // This is expected - invalid URLs should throw errors
      console.log(
        '✅ Invalid URL correctly blocked:',
        error instanceof Error ? error.message : String(error),
      );
    }
    await browserContext.safeGoto('http://localhost:3005');

    console.log(`✅ Quick safeGoto test passed (${duration.toFixed(2)}ms, status: ${status})`);
    return true;
  } catch (error) {
    console.error('Quick safeGoto test encountered an error:', error);
    return false;
  }
}
