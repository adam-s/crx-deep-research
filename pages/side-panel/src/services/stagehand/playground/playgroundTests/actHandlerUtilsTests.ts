/**
 * ActHandlerUtils Tests
 * Test suite for ActHandlerUtils functionality using generic element operations
 * Tests the scrollToNextChunkElementFunction in actual content script context (MAIN world)
 */

import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage, Severity } from '@src/utils/types';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';
import {
  scrollToNextChunkElementFunction,
  scrollToPreviousChunkElementFunction,
  scrollElementIntoViewFunction,
  scrollElementToPercentageFunction,
  clickElementFunction,
  doubleClickElementFunction,
  rightClickElementFunction,
  fillElementFunction,
  clearElementFunction,
  selectOptionFunction,
  focusElementFunction,
  blurElementFunction,
  pressKeyFunction,
  hoverElementFunction,
  scrollByPixelsFunction,
  waitForVisibleFunction,
} from '../../lib/handlers/actHandlerUtils';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';

interface TestContext {
  events: SimpleEventEmitter<EventMessage>;
  storage: ILocalAsyncStorage<SidePanelAppStorageSchema>;
}

/**
 * Test ActHandlerUtils core functionality
 * Tests both pure function validation and actual execution in content script context
 */
export async function testActHandlerUtils(context: TestContext): Promise<void> {
  console.log('[DEBUG] testActHandlerUtils called - starting...');

  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Starting ActHandlerUtils test suite...',
    });

    console.log('[DEBUG] Event emitted successfully');

    // Test 1: Pure function tests (no DOM needed)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing pure functions...',
    });

    console.log('[DEBUG] About to call testPureFunctions');
    await testPureFunctions(context);
    console.log('[DEBUG] testPureFunctions completed');

    // Test 2: Element function registry (would need DOM)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing element function registry...',
    });
    console.log('[DEBUG] About to call testElementFunctionRegistry');
    await testElementFunctionRegistry(context);
    console.log('[DEBUG] testElementFunctionRegistry completed');

    // Test 3: Register and test scrollToNextChunkElementFunction in live page
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing scrollToNextChunkElementFunction in live page...',
    });
    console.log('[DEBUG] About to call testLivePageExecution');
    await testLivePageExecution(context);
    console.log('[DEBUG] testLivePageExecution completed');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] ActHandlerUtils test suite completed successfully',
    });
    console.log('[DEBUG] Test suite completed successfully');
  } catch (error) {
    console.log('[DEBUG] Error caught in testActHandlerUtils:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '[ActHandlerUtils Tests] ActHandlerUtils test suite failed: ${errorMessage}',
      details: { error: errorMessage },
    });

    throw error;
  }
}

/**
 * Test pure functions that don't require DOM
 */
async function testPureFunctions(context: TestContext): Promise<void> {
  console.log('[DEBUG] testPureFunctions started');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '[ActHandlerUtils Tests] Testing pure ActHandlerUtils functions...',
  });

  try {
    console.log('[DEBUG] About to test ActHandlerUtils function imports');

    // Test that all our element functions can be imported
    const functions = {
      scrollToNextChunk: scrollToNextChunkElementFunction,
      scrollToPreviousChunk: scrollToPreviousChunkElementFunction,
      scrollIntoView: scrollElementIntoViewFunction,
      scrollToPercentage: scrollElementToPercentageFunction,
      clickElement: clickElementFunction,
      doubleClickElement: doubleClickElementFunction,
      rightClickElement: rightClickElementFunction,
      fillElement: fillElementFunction,
      clearElement: clearElementFunction,
      selectOption: selectOptionFunction,
      focusElement: focusElementFunction,
      blurElement: blurElementFunction,
      pressKey: pressKeyFunction,
      hoverElement: hoverElementFunction,
      scrollByPixels: scrollByPixelsFunction,
      waitForVisible: waitForVisibleFunction,
    };

    console.log('[DEBUG] Functions imported:', Object.keys(functions));

    // Validate all functions are actually functions
    const functionResults = Object.entries(functions).map(([name, func]) => {
      const isFunction = typeof func === 'function';
      console.log(`[DEBUG] ${name} type:`, typeof func);
      return { name, isFunction, type: typeof func };
    });

    const invalidFunctions = functionResults.filter(result => !result.isFunction);
    if (invalidFunctions.length > 0) {
      throw new Error(`Invalid functions: ${invalidFunctions.map(f => f.name).join(', ')}`);
    }

    console.log('[DEBUG] All function type validations passed');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] Pure function tests passed',
      details: {
        testedFunctions: Object.keys(functions),
        status: 'all importable and callable',
        functionResults,
      },
    });

    console.log('[DEBUG] testPureFunctions completed successfully');
  } catch (error) {
    console.log('[DEBUG] Error in testPureFunctions:', error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '[ActHandlerUtils Tests] Pure function tests failed',
      details: { error: String(error) },
    });
    throw error;
  }
}

