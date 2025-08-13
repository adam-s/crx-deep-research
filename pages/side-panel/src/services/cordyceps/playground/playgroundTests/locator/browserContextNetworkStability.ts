import { Progress } from '@src/services/cordyceps/core/progress';
import { BrowserContext } from '@src/services/browser-use/browser/context';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Test BrowserContext network stability functionality
 * Tests the _waitForStableNetwork method and network event integration
 */
export async function testBrowserContextNetworkStability(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting BrowserContext network stability tests',
    });

    // Test 1: Create BrowserContext with default config
    progress.log('Test 1: Testing BrowserContext creation with default config');
    await testBrowserContextCreation(page, progress, context);

    // Test 2: Create BrowserContext with custom config
    progress.log('Test 2: Testing BrowserContext creation with custom config');
    await testBrowserContextCustomConfig(page, progress, context);

    // Test 3: Test network stability detection (private method testing)
    progress.log('Test 3: Testing network stability detection integration');
    await testNetworkStabilityIntegration(page, progress, context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'BrowserContext network stability tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`BrowserContext network stability test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'BrowserContext network stability tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

async function testBrowserContextCreation(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  // Get a BrowserWindow instance (simulated through the existing page)
  const browserWindow = await context.getBrowser(progress);

  // Create BrowserContext with default config
  const browserContext = new BrowserContext(browserWindow);

  // Verify default configuration
  if (!browserContext.config) {
    throw new Error('Test 1 failed: BrowserContext should have config');
  }

  if (browserContext.config.maximumWaitPageLoadTime !== 5) {
    throw new Error('Test 1 failed: Default maximumWaitPageLoadTime should be 5 seconds');
  }

  if (browserContext.config.waitForNetworkIdlePageLoadTime !== 0.5) {
    throw new Error('Test 1 failed: Default waitForNetworkIdlePageLoadTime should be 0.5 seconds');
  }

  // Test enter method
  await browserContext.enter();

  if (browserContext.session.state !== 'active') {
    throw new Error('Test 1 failed: BrowserContext should be in active state after enter()');
  }

  // Test close method
  await browserContext.close();

  // Note: The session state doesn't automatically change to CLOSED on BrowserContext.close()
  // This is expected behavior as the session tracks the browser window, not the context

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Test 1 passed: BrowserContext creation with default config works',
    details: {
      defaultMaxWait: browserContext.config.maximumWaitPageLoadTime,
      defaultNetworkIdle: browserContext.config.waitForNetworkIdlePageLoadTime,
    },
  });
}

async function testBrowserContextCustomConfig(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  // Get a BrowserWindow instance
  const browserWindow = await context.getBrowser(progress);

  // Create BrowserContext with custom config
  const customConfig = {
    maximumWaitPageLoadTime: 10,
    waitForNetworkIdlePageLoadTime: 1.0,
  };

  const browserContext = new BrowserContext(browserWindow, customConfig);

  // Verify custom configuration
  if (browserContext.config.maximumWaitPageLoadTime !== 10) {
    throw new Error('Test 2 failed: Custom maximumWaitPageLoadTime should be 10 seconds');
  }

  if (browserContext.config.waitForNetworkIdlePageLoadTime !== 1.0) {
    throw new Error('Test 2 failed: Custom waitForNetworkIdlePageLoadTime should be 1.0 seconds');
  }

  // Test partial config override
  const partialConfig = {
    maximumWaitPageLoadTime: 15,
    // waitForNetworkIdlePageLoadTime should use default
  };

  const browserContext2 = new BrowserContext(browserWindow, partialConfig);

  if (browserContext2.config.maximumWaitPageLoadTime !== 15) {
    throw new Error('Test 2 failed: Partial config maximumWaitPageLoadTime should be 15 seconds');
  }

  if (browserContext2.config.waitForNetworkIdlePageLoadTime !== 0.5) {
    throw new Error(
      'Test 2 failed: Partial config waitForNetworkIdlePageLoadTime should use default 0.5 seconds',
    );
  }

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Test 2 passed: BrowserContext creation with custom config works',
    details: {
      customMaxWait: browserContext.config.maximumWaitPageLoadTime,
      customNetworkIdle: browserContext.config.waitForNetworkIdlePageLoadTime,
      partialMaxWait: browserContext2.config.maximumWaitPageLoadTime,
      partialNetworkIdle: browserContext2.config.waitForNetworkIdlePageLoadTime,
    },
  });
}

