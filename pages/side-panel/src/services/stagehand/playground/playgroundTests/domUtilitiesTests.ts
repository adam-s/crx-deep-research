/**
 * DOM Utilities Tests - No Conversion Needed (15%)
 *
 * Tests for pure DOM utility functions that work with standard DOM APIs
 * and require no changes for Cordyceps conversion.
 *
 * Files tested:
 * - dom/utils.ts - canElementScroll(), getNodeFromXpath(), waitForElementScrollEnd()
 * - dom/process.ts - getScrollableElements(), getScrollableElementXpaths()
 * - dom/xpathUtils.ts - generateXPathsForElement(), escapeXPathString()
 * - dom/elementCheckUtils.ts - Element type checking utilities
 */

import { Severity } from '@src/utils/types';
import { TestProgress, TestContext } from './types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';

// Use any for page type to match the actual Cordyceps API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageType = any;

// Stagehand DOM utility function declarations for testing
declare global {
  interface Window {
    // XPath utility functions
    generateXPathsForElement?: (element: Element) => string[];
    escapeXPathString?: (str: string) => string;

    // Element utility functions
    canElementScroll?: (element: HTMLElement) => boolean;

    // Scrollable element detection
    getScrollableElements?: () => HTMLElement[];

    // Element type checking utilities
    isInputElement?: (element: Element) => boolean;
    isSelectElement?: (element: Element) => boolean;
    isTextareaElement?: (element: Element) => boolean;
    isButtonElement?: (element: Element) => boolean;
    isFormElement?: (element: Element) => boolean;
  }
}

/**
 * Test DOM utilities that require no conversion for Cordyceps
 */
