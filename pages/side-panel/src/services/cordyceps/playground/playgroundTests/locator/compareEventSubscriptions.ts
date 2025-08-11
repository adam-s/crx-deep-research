/**
 * Minimal test to compare how waitForNetworkStability subscribes vs how our test subscribes
 * This should reveal if there's a difference in Event instances or subscription patterns
 */

import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';

export async function testCompareEventSubscriptions(
  page: Page,
  progress: Progress,
): Promise<{ success: boolean; details: string }> {
  try {
    progress.log('🔍 COMPARISON TEST: Analyzing Event subscription patterns...');

    const tabId = page.tabId;

    progress.log(`📋 Page tab ID: ${tabId}`);

    // Get debug snapshot to see current state
    const initialDebug = await page.getNetworkDebugSnapshot();
    progress.log(`🔍 INITIAL STATE: ${JSON.stringify(initialDebug)}`);

    // Test 1: Direct comparison of Event instances
    progress.log('\n🧪 TEST 1: Comparing Event instance identity...');

    // Get the internal _networkEvents that waitForNetworkStability uses
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalNetworkEvents = (page as any)._networkEvents;
    progress.log(`🔍 Internal _networkEvents exists: ${!!internalNetworkEvents}`);
    progress.log(`🔍 page.onRequest exists: ${!!page.onRequest}`);
    progress.log(`🔍 page.onResponse exists: ${!!page.onResponse}`);

    // Check if they're the same instances
    const sameRequestEvent = page.onRequest === internalNetworkEvents?.onRequest;
    const sameResponseEvent = page.onResponse === internalNetworkEvents?.onResponse;

    progress.log(`🔍 page.onRequest === _networkEvents.onRequest: ${sameRequestEvent}`);
    progress.log(`🔍 page.onResponse === _networkEvents.onResponse: ${sameResponseEvent}`);

    // Test 2: Try subscribing to both and see which works
    progress.log('\n🧪 TEST 2: Subscribe to both and compare...');

    let pageRequestCount = 0;
    let internalRequestCount = 0;
    let pageResponseCount = 0;
    let internalResponseCount = 0;

    // Subscribe to page events (what our test does)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageRequestDisposable = page.onRequest((request: any) => {
      pageRequestCount++;
      progress.log(`📥 PAGE onRequest: ${request.method} ${request.url}`);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageResponseDisposable = page.onResponse((response: any) => {
      pageResponseCount++;
      progress.log(`📤 PAGE onResponse: ${response.status} ${response.url}`);
    });

    // Subscribe to internal events (what waitForNetworkStability uses)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalRequestDisposable = internalNetworkEvents.onRequest((request: any) => {
      internalRequestCount++;
      progress.log(`📥 INTERNAL onRequest: ${request.method} ${request.url}`);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const internalResponseDisposable = internalNetworkEvents.onResponse((response: any) => {
      internalResponseCount++;
      progress.log(`📤 INTERNAL onResponse: ${response.status} ${response.url}`);
    });

    progress.log('✅ All subscriptions set up');

    // Get debug state after subscriptions
    const afterSubscriptionsDebug = await page.getNetworkDebugSnapshot();
    progress.log(`🔍 AFTER SUBSCRIPTIONS: ${JSON.stringify(afterSubscriptionsDebug)}`);

    // Trigger a test request
    progress.log('\n🚀 Triggering test request...');
    try {
      const response = await page.evaluate(async () => {
        const response = await fetch(`http://localhost:3005/?comparison-test=${Date.now()}`);
        return { status: response.status, url: response.url };
      });
      progress.log(`✅ Fetch completed: ${response.status} ${response.url}`);
    } catch (e) {
      progress.log(`❌ Fetch failed: ${e}`);
    }

    // Wait a moment for events to propagate
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get final debug state
    const finalDebug = await page.getNetworkDebugSnapshot();
    progress.log(`🔍 FINAL STATE: ${JSON.stringify(finalDebug)}`);

    // Clean up subscriptions
    pageRequestDisposable.dispose();
    pageResponseDisposable.dispose();
    internalRequestDisposable.dispose();
    internalResponseDisposable.dispose();

    progress.log('\n📊 COMPARISON RESULTS:');
    progress.log(`   Page request events: ${pageRequestCount}`);
    progress.log(`   Internal request events: ${internalRequestCount}`);
    progress.log(`   Page response events: ${pageResponseCount}`);
    progress.log(`   Internal response events: ${internalResponseCount}`);

    progress.log('\n🔍 EVENT IDENTITY ANALYSIS:');
    progress.log(`   Same request Event: ${sameRequestEvent}`);
    progress.log(`   Same response Event: ${sameResponseEvent}`);

    // Test 3: Test waitForNetworkStability to confirm it works
    progress.log('\n🧪 TEST 3: Verify waitForNetworkStability works...');

    try {
      // Trigger request during stability wait
      const stabilityPromise = page.waitForNetworkStability(progress, {
        idleTime: 500,
        timeout: 3000,
      });

      // Trigger a request after starting stability wait
      setTimeout(async () => {
        try {
          await page.evaluate(async () => {
            await fetch(`http://localhost:3005/?stability-test=${Date.now()}`);
          });
        } catch (e) {
          progress.log(`❌ Stability test fetch failed: ${e}`);
        }
      }, 100);

      await stabilityPromise;
      progress.log('✅ waitForNetworkStability completed successfully');
    } catch (e) {
      progress.log(`❌ waitForNetworkStability failed: ${e}`);
    }

    // Final analysis
    const allEventsWorking = pageRequestCount > 0 && pageResponseCount > 0;
    const internalEventsWorking = internalRequestCount > 0 && internalResponseCount > 0;

    const summary = {
      pageEvents: allEventsWorking,
      internalEvents: internalEventsWorking,
      sameInstances: sameRequestEvent && sameResponseEvent,
      pageRequestCount,
      internalRequestCount,
      pageResponseCount,
      internalResponseCount,
    };

    progress.log(`\n🎯 SUMMARY: ${JSON.stringify(summary)}`);

    const success = true; // Always succeed to get the analysis
    const details = `Event comparison: page=${allEventsWorking}, internal=${internalEventsWorking}, same=${sameRequestEvent && sameResponseEvent}`;

    return { success, details };
  } catch (error) {
    progress.log(`❌ Comparison test failed: ${error}`);
    return { success: false, details: `Error: ${error}` };
  }
}
