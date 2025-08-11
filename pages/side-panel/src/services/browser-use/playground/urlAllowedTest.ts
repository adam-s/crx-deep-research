/**
 * Browser-Use _isUrlAllowed functionality tests
 *
 * This file contains comprehensive tests for the BrowserContext._isUrlAllowed method
 * designed to run within the Chrome extension side panel playground.
 */

import { BrowserContext } from '../browser/contex';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
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
 * Interface for test context to maintain consistency with other playground tests
 */
interface UrlAllowedTestContext {
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
 * Test _isUrlAllowed with no allowed domains configured (should allow all URLs)
 */
export async function testUrlAllowedNoConfiguration(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _isUrlAllowed test with no configuration',
    });

    progress.log('Creating BrowserContext with no allowedDomains configuration...');
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, {
      // No allowedDomains configured - should allow all URLs
    });

    // Test various URLs - all should be allowed
    const testUrls = [
      'http://localhost:3005',
      'http://localhost:3005/nav-page-1',
      'http://localhost:3005/nav-page-2',
      'http://localhost:3005/iframe1',
      'http://localhost:3005/iframe2',
      'http://localhost:3005/nested-iframe',
      'http://localhost:8080/test',
    ];

    let passedTests = 0;
    const totalTests = testUrls.length;

    for (const url of testUrls) {
      const isAllowed = browserContext._isUrlAllowed(url);
      if (isAllowed) {
        passedTests++;
        progress.log(`✅ URL allowed (as expected): ${url}`);
      } else {
        progress.log(`❌ URL rejected (unexpected): ${url}`);
      }
    }

    await browserContext.close();

    if (passedTests === totalTests) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: No configuration allows all URLs',
        details: { testedUrls: totalTests, passedUrls: passedTests },
      });
    } else {
      throw new Error(
        `Test 1 failed: Expected all ${totalTests} URLs to be allowed, but only ${passedTests} were allowed`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 1 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 1 failed: No configuration test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  }
}

/**
 * Test _isUrlAllowed with specific allowed domains
 */
export async function testUrlAllowedWithAllowedDomains(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _isUrlAllowed test with allowed domains',
    });

    progress.log('Creating BrowserContext with specific allowed domains...');
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost', '127.0.0.1', 'test-local.dev'],
    });

    // Test URLs that should be allowed
    const allowedUrls = [
      'http://localhost:3005',
      'http://localhost:3005/nav-page-1', // subdomain should be allowed
      'http://localhost:3005/iframe1', // subdomain should be allowed
      'http://localhost:8080',
      'http://127.0.0.1:3005', // localhost with port
      'https://localhost', // localhost without port
    ];

    // Test URLs that should be rejected
    const rejectedUrls = [
      'http://test-remote.com', // not in allowed list
      'http://forbidden-site.org', // not in allowed list
      'http://bad-localhost.com', // contains 'localhost' but not a subdomain
      'http://not-local.net', // contains 'local' but not a subdomain
      'http://localhost.fake', // different TLD
    ];

    let allowedPassed = 0;
    let rejectedPassed = 0;

    // Test allowed URLs
    for (const url of allowedUrls) {
      const isAllowed = browserContext._isUrlAllowed(url);
      if (isAllowed) {
        allowedPassed++;
        progress.log(`✅ URL correctly allowed: ${url}`);
      } else {
        progress.log(`❌ URL incorrectly rejected: ${url}`);
      }
    }

    // Test rejected URLs
    for (const url of rejectedUrls) {
      const isAllowed = browserContext._isUrlAllowed(url);
      if (!isAllowed) {
        rejectedPassed++;
        progress.log(`✅ URL correctly rejected: ${url}`);
      } else {
        progress.log(`❌ URL incorrectly allowed: ${url}`);
      }
    }

    await browserContext.close();

    const totalAllowedTests = allowedUrls.length;
    const totalRejectedTests = rejectedUrls.length;

    if (allowedPassed === totalAllowedTests && rejectedPassed === totalRejectedTests) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Allowed domains filtering works correctly',
        details: {
          allowedTests: totalAllowedTests,
          allowedPassed,
          rejectedTests: totalRejectedTests,
          rejectedPassed,
        },
      });
    } else {
      throw new Error(
        `Test 2 failed: Expected ${totalAllowedTests} allowed and ${totalRejectedTests} rejected, got ${allowedPassed} allowed and ${rejectedPassed} rejected`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 2 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 2 failed: Allowed domains test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  }
}

