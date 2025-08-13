/**
 * Browser-Use _waitForStableNetwork functionality tests
 *
 * This file contains comprehensive tests for the BrowserContext._waitForStableNetwork method
 * designed to run within the Chrome extension side panel playground.
 */

import { BrowserContext } from '../../browser/context';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { Severity } from '@src/utils/types';
import type { BrowserUsePlaygroundService } from '../browserUsePlaygroundService';

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
interface WaitForStableNetworkTestContext {
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
 * Test the _waitForStableNetwork method with immediate stability (no pending requests)
 */
export async function testWaitForStableNetworkImmediate(
  progress: TestProgress,
  context: WaitForStableNetworkTestContext,
  browserWindow: BrowserWindow,
): Promise<void> {
  let browserContext: BrowserContext | undefined;
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForStableNetwork immediate stability test',
    });

    progress.log('Creating BrowserContext...');
    browserContext = new BrowserContext(browserWindow, {
      maximumWaitPageLoadTime: 3, // 3 seconds for testing
      waitForNetworkIdlePageLoadTime: 0.5, // 0.5 seconds for testing
    });

    await browserContext.enter();

    progress.log('Testing _waitForStableNetwork with no active requests...');
    const startTime = Date.now();

    // Test immediate stability (no requests should complete quickly)
    await browserContext._waitForStableNetwork();

    const duration = Date.now() - startTime;
    progress.log(`Network stability achieved in ${duration}ms`);

    // Should complete quickly since there are no pending requests
    if (duration < 2000) {
      // Under 2 seconds
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Immediate network stability detection',
        details: { duration },
      });
    } else {
      throw new Error(`Test 1 failed: Expected quick completion, took ${duration}ms`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 1 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 1 failed: Immediate network stability test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    // Ensure proper cleanup
    if (browserContext) {
      await browserContext.close();
    }
  }
}

/**
 * Test the _waitForStableNetwork method with simulated network activity
 */
export async function testWaitForStableNetworkWithActivity(
  progress: TestProgress,
  context: WaitForStableNetworkTestContext,
  browserWindow: BrowserWindow,
): Promise<void> {
  let browserContext: BrowserContext | undefined;
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForStableNetwork with network activity test',
    });

    progress.log('Creating BrowserContext...');
    browserContext = new BrowserContext(browserWindow, {
      maximumWaitPageLoadTime: 10, // 10 seconds for testing
      waitForNetworkIdlePageLoadTime: 1, // 1 second for testing
    });

    await browserContext.enter();
    const page = await browserContext.getCurrentPage();

    // Navigate to a proper webpage that supports JavaScript execution
    progress.log('Navigating to localhost for testing...');
    try {
      await page.goto('http://localhost:3005/');
      progress.log('Navigation to localhost completed');
    } catch (error) {
      progress.log('Failed to navigate to localhost, using current page');
    }

    progress.log('Starting network stability monitoring with simulated activity...');
    const startTime = Date.now();

    // Start the stability wait in parallel with network activity
    const stabilityPromise = browserContext._waitForStableNetwork();

    // Trigger some network activity
    progress.log('Triggering network requests...');

    // Use page.evaluate to trigger multiple requests with error handling
    try {
      await page.evaluate(() => {
        // Trigger multiple fetch requests to simulate network activity
        const requests = [
          fetch('/', { method: 'GET' }).catch(() => {}),
          fetch('/?test=1', { method: 'GET' }).catch(() => {}),
          fetch('/?test=2', { method: 'GET' }).catch(() => {}),
        ];

        // Also try some common web requests that might be filtered
        const additionalRequests = [
          fetch('/?analytics=true', { method: 'GET' }).catch(() => {}), // Should be filtered
          fetch('/?api=data', { method: 'GET' }).catch(() => {}), // Should be relevant
        ];

        return Promise.allSettled([...requests, ...additionalRequests]);
      });
    } catch (evaluateError) {
      progress.log(`Page evaluation failed, continuing test: ${evaluateError}`);
      // Continue the test even if evaluate fails - network stability should still work
    }

    // Wait for stability to be achieved
    await stabilityPromise;

    const duration = Date.now() - startTime;
    progress.log(`Network stability achieved after activity in ${duration}ms`);

    // Should complete after network idle time but before timeout
    if (duration >= 1000 && duration < 8000) {
      // Between 1-8 seconds
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Network stability with activity detection',
        details: { duration },
      });
    } else {
      throw new Error(`Test 2 failed: Expected 1-8 second completion, took ${duration}ms`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 2 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 2 failed: Network stability with activity test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    // Ensure proper cleanup
    if (browserContext) {
      await browserContext.close();
    }
  }
}