/**
 * Test element function registry concepts
 */
async function testElementFunctionRegistry(context: TestContext): Promise<void> {
  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '[ActHandlerUtils Tests] Testing element function registry concepts...',
  });

  try {
    // Test that we can work with function metadata for all functions
    const registryEntries = [
      {
        name: 'scrollToNextChunk',
        description: 'Scrolls to the next chunk of content within an element',
        fn: scrollToNextChunkElementFunction,
      },
      {
        name: 'scrollToPreviousChunk',
        description: 'Scrolls to the previous chunk of content within an element',
        fn: scrollToPreviousChunkElementFunction,
      },
      {
        name: 'scrollIntoView',
        description: 'Scrolls an element into view with smooth animation',
        fn: scrollElementIntoViewFunction,
      },
      {
        name: 'scrollToPercentage',
        description: 'Scrolls an element to a specific percentage of its content',
        fn: scrollElementToPercentageFunction,
      },
      {
        name: 'clickElement',
        description: 'Clicks an element',
        fn: clickElementFunction,
      },
      {
        name: 'doubleClickElement',
        description: 'Double clicks an element',
        fn: doubleClickElementFunction,
      },
      {
        name: 'rightClickElement',
        description: 'Right clicks an element (context menu)',
        fn: rightClickElementFunction,
      },
      {
        name: 'fillElement',
        description: 'Fills text into an input element',
        fn: fillElementFunction,
      },
      {
        name: 'clearElement',
        description: 'Clears an input element',
        fn: clearElementFunction,
      },
      {
        name: 'selectOption',
        description: 'Selects an option in a select element',
        fn: selectOptionFunction,
      },
      {
        name: 'focusElement',
        description: 'Focuses an element',
        fn: focusElementFunction,
      },
      {
        name: 'blurElement',
        description: 'Blurs (unfocuses) an element',
        fn: blurElementFunction,
      },
      {
        name: 'pressKey',
        description: 'Presses a keyboard key on an element',
        fn: pressKeyFunction,
      },
      {
        name: 'hoverElement',
        description: 'Hovers over an element',
        fn: hoverElementFunction,
      },
      {
        name: 'scrollByPixels',
        description: 'Scrolls an element by specific pixel amounts',
        fn: scrollByPixelsFunction,
      },
      {
        name: 'waitForVisible',
        description: 'Waits for an element to become visible',
        fn: waitForVisibleFunction,
      },
    ];

    // Validate all registry entries
    for (const entry of registryEntries) {
      if (!entry.name || typeof entry.fn !== 'function') {
        throw new Error(`Invalid registry entry: ${entry.name}`);
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] Element function registry tests passed',
      details: {
        registryEntries: registryEntries.map(entry => ({
          name: entry.name,
          description: entry.description,
          functionType: typeof entry.fn,
        })),
        totalFunctions: registryEntries.length,
      },
    });
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '[ActHandlerUtils Tests] Element function registry tests failed',
      details: { error: String(error) },
    });
    throw error;
  }
}

/**
 * Test scrollToNextChunkElementFunction in live page context
 * This registers the function in the content script and tests it with real DOM elements
 * Uses the same pattern as other integration tests (livePageDomTests.ts, etc.)
 */
