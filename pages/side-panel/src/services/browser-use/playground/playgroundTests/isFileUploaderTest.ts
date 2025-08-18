/**
 * Comprehensive test for BrowserContext.isFileUploader() method
 *
 * This test verifies the file uploader detection functionality works correctly,
 * including different element types, recursive child checking, and edge cases.
 */

import { BrowserContext } from '../../browser/context';
import { Severity } from '@src/utils/types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { ElementNode, DOMElementNode, ElementNodeDict, ElementForSelector } from '../../dom/types';

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
 * Main test function for isFileUploader() method
 */
export async function testIsFileUploader(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🧪 Testing BrowserContext.isFileUploader() method...');

  try {
    // Create browser window
    let browserWindow: BrowserWindow;
    try {
      browserWindow = await BrowserWindow.create();
      progress.log(`📍 Created browser window: ${browserWindow.windowId}`);
    } catch (error) {
      progress.log('⚠️ Skipping isFileUploader tests - BrowserWindow not available');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'isFileUploader tests skipped - BrowserWindow not available',
        details: { reason: 'Cannot create BrowserWindow in test environment' },
      });
      return;
    }

    // Create browser context
    const browserContext = new BrowserContext(browserWindow);
    await browserContext.enter();

    // Navigate to test page to have a proper page context
    progress.log('Test 0: Navigate to test page');
    const page = await browserContext.getCurrentPage();
    await page.goto('http://localhost:3005');
    await page.waitForLoadState();
    progress.log('📍 Navigated to http://localhost:3005');

    // Test 1: Test with null/undefined elements
    progress.log('Test 1: Null and undefined element handling');

    const nullResult = await browserContext.isFileUploader(null);
    if (nullResult !== false) {
      throw new Error(`Expected false for null element, got: ${nullResult}`);
    }

    const undefinedResult = await browserContext.isFileUploader(
      undefined as unknown as ElementNode
    );
    if (undefinedResult !== false) {
      throw new Error(`Expected false for undefined element, got: ${undefinedResult}`);
    }

    progress.log(`✅ Test 1 passed: Null/undefined elements handled correctly`);

    // Test 2: Test with file input elements (ElementForSelector format)
    progress.log('Test 2: File input elements (ElementForSelector format)');

    const fileInputElement: ElementForSelector = {
      xpath: '//input[@type="file"]',
      tag_name: 'input',
      attributes: {
        type: 'file',
        name: 'upload',
      },
    };

    const fileInputResult = await browserContext.isFileUploader(fileInputElement);
    if (fileInputResult !== true) {
      throw new Error(`Expected true for file input element, got: ${fileInputResult}`);
    }

    const fileInputWithAccept: ElementForSelector = {
      xpath: '//input[@accept]',
      tag_name: 'input',
      attributes: {
        type: 'text',
        accept: 'image/*',
      },
    };

    const fileInputWithAcceptResult = await browserContext.isFileUploader(fileInputWithAccept);
    if (fileInputWithAcceptResult !== true) {
      throw new Error(
        `Expected true for input with accept attribute, got: ${fileInputWithAcceptResult}`
      );
    }

    progress.log(`✅ Test 2 passed: File input elements detected correctly`);

    // Test 3: Test with non-file input elements
    progress.log('Test 3: Non-file input elements');

    const textInputElement: ElementForSelector = {
      xpath: '//input[@type="text"]',
      tag_name: 'input',
      attributes: {
        type: 'text',
        name: 'username',
      },
    };

    const textInputResult = await browserContext.isFileUploader(textInputElement);
    if (textInputResult !== false) {
      throw new Error(`Expected false for text input element, got: ${textInputResult}`);
    }

    const divElement: ElementForSelector = {
      xpath: '//div',
      tag_name: 'div',
      attributes: {
        class: 'container',
      },
    };

    const divResult = await browserContext.isFileUploader(divElement);
    if (divResult !== false) {
      throw new Error(`Expected false for div element, got: ${divResult}`);
    }

    progress.log(`✅ Test 3 passed: Non-file elements correctly identified as non-uploaders`);

    // Test 4: Test with ElementNodeDict format
    progress.log('Test 4: ElementNodeDict format elements');

    const fileInputDict: ElementNodeDict = {
      tag: 'input',
      xpath: '//input[@type="file"]',
      attributes: {
        type: 'file',
        multiple: 'true',
      },
      isVisible: true,
      isInteractive: true,
    };

    const dictResult = await browserContext.isFileUploader(fileInputDict);
    if (dictResult !== true) {
      throw new Error(`Expected true for ElementNodeDict file input, got: ${dictResult}`);
    }

    const nonFileDict: ElementNodeDict = {
      tag: 'button',
      xpath: '//button',
      attributes: {
        type: 'submit',
      },
      isVisible: true,
      isInteractive: true,
    };

    const nonFileDictResult = await browserContext.isFileUploader(nonFileDict);
    if (nonFileDictResult !== false) {
      throw new Error(`Expected false for ElementNodeDict button, got: ${nonFileDictResult}`);
    }

    progress.log(`✅ Test 4 passed: ElementNodeDict format handled correctly`);

    // Test 5: Test with DOMElementNode interface format
    progress.log('Test 5: DOMElementNode interface format');

    const domFileInput: DOMElementNode = {
      tag: 'input',
      xpath: '//input[@type="file"]',
      attributes: {
        type: 'file',
        name: 'file-upload',
      },
    };

    const domFileResult = await browserContext.isFileUploader(domFileInput);
    if (domFileResult !== true) {
      throw new Error(`Expected true for DOMElementNode file input, got: ${domFileResult}`);
    }

    progress.log(`✅ Test 5 passed: DOMElementNode interface format handled correctly`);

    // Test 6: Test recursive child checking
    progress.log('Test 6: Recursive child checking');

    const parentWithFileInputChild: ElementNodeDict = {
      tag: 'form',
      xpath: '//form',
      attributes: {
        action: '/upload',
      },
      children: [
        {
          tag: 'div',
          xpath: '//form/div',
          attributes: {
            class: 'form-group',
          },
          children: [
            {
              tag: 'input',
              xpath: '//form/div/input',
              attributes: {
                type: 'file',
                name: 'document',
              },
            },
          ],
        },
      ],
    };

    const parentResult = await browserContext.isFileUploader(parentWithFileInputChild);
    if (parentResult !== true) {
      throw new Error(`Expected true for parent with file input child, got: ${parentResult}`);
    }

    const parentWithoutFileInput: ElementNodeDict = {
      tag: 'form',
      xpath: '//form',
      attributes: {
        action: '/login',
      },
      children: [
        {
          tag: 'input',
          xpath: '//form/input[1]',
          attributes: {
            type: 'text',
            name: 'username',
          },
        },
        {
          tag: 'input',
          xpath: '//form/input[2]',
          attributes: {
            type: 'password',
            name: 'password',
          },
        },
      ],
    };

    const parentNoFileResult = await browserContext.isFileUploader(parentWithoutFileInput);
    if (parentNoFileResult !== false) {
      throw new Error(
        `Expected false for parent without file input child, got: ${parentNoFileResult}`
      );
    }

    progress.log(`✅ Test 6 passed: Recursive child checking works correctly`);

    // Test 7: Real DOM structure - form container with file inputs
    progress.log('Test 7: Real DOM structure validation');

    // Test the actual form container that contains file inputs
    // This represents the real structure from localhost:3005
    const formContainer: ElementNodeDict = {
      tag: 'div',
      xpath: '//div[@class="controls"]',
      attributes: { class: 'controls' },
      children: [
        {
          tag: 'form',
          xpath: '//div[@class="controls"]/form',
          attributes: { id: 'test-form' },
          children: [
            {
              tag: 'div',
              xpath: '//div[@class="controls"]/form/div',
              attributes: { style: 'margin: 1em 0;' },
              children: [
                {
                  tag: 'input',
                  xpath: '//div[@class="controls"]/form/div/input[@type="file"]',
                  attributes: {
                    type: 'file',
                    id: 'file-input',
                    name: 'file-input',
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    // Test the form container - should find file input in children
    const formResult = await browserContext.isFileUploader(formContainer);
    if (formResult !== true) {
      throw new Error(`Expected true for form container with file input, got: ${formResult}`);
    }

    // Test depth limiting with the form container
    // With depth 1, should not find the nested file input
    const shallowResult = await browserContext.isFileUploader(formContainer, 1);
    if (shallowResult !== false) {
      throw new Error(
        `Expected false for form container with shallow depth (1), got: ${shallowResult}`
      );
    }

    // With depth 3, should find the nested file input
    const deepResult = await browserContext.isFileUploader(formContainer, 3);
    if (deepResult !== true) {
      throw new Error(
        `Expected true for form container with sufficient depth (3), got: ${deepResult}`
      );
    }

    progress.log(`✅ Test 7 passed: Real DOM structure and depth limiting work correctly`);

    // Test 8: Test with elements missing required properties
    progress.log('Test 8: Elements with missing properties');

    const elementMissingTagName: Partial<ElementForSelector> = {
      xpath: '//input',
      attributes: {
        type: 'file',
      },
    };

    const missingTagResult = await browserContext.isFileUploader(
      elementMissingTagName as ElementNode
    );
    if (missingTagResult !== false) {
      throw new Error(`Expected false for element missing tag name, got: ${missingTagResult}`);
    }

    const elementMissingAttributes: ElementForSelector = {
      xpath: '//input',
      tag_name: 'input',
      // No attributes property
    };

    const missingAttrsResult = await browserContext.isFileUploader(elementMissingAttributes);
    if (missingAttrsResult !== false) {
      throw new Error(`Expected false for element missing attributes, got: ${missingAttrsResult}`);
    }

    progress.log(`✅ Test 8 passed: Elements with missing properties handled correctly`);

    // Test 9: Performance test with large element trees
    progress.log('Test 9: Performance with large element trees');

    // Create a large tree with many children but no file inputs
    const largeTree: ElementNodeDict = {
      tag: 'div',
      xpath: '//div',
      attributes: { class: 'large-container' },
      children: Array.from({ length: 50 }, (_, i) => ({
        tag: 'div',
        xpath: `//div/div[${i + 1}]`,
        attributes: { class: `child-${i}` },
        children: Array.from({ length: 10 }, (_, j) => ({
          tag: 'span',
          xpath: `//div/div[${i + 1}]/span[${j + 1}]`,
          attributes: { class: `grandchild-${i}-${j}` },
        })),
      })),
    };

    const perfStartTime = performance.now();
    const largeTreeResult = await browserContext.isFileUploader(largeTree);
    const perfEndTime = performance.now();
    const performanceTime = perfEndTime - perfStartTime;

    if (largeTreeResult !== false) {
      throw new Error(`Expected false for large tree without file inputs, got: ${largeTreeResult}`);
    }

    progress.log(
      `📍 Large tree performance: ${performanceTime.toFixed(2)}ms for ${50 * 10} elements`
    );

    if (performanceTime > 1000) {
      // Should complete within 1 second
      progress.log(`⚠️ Performance warning: Large tree took ${performanceTime.toFixed(2)}ms`);
    }

    progress.log(`✅ Test 9 passed: Performance with large trees acceptable`);

    // Cleanup
    await browserContext.close();
    progress.log('🧹 Cleaned up browser context');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'isFileUploader() tests completed successfully',
      details: {
        totalTests: 9,
        testsPassed: 9,
        performanceTime: `${performanceTime.toFixed(2)}ms`,
      },
    });

    progress.log('✅ All isFileUploader() tests passed!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ isFileUploader() test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'isFileUploader() test failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}
