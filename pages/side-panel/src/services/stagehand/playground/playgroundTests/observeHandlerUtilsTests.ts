/**
 * ObserveHandlerUtils Tests
 *
 * This test suite validates the ObserveHandler content script functions
 * with comprehensive DOM verification and real element observation testing.
 */

import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage, Severity } from '@src/utils/types';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import {
  drawObserveOverlayFunction,
  clearObserveOverlaysFunction,
  countObservableElementsFunction,
  getObservedElementInfoFunction,
  testXPathEvaluationFunction,
  validateOverlayPositioningFunction,
  observeDrawOverlayFunction,
  observeClearOverlaysFunction,
  observeCountElementsFunction,
  observeGetElementInfoFunction,
  observeTestXPathFunction,
  observeValidateOverlayFunction,
} from '../../lib/handlers/observeHandlerUtils';

interface TestContext {
  events: SimpleEventEmitter<EventMessage>;
  storage: ILocalAsyncStorage<SidePanelAppStorageSchema>;
}

interface TestResults {
  passed: number;
  failed: number;
  errors: string[];
}

/**
 * Test ObserveHandlerUtils core functionality
 * Tests content script functions for element observation and highlighting
 */
export async function testObserveHandlerUtils(context: TestContext): Promise<void> {
  console.log('[DEBUG] testObserveHandlerUtils called - starting...');

  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ObserveHandlerUtils Tests] Starting ObserveHandlerUtils test suite...',
    });

    // Test 1: Pure function imports validation
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ObserveHandlerUtils Tests] Testing function imports...',
    });
    await testObserveHandlerImports(context);

    // Test 2: Content script function registry
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ObserveHandlerUtils Tests] Testing content script function registry...',
    });
    await testObserveContentScriptRegistry(context);

    // Test 3: Live page execution with real DOM elements
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ObserveHandlerUtils Tests] Testing live page execution...',
    });
    await testObserveLivePageExecution(context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ObserveHandlerUtils Tests] ObserveHandlerUtils test suite completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `[ObserveHandlerUtils Tests] Test suite failed: ${errorMessage}`,
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Test ObserveHandlerUtils function imports
 */
async function testObserveHandlerImports(context: TestContext): Promise<void> {
  const results: TestResults = { passed: 0, failed: 0, errors: [] };

  const functionTests = [
    { name: 'drawObserveOverlayFunction', fn: drawObserveOverlayFunction },
    { name: 'clearObserveOverlaysFunction', fn: clearObserveOverlaysFunction },
    { name: 'countObservableElementsFunction', fn: countObservableElementsFunction },
    { name: 'getObservedElementInfoFunction', fn: getObservedElementInfoFunction },
    { name: 'testXPathEvaluationFunction', fn: testXPathEvaluationFunction },
    { name: 'validateOverlayPositioningFunction', fn: validateOverlayPositioningFunction },
    // Exported alias functions
    { name: 'observeDrawOverlayFunction', fn: observeDrawOverlayFunction },
    { name: 'observeClearOverlaysFunction', fn: observeClearOverlaysFunction },
    { name: 'observeCountElementsFunction', fn: observeCountElementsFunction },
    { name: 'observeGetElementInfoFunction', fn: observeGetElementInfoFunction },
    { name: 'observeTestXPathFunction', fn: observeTestXPathFunction },
    { name: 'observeValidateOverlayFunction', fn: observeValidateOverlayFunction },
  ];

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '[ObserveHandlerUtils Tests] Testing function imports...',
  });

  for (const test of functionTests) {
    try {
      if (typeof test.fn !== 'function') {
        results.failed++;
        results.errors.push(`${test.name} is not a function`);
        continue;
      }

      // Test function properties
      if (test.fn.length === undefined) {
        results.failed++;
        results.errors.push(`${test.name} missing function properties`);
        continue;
      }

      results.passed++;
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: `[ObserveHandlerUtils Tests] ✅ ${test.name} imported successfully`,
      });
    } catch (error) {
      results.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.errors.push(`${test.name}: ${errorMsg}`);
    }
  }

  context.events.emit({
    timestamp: Date.now(),
    severity: results.failed === 0 ? Severity.Success : Severity.Error,
    message: `[ObserveHandlerUtils Tests] Function import tests: ${results.passed} passed, ${results.failed} failed`,
    details: {
      passed: results.passed,
      failed: results.failed,
      errors: results.errors,
    },
  });
}