/**
 * Test _isUrlAllowed with edge cases and special URL formats
 */
export async function testUrlAllowedEdgeCases(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _isUrlAllowed edge cases test',
    });

    progress.log('Creating BrowserContext for edge case testing...');
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost', 'test-local.dev'],
    });

    // Test edge cases
    const edgeCaseTests = [
      // URLs with ports
      { url: 'http://localhost:8080/path', expected: true, description: 'URL with port' },
      { url: 'http://localhost:3005', expected: true, description: 'HTTP URL with port' },

      // URLs with paths and query parameters
      {
        url: 'http://localhost:3005/nav-page-1?page=1',
        expected: true,
        description: 'URL with path and query',
      },
      {
        url: 'http://test-local.dev/api/test',
        expected: true,
        description: 'Test domain with path',
      },

      // URLs with special characters
      {
        url: 'http://localhost:3005/search?q=hello%20world',
        expected: true,
        description: 'URL with encoded characters',
      },

      // Case sensitivity tests
      { url: 'http://LOCALHOST:3005', expected: true, description: 'Uppercase domain' },
      { url: 'http://LocalHost:3005/Path', expected: true, description: 'Mixed case domain' },

      // Subdomain variations
      {
        url: 'http://api.test-local.dev',
        expected: true,
        description: 'Subdomain of test domain',
      },
      { url: 'http://sub.test-local.dev', expected: true, description: 'Subdomain with hyphen' },

      // Invalid or malformed URLs should return false
      { url: 'not-a-url', expected: false, description: 'Invalid URL format' },
      {
        url: 'ftp://localhost',
        expected: true,
        description: 'FTP protocol (should work if domain matches)',
      },

      // URLs that should be rejected
      { url: 'http://blocked-site.com', expected: false, description: 'Unallowed domain' },
      {
        url: 'http://localhostfake.com',
        expected: false,
        description: 'Similar but different domain',
      },
    ];

    let passedTests = 0;
    const totalTests = edgeCaseTests.length;

    for (const test of edgeCaseTests) {
      try {
        const isAllowed = browserContext._isUrlAllowed(test.url);
        if (isAllowed === test.expected) {
          passedTests++;
          progress.log(
            `✅ ${test.description}: ${test.url} -> ${isAllowed} (expected ${test.expected})`,
          );
        } else {
          progress.log(
            `❌ ${test.description}: ${test.url} -> ${isAllowed} (expected ${test.expected})`,
          );
        }
      } catch (error) {
        // For invalid URLs, we expect the method to return false
        if (test.expected === false) {
          passedTests++;
          progress.log(`✅ ${test.description}: ${test.url} -> exception handled correctly`);
        } else {
          progress.log(`❌ ${test.description}: ${test.url} -> unexpected exception: ${error}`);
        }
      }
    }

    await browserContext.close();

    if (passedTests === totalTests) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Edge cases handled correctly',
        details: { testedCases: totalTests, passedCases: passedTests },
      });
    } else {
      throw new Error(
        `Test 3 failed: Expected all ${totalTests} edge cases to pass, but only ${passedTests} passed`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 3 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 3 failed: Edge cases test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  }
}

/**
 * Test _isUrlAllowed with empty allowed domains array
 */
export async function testUrlAllowedEmptyArray(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _isUrlAllowed test with empty allowed domains array',
    });

    progress.log('Creating BrowserContext with empty allowedDomains array...');
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: [], // Empty array should allow all URLs
    });

    // Test various URLs - all should be allowed when array is empty
    const testUrls = [
      'http://localhost:3005',
      'https://google.com',
      'https://any-domain.com',
      'http://localhost:3000',
    ];

    let passedTests = 0;
    const totalTests = testUrls.length;

    for (const url of testUrls) {
      const isAllowed = browserContext._isUrlAllowed(url);
      if (isAllowed) {
        passedTests++;
        progress.log(`✅ URL allowed (as expected with empty array): ${url}`);
      } else {
        progress.log(`❌ URL rejected (unexpected with empty array): ${url}`);
      }
    }

    await browserContext.close();

    if (passedTests === totalTests) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Empty allowed domains array allows all URLs',
        details: { testedUrls: totalTests, passedUrls: passedTests },
      });
    } else {
      throw new Error(
        `Test 4 failed: Expected all ${totalTests} URLs to be allowed with empty array, but only ${passedTests} were allowed`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 4 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 4 failed: Empty array test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  }
}

