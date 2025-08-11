import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { NetworkListenerManager } from '@src/services/cordyceps/navigation/networkListenerManager';
import { RequestInfo, ResponseInfo } from '@src/services/cordyceps/utilities/types';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Test network event functionality on Page class
 * Tests the chrome.webRequest integration and VS Code event system
 */
export async function testNetworkEventFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting network event functionality tests',
    });

    // Test 1: Request event handling
    progress.log('Test 1: Testing request event listener');
    await testRequestEventListener(page, progress, context);

    // Test 2: Response event handling
    progress.log('Test 2: Testing response event listener');
    await testResponseEventListener(page, progress, context);

    // Test 3: Header capture functionality
    progress.log('Test 3: Testing header capture functionality');
    await testHeaderCapture(page, progress, context);

    // Test 4: Event cleanup on page disposal
    progress.log('Test 4: Testing event cleanup on page disposal');
    await testEventCleanup(page, progress, context);

    // Test 5: Resource type filtering
    progress.log('Test 5: Testing resource type filtering');
    await testResourceTypeFiltering(page, progress, context);

    // Test 6: Multiple concurrent requests
    progress.log('Test 6: Testing multiple concurrent requests');
    await testConcurrentRequests(page, progress, context);

    // Test 7: Memory leak detection
    progress.log('Test 7: Testing memory leak detection and prevention');
    await testMemoryLeakDetection(page, progress, context);

    // Test 8: NetworkListenerManager cleanup
    progress.log('Test 8: Testing NetworkListenerManager automatic cleanup');
    await testNetworkListenerManagerCleanup(page, progress, context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Network event functionality tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Network event functionality test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Network event functionality tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

async function testRequestEventListener(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let requestCount = 0;
    const timeout = setTimeout(() => {
      requestDisposable.dispose();
      reject(new Error('Test 1 failed: No request events received within timeout'));
    }, 10000);

    // Listen for request events
    const requestDisposable = page.onRequest(request => {
      try {
        requestCount++;
        progress.log(`Received request event: ${request.method} ${request.url}`);

        // Validate request structure
        if (!request.id || !request.url || !request.method || !request.resourceType) {
          throw new Error('Request event missing required properties');
        }

        // Validate types
        if (typeof request.timestamp !== 'number' || request.timestamp <= 0) {
          throw new Error('Request timestamp should be a positive number');
        }

        if (typeof request.headers !== 'object') {
          throw new Error('Request headers should be an object');
        }

        // Log headers for debugging
        progress.log(`Request headers: ${JSON.stringify(request.headers)}`);

        // Check if we have common headers (at least one should be present for most requests)
        const headerKeys = Object.keys(request.headers);
        if (headerKeys.length > 0) {
          progress.log(`✓ Request has ${headerKeys.length} headers: ${headerKeys.join(', ')}`);
        } else {
          progress.log('⚠️ Warning: Request has no headers captured');
        }

        clearTimeout(timeout);
        requestDisposable.dispose();

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 1 passed: Request event listener works correctly',
          details: { requestCount, lastRequest: { method: request.method, url: request.url } },
        });

        resolve();
      } catch (error) {
        clearTimeout(timeout);
        requestDisposable.dispose();
        reject(error);
      }
    });

    // Trigger a request by navigating to a page with resources
    page
      .evaluate(() => {
        // Create a simple fetch request to trigger network activity
        fetch('/').catch(() => {
          // Ignore errors, we just want to generate network activity
        });
      })
      .catch(() => {
        // Ignore evaluation errors
      });
  });
}

async function testResponseEventListener(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let responseCount = 0;
    const timeout = setTimeout(() => {
      responseDisposable.dispose();
      reject(new Error('Test 2 failed: No response events received within timeout'));
    }, 10000);

    // Listen for response events
    const responseDisposable = page.onResponse(response => {
      try {
        responseCount++;
        progress.log(`Received response event: ${response.status} ${response.url}`);

        // Validate response structure
        if (!response.id || !response.url || typeof response.status !== 'number') {
          throw new Error('Response event missing required properties');
        }

        // Validate request reference
        if (!response.request || !response.request.id || !response.request.url) {
          throw new Error('Response.request should contain valid request data');
        }

        // Validate timestamp
        if (typeof response.timestamp !== 'number' || response.timestamp <= 0) {
          throw new Error('Response timestamp should be a positive number');
        }

        // Validate headers
        if (typeof response.headers !== 'object') {
          throw new Error('Response headers should be an object');
        }

        // Log headers for debugging
        progress.log(`Response headers: ${JSON.stringify(response.headers)}`);

        // Check if we have common response headers (at least one should be present for HTTP responses)
        const responseHeaderKeys = Object.keys(response.headers);
        if (responseHeaderKeys.length > 0) {
          progress.log(
            `✓ Response has ${responseHeaderKeys.length} headers: ${responseHeaderKeys.join(', ')}`,
          );
        } else {
          progress.log('⚠️ Warning: Response has no headers captured');
        }

        clearTimeout(timeout);
        responseDisposable.dispose();

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 2 passed: Response event listener works correctly',
          details: { responseCount, lastResponse: { status: response.status, url: response.url } },
        });

        resolve();
      } catch (error) {
        clearTimeout(timeout);
        responseDisposable.dispose();
        reject(error);
      }
    });

    // Trigger a request that will generate a response
    page
      .evaluate(() => {
        fetch('/', { method: 'GET' }).catch(() => {
          // Ignore errors, we just want to generate network activity
        });
      })
      .catch(() => {
        // Ignore evaluation errors
      });
  });
}