async function testNetworkStabilityIntegration(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  // Get a BrowserWindow instance
  const browserWindow = await context.getBrowser(progress);

  // Create BrowserContext
  const browserContext = new BrowserContext(browserWindow);

  await browserContext.enter();

  // Get the current page to test network stability integration
  const currentPage = await browserContext.getCurrentPage();

  // Test the new network stability method with race condition handling
  progress.log('Testing Page.waitForNetworkStability with race conditions...');

  try {
    // Trigger some network activity first
    await currentPage.evaluate(() => {
      // Create multiple concurrent requests to test race conditions
      Promise.all([
        fetch('/', { method: 'GET' }),
        fetch('/?test=1', { method: 'GET' }),
        fetch('/?test=2', { method: 'GET' }),
      ]);
    });

    // Now wait for network stability with race condition handling
    await currentPage.waitForNetworkStability(progress, {
      idleTime: 1000, // 1 second idle time
      timeout: 10000, // 10 second timeout
      ignoredResourceTypes: ['image', 'media', 'font'],
    });

    progress.log('Network stability achieved using race condition handling');

    // Test the waitForCondition utility method
    progress.log('Testing Page.waitForCondition with race conditions...');

    let conditionMet = false;
    setTimeout(() => {
      conditionMet = true;
    }, 2000); // Set condition after 2 seconds

    await currentPage.waitForCondition(progress, () => conditionMet, {
      pollInterval: 100,
      timeout: 5000,
      description: 'test condition',
    });

    progress.log('Condition waiting completed using race condition handling');

    // Capture request and response counts
    let requestCount = 0;
    let responseCount = 0;

    const requestDisposable = currentPage.onRequest(() => requestCount++);
    const responseDisposable = currentPage.onResponse(() => responseCount++);

    // Trigger more network activity to test event capture
    await currentPage.evaluate(() => {
      fetch('/?race-test=1');
      fetch('/?race-test=2');
    });

    // Wait a bit for events with race condition handling
    await progress.race(
      Promise.race([
        new Promise<void>(resolve => {
          const checkCounts = () => {
            if (requestCount > 0 && responseCount > 0) {
              resolve();
            } else {
              setTimeout(checkCounts, 100);
            }
          };
          checkCounts();
        }),
        new Promise<void>(resolve => setTimeout(resolve, 3000)),
      ]),
    );

    requestDisposable.dispose();
    responseDisposable.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Network stability integration with race conditions works',
      details: {
        requestCount,
        responseCount,
        raceConditionHandling: true,
      },
    });
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `Test 3 failed: Network stability integration error: ${error}`,
    });
    throw error;
  } finally {
    await browserContext.close();
  }
}

/**
 * Test network stability method performance
 * This tests the actual performance characteristics of the network stability detection
 */
export async function testNetworkStabilityPerformance(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting network stability performance tests',
    });

    const browserWindow = await context.getBrowser(progress);
    const browserContext = new BrowserContext(browserWindow, {
      maximumWaitPageLoadTime: 2, // Fast timeout for testing
      waitForNetworkIdlePageLoadTime: 0.1, // Very fast idle detection
    });

    await browserContext.enter();

    try {
      const startTime = Date.now();

      // Access the private method for testing
      const browserContextWithPrivateMethod = browserContext as unknown as {
        _waitForStableNetwork(): Promise<void>;
      };

      // This should resolve quickly since there's likely no active network traffic
      await browserContextWithPrivateMethod._waitForStableNetwork();

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (under 2 seconds for this test)
      if (duration > 2000) {
        throw new Error(`Network stability detection took too long: ${duration}ms`);
      }

      progress.log(`Network stability detection completed in ${duration}ms`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Network stability performance test passed',
        details: { duration },
      });
    } finally {
      await browserContext.close();
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Network stability performance test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Network stability performance test failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}