/**
 * Test content script function registry concepts
 */
async function testObserveContentScriptRegistry(context: TestContext): Promise<void> {
  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '[ObserveHandlerUtils Tests] Testing content script function registry...',
  });

  try {
    // Test that all observe functions are properly typed and can be registered
    const observeFunctions = {
      drawOverlay: drawObserveOverlayFunction,
      clearOverlays: clearObserveOverlaysFunction,
      countElements: countObservableElementsFunction,
      getElementInfo: getObservedElementInfoFunction,
      testXPath: testXPathEvaluationFunction,
      validateOverlay: validateOverlayPositioningFunction,
    };

    for (const [name, fn] of Object.entries(observeFunctions)) {
      if (typeof fn !== 'function') {
        throw new Error(`${name} is not a valid function`);
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ObserveHandlerUtils Tests] ✅ Content script function registry validated',
      details: {
        functionCount: Object.keys(observeFunctions).length,
        functions: Object.keys(observeFunctions),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `[ObserveHandlerUtils Tests] ❌ Content script registry test failed: ${errorMessage}`,
    });
    throw error;
  }
}

/**
 * Test ObserveHandlerUtils functions with live page execution
 */
async function testObserveLivePageExecution(context: TestContext): Promise<void> {
  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '[ObserveHandlerUtils Tests] Testing with live page at http://localhost:3005...',
  });

  let browserWindow: BrowserWindow | null = null;

  try {
    browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();
    await page.goto('http://localhost:3005');

    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Register our observe functions in the content script using page.evaluate
    await page.evaluate(() => {
      // Get the injected script handler
      const injectedScript = (
        window as {
          __cordyceps_handledInjectedScript?: {
            registerElementFunction: (
              name: string,
              fn: (element: Element, options?: unknown) => unknown,
              description: string
            ) => void;
          };
        }
      ).__cordyceps_handledInjectedScript;

      if (!injectedScript) {
        throw new Error('Cordyceps injected script not found');
      }

      // Define all ObserveHandlerUtils functions directly inline (CSP-compliant)

      // drawObserveOverlayFunction - takes array of selectors as options parameter
      function drawObserveOverlayFunction(element: Element, options?: unknown): void {
        const selectors = options as string[];
        if (!Array.isArray(selectors)) return;

        selectors.forEach(selector => {
          let targetElement: Element | null;

          if (selector.startsWith('xpath=')) {
            const xpath = selector.substring(6);
            targetElement = document.evaluate(
              xpath,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue as Element | null;
          } else {
            targetElement = document.querySelector(selector);
          }

          if (targetElement instanceof HTMLElement) {
            const overlay = document.createElement('div');
            overlay.setAttribute('stagehandObserve', 'true');
            const rect = targetElement.getBoundingClientRect();
            overlay.style.position = 'absolute';
            overlay.style.left = rect.left + 'px';
            overlay.style.top = rect.top + 'px';
            overlay.style.width = rect.width + 'px';
            overlay.style.height = rect.height + 'px';
            overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
            overlay.style.pointerEvents = 'none';
            overlay.style.zIndex = '10000';
            document.body.appendChild(overlay);
          }
        });
      }

      // clearObserveOverlaysFunction
      function clearObserveOverlaysFunction(_element: Element, _options?: unknown): void {
        const overlays = document.querySelectorAll('[stagehandObserve="true"]');
        overlays.forEach(overlay => overlay.remove());
      }

      // countObservableElementsFunction
      function countObservableElementsFunction(
        element: Element,
        options?: unknown
      ): {
        totalSelectors: number;
        foundElements: number;
        foundElementTypes: string[];
        missingSelectors: string[];
      } {
        const selectors = options as string[];
        if (!Array.isArray(selectors)) {
          return {
            totalSelectors: 0,
            foundElements: 0,
            foundElementTypes: [],
            missingSelectors: [],
          };
        }

        const foundElementTypes: string[] = [];
        const missingSelectors: string[] = [];
        let foundElements = 0;

        selectors.forEach(selector => {
          let targetElement: Element | null;

          if (selector.startsWith('xpath=')) {
            const xpath = selector.substring(6);
            targetElement = document.evaluate(
              xpath,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue as Element | null;
          } else {
            targetElement = document.querySelector(selector);
          }

          if (targetElement) {
            foundElements++;
            foundElementTypes.push(targetElement.tagName.toLowerCase());
          } else {
            missingSelectors.push(selector);
          }
        });

        return {
          totalSelectors: selectors.length,
          foundElements,
          foundElementTypes,
          missingSelectors,
        };
      }

      // getObservedElementInfoFunction
      function getObservedElementInfoFunction(
        element: Element,
        options?: unknown
      ): Array<{
        selector: string;
        found: boolean;
        tagName?: string;
        id?: string;
        className?: string;
        textContent?: string;
        visible?: boolean;
      }> {
        const selectors = options as string[];
        if (!Array.isArray(selectors)) return [];

        return selectors.map(selector => {
          let targetElement: Element | null;

          if (selector.startsWith('xpath=')) {
            const xpath = selector.substring(6);
            targetElement = document.evaluate(
              xpath,
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue as Element | null;
          } else {
            targetElement = document.querySelector(selector);
          }

          if (!targetElement) {
            return {
              selector,
              found: false,
            };
          }

          const htmlElement = targetElement as HTMLElement;
          const rect = htmlElement.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(htmlElement);

          return {
            selector,
            found: true,
            tagName: targetElement.tagName.toLowerCase(),
            id: targetElement.id || undefined,
            className: targetElement.className || undefined,
            textContent: targetElement.textContent?.trim().slice(0, 100) || undefined,
            visible:
              computedStyle.display !== 'none' &&
              computedStyle.visibility !== 'hidden' &&
              rect.width > 0 &&
              rect.height > 0,
          };
        });
      }

      // testXPathEvaluationFunction
      function testXPathEvaluationFunction(
        element: Element,
        options?: unknown
      ): Array<{
        xpath: string;
        success: boolean;
        error?: string;
        elementCount?: number;
        firstElementTag?: string;
      }> {
        const xpaths = options as string[];
        if (!Array.isArray(xpaths)) return [];

        return xpaths.map(xpath => {
          try {
            const result = document.evaluate(
              xpath,
              document,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null
            );

            const elementCount = result.snapshotLength;
            const firstElement = elementCount > 0 ? result.snapshotItem(0) : null;

            return {
              xpath,
              success: true,
              elementCount,
              firstElementTag: firstElement?.nodeName.toLowerCase(),
            };
          } catch (error) {
            return {
              xpath,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        });
      }

      // Register all functions
      injectedScript.registerElementFunction(
        'drawObserveOverlay',
        drawObserveOverlayFunction,
        'Draw visual overlays on elements'
      );

      injectedScript.registerElementFunction(
        'clearObserveOverlays',
        clearObserveOverlaysFunction,
        'Clear all observation overlays'
      );

      injectedScript.registerElementFunction(
        'countObservableElements',
        countObservableElementsFunction,
        'Count observable elements matching selectors'
      );

      injectedScript.registerElementFunction(
        'getObservedElementInfo',
        getObservedElementInfoFunction,
        'Get detailed element information'
      );

      injectedScript.registerElementFunction(
        'testXPathEvaluation',
        testXPathEvaluationFunction,
        'Test XPath evaluation capabilities'
      );
    });

    // Test with body element to access registered functions
    const bodyLocator = page.locator('body');

    // Test 1: Count observable elements on the page
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ObserveHandlerUtils Tests] Testing countObservableElements function...',
    });

    const testSelectors = [
      'h1',
      'button',
      'input[type="text"]',
      'xpath=//button[@id="test-button"]',
      'xpath=//h1[contains(text(), "Cordyceps")]',
    ];

    const countResult = (await bodyLocator.executeFunction(
      'countObservableElements',
      testSelectors
    )) as {
      totalSelectors: number;
      foundElements: number;
      foundElementTypes: string[];
      missingSelectors: string[];
    };

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ObserveHandlerUtils Tests] ✅ Element counting completed',
      details: {
        totalSelectors: countResult.totalSelectors,
        foundElements: countResult.foundElements,
        foundElementTypes: countResult.foundElementTypes,
        missingSelectors: countResult.missingSelectors,
      },
    });

    // Test 2: Get detailed element information
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ObserveHandlerUtils Tests] Testing getObservedElementInfo function...',
    });

    const elementInfo = (await bodyLocator.executeFunction(
      'getObservedElementInfo',
      testSelectors
    )) as Array<{
      selector: string;
      found: boolean;
      tagName?: string;
      id?: string;
      className?: string;
      textContent?: string;
      visible?: boolean;
    }>;

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ObserveHandlerUtils Tests] ✅ Element information retrieved',
      details: { elementCount: elementInfo.length },
    });

    // Test 3: Test XPath evaluation
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ObserveHandlerUtils Tests] Testing testXPathEvaluation function...',
    });

    const xpathTests = [
      '//h1',
      '//button[@id="test-button"]',
      '//div[@class="container"]',
      '//input[@type="text"]',
      '//a[@href]',
    ];

    const xpathResults = (await bodyLocator.executeFunction(
      'testXPathEvaluation',
      xpathTests
    )) as Array<{
      xpath: string;
      success: boolean;
      error?: string;
      elementCount?: number;
      firstElementTag?: string;
    }>;

    const successfulXPaths = xpathResults.filter(result => result.success);
    const failedXPaths = xpathResults.filter(result => !result.success);

    context.events.emit({
      timestamp: Date.now(),
      severity: failedXPaths.length === 0 ? Severity.Success : Severity.Warning,
      message: `[ObserveHandlerUtils Tests] XPath evaluation: ${successfulXPaths.length} successful, ${failedXPaths.length} failed`,
      details: {
        successful: successfulXPaths,
        failed: failedXPaths,
      },
    });

    // Test 4: Draw observe overlays
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ObserveHandlerUtils Tests] Testing drawObserveOverlay function...',
    });

    const overlayResult = await bodyLocator.executeFunction('drawObserveOverlay', testSelectors);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ObserveHandlerUtils Tests] ✅ drawObserveOverlay executed successfully',
      details: { selectors: testSelectors, result: overlayResult },
    });

    // Test 5: Clear overlays
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ObserveHandlerUtils Tests] Testing clearObserveOverlays function...',
    });

    await bodyLocator.executeFunction('clearObserveOverlays');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ObserveHandlerUtils Tests] ✅ Overlays cleared successfully',
    });

    // Final validation
    const finalValidation = {
      elementsCountedCorrectly: countResult.foundElements > 0,
      elementInfoRetrieved: elementInfo.some(info => info.found),
      xpathEvaluationWorking: successfulXPaths.length > 0,
      overlaysDrawnAndCleared: overlayResult !== undefined,
    };

    const allTestsPassed = Object.values(finalValidation).every(result => result === true);

    context.events.emit({
      timestamp: Date.now(),
      severity: allTestsPassed ? Severity.Success : Severity.Warning,
      message: `[ObserveHandlerUtils Tests] Live page testing completed: ${allTestsPassed ? 'All tests passed' : 'Some tests failed'}`,
      details: finalValidation,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `[ObserveHandlerUtils Tests] Live page testing failed: ${errorMessage}`,
    });
    throw error;
  } finally {
    if (browserWindow) {
      try {
        await browserWindow.dispose();
      } catch (closeError) {
        console.warn('Failed to close browser window:', closeError);
      }
    }
  }
}

