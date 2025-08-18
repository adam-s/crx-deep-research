/**
 * Tests for BrowserContext.getLocateElement() and _inputTextElementNode() methods
 *
 * This file tests the recently updated DOM interaction methods that now use
 * proper Cordyceps APIs with strong typing and iframe navigation support.
 */

import { BrowserContext } from '../../browser/context';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { Severity } from '@src/utils/types';
import { ElementNode } from '../../dom/types';

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
      details?: unknown;
      error?: Error;
    }) => void;
  };
}

/**
 * Test getLocateElement method with various element types and iframe scenarios
 */
export async function testGetLocateElement(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🧪 Testing BrowserContext.getLocateElement() method...');

  try {
    // Get current window ID for testing
    let currentWindowId: number;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      currentWindowId = currentWindow.id!;
    } catch (error) {
      progress.log('⚠️ Skipping getLocateElement tests - Chrome APIs not available');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'getLocateElement tests skipped - Chrome APIs not available',
        details: { reason: 'Cannot access chrome.windows API in test environment' },
      });
      return;
    }

    // Create real BrowserWindow instance using the current window
    progress.log(`Creating BrowserWindow for window ID: ${currentWindowId}`);
    const realBrowserWindow = await BrowserWindow.create();

    // Ensure we have at least one page/tab to work with
    const pages = realBrowserWindow.pages();
    if (pages.length === 0) {
      progress.log('Creating new tab for testing...');
      await realBrowserWindow.newPage();
    }

    progress.log(`BrowserWindow created with ${pages.length} pages`);
    const browserContext = new BrowserContext(realBrowserWindow);
    await browserContext.enter();

    // Test 1: Simple element without parent (use actual element from page)
    progress.log('Test 1: Simple element without parent');
    const simpleElement: ElementNode = {
      xpath: '//input[@id="test-checkbox"]',
      tag_name: 'input',
      attributes: { id: 'test-checkbox', type: 'checkbox' },
      highlight_index: 1,
    };

    console.log('🐛 About to call getLocateElement - check browser dev tools!');
    console.log('🎯 Looking for element that actually exists:', simpleElement);
    const handle1 = await browserContext.getLocateElement(simpleElement);
    if (!handle1) {
      throw new Error('getLocateElement returned null for simple element');
    }

    progress.log('✅ Test 1 passed: Simple element location works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: Simple element location works',
      details: { elementType: 'simple', hasHandle: !!handle1 },
    });

    // Test 2: Another simple element (button)
    progress.log('Test 2: Another simple element (button)');
    const buttonElement: ElementNode = {
      xpath: '//button[@id="action-button"]',
      tag_name: 'button',
      attributes: { id: 'action-button', type: 'button' },
      highlight_index: 2,
    };

    const handle2 = await browserContext.getLocateElement(buttonElement);
    if (!handle2) {
      throw new Error('getLocateElement returned null for button element');
    }

    progress.log('✅ Test 2 passed: Button element location works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: Button element location works',
      details: { elementType: 'button', hasHandle: !!handle2 },
    });

    // Test 3: Text input element
    progress.log('Test 3: Text input element');
    const textInputElement: ElementNode = {
      xpath: '//input[@id="text-input"]',
      tag_name: 'input',
      attributes: { id: 'text-input', type: 'text' },
      highlight_index: 3,
    };

    const handle3 = await browserContext.getLocateElement(textInputElement);
    if (!handle3) {
      throw new Error('getLocateElement returned null for text input element');
    }

    progress.log('✅ Test 3 passed: Text input element location works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Text input element location works',
      details: { elementType: 'text-input', hasHandle: !!handle3 },
    });

    // Test 4: Null element handling
    progress.log('Test 4: Null element handling');
    const nullHandle = await Promise.race([
      browserContext.getLocateElement(null as unknown as ElementNode),
      new Promise<null>((_, reject) =>
        setTimeout(
          () => reject(new Error('Test 4 timeout: null element handling took too long')),
          1000
        )
      ),
    ]);
    if (nullHandle !== null) {
      throw new Error('getLocateElement should return null for null input');
    }

    progress.log('✅ Test 4 passed: Null element handling works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Null element handling works',
      details: { inputType: 'null', result: 'null' },
    });

    // Test 5: Element with complex attributes
    progress.log('Test 5: Element with complex attributes');
    const complexElement: ElementNode = {
      xpath: '//input[@type="email"][@id="email-input"][@name="email-input"]',
      tag_name: 'input',
      attributes: {
        type: 'email',
        id: 'email-input',
        name: 'email-input',
        placeholder: 'user@example.com',
      },
      highlight_index: 6,
    };

    const handle5 = await browserContext.getLocateElement(complexElement);
    if (!handle5) {
      throw new Error('getLocateElement returned null for complex element');
    }

    progress.log('✅ Test 5 passed: Complex element location works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: Complex element location works',
      details: { elementType: 'complex-attributes', hasHandle: !!handle5 },
    });

    // Test 6: Element inside iframe (first iframe)
    progress.log('Test 6: Element inside first iframe');
    const elementInFirstIframe: ElementNode = {
      xpath: '//body',
      tag_name: 'body',
      attributes: {},
      highlight_index: 7,
      parent: {
        tag: 'iframe',
        xpath: '//iframe[@src="/iframe1"]',
        attributes: { src: '/iframe1', title: 'First embedded iframe' },
        highlightIndex: 6,
      },
    };

    const handle6 = await browserContext.getLocateElement(elementInFirstIframe);
    if (!handle6) {
      throw new Error('getLocateElement returned null for element in first iframe');
    }

    progress.log('✅ Test 6 passed: Element in first iframe location works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 6 passed: Element in first iframe location works',
      details: { elementType: 'iframe-element', hasHandle: !!handle6 },
    });

    // Test 7: Element inside second iframe
    progress.log('Test 7: Element inside second iframe');
    const elementInSecondIframe: ElementNode = {
      xpath: '//body',
      tag_name: 'body',
      attributes: {},
      highlight_index: 8,
      parent: {
        tag: 'iframe',
        xpath: '//iframe[@src="/iframe2"]',
        attributes: { src: '/iframe2', title: 'Second embedded iframe with nested content' },
        highlightIndex: 7,
      },
    };

    const handle7 = await browserContext.getLocateElement(elementInSecondIframe);
    if (!handle7) {
      throw new Error('getLocateElement returned null for element in second iframe');
    }

    progress.log('✅ Test 7 passed: Element in second iframe location works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 7 passed: Element in second iframe location works',
      details: { elementType: 'iframe-element-2', hasHandle: !!handle7 },
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '🎉 All getLocateElement tests passed successfully!',
    });
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'getLocateElement tests failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw error;
  }
}