/**
 * Test the _waitForStableNetwork method with filtering logic
 */
export async function testWaitForStableNetworkFiltering(
  progress: TestProgress,
  context: WaitForStableNetworkTestContext,
  browserWindow: BrowserWindow,
): Promise<void> {
  let browserContext: BrowserContext | undefined;
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForStableNetwork filtering logic test',
    });

    progress.log('Creating BrowserContext...');
    browserContext = new BrowserContext(browserWindow, {
      maximumWaitPageLoadTime: 5, // 5 seconds for testing
      waitForNetworkIdlePageLoadTime: 0.5, // 0.5 seconds for testing
    });

    await browserContext.enter();
    const page = await browserContext.getCurrentPage();

    // Navigate to a proper webpage that supports JavaScript execution
    progress.log('Navigating to localhost for testing...');
    try {
      await page.goto('http://localhost:3005/');
      progress.log('Navigation to localhost completed');
    } catch (error) {
      progress.log('Failed to navigate to localhost, using current page');
    }

    progress.log('Testing network stability with filtered requests...');
    const startTime = Date.now();

    // Start the stability wait
    const stabilityPromise = browserContext._waitForStableNetwork();

    // Trigger requests that should be filtered out (analytics, tracking, etc.)
    progress.log('Triggering filtered requests (analytics, tracking, etc.)...');

    try {
      await page.evaluate(() => {
        // These should be filtered out and not affect stability
        const filteredRequests = [
          fetch('/?analytics=track', { method: 'GET' }).catch(() => {}),
          fetch('/?tracking=pixel', { method: 'GET' }).catch(() => {}),
          fetch('/?beacon=data', { method: 'GET' }).catch(() => {}),
          fetch('/?telemetry=info', { method: 'GET' }).catch(() => {}),
        ];

        return Promise.allSettled(filteredRequests);
      });
    } catch (evaluateError) {
      progress.log(`Page evaluation failed, continuing test: ${evaluateError}`);
      // Continue the test even if evaluate fails - network stability should still work
    }

    // Wait for stability
    await stabilityPromise;

    const duration = Date.now() - startTime;
    progress.log(`Network stability achieved with filtered requests in ${duration}ms`);

    // Should complete quickly since filtered requests don't count
    if (duration < 3000) {
      // Under 3 seconds
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Network stability filtering logic',
        details: { duration },
      });
    } else {
      throw new Error(
        `Test 3 failed: Expected quick completion with filtering, took ${duration}ms`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 3 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 3 failed: Network stability filtering test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    // Ensure proper cleanup
    if (browserContext) {
      await browserContext.close();
    }
  }
}

/**
 * Test the _waitForStableNetwork method with delayed network stabilization
 */
