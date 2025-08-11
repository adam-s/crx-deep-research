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
class TestProgress {
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
      'https://example.com',
      'https://google.com',
      'https://github.com',
      'http://localhost:3000',
      'https://subdomain.example.com',
      'https://api.github.com/repos',
      'https://www.google.com/search?q=test',
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
      allowedDomains: ['example.com', 'github.com', 'localhost'],
    });

    // Test URLs that should be allowed
    const allowedUrls = [
      'https://example.com',
      'https://www.example.com', // subdomain should be allowed
      'https://api.example.com', // subdomain should be allowed
      'https://github.com',
      'https://api.github.com', // subdomain should be allowed
      'http://localhost:3000', // localhost with port
      'https://localhost', // localhost without port
    ];

    // Test URLs that should be rejected
    const rejectedUrls = [
      'https://google.com', // not in allowed list
      'https://stackoverflow.com', // not in allowed list
      'https://badexample.com', // contains 'example.com' but not a subdomain
      'https://notgithub.com', // contains 'github.com' but not a subdomain
      'https://example.net', // different TLD
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
      allowedDomains: ['example.com', 'test-site.org'],
    });

    // Test edge cases
    const edgeCaseTests = [
      // URLs with ports
      { url: 'https://example.com:8080/path', expected: true, description: 'URL with port' },
      { url: 'http://example.com:3000', expected: true, description: 'HTTP URL with port' },

      // URLs with paths and query parameters
      {
        url: 'https://example.com/api/v1/users?page=1',
        expected: true,
        description: 'URL with path and query',
      },
      {
        url: 'https://api.example.com/graphql',
        expected: true,
        description: 'Subdomain with path',
      },

      // URLs with special characters
      {
        url: 'https://example.com/search?q=hello%20world',
        expected: true,
        description: 'URL with encoded characters',
      },

      // Case sensitivity tests
      { url: 'https://EXAMPLE.COM', expected: true, description: 'Uppercase domain' },
      { url: 'https://Example.Com/Path', expected: true, description: 'Mixed case domain' },

      // Subdomain variations
      {
        url: 'https://deep.nested.example.com',
        expected: true,
        description: 'Deep nested subdomain',
      },
      { url: 'https://sub.test-site.org', expected: true, description: 'Subdomain with hyphen' },

      // Invalid or malformed URLs should return false
      { url: 'not-a-url', expected: false, description: 'Invalid URL format' },
      {
        url: 'ftp://example.com',
        expected: true,
        description: 'FTP protocol (should work if domain matches)',
      },

      // URLs that should be rejected
      { url: 'https://malicious.com', expected: false, description: 'Unallowed domain' },
      {
        url: 'https://examplefake.com',
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
      'https://example.com',
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
    const test1 = contextNoConfig._isUrlAllowed('https://example.com');

    // Test 2: With allowed domains
    const contextWithConfig = new BrowserContext(browserWindow, {
      allowedDomains: ['example.com'],
    });
    const test2 = contextWithConfig._isUrlAllowed('https://example.com'); // Should be allowed
    const test3 = contextWithConfig._isUrlAllowed('https://google.com'); // Should be rejected

    // Test 3: Subdomain test
    const test4 = contextWithConfig._isUrlAllowed('https://api.example.com'); // Should be allowed

    await contextNoConfig.close();
    await contextWithConfig.close();

    const success = test1 === true && test2 === true && test3 === false && test4 === true;

    console.log(`Quick _isUrlAllowed test: ${success ? 'PASSED' : 'FAILED'}`);
    console.log(
      `Results: noConfig=${test1}, allowed=${test2}, rejected=${test3}, subdomain=${test4}`,
    );

    return success;
  } catch (error) {
    console.error('Quick _isUrlAllowed test failed:', error);
    return false;
  }
}