/**
 * Test _inputTextElementNode method with various input scenarios
 */
export async function testInputTextElementNode(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🧪 Testing BrowserContext._inputTextElementNode() method...');

  try {
    // Get current window ID for testing
    let currentWindowId: number;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      currentWindowId = currentWindow.id!;
    } catch (error) {
      progress.log('⚠️ Skipping _inputTextElementNode tests - Chrome APIs not available');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: '_inputTextElementNode tests skipped - Chrome APIs not available',
        details: { reason: 'Cannot access chrome.windows API in test environment' },
      });
      return;
    }

    // Create mock element handles for different input types
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const createMockElementHandle = (tagName: string, attributes: Record<string, string> = {}) => ({
      scrollIntoViewIfNeeded: async () => {},
      getTagName: async () => tagName,
      getAttribute: async (name: string) => attributes[name] || null,
      isDisabled: async () => attributes.disabled === 'true',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setTextContent: async (_text: string) => {},
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      type: async (_text: string, _options?: { delay?: number }) => {},
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      fill: async (_text: string) => {},
    });

    const mockPage = {
      tabId: 1,
      url: () => 'http://localhost:3005',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      elementHandle: async (selector: string) => {
        // Return different mock handles based on selector content
        if (selector.includes('contenteditable')) {
          return createMockElementHandle('div', { contenteditable: 'true' });
        } else if (selector.includes('readonly')) {
          return createMockElementHandle('input', { readonly: 'true' });
        } else if (selector.includes('disabled')) {
          return createMockElementHandle('input', { disabled: 'true' });
        } else if (selector.includes('textarea')) {
          return createMockElementHandle('textarea');
        } else {
          return createMockElementHandle('input', { type: 'text' });
        }
      },
    };

    const mockBrowserWindow = {
      windowId: currentWindowId,
      pages: () => [mockPage],
      getCurrentPage: async () => mockPage,
    } as unknown as BrowserWindow;

    const browserContext = new BrowserContext(mockBrowserWindow);
    await browserContext.enter();

    // Test 1: Regular input element
    progress.log('Test 1: Regular input element');
    const inputElement: ElementNode = {
      xpath: '//input[@type="text"]',
      tag_name: 'input',
      attributes: { type: 'text', name: 'username' },
      highlight_index: 1,
    };

    await browserContext._inputTextElementNode(inputElement, 'test input');

    progress.log('✅ Test 1 passed: Regular input element text input works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: Regular input element text input works',
      details: { elementType: 'input', text: 'test input' },
    });

    // Test 2: Content-editable element
    progress.log('Test 2: Content-editable element');
    const contentEditableElement: ElementNode = {
      xpath: '//div[@contenteditable="true"]',
      tag_name: 'div',
      attributes: { contenteditable: 'true', class: 'editor' },
      highlight_index: 2,
    };

    await browserContext._inputTextElementNode(contentEditableElement, 'editable content');

    progress.log('✅ Test 2 passed: Content-editable element text input works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: Content-editable element text input works',
      details: { elementType: 'contenteditable', text: 'editable content' },
    });

    // Test 3: Textarea element
    progress.log('Test 3: Textarea element');
    const textareaElement: ElementNode = {
      xpath: '//textarea[@name="description"]',
      tag_name: 'textarea',
      attributes: { name: 'description', rows: '5' },
      highlight_index: 3,
    };

    await browserContext._inputTextElementNode(textareaElement, 'multiline\ntext\ncontent');

    progress.log('✅ Test 3 passed: Textarea element text input works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Textarea element text input works',
      details: { elementType: 'textarea', text: 'multiline content' },
    });

    // Test 4: Readonly element (should still work with fill)
    progress.log('Test 4: Readonly element');
    const readonlyElement: ElementNode = {
      xpath: '//input[@readonly="true"]',
      tag_name: 'input',
      attributes: { type: 'text', readonly: 'true' },
      highlight_index: 4,
    };

    await browserContext._inputTextElementNode(readonlyElement, 'readonly text');

    progress.log('✅ Test 4 passed: Readonly element text input works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Readonly element text input works',
      details: { elementType: 'readonly', text: 'readonly text' },
    });

    // Test 5: Disabled element (should still work with fill)
    progress.log('Test 5: Disabled element');
    const disabledElement: ElementNode = {
      xpath: '//input[@disabled="true"]',
      tag_name: 'input',
      attributes: { type: 'text', disabled: 'true' },
      highlight_index: 5,
    };

    await browserContext._inputTextElementNode(disabledElement, 'disabled text');

    progress.log('✅ Test 5 passed: Disabled element text input works');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: Disabled element text input works',
      details: { elementType: 'disabled', text: 'disabled text' },
    });

    // Test 6: Element not found error
    progress.log('Test 6: Element not found error handling');
    const mockPageNoElement = {
      tabId: 1,
      url: () => 'http://localhost:3005',
      elementHandle: async () => null, // Simulate element not found
    };

    const mockBrowserWindowNoElement = {
      windowId: currentWindowId,
      pages: () => [mockPageNoElement],
      getCurrentPage: async () => mockPageNoElement,
    } as unknown as BrowserWindow;

    const browserContextNoElement = new BrowserContext(mockBrowserWindowNoElement);
    await browserContextNoElement.enter();

    const missingElement: ElementNode = {
      xpath: '//input[@id="missing"]',
      tag_name: 'input',
      attributes: { id: 'missing' },
      highlight_index: 6,
    };

    try {
      await browserContextNoElement._inputTextElementNode(missingElement, 'should fail');
      throw new Error('Expected error for missing element');
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        progress.log('✅ Test 6 passed: Element not found error handling works');
        context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 6 passed: Element not found error handling works',
          details: { errorType: 'element-not-found' },
        });
      } else {
        throw error;
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '🎉 All _inputTextElementNode tests passed successfully!',
    });
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '_inputTextElementNode tests failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw error;
  }
}