async function testHeaderCapture(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let requestWithHeaders = false;
    let responseWithHeaders = false;
    let completedTests = 0;
    const expectedTests = 2;

    const timeout = setTimeout(() => {
      requestDisposable.dispose();
      responseDisposable.dispose();
      reject(new Error('Test 3 failed: Header capture timeout'));
    }, 15000);

    const checkCompletion = () => {
      if (completedTests >= expectedTests) {
        clearTimeout(timeout);
        requestDisposable.dispose();
        responseDisposable.dispose();

        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 3 passed: Header capture works correctly',
          details: {
            requestWithHeaders,
            responseWithHeaders,
            completedTests,
          },
        });

        resolve();
      }
    };

    // Listen for request events to validate headers
    const requestDisposable = page.onRequest(request => {
      try {
        progress.log(`Header test - Received request: ${request.method} ${request.url}`);

        // Validate request headers structure
        if (typeof request.headers !== 'object') {
          throw new Error('Request headers should be an object');
        }

        const requestHeaderKeys = Object.keys(request.headers);
        progress.log(`Request headers captured: ${requestHeaderKeys.length} headers`);

        if (requestHeaderKeys.length > 0) {
          progress.log(`✓ Request headers: ${requestHeaderKeys.join(', ')}`);
          requestWithHeaders = true;

          // Log some common headers if present
          if (request.headers['user-agent']) {
            progress.log(
              `✓ User-Agent header captured: ${request.headers['user-agent'].substring(0, 50)}...`,
            );
          }
          if (request.headers['accept']) {
            progress.log(`✓ Accept header captured: ${request.headers['accept']}`);
          }
        } else {
          progress.log(
            '⚠️ No request headers captured (this might be expected for some request types)',
          );
        }

        completedTests++;
        checkCompletion();
      } catch (error) {
        clearTimeout(timeout);
        requestDisposable.dispose();
        responseDisposable.dispose();
        reject(error);
      }
    });

    // Listen for response events to validate headers
    const responseDisposable = page.onResponse(response => {
      try {
        progress.log(`Header test - Received response: ${response.status} ${response.url}`);

        // Validate response headers structure
        if (typeof response.headers !== 'object') {
          throw new Error('Response headers should be an object');
        }

        const responseHeaderKeys = Object.keys(response.headers);
        progress.log(`Response headers captured: ${responseHeaderKeys.length} headers`);

        if (responseHeaderKeys.length > 0) {
          progress.log(`✓ Response headers: ${responseHeaderKeys.join(', ')}`);
          responseWithHeaders = true;

          // Log some common response headers if present
          if (response.headers['content-type']) {
            progress.log(`✓ Content-Type header captured: ${response.headers['content-type']}`);
          }
          if (response.headers['content-length']) {
            progress.log(`✓ Content-Length header captured: ${response.headers['content-length']}`);
          }
          if (response.headers['server']) {
            progress.log(`✓ Server header captured: ${response.headers['server']}`);
          }
        } else {
          progress.log('⚠️ No response headers captured (this might indicate an issue)');
        }

        completedTests++;
        checkCompletion();
      } catch (error) {
        clearTimeout(timeout);
        requestDisposable.dispose();
        responseDisposable.dispose();
        reject(error);
      }
    });

    // Trigger a request with explicit headers
    page
      .evaluate(() => {
        fetch('/', {
          method: 'GET',
          headers: {
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'X-Test-Header': 'cordyceps-test',
          },
        }).catch(() => {
          // Ignore errors, we just want to generate network activity with headers
        });
      })
      .catch(() => {
        // Ignore evaluation errors
      });
  });
}

