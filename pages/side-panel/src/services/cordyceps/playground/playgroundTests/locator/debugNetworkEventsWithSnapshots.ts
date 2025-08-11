import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { NetworkListenerManager } from '@src/services/cordyceps/navigation/networkListenerManager';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';
import type { IDisposable } from 'vs/base/common/lifecycle';
import { testPageListenersFix } from './testPageListenersFix';
import { testCompareEventSubscriptions } from './compareEventSubscriptions';

/**
 * Debug network events to understand what's happening with debug snapshots
 */
export async function debugNetworkEvents(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    progress.log('🔍 Debugging network events with debug snapshots...');

    // Check if chrome.webRequest is available
    progress.log(`chrome.webRequest available: ${!!chrome.webRequest}`);
    progress.log(
      `chrome.webRequest.onBeforeRequest available: ${!!chrome.webRequest?.onBeforeRequest}`,
    );

    // Check page tab ID
    progress.log(`Page tab ID: ${page.tabId}`);

    // 🔍 DEBUG SNAPSHOT: Get initial debug state before any listeners
    const initialDebug = page.getNetworkDebugSnapshot();
    progress.log(`🔍 INITIAL DEBUG STATE: ${JSON.stringify(initialDebug, null, 2)}`);

    // Test page network events - SET UP LISTENERS FIRST BEFORE ANY NETWORK ACTIVITY
    progress.log('Setting up page network event listeners BEFORE triggering requests...');
    let requestEventReceived = false;
    let responseEventReceived = false;
    let requestCount = 0;
    let responseCount = 0;
    let managerRequestCount = 0;
    let managerResponseCount = 0;

    // Subscribe directly to NetworkListenerManager for comparison
    const managerSub = NetworkListenerManager.getInstance().subscribeTab(page.tabId);
    const managerRequestDisposable = managerSub.onRequest(request => {
      managerRequestCount += 1;
      progress.log(
        `🔧 Manager subscription received request: ${request.method} ${request.url} (tabId: ${request.tabId})`,
      );
    });
    const managerResponseDisposable = managerSub.onResponse(response => {
      managerResponseCount += 1;
      progress.log(
        `🔧 Manager subscription received response: ${response.status} ${response.url} (tabId: ${response.tabId})`,
      );
    });

    // Attach page-level listeners
    let requestDisposable: IDisposable | undefined;
    let responseDisposable: IDisposable | undefined;

    try {
      progress.log('🔧 Attempting to subscribe to page.onRequest...');
      requestDisposable = page.onRequest(request => {
        try {
          requestEventReceived = true;
          requestCount++;
          progress.log(`✅ Page network event received: ${request.method} ${request.url}`);
        } catch (e) {
          progress.log(`❌ Error in request listener: ${e}`);
        }
      });
      progress.log(`✅ Successfully subscribed to page.onRequest`);
    } catch (e) {
      progress.log(`❌ Failed to subscribe to page.onRequest: ${e}`);
    }

    try {
      progress.log('🔧 Attempting to subscribe to page.onResponse...');
      responseDisposable = page.onResponse(response => {
        try {
          responseEventReceived = true;
          responseCount++;
          progress.log(`✅ Page network response received: ${response.status} ${response.url}`);
        } catch (e) {
          progress.log(`❌ Error in response listener: ${e}`);
        }
      });
      progress.log(`✅ Successfully subscribed to page.onResponse`);
    } catch (e) {
      progress.log(`❌ Failed to subscribe to page.onResponse: ${e}`);
    }

    // 🔍 DEBUG SNAPSHOT: Get debug state after setting up page listeners
    const afterListenersDebug = page.getNetworkDebugSnapshot();
    progress.log(`🔍 AFTER LISTENERS DEBUG STATE: ${JSON.stringify(afterListenersDebug, null, 2)}`);

    // Give a moment for listeners to be fully attached
    await progress.race(new Promise(resolve => setTimeout(resolve, 100)));

    // FIRST: Quick test to verify the fix works
    progress.log('🔧 FIRST: Quick test to verify page listeners work after debug wrapper fix...');
    try {
      await testPageListenersFix(page, progress, context);
      progress.log('✅ Quick test PASSED - page listeners are working!');
    } catch (error) {
      progress.log(`❌ Quick test FAILED - page listeners still broken: ${error}`);
      // Continue with full debug anyway to gather more info
    }

    // SECOND: Deep comparison test to understand Event instances
    progress.log('\n🔬 SECOND: Deep comparison of Event subscription patterns...');
    try {
      const comparisonResult = await testCompareEventSubscriptions(page, progress);
      progress.log(`✅ Comparison test completed: ${comparisonResult.details}`);
    } catch (error) {
      progress.log(`❌ Comparison test failed: ${error}`);
    }

    // Test if Page.waitForNetworkStability works (it should prove events work)
    progress.log('\n🔬 Testing Page.waitForNetworkStability to prove events work...');

    let afterStabilityDebug = null;

    try {
      // Trigger a simple request
      const testStabilityPromise = page.evaluate(() => {
        return fetch('/?' + Date.now())
          .then(() => 'stability-test-fetch-success')
          .catch(() => 'stability-test-fetch-error');
      });

      // Use the actual waitForNetworkStability method
      const stabilityPromise = page.waitForNetworkStability(progress, {
        idleTime: 500,
        timeout: 5000,
        ignoredResourceTypes: ['image', 'media', 'font'],
      });

      // Wait for both
      const [fetchResult] = await Promise.all([
        progress.race(testStabilityPromise),
        progress.race(stabilityPromise),
      ]);

      progress.log(`🎉 PROOF: Page.waitForNetworkStability works! Fetch result: ${fetchResult}`);
      progress.log(`🎉 This PROVES that page-level network events ARE working correctly!`);

      // 🔍 DEBUG SNAPSHOT: Get debug state after successful stability test
      afterStabilityDebug = page.getNetworkDebugSnapshot();
      progress.log(
        `🔍 AFTER STABILITY TEST DEBUG STATE: ${JSON.stringify(afterStabilityDebug, null, 2)}`,
      );
    } catch (stabilityError) {
      progress.log(`❌ Page.waitForNetworkStability failed: ${stabilityError}`);

      // 🔍 DEBUG SNAPSHOT: Get debug state after failed stability test
      afterStabilityDebug = page.getNetworkDebugSnapshot();
      progress.log(
        `🔍 AFTER FAILED STABILITY TEST DEBUG STATE: ${JSON.stringify(afterStabilityDebug, null, 2)}`,
      );
    }

    // Test our own listeners by triggering more requests
    progress.log('🧪 Testing our own listeners with additional requests...');

    try {
      // Test simple fetch
      const fetchPromise = page.evaluate(() => {
        return fetch('/')
          .then(() => 'fetch-success')
          .catch(() => 'fetch-error');
      });

      const fetchResult = await progress.race(
        Promise.race([
          fetchPromise,
          new Promise(resolve => setTimeout(() => resolve('fetch-timeout'), 3000)),
        ]),
      );

      progress.log(`Fetch request result: ${fetchResult}`);

      // Wait longer to see if events eventually arrive
      await progress.race(new Promise(resolve => setTimeout(resolve, 2000)));

      // 🔍 DEBUG SNAPSHOT: Get debug state after our test requests
      const afterTestRequestsDebug = page.getNetworkDebugSnapshot();
      progress.log(
        `🔍 AFTER TEST REQUESTS DEBUG STATE: ${JSON.stringify(afterTestRequestsDebug, null, 2)}`,
      );

      progress.log(
        `🔍 Final counts - Our listeners: Requests=${requestCount}, Responses=${responseCount}`,
      );
      progress.log(
        `🔍 Manager subscription counts - Requests=${managerRequestCount}, Responses=${managerResponseCount}`,
      );

      // Clean up
      managerRequestDisposable.dispose();
      managerResponseDisposable.dispose();
      requestDisposable?.dispose();
      responseDisposable?.dispose();

      const success = requestEventReceived && responseEventReceived;
      context.events.emit({
        timestamp: Date.now(),
        severity: success ? Severity.Success : Severity.Warning,
        message: `Debug completed - Request events ${requestEventReceived ? 'working' : 'not working'}, Response events ${responseEventReceived ? 'working' : 'not working'}`,
        details: {
          requestCount,
          responseCount,
          managerRequestCount,
          managerResponseCount,
          initialDebug,
          afterListenersDebug,
          afterStabilityDebug,
          afterTestRequestsDebug,
        },
      });
    } catch (evalError) {
      progress.log(`Error during evaluation: ${evalError}`);

      // 🔍 DEBUG SNAPSHOT: Get debug state after error
      const afterErrorDebug = page.getNetworkDebugSnapshot();
      progress.log(`🔍 AFTER ERROR DEBUG STATE: ${JSON.stringify(afterErrorDebug, null, 2)}`);

      // Clean up
      managerRequestDisposable?.dispose();
      managerResponseDisposable?.dispose();
      requestDisposable?.dispose();
      responseDisposable?.dispose();
      throw evalError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Debug network events failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Debug network events failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}
