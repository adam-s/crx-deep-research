import { Progress } from '@src/services/cordyceps/core/progress';
import { Page } from '@src/services/cordyceps/page';
import { Severity } from '@src/utils/types';
import type { TestContext } from '../api';

/**
 * Quick test to verify page.onRequest/onResponse listeners work after debug wrapper fix
 */
export async function testPageListenersFix(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    progress.log('🔧 QUICK TEST: Verifying page.onRequest/onResponse listeners work...');

    // Get initial debug state
    const initialDebug = page.getNetworkDebugSnapshot();
    progress.log(`📊 Initial: ${JSON.stringify(initialDebug)}`);

    let requestReceived = false;
    let responseReceived = false;
    let requestUrl = '';
    let responseStatus = 0;

    // Set up listeners
    const requestDisposable = page.onRequest(request => {
      requestReceived = true;
      requestUrl = request.url;
      progress.log(`✅ TEST: page.onRequest fired for ${request.url}`);
    });

    const responseDisposable = page.onResponse(response => {
      responseReceived = true;
      responseStatus = response.status;
      progress.log(`✅ TEST: page.onResponse fired for ${response.url} (${response.status})`);
    });

    // Get debug state after adding listeners
    const afterListenersDebug = page.getNetworkDebugSnapshot();
    progress.log(`📊 After listeners: ${JSON.stringify(afterListenersDebug)}`);

    // Trigger a request
    progress.log('🚀 Triggering test request...');
    const testResult = await page.evaluate(() => {
      return fetch('/?' + Date.now())
        .then(() => 'success')
        .catch(() => 'error');
    });

    // Wait for events
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get final debug state
    const finalDebug = page.getNetworkDebugSnapshot();
    progress.log(`📊 Final: ${JSON.stringify(finalDebug)}`);

    // Clean up
    requestDisposable.dispose();
    responseDisposable.dispose();

    // Report results
    progress.log(`📋 RESULTS:`);
    progress.log(`   Request received: ${requestReceived} (${requestUrl})`);
    progress.log(`   Response received: ${responseReceived} (${responseStatus})`);
    progress.log(`   Fetch result: ${testResult}`);

    const success = requestReceived && responseReceived;

    context.events.emit({
      timestamp: Date.now(),
      severity: success ? Severity.Success : Severity.Error,
      message: `Page listeners test: ${success ? 'WORKING' : 'BROKEN'}`,
      details: {
        requestReceived,
        responseReceived,
        requestUrl,
        responseStatus,
        testResult,
        initialDebug,
        afterListenersDebug,
        finalDebug,
      },
    });

    if (!success) {
      throw new Error(
        `Page listeners still not working: req=${requestReceived}, res=${responseReceived}`,
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ Page listeners test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Page listeners test failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}