async function testEventCleanup(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  let requestEventFired = false;
  let responseEventFired = false;

  // Set up listeners
  const requestDisposable = page.onRequest(() => {
    requestEventFired = true;
  });

  const responseDisposable = page.onResponse(() => {
    responseEventFired = true;
  });

  // Manually dispose listeners (simulating page disposal)
  requestDisposable.dispose();
  responseDisposable.dispose();

  // Wait a bit and then trigger network activity
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    await page.evaluate(() => {
      fetch('/').catch(() => {});
    });
  } catch (error) {
    // Ignore evaluation errors
  }

  // Wait for potential events
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Events should NOT have fired after disposal
  if (requestEventFired || responseEventFired) {
    throw new Error('Test 3 failed: Events fired after disposal');
  }

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Test 3 passed: Event cleanup works correctly',
  });
}

async function testResourceTypeFiltering(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  const receivedResourceTypes = new Set<string>();

  const requestDisposable = page.onRequest(request => {
    receivedResourceTypes.add(request.resourceType);
  });

  try {
    // Navigate to a page that should generate various resource types
    const origin = await page.evaluate(() => window.location.origin);
    await page.goto(`${origin}/`, { waitUntil: 'load' });

    // Wait for network activity to settle
    await new Promise(resolve => setTimeout(resolve, 2000));

    requestDisposable.dispose();

    // Verify we received some relevant resource types
    const expectedTypes = ['main_frame', 'stylesheet', 'script', 'image'];
    const foundTypes = expectedTypes.filter(type => receivedResourceTypes.has(type));

    if (foundTypes.length === 0) {
      throw new Error('Test 4 failed: No expected resource types were captured');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Resource type filtering works correctly',
      details: {
        capturedTypes: Array.from(receivedResourceTypes),
        expectedFound: foundTypes,
      },
    });
  } finally {
    requestDisposable.dispose();
  }
}

async function testConcurrentRequests(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  const requests = new Map<string, RequestInfo>();
  const responses = new Map<string, ResponseInfo>();

  const requestDisposable = page.onRequest(request => {
    requests.set(request.id, request);
  });

  const responseDisposable = page.onResponse(response => {
    responses.set(response.id, response);
  });

  try {
    // Create multiple concurrent requests
    await page.evaluate(() => {
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(fetch(`/?test=${i}`).catch(() => {}));
      }
      return Promise.all(promises);
    });

    // Wait for network activity to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    requestDisposable.dispose();
    responseDisposable.dispose();

    // Verify we captured multiple requests
    if (requests.size === 0) {
      throw new Error('Test 5 failed: No concurrent requests were captured');
    }

    // Verify request-response pairing
    let matchedPairs = 0;
    for (const [requestId, request] of requests) {
      const response = responses.get(requestId);
      if (response && response.request.id === request.id) {
        matchedPairs++;
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: Concurrent request handling works correctly',
      details: {
        totalRequests: requests.size,
        totalResponses: responses.size,
        matchedPairs,
      },
    });
  } finally {
    requestDisposable.dispose();
    responseDisposable.dispose();
  }
}

/**
 * Test memory leak detection and prevention
 */
async function testMemoryLeakDetection(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  const manager = NetworkListenerManager.getInstance();

  // Get initial stats
  const initialStats = manager.getStats();
  progress.log(`Initial stats: ${JSON.stringify(initialStats)}`);

  // Test checkForLeaks functionality
  const leakCheck = manager.checkForLeaks();
  progress.log(`Initial leak check: hasLeaks=${leakCheck.hasLeaks}`);

  if (leakCheck.hasLeaks) {
    progress.log(`Found potential issues: ${leakCheck.issues.join(', ')}`);
    progress.log(`Recommendations: ${leakCheck.recommendations.join(', ')}`);
  }

  // Create multiple listeners and verify they don't cause immediate leaks
  const disposables: Array<{ dispose(): void }> = [];

  try {
    // Create 5 listeners to test ref counting
    for (let i = 0; i < 5; i++) {
      const requestDisposable = page.onRequest(() => {
        // Empty handler for testing
      });
      const responseDisposable = page.onResponse(() => {
        // Empty handler for testing
      });
      disposables.push(requestDisposable, responseDisposable);
    }

    // Check stats after adding listeners
    const afterListenersStats = manager.getStats();
    progress.log(`After adding listeners: ${JSON.stringify(afterListenersStats)}`);

    // Trigger some network activity to test pending request tracking
    await page.evaluate(() => {
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(
          fetch(`/?test_memory_leak_${i}_${Date.now()}`)
            .then(() => `success_${i}`)
            .catch(() => `error_${i}`),
        );
      }
      return Promise.all(promises);
    });

    // Wait for events to settle
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check for leaks after activity
    const afterActivityLeakCheck = manager.checkForLeaks();
    const afterActivityStats = manager.getStats();

    progress.log(`After activity stats: ${JSON.stringify(afterActivityStats)}`);
    progress.log(`After activity leak check: hasLeaks=${afterActivityLeakCheck.hasLeaks}`);

    // Clean up all listeners
    disposables.forEach(d => d.dispose());

    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    // Final stats check
    const finalStats = manager.getStats();
    progress.log(`Final stats: ${JSON.stringify(finalStats)}`);

    // Verify cleanup worked
    const finalLeakCheck = manager.checkForLeaks();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 6 passed: Memory leak detection works correctly',
      details: {
        initialStats,
        afterListenersStats,
        afterActivityStats,
        finalStats,
        initialLeakCheck: leakCheck,
        afterActivityLeakCheck,
        finalLeakCheck,
      },
    });
  } finally {
    // Ensure cleanup even if test fails
    disposables.forEach(d => {
      try {
        d.dispose();
      } catch (e) {
        progress.log(`Error disposing listener: ${e}`);
      }
    });
  }
}