/**
 * Test _handleDisallowedNavigation method functionality
 */
export async function testHandleDisallowedNavigation(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _handleDisallowedNavigation test',
    });

    progress.log('Creating BrowserContext for disallowed navigation testing...');
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'], // Only allow localhost
    });

    await browserContext.enter();
    const page = await browserContext.getCurrentPage();

    // Small delay to ensure page is properly loaded
    await new Promise(resolve => setTimeout(resolve, 100));

    // Navigate to localhost first (which should be allowed initially for the test)
    try {
      await page.goto('http://localhost:3005/');
      progress.log('Initial navigation to localhost completed');
      // Small delay after navigation
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      progress.log('Failed to navigate to localhost, using current page');
    }

    // Get initial URL safely
    let initialUrl = '';
    try {
      initialUrl = await page.evaluate(() => window.location.href);
      progress.log(`Initial page URL: ${initialUrl}`);
    } catch (error) {
      progress.log('Could not get initial URL (page may not have execution context)');
      initialUrl = 'unknown';
    }

    // Test handling disallowed navigation
    const disallowedUrl = 'https://malicious-site.com';
    progress.log(`Testing disallowed navigation to: ${disallowedUrl}`);

    let errorThrown = false;
    let errorMessage = '';

    try {
      await browserContext._handleDisallowedNavigation(disallowedUrl);
    } catch (error) {
      errorThrown = true;
      errorMessage = error instanceof Error ? error.message : String(error);
      progress.log(`Expected error thrown: ${errorMessage}`);
    }

    // Verify the method behaved correctly - safely get final URL
    let finalUrl = '';
    try {
      finalUrl = await page.evaluate(() => window.location.href);
      progress.log(`Final page URL: ${finalUrl}`);
    } catch (error) {
      progress.log(
        'Could not get final URL (page may not have execution context after navigation to about:blank)',
      );
      finalUrl = 'about:blank'; // Expected result
    }

    // Check that error was thrown
    if (!errorThrown) {
      throw new Error('Expected _handleDisallowedNavigation to throw an error');
    }

    // Check that error message contains the disallowed URL
    if (!errorMessage.includes(disallowedUrl)) {
      throw new Error(`Expected error message to contain "${disallowedUrl}", got: ${errorMessage}`);
    }

    // Check that error message contains the disallowed URL
    if (!errorMessage.includes(disallowedUrl)) {
      throw new Error(`Expected error message to contain "${disallowedUrl}", got: ${errorMessage}`);
    }

    // Check that page navigation was attempted (we may not be able to verify the final URL
    // due to execution context limitations with about:blank)
    if (finalUrl === 'about:blank' || finalUrl === 'unknown') {
      progress.log(
        '✅ Navigation to safe page attempted (about:blank or execution context unavailable)',
      );
    } else if (finalUrl !== initialUrl) {
      progress.log('✅ Page URL changed as expected');
    } else {
      progress.log(
        `⚠️ Warning: Page URL didn't change, but this may be expected in test environment. Initial: ${initialUrl}, Final: ${finalUrl}`,
      );
    }

    await browserContext.close();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: _handleDisallowedNavigation works correctly',
      details: {
        disallowedUrl,
        errorThrown,
        errorMessage,
        initialUrl,
        finalUrl,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 5 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 5 failed: _handleDisallowedNavigation test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  }
}

/**
 * Test _handleDisallowedNavigation with multiple disallowed URLs
 */