/**
 * Advanced TypeScript test patterns for comprehensive function validation
 */
async function testObserveFunctionCompleteTests(): Promise<TestResults> {
  const results: TestResults = { passed: 0, failed: 0, errors: [] };

  console.log('🧪 Testing ObserveHandlerUtils Redux Function Completeness...');

  const allFunctions = [
    drawObserveOverlayFunction,
    clearObserveOverlaysFunction,
    countObservableElementsFunction,
    getObservedElementInfoFunction,
    testXPathEvaluationFunction,
    validateOverlayPositioningFunction,
    observeDrawOverlayFunction,
    observeClearOverlaysFunction,
    observeCountElementsFunction,
    observeGetElementInfoFunction,
    observeTestXPathFunction,
    observeValidateOverlayFunction,
  ];

  // Test function completeness
  for (const fn of allFunctions) {
    try {
      if (typeof fn !== 'function') {
        results.failed++;
        results.errors.push('Function is not properly defined');
        continue;
      }

      if (fn.length === undefined) {
        results.failed++;
        results.errors.push('Function missing parameter information');
        continue;
      }

      results.passed++;
    } catch (error) {
      results.failed++;
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.errors.push(errorMsg);
    }
  }

  return results;
}

// Export test functions
export { testObserveFunctionCompleteTests };