/**
 * Run all getLocateElement and _inputTextElementNode tests
 */
export async function runAllElementInteractionTests(context: TestContext): Promise<void> {
  const progress = new TestProgress('Element Interaction Tests');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: 'Starting getLocateElement and _inputTextElementNode tests',
  });

  try {
    // Run getLocateElement tests
    await testGetLocateElement(progress, context);

    // Run _inputTextElementNode tests
    await testInputTextElementNode(progress, context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '🎉 All element interaction tests completed successfully!',
    });
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Element interaction tests failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });
    throw error;
  }
}

/**
 * Quick test for getLocateElement functionality
 */
export async function quickGetLocateElementTest(): Promise<boolean> {
  try {
    const progress = new TestProgress('Quick getLocateElement Test');
    const mockContext = {
      events: {
        emit: () => {}, // No-op for quick test
      },
    };

    await testGetLocateElement(progress, mockContext);
    return true;
  } catch (error) {
    console.error('Quick getLocateElement test failed:', error);
    return false;
  }
}

/**
 * Quick test for _inputTextElementNode functionality
 */
export async function quickInputTextElementNodeTest(): Promise<boolean> {
  try {
    const progress = new TestProgress('Quick _inputTextElementNode Test');
    const mockContext = {
      events: {
        emit: () => {}, // No-op for quick test
      },
    };

    await testInputTextElementNode(progress, mockContext);
    return true;
  } catch (error) {
    console.error('Quick _inputTextElementNode test failed:', error);
    return false;
  }
}