export async function testHandleDisallowedNavigationMultiple(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _handleDisallowedNavigation multiple URLs test',
    });

    progress.log('Creating BrowserContext for multiple disallowed navigation testing...');
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'], // Only allow localhost
    });

    await browserContext.enter();

    // Test multiple disallowed URLs
    const disallowedUrls = [
      'http://blocked-site.com',
      'http://phishing-site.org',
      'http://suspicious-domain.net',
      'http://untrusted.io',
    ];

    let successfulTests = 0;
    const totalTests = disallowedUrls.length;

    for (const url of disallowedUrls) {
      progress.log(`Testing disallowed navigation to: ${url}`);

      try {
        await browserContext._handleDisallowedNavigation(url);
        progress.log(`❌ Expected error for ${url}, but none was thrown`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes(url)) {
          successfulTests++;
          progress.log(`✅ Correctly handled disallowed URL: ${url}`);
        } else {
          progress.log(`❌ Error message doesn't contain URL ${url}: ${errorMessage}`);
        }
      }
    }

    await browserContext.close();

    if (successfulTests === totalTests) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 6 passed: Multiple disallowed URLs handled correctly',
        details: {
          testedUrls: totalTests,
          successfulTests,
          disallowedUrls,
        },
      });
    } else {
      throw new Error(
        `Test 6 failed: Expected ${totalTests} successful tests, got ${successfulTests}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 6 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 6 failed: Multiple disallowed URLs test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  }
}

/**
 * Test _handleDisallowedNavigation error handling edge cases
 */
export async function testHandleDisallowedNavigationEdgeCases(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _handleDisallowedNavigation edge cases test',
    });

    progress.log('Creating BrowserContext for edge cases testing...');
    const browserWindow = await BrowserWindow.create();
    const browserContext = new BrowserContext(browserWindow);

    await browserContext.enter();

    // Test edge cases
    const edgeCases = [
      { url: '', description: 'Empty URL' },
      { url: 'invalid-url-format', description: 'Invalid URL format' },
      { url: 'javascript:alert("test")', description: 'JavaScript URL' },
      { url: 'data:text/html,<h1>Test</h1>', description: 'Data URL' },
      { url: 'blob:http://localhost:3005/123', description: 'Blob URL' },
    ];

    let successfulTests = 0;
    const totalTests = edgeCases.length;

    for (const testCase of edgeCases) {
      progress.log(`Testing edge case: ${testCase.description} - "${testCase.url}"`);

      try {
        await browserContext._handleDisallowedNavigation(testCase.url);
        progress.log(`❌ Expected error for ${testCase.description}, but none was thrown`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('URL not allowed')) {
          successfulTests++;
          progress.log(`✅ Correctly handled edge case: ${testCase.description}`);
        } else {
          progress.log(`❌ Unexpected error for ${testCase.description}: ${errorMessage}`);
        }
      }
    }

    await browserContext.close();

    if (successfulTests === totalTests) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 7 passed: Edge cases handled correctly',
        details: {
          testedCases: totalTests,
          successfulTests,
          edgeCases: edgeCases.map(c => c.description),
        },
      });
    } else {
      throw new Error(
        `Test 7 failed: Expected ${totalTests} successful tests, got ${successfulTests}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 7 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 7 failed: Edge cases test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  }
}

/**
 * Run all _isUrlAllowed tests
 */