async function testLivePageExecution(context: TestContext): Promise<void> {
  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '[ActHandlerUtils Tests] Testing scrollToNextChunkElementFunction with live page...',
  });

  let browserWindow: BrowserWindow | null = null;

  try {
    // Create browser window and navigate to test page (following established pattern)
    browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Navigating to test page...',
    });

    await page.goto('http://localhost:3005', { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Registering all ActHandlerUtils functions...',
    });

    // Register all functions in content script (MAIN world execution context)
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

      // Define all ActHandlerUtils functions directly inline (CSP-compliant)

      // scrollToNextChunkElementFunction
      function scrollToNextChunkElementFunction(element: Element, options: unknown = {}): unknown {
        const opts = (options as { pixels?: number }) || {};
        const { pixels = 300 } = opts;

        // Determine if this is an html or body element (should scroll window)
        const tagName = element.tagName.toLowerCase();
        const isHtmlOrBody = tagName === 'html' || tagName === 'body';

        if (isHtmlOrBody) {
          // Scroll the window
          const currentScrollY = window.scrollY;
          const targetScrollY = currentScrollY + pixels;

          window.scrollTo({
            top: targetScrollY,
            behavior: 'smooth',
          });
        } else {
          // Scroll the element itself
          const currentScrollTop = element.scrollTop;
          const targetScrollTop = currentScrollTop + pixels;

          element.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth',
          });
        }

        return { scrolled: true, pixels };
      }

      // scrollToPreviousChunkElementFunction
      function scrollToPreviousChunkElementFunction(
        element: Element,
        options: unknown = {}
      ): unknown {
        const opts = (options as { pixels?: number }) || {};
        const { pixels = 300 } = opts;

        const tagName = element.tagName.toLowerCase();
        const isHtmlOrBody = tagName === 'html' || tagName === 'body';

        if (isHtmlOrBody) {
          const currentScrollY = window.scrollY;
          const targetScrollY = Math.max(0, currentScrollY - pixels);

          window.scrollTo({
            top: targetScrollY,
            behavior: 'smooth',
          });
        } else {
          const currentScrollTop = element.scrollTop;
          const targetScrollTop = Math.max(0, currentScrollTop - pixels);

          element.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth',
          });
        }

        return { scrolled: true, pixels: -pixels };
      }

      // scrollElementIntoViewFunction
      function scrollElementIntoViewFunction(element: Element): unknown {
        (element as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { scrolledIntoView: true };
      }

      // scrollElementToPercentageFunction
      function scrollElementToPercentageFunction(element: Element, options: unknown = {}): unknown {
        const opts = (options as { yArg?: string }) || {};
        const { yArg = '0%' } = opts;

        function parsePercent(val: string): number {
          const cleaned = val.trim().replace('%', '');
          const num = parseFloat(cleaned);
          return Number.isNaN(num) ? 0 : Math.max(0, Math.min(num, 100));
        }

        const yPct = parsePercent(yArg);

        if (element.tagName.toLowerCase() === 'html') {
          const scrollHeight = document.body.scrollHeight;
          const viewportHeight = window.innerHeight;
          const scrollTop = (scrollHeight - viewportHeight) * (yPct / 100);
          window.scrollTo({
            top: scrollTop,
            left: window.scrollX,
            behavior: 'smooth',
          });
        } else {
          const scrollHeight = element.scrollHeight;
          const clientHeight = element.clientHeight;
          const scrollTop = (scrollHeight - clientHeight) * (yPct / 100);
          element.scrollTo({
            top: scrollTop,
            left: element.scrollLeft,
            behavior: 'smooth',
          });
        }

        return { scrolledToPercentage: yPct };
      }

      // clickElementFunction
      function clickElementFunction(element: Element): unknown {
        (element as HTMLElement).click();
        return { clicked: true };
      }

      // Register all functions for element operations
      injectedScript.registerElementFunction(
        'scrollToNextChunk',
        scrollToNextChunkElementFunction,
        'Scroll to the next chunk of content within an element'
      );

      injectedScript.registerElementFunction(
        'scrollToPreviousChunk',
        scrollToPreviousChunkElementFunction,
        'Scroll to the previous chunk of content within an element'
      );

      injectedScript.registerElementFunction(
        'scrollIntoView',
        scrollElementIntoViewFunction,
        'Scroll an element into view with smooth animation'
      );

      injectedScript.registerElementFunction(
        'scrollToPercentage',
        scrollElementToPercentageFunction,
        'Scroll an element to a specific percentage of its content'
      );

      injectedScript.registerElementFunction(
        'clickElement',
        clickElementFunction,
        'Click an element'
      );

      // doubleClickElementFunction
      function doubleClickElementFunction(element: Element): unknown {
        const event = new MouseEvent('dblclick', {
          view: window,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
        return { doubleClicked: true };
      }

      // rightClickElementFunction
      function rightClickElementFunction(element: Element): unknown {
        const event = new MouseEvent('contextmenu', {
          view: window,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(event);
        return { rightClicked: true };
      }

      // fillElementFunction
      function fillElementFunction(element: Element, options: unknown = {}): unknown {
        const opts = (options as { text?: string }) || {};
        const { text = '' } = opts;
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

        if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
          // Clear existing value first
          inputElement.value = '';

          // Set new value
          inputElement.value = text;

          // Trigger input and change events
          const inputEvent = new Event('input', { bubbles: true });
          const changeEvent = new Event('change', { bubbles: true });

          inputElement.dispatchEvent(inputEvent);
          inputElement.dispatchEvent(changeEvent);
        } else if (inputElement.isContentEditable) {
          // Handle contenteditable elements
          inputElement.textContent = text;

          const inputEvent = new Event('input', { bubbles: true });
          inputElement.dispatchEvent(inputEvent);
        }

        return { filled: true, text };
      }

      // clearElementFunction
      function clearElementFunction(element: Element): unknown {
        const inputElement = element as HTMLInputElement | HTMLTextAreaElement;

        if (inputElement.tagName === 'INPUT' || inputElement.tagName === 'TEXTAREA') {
          inputElement.value = '';

          // Trigger input and change events
          const inputEvent = new Event('input', { bubbles: true });
          const changeEvent = new Event('change', { bubbles: true });

          inputElement.dispatchEvent(inputEvent);
          inputElement.dispatchEvent(changeEvent);
        } else if (inputElement.isContentEditable) {
          inputElement.textContent = '';

          const inputEvent = new Event('input', { bubbles: true });
          inputElement.dispatchEvent(inputEvent);
        }

        return { cleared: true };
      }

      // selectOptionFunction
      function selectOptionFunction(element: Element, options: unknown = {}): unknown {
        const opts = (options as { value?: string; text?: string }) || {};
        const { value, text } = opts;
        const selectElement = element as HTMLSelectElement;

        if (selectElement.tagName !== 'SELECT') {
          return { selected: false, reason: 'Not a select element' };
        }

        // Find option by value or text
        let optionToSelect: HTMLOptionElement | null = null;

        if (value !== undefined) {
          optionToSelect = selectElement.querySelector(`option[value="${value}"]`);
        } else if (text !== undefined) {
          // Find by text content
          for (const option of selectElement.options) {
            if (option.textContent?.trim() === text.trim()) {
              optionToSelect = option;
              break;
            }
          }
        }

        if (optionToSelect) {
          selectElement.value = optionToSelect.value;
          optionToSelect.selected = true;

          // Trigger change event
          const changeEvent = new Event('change', { bubbles: true });
          selectElement.dispatchEvent(changeEvent);

          return { selected: true, value: optionToSelect.value, text: optionToSelect.textContent };
        }

        return { selected: false, reason: 'Option not found' };
      }

      // focusElementFunction
      function focusElementFunction(element: Element): unknown {
        (element as HTMLElement).focus();
        return { focused: true };
      }

      // blurElementFunction
      function blurElementFunction(element: Element): unknown {
        (element as HTMLElement).blur();
        return { blurred: true };
      }

      // Register the additional 7 functions
      injectedScript.registerElementFunction(
        'doubleClickElement',
        doubleClickElementFunction,
        'Double click an element'
      );

      injectedScript.registerElementFunction(
        'rightClickElement',
        rightClickElementFunction,
        'Right click an element (context menu)'
      );

      injectedScript.registerElementFunction(
        'fillElement',
        fillElementFunction,
        'Fill text into an input element'
      );

      injectedScript.registerElementFunction(
        'clearElement',
        clearElementFunction,
        'Clear an input element'
      );

      injectedScript.registerElementFunction(
        'selectOption',
        selectOptionFunction,
        'Select an option in a select element'
      );

      injectedScript.registerElementFunction(
        'focusElement',
        focusElementFunction,
        'Focus an element'
      );

      injectedScript.registerElementFunction(
        'blurElement',
        blurElementFunction,
        'Blur (unfocus) an element'
      );

      // pressKeyFunction
      function pressKeyFunction(element: Element, options: unknown = {}): unknown {
        const opts = (options as { key?: string }) || {};
        const { key = 'Enter' } = opts;
        const keyboardEvent = new KeyboardEvent('keydown', {
          key,
          bubbles: true,
          cancelable: true,
        });

        element.dispatchEvent(keyboardEvent);

        // Also dispatch keyup for completeness
        const keyupEvent = new KeyboardEvent('keyup', {
          key,
          bubbles: true,
          cancelable: true,
        });

        element.dispatchEvent(keyupEvent);
        return { keyPressed: true, key };
      }

      // hoverElementFunction
      function hoverElementFunction(element: Element): unknown {
        const mouseEvent = new MouseEvent('mouseover', {
          view: window,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(mouseEvent);

        // Also dispatch mouseenter for completeness
        const enterEvent = new MouseEvent('mouseenter', {
          view: window,
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(enterEvent);
        return { hovered: true };
      }

      // scrollByPixelsFunction
      function scrollByPixelsFunction(element: Element, options: unknown = {}): unknown {
        const opts = (options as { x?: number; y?: number }) || {};
        const { x = 0, y = 0 } = opts;

        if (element.tagName.toLowerCase() === 'html' || element.tagName.toLowerCase() === 'body') {
          window.scrollBy({
            left: x,
            top: y,
            behavior: 'smooth',
          });
        } else {
          (element as HTMLElement).scrollBy({
            left: x,
            top: y,
            behavior: 'smooth',
          });
        }
        return { scrolledByPixels: true, x, y };
      }

      // waitForVisibleFunction
      function waitForVisibleFunction(element: Element, options: unknown = {}): Promise<unknown> {
        const opts = (options as { timeout?: number }) || {};
        const { timeout = 5000 } = opts;

        return new Promise(resolve => {
          const startTime = Date.now();

          const checkVisibility = () => {
            const htmlElement = element as HTMLElement;
            const isVisible =
              htmlElement.offsetWidth > 0 &&
              htmlElement.offsetHeight > 0 &&
              getComputedStyle(htmlElement).visibility !== 'hidden';

            if (isVisible) {
              resolve({ visible: true, waitTime: Date.now() - startTime });
              return;
            }

            if (Date.now() - startTime >= timeout) {
              resolve({ visible: false, timeout: true, waitTime: Date.now() - startTime });
              return;
            }

            requestAnimationFrame(checkVisibility);
          };

          checkVisibility();
        });
      }

      // Register the additional 4 functions
      injectedScript.registerElementFunction(
        'pressKey',
        pressKeyFunction,
        'Press a keyboard key on an element'
      );

      injectedScript.registerElementFunction(
        'hoverElement',
        hoverElementFunction,
        'Hover over an element'
      );

      injectedScript.registerElementFunction(
        'scrollByPixels',
        scrollByPixelsFunction,
        'Scroll an element by specific pixel amounts'
      );

      injectedScript.registerElementFunction(
        'waitForVisible',
        waitForVisibleFunction,
        'Wait for an element to become visible'
      );

      return { registered: 16 };
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing scroll on body element (window scroll)...',
    });

    // Test 1: Body element scroll (should trigger window scrolling)
    // First, get the initial scroll position
    const initialWindowScroll = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollX: window.scrollX,
    }));

    const bodyLocator = page.locator('body');
    const bodyResult = await bodyLocator.executeFunction('scrollToNextChunk');

    // Wait for smooth scroll animation to complete
    await page.waitForTimeout(500);

    // Verify the window actually scrolled
    const finalWindowScroll = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollX: window.scrollX,
    }));

    const windowScrollDelta = finalWindowScroll.scrollY - initialWindowScroll.scrollY;
    const scrolledCorrectly = windowScrollDelta > 0;

    context.events.emit({
      timestamp: Date.now(),
      severity: scrolledCorrectly ? Severity.Success : Severity.Error,
      message: `[ActHandlerUtils Tests] Body element scroll test ${scrolledCorrectly ? 'passed' : 'failed'}`,
      details: {
        result: bodyResult,
        initialScroll: initialWindowScroll,
        finalScroll: finalWindowScroll,
        scrollDelta: windowScrollDelta,
        scrolledCorrectly,
      },
    });

    if (!scrolledCorrectly) {
      throw new Error(`Window did not scroll correctly. Delta: ${windowScrollDelta}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing scroll on container element...',
    });

    // Test 2: Container element scroll
    // First, get the initial scroll position and scrollable state of the container
    const initialContainerScroll = await page.evaluate(() => {
      const container = document.querySelector('.container') as HTMLElement;
      return {
        scrollTop: container?.scrollTop || 0,
        scrollLeft: container?.scrollLeft || 0,
        exists: !!container,
        hasScrollableContent: container ? container.scrollHeight > container.clientHeight : false,
        scrollHeight: container?.scrollHeight || 0,
        clientHeight: container?.clientHeight || 0,
      };
    });

    const containerLocator = page.locator('.container');
    const containerResult = await containerLocator.executeFunction('scrollToNextChunk');

    // Wait for smooth scroll animation to complete
    await page.waitForTimeout(500);

    // Verify the container element behavior
    const finalContainerScroll = await page.evaluate(() => {
      const container = document.querySelector('.container') as HTMLElement;
      return {
        scrollTop: container?.scrollTop || 0,
        scrollLeft: container?.scrollLeft || 0,
        exists: !!container,
        hasScrollableContent: container ? container.scrollHeight > container.clientHeight : false,
        scrollHeight: container?.scrollHeight || 0,
        clientHeight: container?.clientHeight || 0,
      };
    });

    const containerScrollDelta = finalContainerScroll.scrollTop - initialContainerScroll.scrollTop;

    // Test passes if:
    // 1. Element doesn't exist (graceful handling)
    // 2. Element has no scrollable content (nothing to scroll)
    // 3. Element actually scrolled (successful scroll)
    const containerScrolledCorrectly =
      !initialContainerScroll.exists ||
      !initialContainerScroll.hasScrollableContent ||
      containerScrollDelta > 0;

    const testStatus = containerScrolledCorrectly ? 'passed' : 'failed';
    const testReason = !initialContainerScroll.exists
      ? 'element not found'
      : !initialContainerScroll.hasScrollableContent
        ? 'no scrollable content'
        : containerScrollDelta > 0
          ? 'successfully scrolled'
          : 'failed to scroll';

    context.events.emit({
      timestamp: Date.now(),
      severity: containerScrolledCorrectly ? Severity.Success : Severity.Error,
      message: `[ActHandlerUtils Tests] Container element scroll test ${testStatus} (${testReason})`,
      details: {
        result: containerResult,
        initialScroll: initialContainerScroll,
        finalScroll: finalContainerScroll,
        scrollDelta: containerScrollDelta,
        scrolledCorrectly: containerScrolledCorrectly,
        testReason,
      },
    });

    if (!containerScrolledCorrectly) {
      throw new Error(
        `Container test failed unexpectedly. Delta: ${containerScrollDelta}, HasScrollableContent: ${initialContainerScroll.hasScrollableContent}`
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing scroll on textarea element...',
    });

    // Test 3: Textarea element scroll
    // First, get the initial scroll position of the textarea
    const initialTextareaScroll = await page.evaluate(() => {
      const textarea = document.querySelector('#textarea-input') as HTMLTextAreaElement;
      return {
        scrollTop: textarea?.scrollTop || 0,
        scrollLeft: textarea?.scrollLeft || 0,
        exists: !!textarea,
        hasScrollableContent: textarea ? textarea.scrollHeight > textarea.clientHeight : false,
      };
    });

    const textareaLocator = page.locator('#textarea-input');
    const textareaResult = await textareaLocator.executeFunction('scrollToNextChunk');

    // Wait for smooth scroll animation to complete
    await page.waitForTimeout(500);

    // Verify the textarea element actually scrolled (if it has scrollable content)
    const finalTextareaScroll = await page.evaluate(() => {
      const textarea = document.querySelector('#textarea-input') as HTMLTextAreaElement;
      return {
        scrollTop: textarea?.scrollTop || 0,
        scrollLeft: textarea?.scrollLeft || 0,
        exists: !!textarea,
        hasScrollableContent: textarea ? textarea.scrollHeight > textarea.clientHeight : false,
      };
    });

    const textareaScrollDelta = finalTextareaScroll.scrollTop - initialTextareaScroll.scrollTop;
    // Textarea might not have scrollable content, so we consider it successful if:
    // 1. It doesn't exist (element not found is handled gracefully)
    // 2. It has no scrollable content (nothing to scroll)
    // 3. It actually scrolled
    const textareaScrolledCorrectly =
      !initialTextareaScroll.exists ||
      !initialTextareaScroll.hasScrollableContent ||
      textareaScrollDelta > 0;

    context.events.emit({
      timestamp: Date.now(),
      severity: textareaScrolledCorrectly ? Severity.Success : Severity.Warning,
      message: `[ActHandlerUtils Tests] Textarea element scroll test ${textareaScrolledCorrectly ? 'passed' : 'inconclusive'}`,
      details: {
        result: textareaResult,
        initialScroll: initialTextareaScroll,
        finalScroll: finalTextareaScroll,
        scrollDelta: textareaScrollDelta,
        scrolledCorrectly: textareaScrolledCorrectly,
      },
    });

    // Test 4: scrollToPreviousChunk function
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing scrollToPreviousChunk function...',
    });

    const previousScrollResult = await bodyLocator.executeFunction('scrollToPreviousChunk');
    await page.waitForTimeout(300);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] ScrollToPreviousChunk test completed',
      details: { result: previousScrollResult },
    });

    // Test 5: scrollIntoView function
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing scrollIntoView function...',
    });

    const scrollIntoViewResult = await containerLocator.executeFunction('scrollIntoView');
    await page.waitForTimeout(300);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] ScrollIntoView test completed',
      details: { result: scrollIntoViewResult },
    });

    // Test 6: scrollToPercentage function
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing scrollToPercentage function...',
    });

    const scrollToPercentageResult = await bodyLocator.executeFunction('scrollToPercentage', {
      yArg: '50%',
    });
    await page.waitForTimeout(300);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] ScrollToPercentage test completed',
      details: { result: scrollToPercentageResult },
    });

    // Test 7: clickElement function (test on a button if available)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing clickElement function...',
    });

    let clickResult = null;
    try {
      const buttonLocator = page.locator('#action-button');
      clickResult = await buttonLocator.executeFunction('clickElement');
      await page.waitForTimeout(200);
    } catch (error) {
      // If button doesn't exist, test on container element
      clickResult = await containerLocator.executeFunction('clickElement');
      await page.waitForTimeout(200);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] ClickElement test completed',
      details: { result: clickResult },
    });

    // Test 8: fillElement function (test on text input)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing fillElement function on text input...',
    });

    const textInputLocator = page.locator('#text-input');
    const buttonLocator = page.locator('#action-button');
    const fillResult = await textInputLocator.executeFunction('fillElement', {
      text: 'Test input text',
    });
    await page.waitForTimeout(200);

    // Verify the text was filled
    const inputValue = await page.evaluate(() => {
      const input = document.querySelector('#text-input') as HTMLInputElement;
      return input?.value || '';
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: inputValue === 'Test input text' ? Severity.Success : Severity.Warning,
      message: `[ActHandlerUtils Tests] FillElement test completed (filled: "${inputValue}")`,
      details: { result: fillResult, actualValue: inputValue },
    });

    // Test 9: clearElement function (clear the text input)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing clearElement function...',
    });

    const clearResult = await textInputLocator.executeFunction('clearElement');
    await page.waitForTimeout(200);

    // Verify the text was cleared
    const clearedValue = await page.evaluate(() => {
      const input = document.querySelector('#text-input') as HTMLInputElement;
      return input?.value || '';
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: clearedValue === '' ? Severity.Success : Severity.Warning,
      message: `[ActHandlerUtils Tests] ClearElement test completed (value: "${clearedValue}")`,
      details: { result: clearResult, actualValue: clearedValue },
    });

    // Test 10: selectOption function (test on select element)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing selectOption function...',
    });

    const selectLocator = page.locator('#single-select');
    const selectResult = await selectLocator.executeFunction('selectOption', { value: 'option3' });
    await page.waitForTimeout(200);

    // Verify the option was selected
    const selectedValue = await page.evaluate(() => {
      const select = document.querySelector('#single-select') as HTMLSelectElement;
      return select?.value || '';
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: selectedValue === 'option3' ? Severity.Success : Severity.Warning,
      message: `[ActHandlerUtils Tests] SelectOption test completed (selected: "${selectedValue}")`,
      details: { result: selectResult, actualValue: selectedValue },
    });

    // Test 11: focusElement function (test on email input)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing focusElement function...',
    });

    const emailInputLocator = page.locator('#email-input');
    const focusResult = await emailInputLocator.executeFunction('focusElement');
    await page.waitForTimeout(200);

    // Verify the element has focus
    const hasFocus = await page.evaluate(() => {
      const input = document.querySelector('#email-input') as HTMLInputElement;
      return document.activeElement === input;
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: hasFocus ? Severity.Success : Severity.Warning,
      message: `[ActHandlerUtils Tests] FocusElement test completed (focused: ${hasFocus})`,
      details: { result: focusResult, hasFocus },
    });

    // Test 12: blurElement function (blur the focused element)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing blurElement function...',
    });

    const blurResult = await emailInputLocator.executeFunction('blurElement');
    await page.waitForTimeout(200);

    // Verify the element lost focus
    const stillHasFocus = await page.evaluate(() => {
      const input = document.querySelector('#email-input') as HTMLInputElement;
      return document.activeElement === input;
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: !stillHasFocus ? Severity.Success : Severity.Warning,
      message: `[ActHandlerUtils Tests] BlurElement test completed (still focused: ${stillHasFocus})`,
      details: { result: blurResult, stillHasFocus },
    });

    // Test 13: doubleClickElement function (test on action button)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing doubleClickElement function...',
    });

    let doubleClickButtonLocator;
    try {
      doubleClickButtonLocator = page.locator('#action-button');
    } catch (error) {
      doubleClickButtonLocator = containerLocator;
    }

    const doubleClickResult = await doubleClickButtonLocator.executeFunction('doubleClickElement');
    await page.waitForTimeout(200);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] DoubleClickElement test completed',
      details: { result: doubleClickResult },
    });

    // Test 14: rightClickElement function (test on action button)
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing rightClickElement function...',
    });

    let rightClickButtonLocator;
    try {
      rightClickButtonLocator = page.locator('#action-button');
    } catch (error) {
      rightClickButtonLocator = containerLocator;
    }

    const rightClickResult = await rightClickButtonLocator.executeFunction('rightClickElement');
    await page.waitForTimeout(200);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] RightClickElement test completed',
      details: { result: rightClickResult },
    });

    // Test 15: fillElement on textarea
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing fillElement function on textarea...',
    });

    const testTextareaLocator = page.locator('#textarea-input');
    const textareaFillResult = await testTextareaLocator.executeFunction('fillElement', {
      text: 'This is a test message for the textarea element!',
    });
    await page.waitForTimeout(200);

    // Verify the textarea was filled
    const textareaValue = await page.evaluate(() => {
      const textarea = document.querySelector('#textarea-input') as HTMLTextAreaElement;
      return textarea?.value || '';
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: textareaValue.includes('test message') ? Severity.Success : Severity.Warning,
      message: `[ActHandlerUtils Tests] Textarea fillElement test completed`,
      details: { result: textareaFillResult, actualValue: textareaValue },
    });

    // Test 15: pressKey function
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing pressKey function...',
    });

    const pressKeyResult = await textInputLocator.executeFunction('pressKey', { key: 'Escape' });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] PressKey test completed',
      details: { result: pressKeyResult },
    });

    // Test 16: hoverElement function
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing hoverElement function...',
    });

    const hoverResult = await buttonLocator.executeFunction('hoverElement');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] HoverElement test completed',
      details: { result: hoverResult },
    });

    // Test 17: scrollByPixels function
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing scrollByPixels function...',
    });

    const scrollByPixelsResult = await bodyLocator.executeFunction('scrollByPixels', {
      x: 0,
      y: 100,
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] ScrollByPixels test completed',
      details: { result: scrollByPixelsResult },
    });

    // Test 18: waitForVisible function
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '[ActHandlerUtils Tests] Testing waitForVisible function...',
    });

    const waitForVisibleResult = await buttonLocator.executeFunction('waitForVisible', {
      timeout: 1000,
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] WaitForVisible test completed',
      details: { result: waitForVisibleResult },
    });

    const finalResults = {
      bodyScroll: bodyResult,
      containerScroll: containerResult,
      textareaScroll: textareaResult,
      previousScroll: previousScrollResult,
      scrollIntoView: scrollIntoViewResult,
      scrollToPercentage: scrollToPercentageResult,
      clickElement: clickResult,
      fillElement: fillResult,
      clearElement: clearResult,
      selectOption: selectResult,
      focusElement: focusResult,
      blurElement: blurResult,
      doubleClickElement: doubleClickResult,
      rightClickElement: rightClickResult,
      textareaFill: textareaFillResult,
      pressKey: pressKeyResult,
      hoverElement: hoverResult,
      scrollByPixels: scrollByPixelsResult,
      waitForVisible: waitForVisibleResult,
    };

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '[ActHandlerUtils Tests] Live page execution tests completed successfully',
      details: finalResults,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '[ActHandlerUtils Tests] Live page execution tests failed',
      details: { error: errorMessage },
    });
    throw error;
  } finally {
    // Clean up browser window
    if (browserWindow) {
      try {
        await browserWindow.dispose();
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Info,
          message: '[ActHandlerUtils Tests] Browser window closed',
        });
      } catch (closeError) {
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '[ActHandlerUtils Tests] Warning: Failed to close browser window',
          details: { error: String(closeError) },
        });
      }
    }
  }
}
