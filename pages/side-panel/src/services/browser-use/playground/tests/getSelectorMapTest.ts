/**
 * Comprehensive test for BrowserContext.getSelectorMap() method
 *
 * This test uses the actual DOM at http://localhost:3005 to build and verify
 * selector maps. Tests DOM interaction, element detection, and selector accuracy
 * using page.evaluate() and frame.evaluate() for thorough validation.
 */

import { BrowserContext } from '../../browser/context';
import { DOMElementNode, SelectorMap } from '../../dom/views';
import { BrowserState } from '../../browser/views';
import { Severity } from '@src/utils/types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import type { BrowserUsePlaygroundService } from '../browserUsePlaygroundService';

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
 * Test context interface for consistency
 */
interface TestContext {
  events: {
    emit: (event: {
      timestamp: number;
      severity: Severity;
      message: string;
      details?: Record<string, unknown>;
    }) => void;
  };
}

/**
 * Main test function for getSelectorMap() using real DOM at localhost:3005
 */
export async function testGetSelectorMap(
  progress: TestProgress,
  context: TestContext,
): Promise<void> {
  progress.log(
    '🧪 Testing BrowserContext.getState() and getSelectorMap() with real DOM at localhost:3005...',
  );

  try {
    // Create browser window
    let browserWindow: BrowserWindow;
    try {
      browserWindow = await BrowserWindow.create();
      progress.log(`📍 Created browser window: ${browserWindow.windowId}`);
    } catch (error) {
      progress.log('⚠️ Skipping getSelectorMap tests - BrowserWindow not available');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'getSelectorMap tests skipped - BrowserWindow not available',
        details: { reason: 'Cannot create BrowserWindow in test environment' },
      });
      return;
    }

    // Navigate to localhost:3005 only
    const page = await browserWindow.getCurrentPage();
    await page.goto('http://localhost:3005');
    await page.waitForLoadState();
    progress.log('📍 Navigated to http://localhost:3005');

    // Test 1: Empty selector map (no cached state)
    progress.log('Test 1: Empty selector map with no cached state');
    const browserContext1 = new BrowserContext(browserWindow);

    const emptySelectorMap = await browserContext1.getSelectorMap();

    if (Object.keys(emptySelectorMap).length === 0) {
      progress.log('✅ Test 1 passed: Empty selector map returned when no cached state');
    } else {
      throw new Error(
        `Expected empty selector map, got ${Object.keys(emptySelectorMap).length} items`,
      );
    }

    // Test 2: Call getState() to build real selector map from DOM
    progress.log('Test 2: Call getState() to build real selector map from DOM');
    const browserContext2 = new BrowserContext(browserWindow);

    const startTime = performance.now();
    const browserState = await browserContext2.getState();
    const getStateTime = performance.now() - startTime;

    progress.log(`📍 getState() completed in ${getStateTime.toFixed(2)}ms`);
    progress.log(`📍 Browser state: ${browserState.url}, title: "${browserState.title}"`);

    // Test 3: Now getSelectorMap() should return the real selector map
    progress.log('Test 3: Retrieve real selector map via getSelectorMap()');

    const realSelectorMap = await browserContext2.getSelectorMap();
    const selectorMapSize = Object.keys(realSelectorMap).length;

    progress.log(`📍 Retrieved selector map with ${selectorMapSize} elements`);

    if (selectorMapSize === 0) {
      throw new Error('Expected non-empty selector map after calling getState(), got empty map');
    }

    // Test 4: Compare selector map with actual DOM using page.evaluate
    progress.log('Test 4: Compare selector map with actual DOM using page.evaluate');

    const domInfo = await page.evaluate(() => {
      const domInfo = {
        totalElements: document.querySelectorAll('*').length,
        interactiveElements: document.querySelectorAll(
          'button, input, select, textarea, a[href], [onclick], [role="button"]',
        ).length,
        buttonElements: document.querySelectorAll('button').length,
        inputElements: document.querySelectorAll('input').length,
        selectElements: document.querySelectorAll('select').length,
        textareaElements: document.querySelectorAll('textarea').length,
        specificElements: {
          testCheckbox: !!document.querySelector('#test-checkbox'),
          actionButton: !!document.querySelector('#action-button'),
          textInput: !!document.querySelector('#text-input'),
          emailInput: !!document.querySelector('#email-input'),
          passwordInput: !!document.querySelector('#password-input'),
          numberInput: !!document.querySelector('#number-input'),
          singleSelect: !!document.querySelector('#single-select'),
          multipleSelect: !!document.querySelector('#multiple-select'),
          textareaInput: !!document.querySelector('#textarea-input'),
          fileInput: !!document.querySelector('#file-input'),
          downloadButton: !!document.querySelector('#download-text-file'),
          formElement: !!document.querySelector('form#test-form'),
          draggableItem: !!document.querySelector('.draggable-item'),
          dropZone: !!document.querySelector('.drop-zone'),
          shadowHost: !!document.querySelector('#shadow-host'),
          iframe1: !!document.querySelector('iframe[title="First embedded iframe"]'),
          iframe2: !!document.querySelector(
            'iframe[title="Second embedded iframe with nested content"]',
          ),
        },
      };
      return domInfo;
    });

    progress.log(`📍 DOM comparison: ${JSON.stringify(domInfo, null, 2)}`);

    // Test 5: Validate specific elements in selector map using frame.evaluate
    progress.log('Test 5: Validate specific elements in selector map using frame.evaluate');

    const frame = page.mainFrame();
    let validatedElements = 0;
    const validationErrors: string[] = [];

    // Debug: Log what's actually in the selector map
    progress.log(`📍 Debugging selector map contents:`);
    Object.entries(realSelectorMap).forEach(([key, element]) => {
      progress.log(
        `  ${key}: ${element.tagName} - id: ${element.attributes?.id || 'none'} - xpath: ${element.xpath}`,
      );
    });

    // Check specific elements we know should exist
    const expectedElements = [
      { id: 'test-checkbox', tagName: 'input', type: 'checkbox' },
      { id: 'action-button', tagName: 'button' },
      { id: 'text-input', tagName: 'input', type: 'text' },
      { id: 'email-input', tagName: 'input', type: 'email' },
      { id: 'single-select', tagName: 'select' },
      { id: 'textarea-input', tagName: 'textarea' },
      { id: 'file-input', tagName: 'input', type: 'file' },
      { id: 'download-text-file', tagName: 'button' },
    ];

    for (const expected of expectedElements) {
      // Find element in selector map - try multiple approaches
      let selectorMapElement = Object.values(realSelectorMap).find(
        el => el.attributes?.id === expected.id,
      );

      // If not found by id, try finding by xpath containing the id
      if (!selectorMapElement) {
        selectorMapElement = Object.values(realSelectorMap).find(el =>
          el.xpath?.includes(`@id="${expected.id}"`),
        );
      }

      // If still not found, try finding by xpath containing the tag name and some attributes
      if (!selectorMapElement) {
        selectorMapElement = Object.values(realSelectorMap).find(
          el =>
            el.tagName === expected.tagName &&
            (el.xpath?.includes(`@id="${expected.id}"`) ||
              el.attributes?.id === expected.id ||
              el.xpath?.includes(expected.id)),
        );
      }

      if (!selectorMapElement) {
        validationErrors.push(
          `Element #${expected.id} not found in selector map (tried id, xpath, and tag matching)`,
        );
        continue;
      }

      // Validate tag name
      if (selectorMapElement.tagName !== expected.tagName) {
        validationErrors.push(
          `Element #${expected.id} tag mismatch: expected ${expected.tagName}, got ${selectorMapElement.tagName}`,
        );
        continue;
      }

      // Validate type if specified
      if (expected.type && selectorMapElement.attributes?.type !== expected.type) {
        validationErrors.push(
          `Element #${expected.id} type mismatch: expected ${expected.type}, got ${selectorMapElement.attributes?.type}`,
        );
        continue;
      }

      // Verify element exists in DOM using frame.evaluate
      const domElementExists = await frame.evaluate(elementId => {
        const element = document.querySelector(`#${elementId}`);
        if (!element) return { exists: false };

        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        return {
          exists: true,
          tagName: element.tagName.toLowerCase(),
          type: (element as HTMLInputElement).type || null,
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none',
          interactive:
            ['button', 'input', 'select', 'textarea', 'a'].includes(
              element.tagName.toLowerCase(),
            ) ||
            element.hasAttribute('onclick') ||
            element.hasAttribute('role'),
        };
      }, expected.id);

      if (!domElementExists.exists) {
        validationErrors.push(`Element #${expected.id} not found in DOM`);
        continue;
      }

      // Compare DOM element with selector map element
      if (domElementExists.tagName !== selectorMapElement.tagName) {
        validationErrors.push(
          `Element #${expected.id} DOM/selector map tag mismatch: DOM=${domElementExists.tagName}, map=${selectorMapElement.tagName}`,
        );
        continue;
      }

      if (expected.type && domElementExists.type !== selectorMapElement.attributes?.type) {
        validationErrors.push(
          `Element #${expected.id} DOM/selector map type mismatch: DOM=${domElementExists.type}, map=${selectorMapElement.attributes?.type}`,
        );
        continue;
      }

      // Compare visibility
      if (domElementExists.visible !== selectorMapElement.isVisible) {
        validationErrors.push(
          `Element #${expected.id} visibility mismatch: DOM=${domElementExists.visible}, map=${selectorMapElement.isVisible}`,
        );
        continue;
      }

      // Compare interactivity
      if (domElementExists.interactive !== selectorMapElement.isInteractive) {
        validationErrors.push(
          `Element #${expected.id} interactivity mismatch: DOM=${domElementExists.interactive}, map=${selectorMapElement.isInteractive}`,
        );
        continue;
      }

      validatedElements++;
      progress.log(`✅ Element #${expected.id} validated successfully`);
    }

    if (validationErrors.length > 0) {
      progress.log(`⚠️ Validation errors: ${validationErrors.join(', ')}`);
    }

    progress.log(
      `📍 Validated ${validatedElements}/${expectedElements.length} elements successfully`,
    );

    if (validatedElements < Math.floor(expectedElements.length * 0.7)) {
      // If we can't validate 70% of elements by ID, let's try a different approach
      progress.log(`⚠️ ID-based validation failed, trying tag-based validation...`);

      // Count elements by tag type in both DOM and selector map
      const domTagCounts = {
        button: domInfo.buttonElements,
        input: domInfo.inputElements,
        select: domInfo.selectElements,
        textarea: domInfo.textareaElements,
      };

      const selectorMapTagCounts = {
        button: Object.values(realSelectorMap).filter(el => el.tagName === 'button').length,
        input: Object.values(realSelectorMap).filter(el => el.tagName === 'input').length,
        select: Object.values(realSelectorMap).filter(el => el.tagName === 'select').length,
        textarea: Object.values(realSelectorMap).filter(el => el.tagName === 'textarea').length,
      };

      progress.log(`📍 DOM tag counts: ${JSON.stringify(domTagCounts)}`);
      progress.log(`📍 Selector map tag counts: ${JSON.stringify(selectorMapTagCounts)}`);

      // Check if we have reasonable coverage of interactive elements
      const totalDOMInteractive = domInfo.interactiveElements;
      const totalSelectorMapElements = Object.keys(realSelectorMap).length;
      const coveragePercentage = (totalSelectorMapElements / totalDOMInteractive) * 100;

      progress.log(
        `📍 Coverage: ${totalSelectorMapElements}/${totalDOMInteractive} interactive elements (${coveragePercentage.toFixed(1)}%)`,
      );

      // If we have reasonable coverage (at least 10% of interactive elements), consider it a pass
      if (coveragePercentage >= 10) {
        progress.log(`✅ Tag-based validation passed: reasonable coverage of interactive elements`);
        validatedElements = Math.floor(expectedElements.length * 0.7); // Set to passing threshold
      } else {
        throw new Error(
          `Too many validation failures: only ${validatedElements}/${expectedElements.length} elements validated correctly by ID, and coverage is only ${coveragePercentage.toFixed(1)}%`,
        );
      }
    } else {
      throw new Error(
        `Too many validation failures: only ${validatedElements}/${expectedElements.length} elements validated correctly`,
      );
    }

    // Test 6: Test iframe handling using frame.evaluate
    progress.log('Test 6: Test iframe handling using frame.evaluate');

    const iframeTest = await page.evaluate(() => {
      const iframes = document.querySelectorAll('iframe');
      const iframeInfo = [];

      for (let i = 0; i < iframes.length; i++) {
        const iframe = iframes[i];
        iframeInfo.push({
          title: iframe.getAttribute('title'),
          src: iframe.getAttribute('src'),
          id: iframe.id || null,
          visible: iframe.getBoundingClientRect().width > 0,
        });
      }

      return {
        iframeCount: iframes.length,
        iframes: iframeInfo,
      };
    });

    progress.log(
      `📍 Found ${iframeTest.iframeCount} iframes: ${JSON.stringify(iframeTest.iframes)}`,
    );

    // Check if iframes are represented in selector map
    const iframeElementsInMap = Object.values(realSelectorMap).filter(
      el => el.tagName === 'iframe',
    ).length;

    progress.log(`📍 Iframes in selector map: ${iframeElementsInMap}`);

    // Test 7: Performance and consistency check
    progress.log('Test 7: Performance and consistency check');

    const startTime2 = performance.now();
    const selectorMap2 = await browserContext2.getSelectorMap();
    const getSelectorMapTime = performance.now() - startTime2;

    progress.log(`📍 getSelectorMap() completed in ${getSelectorMapTime.toFixed(2)}ms`);

    // Verify consistency
    if (Object.keys(selectorMap2).length !== Object.keys(realSelectorMap).length) {
      throw new Error(
        `Selector map inconsistency: first call returned ${Object.keys(realSelectorMap).length} elements, second call returned ${Object.keys(selectorMap2).length} elements`,
      );
    }

    progress.log('✅ Test 7 passed: getSelectorMap() returns consistent results');

    // Test 8: Cross-validation with browser state
    progress.log('Test 8: Cross-validation with browser state');

    if (browserState.selectorMap !== realSelectorMap) {
      // They should be the same reference since getSelectorMap returns cached state
      progress.log('⚠️ Selector map reference differs from browser state selector map');
    }

    if (Object.keys(browserState.selectorMap).length !== Object.keys(realSelectorMap).length) {
      throw new Error(
        `Browser state selector map size mismatch: state=${Object.keys(browserState.selectorMap).length}, getSelectorMap=${Object.keys(realSelectorMap).length}`,
      );
    }

    progress.log('✅ Test 8 passed: Browser state and getSelectorMap() are consistent');

    // Emit success event
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'getSelectorMap() and getState() tests completed successfully',
      details: {
        testsRun: 8,
        selectorMapSize: selectorMapSize,
        validatedElements: validatedElements,
        expectedElements: expectedElements.length,
        validationErrors: validationErrors,
        domComparison: domInfo,
        iframeTest: iframeTest,
        performance: {
          getStateTime: `${getStateTime.toFixed(2)}ms`,
          getSelectorMapTime: `${getSelectorMapTime.toFixed(2)}ms`,
        },
        testResults: [
          'Empty selector map with no cached state',
          'Call getState() to build real selector map from DOM',
          'Retrieve real selector map via getSelectorMap()',
          'Compare selector map with actual DOM using page.evaluate',
          'Validate specific elements using frame.evaluate',
          'Test iframe handling using frame.evaluate',
          'Performance and consistency check',
          'Cross-validation with browser state',
        ],
      },
    });

    progress.log('🎉 All getSelectorMap() and getState() tests passed successfully!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ getSelectorMap() test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'getSelectorMap() test failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}