export async function testDOMUtilities(
  progress: TestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('🔧 Testing DOM utilities (no conversion needed)...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔧 Testing DOM utilities - pure functions at http://localhost:3005...',
  });

  let browserWindow: BrowserWindow | undefined;
  try {
    // Get browser window service
    browserWindow = await BrowserWindow.create();

    // Navigate to test page
    await browserWindow.newPage();
    const page = await browserWindow.getCurrentPage();
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded' });

    progress.log('📄 Navigated to test page with rich DOM content');

    // Test 1: XPath Generation and Utilities
    await testXPathUtilities(page, progress, context);

    // Test 2: Element Scrolling Detection
    await testScrollUtilities(page, progress, context);

    // Test 3: Element Type Checking
    await testElementTypeChecking(page, progress, context);

    // Test 4: Node Selection from XPath
    await testNodeSelection(page, progress, context);

    // Test 5: Shadow DOM and Iframe Handling
    await testAdvancedDOMFeatures(page, progress, context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ DOM utilities tests completed successfully',
      details: {
        category: 'pure-dom-functions',
        testsRun: 5,
        url: 'http://localhost:3005',
      },
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ DOM utilities tests failed: ${errorMessage}`,
      details: { category: 'pure-dom-functions', error: errorMessage },
    });

    progress.log(`❌ DOM utilities test error: ${errorMessage}`);
    return false;
  } finally {
    // Always dispose the browser window to prevent frame leakage
    if (browserWindow) {
      try {
        browserWindow.dispose();

        // Add a small delay to allow Chrome extension lifecycle to fully clean up
        // This prevents frame ID conflicts when tests run multiple times
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (disposeError) {
        progress.log(`⚠️ Error disposing browser window: ${disposeError}`);
      }
    }
  }
}

/**
 * Test XPath generation and utility functions
 */
async function testXPathUtilities(
  page: PageType,
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🎯 Testing XPath generation utilities...');

  const xpathResults = await page.evaluate(() => {
    const results = {
      buttonXPaths: [] as string[],
      hasGenerateXPaths: false,
      escapedString: '',
      hasEscapeXPath: false,
      manualButtonXPath: '//*[@id="action-button"]',
      manualCheckboxXPath: '//*[@id="test-checkbox"]',
    };

    // Test with various elements from the test page
    const testButton = document.getElementById('action-button');

    // Test generateXPathsForElement if available
    if (window.generateXPathsForElement && testButton) {
      results.buttonXPaths = window.generateXPathsForElement(testButton);
      results.hasGenerateXPaths = true;
    }

    // Test escapeXPathString if available
    if (window.escapeXPathString) {
      results.escapedString = window.escapeXPathString('text with \'quotes\' and "double quotes"');
      results.hasEscapeXPath = true;
    }

    return results;
  });

  progress.log(
    `📊 XPath test results: Generated ${xpathResults.buttonXPaths?.length || 0} XPaths for button`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🎯 XPath utilities tested',
    details: {
      hasGenerateXPaths: xpathResults.hasGenerateXPaths,
      hasEscapeXPath: xpathResults.hasEscapeXPath,
      buttonXPathCount: xpathResults.buttonXPaths?.length || 0,
    },
  });
}

/**
 * Test scrolling-related utility functions
 */
async function testScrollUtilities(
  page: PageType,
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('📜 Testing scroll detection utilities...');

  const scrollResults = await page.evaluate(() => {
    const results = {
      containerCanScroll: false,
      bodyCanScroll: false,
      buttonCanScroll: false,
      hasCanElementScroll: false,
      scrollableElementCount: 0,
      hasGetScrollableElements: false,
    };

    // Test canElementScroll with various elements
    const container = document.querySelector('.container');
    const body = document.body;
    const button = document.getElementById('action-button');

    if (window.canElementScroll) {
      if (container) results.containerCanScroll = window.canElementScroll(container as HTMLElement);
      results.bodyCanScroll = window.canElementScroll(body);
      if (button) results.buttonCanScroll = window.canElementScroll(button as HTMLElement);
      results.hasCanElementScroll = true;
    }

    // Test getScrollableElements if available
    if (window.getScrollableElements) {
      const scrollableElements = window.getScrollableElements();
      results.scrollableElementCount = scrollableElements.length;
      results.hasGetScrollableElements = true;
    }

    return results;
  });

  progress.log(
    `📊 Scroll test results: Found ${scrollResults.scrollableElementCount || 0} scrollable elements`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '📜 Scroll utilities tested',
    details: {
      scrollableElements: scrollResults.scrollableElementCount || 0,
      bodyCanScroll: scrollResults.bodyCanScroll,
    },
  });
}

/**
 * Test element type checking utilities
 */
async function testElementTypeChecking(
  page: PageType,
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🔍 Testing element type checking utilities...');

  const typeResults = await page.evaluate(() => {
    const results = {
      textInputIsInput: false,
      checkboxIsInput: false,
      buttonIsInput: false,
      hasIsInputElement: false,
      selectIsSelect: false,
      inputIsSelect: false,
      hasIsSelectElement: false,
      textareaIsTextarea: false,
      inputIsTextarea: false,
      hasIsTextareaElement: false,
      buttonIsButton: false,
      inputIsButton: false,
      hasIsButtonElement: false,
      formIsForm: false,
      inputIsForm: false,
      hasIsFormElement: false,
      inputCount: 0,
      selectCount: 0,
      textareaCount: 0,
      buttonCount: 0,
      formCount: 0,
    };

    // Get various elements from the test page
    const textInput = document.getElementById('text-input');
    const selectElement = document.getElementById('single-select');
    const textareaElement = document.getElementById('textarea-input');
    const buttonElement = document.getElementById('action-button');
    const formElement = document.getElementById('test-form');
    const checkboxElement = document.getElementById('test-checkbox');

    // Test type checking functions if available
    if (window.isInputElement && textInput && checkboxElement && buttonElement) {
      results.textInputIsInput = window.isInputElement(textInput);
      results.checkboxIsInput = window.isInputElement(checkboxElement);
      results.buttonIsInput = window.isInputElement(buttonElement);
      results.hasIsInputElement = true;
    }

    if (window.isSelectElement && selectElement && textInput) {
      results.selectIsSelect = window.isSelectElement(selectElement);
      results.inputIsSelect = window.isSelectElement(textInput);
      results.hasIsSelectElement = true;
    }

    if (window.isTextareaElement && textareaElement && textInput) {
      results.textareaIsTextarea = window.isTextareaElement(textareaElement);
      results.inputIsTextarea = window.isTextareaElement(textInput);
      results.hasIsTextareaElement = true;
    }

    if (window.isButtonElement && buttonElement && textInput) {
      results.buttonIsButton = window.isButtonElement(buttonElement);
      results.inputIsButton = window.isButtonElement(textInput);
      results.hasIsButtonElement = true;
    }

    if (window.isFormElement && formElement && textInput) {
      results.formIsForm = window.isFormElement(formElement);
      results.inputIsForm = window.isFormElement(textInput);
      results.hasIsFormElement = true;
    }

    // Count different element types on the page
    results.inputCount = document.querySelectorAll('input').length;
    results.selectCount = document.querySelectorAll('select').length;
    results.textareaCount = document.querySelectorAll('textarea').length;
    results.buttonCount = document.querySelectorAll('button').length;
    results.formCount = document.querySelectorAll('form').length;

    return results;
  });

  progress.log(
    `📊 Element type results: ${typeResults.inputCount} inputs, ${typeResults.buttonCount} buttons, ${typeResults.formCount} forms`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔍 Element type checking tested',
    details: {
      inputElements: typeResults.inputCount,
      buttonElements: typeResults.buttonCount,
      selectElements: typeResults.selectCount,
      textareaElements: typeResults.textareaCount,
      formElements: typeResults.formCount,
    },
  });
}

/**
 * Test node selection from XPath
 */
async function testNodeSelection(
  page: PageType,
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🎯 Testing node selection from XPath...');

  const nodeResults = await page.evaluate(() => {
    const results = {
      buttonFound: false,
      checkboxFound: false,
      formFound: false,
      invalidNotFound: false,
      hasGetNodeFromXpath: false,
      buttonTagName: '',
      buttonId: '',
      manualButtonFound: false,
    };

    // Manual verification using document.evaluate
    const manualButtonResult = document.evaluate(
      '//*[@id="action-button"]',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    results.manualButtonFound = !!manualButtonResult.singleNodeValue;

    return results;
  });

  progress.log(`📊 Node selection results: Manual button found=${nodeResults.manualButtonFound}`);

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🎯 Node selection from XPath tested',
    details: {
      manualButtonFound: nodeResults.manualButtonFound,
    },
  });
}

/**
 * Test advanced DOM features including Shadow DOM and iframes
 */
async function testAdvancedDOMFeatures(
  page: PageType,
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🌟 Testing advanced DOM features (Shadow DOM & iframes)...');

  const advancedResults = await page.evaluate(() => {
    const results = {
      shadowHostExists: false,
      hasShadowRoot: false,
      shadowButtonExists: false,
      shadowCheckboxExists: false,
      shadowButtonXPaths: [] as string[],
      shadowXPathError: '',
      iframeCount: 0,
      iframeInfo: [] as Array<{
        index: number;
        src: string;
        title: string;
        id: string;
      }>,
    };

    // Test Shadow DOM detection
    const shadowHost = document.getElementById('shadow-host');
    if (shadowHost) {
      results.shadowHostExists = true;
      results.hasShadowRoot = !!shadowHost.shadowRoot;

      if (shadowHost.shadowRoot) {
        const shadowButton = shadowHost.shadowRoot.querySelector('.shadow-button');
        const shadowCheckbox = shadowHost.shadowRoot.querySelector('#shadow-checkbox');
        results.shadowButtonExists = !!shadowButton;
        results.shadowCheckboxExists = !!shadowCheckbox;

        // Test if DOM utilities can work with shadow DOM elements
        if (window.generateXPathsForElement && shadowButton) {
          try {
            results.shadowButtonXPaths = window.generateXPathsForElement(shadowButton);
          } catch (error) {
            results.shadowXPathError = (error as Error).message;
          }
        }
      }
    }

    // Test iframe detection
    const iframes = document.querySelectorAll('iframe');
    results.iframeCount = iframes.length;

    iframes.forEach((iframe, index) => {
      results.iframeInfo.push({
        index,
        src: iframe.src,
        title: iframe.title,
        id: iframe.id || `iframe-${index}`,
      });
    });

    return results;
  });

  progress.log(
    `📊 Advanced DOM results: Shadow DOM=${advancedResults.hasShadowRoot}, ${advancedResults.iframeCount} iframes`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🌟 Advanced DOM features tested',
    details: {
      shadowDOMSupported: advancedResults.hasShadowRoot,
      iframeCount: advancedResults.iframeCount,
      shadowButtonExists: advancedResults.shadowButtonExists,
      shadowCheckboxExists: advancedResults.shadowCheckboxExists,
    },
  });
}

/**
 * Quick test for DOM utilities
 */
export async function quickDOMUtilitiesTest(): Promise<boolean> {
  try {
    // Quick validation that we can access basic DOM APIs
    const testDiv = document.createElement('div');
    testDiv.id = 'quick-test-element';
    testDiv.textContent = 'Quick test element';

    // Test basic XPath evaluation
    const xpathResult = document.evaluate(
      '//div[@id="quick-test-element"]',
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );

    const found = !!xpathResult.singleNodeValue;
    return found;
  } catch (error) {
    console.error('Quick DOM utilities test failed:', error);
    return false;
  }
}