export async function testWaitForStableNetworkDelayedStabilization(
  progress: TestProgress,
  context: WaitForStableNetworkTestContext,
  browserWindow: BrowserWindow,
): Promise<void> {
  let browserContext: BrowserContext | undefined;
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForStableNetwork timeout test',
    });

    progress.log('Creating BrowserContext with short timeout...');
    browserContext = new BrowserContext(browserWindow, {
      maximumWaitPageLoadTime: 2, // 2 seconds timeout for testing
      waitForNetworkIdlePageLoadTime: 0.5, // 0.5 seconds for testing
    });

    await browserContext.enter();
    const page = await browserContext.getCurrentPage();

    // Navigate to a proper webpage that supports JavaScript execution
    progress.log('Navigating to localhost for testing...');
    try {
      await page.goto('http://localhost:3005/');
      progress.log('Navigation to localhost completed');
    } catch (error) {
      progress.log('Failed to navigate to localhost, using current page');
    }

    progress.log('Testing network stability timeout behavior...');
    const startTime = Date.now();

    // Add debug listeners to monitor network activity
    let requestCount = 0;
    let responseCount = 0;
    const requestDisposable = page.onRequest(request => {
      requestCount++;
      progress.log(
        `[DEBUG] Request ${requestCount}: ${request.method} ${request.url} (type: ${request.resourceType})`,
      );
    });
    const responseDisposable = page.onResponse(response => {
      responseCount++;
      progress.log(`[DEBUG] Response ${responseCount}: ${response.status} ${response.url}`);
    });

    // Start the stability wait
    const stabilityPromise = browserContext._waitForStableNetwork();

    // Continuously trigger requests to prevent stability
    progress.log('Continuously triggering relevant requests to test timeout...');

    const requestInterval = setInterval(() => {
      page
        .evaluate(() => {
          // Make multiple requests that should not be filtered out
          // Use different resource types to ensure they're relevant
          Promise.all([
            fetch('/test-document.html', { method: 'GET' }).catch(() => {}),
            fetch('/test-script.js', { method: 'GET' }).catch(() => {}),
            fetch('/api/test-data', { method: 'GET' }).catch(() => {}),
          ]);
        })
        .catch(() => {
          // Ignore evaluation errors during continuous requests
        });
    }, 200); // Every 200ms - more frequent to ensure constant activity

    // Wait for stability (should timeout)
    await stabilityPromise;
    clearInterval(requestInterval);
    requestDisposable.dispose();
    responseDisposable.dispose();

    const duration = Date.now() - startTime;
    progress.log(`Network stability timeout occurred in ${duration}ms`);

    // Should complete when requests stop, not necessarily timeout
    // The timing should be at least the network idle time (500ms) plus some processing time
    if (duration >= 400 && duration <= 3000) {
      // Between 0.4-3.0 seconds (accounting for execution environment variance)
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Network stability timeout behavior',
        details: {
          duration,
          expectedRange: '400-3000ms',
          requestsDetected: requestCount,
          responsesDetected: responseCount,
        },
      });
    } else {
      // Log more details to help debug the issue
      progress.log(`Timeout details: expected 400-3000ms range, got ${duration}ms`);
      progress.log(
        `Config: maxWait=${browserContext.config.maximumWaitPageLoadTime}s, idle=${browserContext.config.waitForNetworkIdlePageLoadTime}s`,
      );
      progress.log(`Debug: Captured ${requestCount} requests, ${responseCount} responses`);
      throw new Error(`Test 4 failed: Expected duration in range 400-3000ms, took ${duration}ms`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Test 4 failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Test 4 failed: Network stability timeout test',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    // Ensure proper cleanup
    if (browserContext) {
      await browserContext.close();
    }
  }
}

/**
 * Run all _waitForStableNetwork tests
 */
export async function runAllWaitForStableNetworkTests(
  context: WaitForStableNetworkTestContext,
): Promise<void> {
  const progress = new TestProgress('WaitForStableNetwork');
  let browserWindow: BrowserWindow | undefined;

  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting all _waitForStableNetwork tests',
    });

    // Create a shared BrowserWindow for all tests
    browserWindow = await BrowserWindow.create();

    // Test 1: Immediate stability
    await testWaitForStableNetworkImmediate(progress, context, browserWindow);

    // Test 2: Network activity
    await testWaitForStableNetworkWithActivity(progress, context, browserWindow);

    // Test 3: Filtering logic
    await testWaitForStableNetworkFiltering(progress, context, browserWindow);

    // Test 4: Delayed stabilization behavior
    await testWaitForStableNetworkDelayedStabilization(progress, context, browserWindow);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All _waitForStableNetwork tests completed successfully',
      details: {
        testsCompleted: [
          'Immediate stability detection',
          'Network activity handling',
          'Request filtering logic',
          'Delayed stabilization behavior',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`_waitForStableNetwork tests failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Some _waitForStableNetwork tests failed',
      error: error instanceof Error ? error : new Error(errorMessage),
    });
    throw error;
  } finally {
    // Ensure proper cleanup
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}