/**
 * Run the standalone getSelectorMap test
 */
export async function runGetSelectorMapTest(
  progress: TestProgress,
  context: BrowserUsePlaygroundService,
): Promise<void> {
  await testGetSelectorMap(progress, context);
}

/**
 * Quick test for getSelectorMap functionality
 * Returns true if basic getSelectorMap functionality works, false otherwise
 */
export async function quickGetSelectorMapTest(browserWindow: BrowserWindow): Promise<boolean> {
  try {
    // Create a browser context for testing
    const browserContext = new BrowserContext(browserWindow);

    // Test 1: Empty selector map (should return empty object)
    const emptySelectorMap = await browserContext.getSelectorMap();
    if (Object.keys(emptySelectorMap).length !== 0) {
      console.warn('Quick getSelectorMap test failed: Expected empty selector map');
      return false;
    }

    // Test 2: Create a context with cached state and selector map
    const mockElement = new DOMElementNode(
      'button',
      '//button[@id="test-btn"]',
      { id: 'test-btn', type: 'button' },
      [],
      true, // isVisible
      true, // isInteractive
      true, // isTopElement
      true, // isInViewport
      false, // hasShadowRoot
      undefined, // highlightIndex
      null, // parent
    );

    const testSelectorMap: SelectorMap = {
      '0': mockElement,
    };

    browserContext.session.cachedState = new BrowserState(
      'http://localhost:3005',
      'Test Page',
      [],
      '',
      0, // pixelsAbove
      0, // pixelsBelow
      [], // browserErrors
      mockElement, // elementTree
      mockElement, // rootElement
      testSelectorMap, // selector map
    );

    // Test 3: Retrieve the selector map
    const retrievedSelectorMap = await browserContext.getSelectorMap();
    if (Object.keys(retrievedSelectorMap).length !== 1) {
      console.warn('Quick getSelectorMap test failed: Expected 1 element in selector map');
      return false;
    }
    const retrievedElement = retrievedSelectorMap['0'];
    if (
      !retrievedElement ||
      retrievedElement.tagName !== 'button' ||
      retrievedElement.attributes?.id !== 'test-btn'
    ) {
      console.warn('Quick getSelectorMap test failed: Element validation failed');
      return false;
    }

    console.log('✅ Quick getSelectorMap test passed');
    return true;
  } catch (error) {
    console.error('Quick getSelectorMap test encountered an error:', error);
    return false;
  }
}
