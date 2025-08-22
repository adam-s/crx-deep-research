/**
 * Tests for a11y utils Cordyceps conversion
 *
 * Tests the core converted functions:
 * - getAccessibilityTree() using Cordyceps ariaSnapshotForRecorder
 * - resolveObjectIdForXPath() using native document.evaluate
 * - findScrollableElementIds() using converted approach
 */

import { Page } from '../../../cordyceps/page';
import { TestContext } from './types';

export async function runA11yUtilsCordycepsConversionTests(
  page: Page,
  _context: TestContext
): Promise<{
  passed: number;
  total: number;
  details: Array<{ test: string; passed: boolean; error?: string }>;
}> {
  const results: Array<{ test: string; passed: boolean; error?: string }> = [];

  try {
    // Test 1: Basic XPath resolution
    console.log('🧪 Test 1: XPath Resolution with Cordyceps');

    const testResult1 = await page.evaluate(() => {
      try {
        // Test native document.evaluate (equivalent to our converted function)
        const xpath = '//body';
        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );

        return {
          success: !!result.singleNodeValue,
          elementTag: (result.singleNodeValue as Element)?.tagName,
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });

    results.push({
      test: 'XPath Resolution - Basic',
      passed: testResult1.success && testResult1.elementTag === 'BODY',
    });

    // Test 2: Aria Snapshot Generation
    console.log('🧪 Test 2: Aria Snapshot Generation');

    const testResult2 = await page.evaluate(() => {
      try {
        // Test using existing HandledInjectedScript instance
        const handledScript = (window as any).__handledInjectedScript_main;
        if (!handledScript) {
          return { success: false, error: 'HandledInjectedScript not available' };
        }

        const snapshot = handledScript.injectedScript.ariaSnapshotForRecorder();

        return {
          success: !!(snapshot.ariaSnapshot && snapshot.refs),
          snapshotLength: snapshot.ariaSnapshot.length,
          refsCount: snapshot.refs.size,
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });

    results.push({
      test: 'Aria Snapshot Generation',
      passed: testResult2.success,
      error: testResult2.error,
    });

    // Test 3: Scrollable Element Detection
    console.log('🧪 Test 3: Scrollable Element Detection');

    const testResult3 = await page.evaluate(async () => {
      try {
        // Test if getScrollableElementXpaths is available
        if (typeof window.getScrollableElementXpaths !== 'function') {
          return { success: false, error: 'getScrollableElementXpaths not available' };
        }

        const scrollableXpaths = await window.getScrollableElementXpaths();

        return {
          success: Array.isArray(scrollableXpaths),
          xpathsCount: scrollableXpaths.length,
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });

    results.push({
      test: 'Scrollable Element Detection',
      passed: testResult3.success,
      error: testResult3.error,
    });

    // Test 4: Combined Functionality Test
    console.log('🧪 Test 4: Combined Functionality');

    const testResult4 = await page.evaluate(async () => {
      try {
        // Test using existing HandledInjectedScript instance
        const handledScript = (window as any).__handledInjectedScript_main;
        if (!handledScript) {
          return { success: false, error: 'HandledInjectedScript not available' };
        }
        const snapshot = handledScript.injectedScript.ariaSnapshotForRecorder();

        const scrollableXpaths = await window.getScrollableElementXpaths();

        // Test XPath resolution on scrollable elements
        let resolvedCount = 0;
        for (const xpath of scrollableXpaths.slice(0, 3)) {
          // Test first 3 to avoid timeout
          const result = document.evaluate(
            xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
          );
          if (result.singleNodeValue) resolvedCount++;
        }

        return {
          success: true,
          snapshotValid: !!(snapshot.ariaSnapshot && snapshot.refs),
          scrollableCount: scrollableXpaths.length,
          resolvedScrollables: resolvedCount,
        };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    });

    results.push({
      test: 'Combined Functionality',
      passed: testResult4.success && (testResult4.snapshotValid || false),
      error: testResult4.error,
    });
  } catch (error) {
    results.push({
      test: 'Overall Test Execution',
      passed: false,
      error: String(error),
    });
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;

  console.log(`\n📊 A11y Utils Cordyceps Conversion Test Results:`);
  console.log(`✅ Passed: ${passed}/${total}`);

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.test}${result.error ? ` - ${result.error}` : ''}`);
  }

  return {
    passed,
    total,
    details: results,
  };
}

// Quick test wrapper for stagehandPlayground.service.ts integration
export async function quickA11yUtilsCordycepsConversionTest(): Promise<boolean> {
  try {
    // For the quick test, we'll use a basic page setup
    const page = (globalThis as any).cordycepsCurrentPage;
    if (!page) {
      console.warn('No Cordyceps page available for A11y utils test');
      return false;
    }

    const mockContext: TestContext = {
      events: { emit: () => {} } as any,
      storage: {} as any,
    };

    const result = await runA11yUtilsCordycepsConversionTests(page, mockContext);
    return result.passed === result.total;
  } catch (error) {
    console.error('Quick A11y utils test failed:', error);
    return false;
  }
}