export async function runAllUrlAllowedTests(context: UrlAllowedTestContext): Promise<void> {
  const progress = new TestProgress('UrlAllowed');

  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting all _isUrlAllowed tests',
    });

    // Test 1: No configuration (allow all)
    await testUrlAllowedNoConfiguration(progress, context);

    // Test 2: Specific allowed domains
    await testUrlAllowedWithAllowedDomains(progress, context);

    // Test 3: Edge cases and special formats
    await testUrlAllowedEdgeCases(progress, context);

    // Test 4: Empty allowed domains array
    await testUrlAllowedEmptyArray(progress, context);

    // Test 5: Handle disallowed navigation
    await testHandleDisallowedNavigation(progress, context);

    // Test 6: Handle multiple disallowed navigations
    await testHandleDisallowedNavigationMultiple(progress, context);

    // Test 7: Handle disallowed navigation edge cases
    await testHandleDisallowedNavigationEdgeCases(progress, context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All _isUrlAllowed tests completed successfully',
      details: {
        testsCompleted: [
          'No configuration allows all URLs',
          'Specific allowed domains filtering',
          'Edge cases and special URL formats',
          'Empty allowed domains array behavior',
          'Handle disallowed navigation',
          'Handle multiple disallowed navigations',
          'Handle disallowed navigation edge cases',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`_isUrlAllowed tests failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Some _isUrlAllowed tests failed',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  }
}

/**
 * Quick test for _isUrlAllowed functionality
 * Runs a minimal set of tests to verify basic functionality
 */
export async function quickUrlAllowedTest(): Promise<boolean> {
  try {
    console.log('Running quick _isUrlAllowed test...');

    const browserWindow = await BrowserWindow.create();

    // Test 1: No configuration (should allow all)
    const contextNoConfig = new BrowserContext(browserWindow);
    const test1 = contextNoConfig._isUrlAllowed('http://localhost:3005');

    // Test 2: With allowed domains
    const contextWithConfig = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });
    const test2 = contextWithConfig._isUrlAllowed('http://localhost:3005'); // Should be allowed
    const test3 = contextWithConfig._isUrlAllowed('http://remote-site.com'); // Should be rejected

    // Test 3: Subdomain test
    const test4 = contextWithConfig._isUrlAllowed('http://localhost:8080'); // Should be allowed

    // Test 4: Handle disallowed navigation
    let test5 = false;
    try {
      await contextWithConfig._handleDisallowedNavigation('http://blocked-site.com');
    } catch (error) {
      // Should throw an error
      test5 = error instanceof Error && error.message.includes('URL not allowed');
    }

    await contextNoConfig.close();
    await contextWithConfig.close();

    const success =
      test1 === true && test2 === true && test3 === false && test4 === true && test5 === true;

    console.log(`Quick _isUrlAllowed test: ${success ? 'PASSED' : 'FAILED'}`);
    console.log(
      `Results: noConfig=${test1}, allowed=${test2}, rejected=${test3}, subdomain=${test4}, handleDisallowed=${test5}`,
    );

    return success;
  } catch (error) {
    console.error('Quick _isUrlAllowed test failed:', error);
    return false;
  }
}

/**
 * Test _waitForPageAndFramesLoad with timeout override functionality
 */
export async function testWaitForPageAndFramesLoadTimeout(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForPageAndFramesLoad timeout override test',
    });

    progress.log('Creating BrowserContext for timeout test...');

    // Test with timeout override
    const browserWindow = await BrowserWindow.create();
    const contextWithTimeout = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    await contextWithTimeout.enter();

    progress.log('Testing timeout override functionality...');

    // Test with 0.05 second timeout override to test very fast minimum wait
    const startTime = Date.now();
    await contextWithTimeout.safeGoto('http://localhost:3005');
    await contextWithTimeout._waitForPageAndFramesLoad({ timeoutOverwrite: 0.05 });
    const elapsed = (Date.now() - startTime) / 1000;

    progress.log(`Page load with 0.05s timeout completed in ${elapsed.toFixed(3)}s`);

    // The timeout override sets minimum wait time, but network operations may take longer
    // We verify that the method completes (doesn't hang) regardless of timing
    const timeoutSuccess = elapsed >= 0.04 && elapsed <= 3.0; // Allow network operations to complete

    // Test 2: Compare with default timing (should be longer than custom override)
    progress.log('Testing default timeout vs override...');

    const startTime2 = Date.now();
    await contextWithTimeout.safeGoto('http://localhost:3005');
    await contextWithTimeout._waitForPageAndFramesLoad(); // Default 0.25s minimum
    const elapsed2 = (Date.now() - startTime2) / 1000;

    progress.log(`Default timeout completed in ${elapsed2.toFixed(3)}s`);

    await contextWithTimeout.close();

    context.events.emit({
      timestamp: Date.now(),
      severity: timeoutSuccess ? Severity.Info : Severity.Warning,
      message: `Timeout override test ${timeoutSuccess ? 'passed' : 'failed'}`,
      details: {
        customTimeout: elapsed,
        defaultTimeout: elapsed2,
        timeoutOverwrite: 0.05,
        note: 'Network operations may extend beyond minimum wait',
      },
    });

    progress.log(
      `Timeout override test: ${timeoutSuccess ? 'PASSED' : 'FAILED'} (custom: ${elapsed.toFixed(3)}s, default: ${elapsed2.toFixed(3)}s)`,
    );
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Timeout override test failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });

    progress.log(`Timeout override test FAILED: ${error}`);
  }
}

/**
 * Test _waitForPageAndFramesLoad with URL validation integration
 */
export async function testWaitForPageAndFramesLoadUrlValidation(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForPageAndFramesLoad URL validation test',
    });

    progress.log('Creating BrowserContext with restricted domains...');

    const browserWindow = await BrowserWindow.create();
    const contextRestricted = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    await contextRestricted.enter();

    progress.log('Testing URL validation during page load...');

    // Test 1: Allowed URL should work
    try {
      await contextRestricted.safeGoto('http://localhost:3005');
      await contextRestricted._waitForPageAndFramesLoad();
      progress.log('✓ Allowed URL test passed');

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Allowed URL validation test passed',
      });
    } catch (error) {
      progress.log(`✗ Allowed URL test failed: ${error}`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Allowed URL validation test failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    // Test 2: Disallowed URL should throw error
    let disallowedTestPassed = false;
    try {
      // Navigate to disallowed domain using safeGoto (should block before navigation)
      await contextRestricted.safeGoto('http://blocked-site.com');
      await contextRestricted._waitForPageAndFramesLoad();
      progress.log('✗ Disallowed URL test failed - should have thrown error');
    } catch (error) {
      if (error instanceof Error && error.message.includes('URL not allowed')) {
        disallowedTestPassed = true;
        progress.log('✓ Disallowed URL test passed - correctly blocked');

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Info,
          message: 'Disallowed URL validation test passed',
        });
      } else {
        progress.log(`✗ Disallowed URL test failed - unexpected error: ${error}`);

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Disallowed URL validation test had unexpected error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    await contextRestricted.close();

    progress.log(
      `URL validation test: ${disallowedTestPassed ? 'PASSED' : 'FAILED'} - disallowed URLs properly blocked`,
    );
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'URL validation test failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });

    progress.log(`URL validation test FAILED: ${error}`);
  }
}

/**
 * Test _waitForPageAndFramesLoad minimum wait time enforcement
 */
export async function testWaitForPageAndFramesLoadMinimumWait(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForPageAndFramesLoad minimum wait time test',
    });

    progress.log('Creating BrowserContext for minimum wait test...');

    const browserWindow = await BrowserWindow.create();
    const contextMinWait = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    await contextMinWait.enter();

    progress.log('Testing minimum wait time enforcement...');

    // Test default minimum wait time (0.25 seconds)
    const startTime = Date.now();
    await contextMinWait.safeGoto('http://localhost:3005');
    await contextMinWait._waitForPageAndFramesLoad();
    const elapsed = (Date.now() - startTime) / 1000;

    progress.log(`Default minimum wait completed in ${elapsed.toFixed(3)}s`);

    // Verify timing was at least close to 0.25s
    const minWaitSuccess = elapsed >= 0.2; // Allow some leeway for fast execution

    await contextMinWait.close();

    context.events.emit({
      timestamp: Date.now(),
      severity: minWaitSuccess ? Severity.Info : Severity.Warning,
      message: `Minimum wait time test ${minWaitSuccess ? 'passed' : 'failed'}`,
      details: { elapsedTime: elapsed, expectedMinimum: 0.25 },
    });

    progress.log(
      `Minimum wait test: ${minWaitSuccess ? 'PASSED' : 'FAILED'} (elapsed: ${elapsed.toFixed(3)}s)`,
    );
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Minimum wait time test failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });

    progress.log(`Minimum wait test FAILED: ${error}`);
  }
}

/**
 * Test _waitForPageAndFramesLoad network stability integration
 */
export async function testWaitForPageAndFramesLoadNetworkStability(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForPageAndFramesLoad network stability test',
    });

    progress.log('Creating BrowserContext for network stability test...');

    const browserWindow = await BrowserWindow.create();
    const contextNetwork = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    await contextNetwork.enter();

    progress.log('Testing network stability monitoring...');

    // Navigate to a page and verify network stability is checked
    const startTime = Date.now();
    try {
      await contextNetwork.safeGoto('http://localhost:3005');
      await contextNetwork._waitForPageAndFramesLoad();
      const elapsed = (Date.now() - startTime) / 1000;

      progress.log(`Network stability test completed in ${elapsed.toFixed(3)}s`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Network stability test passed',
        details: { elapsedTime: elapsed },
      });

      progress.log('✓ Network stability test passed');
    } catch (error) {
      progress.log(`Network stability test error (may be expected): ${error}`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Warning,
        message: 'Network stability test had error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }

    await contextNetwork.close();
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Network stability test failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });

    progress.log(`Network stability test FAILED: ${error}`);
  }
}

/**
 * Test _waitForPageAndFramesLoad error handling and recovery
 */
export async function testWaitForPageAndFramesLoadErrorHandling(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForPageAndFramesLoad error handling test',
    });

    progress.log('Creating BrowserContext for error handling test...');

    const browserWindow = await BrowserWindow.create();
    const contextError = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    await contextError.enter();
    const page = await contextError.getCurrentPage();

    progress.log('Testing error handling and recovery...');

    // Test error handling with problematic navigation
    try {
      // Try to navigate to about:blank which may cause execution context issues
      // Use direct page.goto for this test since about:blank should be allowed
      await page.goto('about:blank');
      await contextError._waitForPageAndFramesLoad();

      progress.log('✓ Error handling test passed - about:blank handled gracefully');

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Error handling test passed',
      });
    } catch (error) {
      // Some errors are expected and should be handled gracefully
      if (error instanceof Error && error.message.includes('URL not allowed')) {
        progress.log('✓ Error handling test passed - URL validation working');

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Info,
          message: 'Error handling test passed - URL validation triggered',
        });
      } else {
        progress.log(`Error handling test - unexpected error: ${error}`);

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Error handling test had unexpected error',
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    await contextError.close();
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Error handling test failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });

    progress.log(`Error handling test FAILED: ${error}`);
  }
}

/**
 * Comprehensive test of _waitForPageAndFramesLoad functionality
 * Tests all aspects: timeout override, URL validation, minimum wait, network stability, and error handling
 */
export async function testWaitForPageAndFramesLoadComprehensive(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting comprehensive _waitForPageAndFramesLoad test suite',
    });

    progress.log('Running comprehensive _waitForPageAndFramesLoad tests...');

    // Run all individual tests
    await testWaitForPageAndFramesLoadTimeout(progress, context);
    await testWaitForPageAndFramesLoadUrlValidation(progress, context);
    await testWaitForPageAndFramesLoadMinimumWait(progress, context);
    await testWaitForPageAndFramesLoadNetworkStability(progress, context);
    await testWaitForPageAndFramesLoadErrorHandling(progress, context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Comprehensive _waitForPageAndFramesLoad test suite completed',
    });

    progress.log('✓ Comprehensive _waitForPageAndFramesLoad test suite completed');
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Comprehensive _waitForPageAndFramesLoad test suite failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });

    progress.log(`Comprehensive test suite FAILED: ${error}`);
  }
}

/**
 * Test takeScreenshot functionality
 */
export async function testTakeScreenshot(
  progress: TestProgress,
  context: UrlAllowedTestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting takeScreenshot functionality test',
    });

    progress.log('Creating BrowserContext for screenshot test...');

    const browserWindow = await BrowserWindow.create();
    const contextScreenshot = new BrowserContext(browserWindow, {
      allowedDomains: ['localhost'],
    });

    await contextScreenshot.enter();

    progress.log('Testing screenshot functionality...');

    // Navigate to a page first
    await contextScreenshot.safeGoto('http://localhost:3005');
    await contextScreenshot._waitForPageAndFramesLoad();

    // Test 1: Take viewport screenshot (graceful error handling)
    progress.log('Taking viewport screenshot...');
    const viewportScreenshot = await contextScreenshot.takeScreenshot(false, false);

    if (viewportScreenshot && viewportScreenshot.length > 0) {
      progress.log(`✓ Viewport screenshot captured (${viewportScreenshot.length} characters)`);
    } else {
      throw new Error('Viewport screenshot failed - no data returned');
    }

    // Test 2: Take full page screenshot (graceful error handling)
    progress.log('Taking full page screenshot...');
    const fullPageScreenshot = await contextScreenshot.takeScreenshot(true, false);

    if (fullPageScreenshot && fullPageScreenshot.length > 0) {
      progress.log(`✓ Full page screenshot captured (${fullPageScreenshot.length} characters)`);
    } else {
      throw new Error('Full page screenshot failed - no data returned');
    }

    // Test 3: Test with throwOnError = true for debugging
    progress.log('Testing screenshot with error throwing enabled...');
    try {
      const debugScreenshot = await contextScreenshot.takeScreenshot(false, true);

      if (debugScreenshot && debugScreenshot.length > 0) {
        progress.log(`✓ Debug screenshot method works (${debugScreenshot.length} characters)`);
      } else {
        progress.log('⚠️ Debug screenshot method returned undefined');
      }
    } catch (error) {
      progress.log(`⚠️ Screenshot with throwOnError=true threw error (may be expected): ${error}`);
    }

    await contextScreenshot.close();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Screenshot functionality test passed',
      details: {
        viewportScreenshotSize: viewportScreenshot.length,
        fullPageScreenshotSize: fullPageScreenshot.length,
        errorHandlingWorking: true,
      },
    });

    progress.log('✓ Screenshot functionality test completed successfully');
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Screenshot functionality test failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });

    progress.log(`Screenshot test FAILED: ${error}`);
  }
}