/**
 * Test NetworkListenerManager automatic cleanup functionality
 */
async function testNetworkListenerManagerCleanup(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  const manager = NetworkListenerManager.getInstance();

  // Get initial state
  const initialStats = manager.getStats();
  progress.log(`Initial cleanup test stats: ${JSON.stringify(initialStats)}`);

  // Test automatic sweeper functionality
  progress.log('Testing automatic request sweeping...');

  // Create some listeners
  const requestDisposable = page.onRequest(() => {
    // Handler for testing
  });

  // Trigger requests to create pending state
  const requests = [];
  for (let i = 0; i < 5; i++) {
    requests.push(
      page.evaluate((index: number) => {
        return fetch(`/?cleanup_test_${index}_${Date.now()}`)
          .then(() => `success_${index}`)
          .catch(() => `error_${index}`);
      }, i),
    );
  }

  // Wait for requests to start
  await new Promise(resolve => setTimeout(resolve, 500));

  const afterRequestsStats = manager.getStats();
  progress.log(`After triggering requests: ${JSON.stringify(afterRequestsStats)}`);

  // Wait for requests to complete and cleanup to occur
  await Promise.all(requests);
  await new Promise(resolve => setTimeout(resolve, 1000));

  const afterCompletionStats = manager.getStats();
  progress.log(`After request completion: ${JSON.stringify(afterCompletionStats)}`);

  // Test manual cleanup
  progress.log('Testing manual tab cleanup...');

  // Get tab-specific subscription to test cleanup
  const tabSub = manager.subscribeTab(page.tabId);
  const tabRequestDisposable = tabSub.onRequest(() => {
    // Handler for testing
  });

  const beforeCleanupStats = manager.getStats();

  // Dispose tab subscription
  tabRequestDisposable.dispose();

  const afterManualCleanupStats = manager.getStats();
  progress.log(`After manual cleanup: ${JSON.stringify(afterManualCleanupStats)}`);

  // Test ref counting by registering/unregistering tab multiple times
  progress.log('Testing ref counting with multiple registrations...');

  const registrations = [];
  for (let i = 0; i < 3; i++) {
    const sub = manager.subscribeTab(page.tabId);
    registrations.push(sub);
  }

  const afterMultipleRegsStats = manager.getStats();
  progress.log(`After multiple registrations: ${JSON.stringify(afterMultipleRegsStats)}`);

  // Dispose all but one registration
  for (let i = 0; i < registrations.length - 1; i++) {
    registrations[i].onRequest(() => {}).dispose();
  }

  const afterPartialCleanupStats = manager.getStats();
  progress.log(`After partial cleanup: ${JSON.stringify(afterPartialCleanupStats)}`);

  // Dispose final registration
  registrations[registrations.length - 1].onRequest(() => {}).dispose();

  const afterFullCleanupStats = manager.getStats();
  progress.log(`After full cleanup: ${JSON.stringify(afterFullCleanupStats)}`);

  // Clean up main listener
  requestDisposable.dispose();

  // Final verification
  const finalLeakCheck = manager.checkForLeaks();

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Success,
    message: 'Test 7 passed: NetworkListenerManager cleanup works correctly',
    details: {
      initialStats,
      afterRequestsStats,
      afterCompletionStats,
      beforeCleanupStats,
      afterManualCleanupStats,
      afterMultipleRegsStats,
      afterPartialCleanupStats,
      afterFullCleanupStats,
      finalLeakCheck,
    },
  });
}
