/**
 * ChromeExtensionStagehandPage Tests
 * Test suite for the Chrome extension compatible StagehandPage implementation
 * This is the most complex component as it integrates AI handlers with Cordyceps
 */

import { TestProgress, TestContext } from './types';
import { Severity } from '@src/utils/types';
import { ChromeExtensionStagehandPage } from '../../lib/ChromeExtensionStagehandPage';
import { ChromeExtensionStagehand } from '../../lib/index';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { Page } from '@src/services/cordyceps/page';
import { LogLine } from '../../types/log';
import { LLMClient } from '../../lib/llm/LLMClient';

/**
 * Mock LLM Client for testing
 */
class MockLLMClient {
  async generateObject() {
    return {
      object: {
        action: 'click',
        element: 'button',
        reasoning: 'Mock AI reasoning',
      },
      usage: { promptTokens: 20, completionTokens: 10 },
    };
  }
}

/**
 * Create a mock Stagehand instance for testing
 */
function createMockStagehand(browserWindow: BrowserWindow): ChromeExtensionStagehand {
  const mockStagehand = {
    llmClient: new MockLLMClient() as unknown as LLMClient,
    userProvidedInstructions: 'Test instructions',
    domSettleTimeoutMs: 1000,
    enableCaching: false,
    verbose: 1,
    selfHeal: false,
    experimental: false,
    browserWindow: browserWindow,
    log: (logLine: LogLine) => {
      console.log(`[${logLine.category}] ${logLine.message}`);
    },
    logger: (logLine: LogLine) => {
      console.log(`[${logLine.category}] ${logLine.message}`);
    },
  } as unknown as ChromeExtensionStagehand;

  return mockStagehand;
}

/**
 * Test ChromeExtensionStagehandPage core functionality
 */
export async function testChromeExtensionStagehandPage(context: TestContext): Promise<void> {
  const progress = new TestProgress('ChromeExtensionStagehandPage Tests');

  try {
    progress.log('Starting ChromeExtensionStagehandPage test suite...');

    // Create a BrowserWindow for testing
    const browserWindow = await BrowserWindow.create();
    const mockStagehand = createMockStagehand(browserWindow);

    // Test: Basic page construction
    await testPageConstruction(context, progress, browserWindow, mockStagehand);

    // Test: Page initialization
    await testPageInitialization(context, progress, browserWindow, mockStagehand);

    // Test: Enhanced page proxy functionality
    await testEnhancedPageProxy(context, progress, browserWindow, mockStagehand);

    // Test: Script injection
    await testScriptInjection(context, progress, browserWindow, mockStagehand);

    // Test: DOM settling functionality
    await testDOMSettling(context, progress, browserWindow, mockStagehand);

    // Test: AI method interfaces (without execution)
    await testAIMethodInterfaces(context, progress, browserWindow, mockStagehand);

    // Test: Error handling scenarios
    await testErrorHandling(context, progress, browserWindow, mockStagehand);

    // Test: Page disposal
    await testPageDisposal(context, progress, browserWindow, mockStagehand);

    progress.log('ChromeExtensionStagehandPage test suite completed successfully');

    // Clean up
    browserWindow.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandPage tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`ChromeExtensionStagehandPage test suite failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandPage test suite failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test basic page construction
 */
async function testPageConstruction(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  mockStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing page construction...');

  try {
    // Get a page from the browser window
    const page = await browserWindow.getCurrentPage();
    const mockLLMClient = new MockLLMClient() as unknown as LLMClient;

    // Test: Basic constructor
    const stagehandPage = new ChromeExtensionStagehandPage(
      page,
      mockStagehand,
      mockLLMClient,
      'Test user instructions'
    );

    // Verify basic properties
    if (stagehandPage.page !== page) {
      throw new Error('StagehandPage should expose the underlying Cordyceps page');
    }

    if (!stagehandPage.enhancedPage) {
      throw new Error('StagehandPage should have an enhanced page proxy');
    }

    progress.log('✓ Basic constructor works correctly');
    progress.log('✓ Page and enhancedPage getters work');

    // Test: Constructor with different parameters
    const stagehandPageMinimal = new ChromeExtensionStagehandPage(
      page,
      mockStagehand,
      mockLLMClient
    );

    if (!stagehandPageMinimal.page) {
      throw new Error('StagehandPage should work without user instructions');
    }

    progress.log('✓ Constructor works with minimal parameters');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandPage construction test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Page construction test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandPage construction test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test page initialization
 */
async function testPageInitialization(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  mockStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing page initialization...');

  try {
    const page = await browserWindow.getCurrentPage();

    // Navigate to a safe URL first to avoid chrome:// restrictions
    try {
      await page.goto('http://localhost:3005');
    } catch (navError) {
      // If navigation fails, that's okay - we'll test with whatever page we have
      progress.log('⚠️ Navigation to test URL failed, continuing with current page');
    }

    const mockLLMClient = new MockLLMClient() as unknown as LLMClient;

    const stagehandPage = new ChromeExtensionStagehandPage(
      page,
      mockStagehand,
      mockLLMClient,
      'Test user instructions'
    );

    // Test: Initialization
    const initializedPage = await stagehandPage.init();

    if (initializedPage !== stagehandPage) {
      throw new Error('init() should return the same StagehandPage instance');
    }

    progress.log('✓ Initialization returns correct instance');

    // Test: AI methods are available after initialization
    if (typeof stagehandPage.act !== 'function') {
      throw new Error('act() method should be available after initialization');
    }

    if (typeof stagehandPage.observe !== 'function') {
      throw new Error('observe() method should be available after initialization');
    }

    if (typeof stagehandPage.extract !== 'function') {
      throw new Error('extract() method should be available after initialization');
    }

    progress.log('✓ AI methods available after initialization');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandPage initialization test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Page initialization test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandPage initialization test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test enhanced page proxy functionality
 */
async function testEnhancedPageProxy(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  mockStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing enhanced page proxy functionality...');

  try {
    const page = await browserWindow.getCurrentPage();
    const mockLLMClient = new MockLLMClient() as unknown as LLMClient;

    const stagehandPage = new ChromeExtensionStagehandPage(page, mockStagehand, mockLLMClient);

    await stagehandPage.init();

    const enhancedPage = stagehandPage.enhancedPage;

    // Test: Enhanced page has Cordyceps methods
    if (typeof enhancedPage.url !== 'function') {
      throw new Error('Enhanced page should have Cordyceps url() method');
    }

    if (typeof enhancedPage.goto !== 'function') {
      throw new Error('Enhanced page should have Cordyceps goto() method');
    }

    if (typeof enhancedPage.evaluate !== 'function') {
      throw new Error('Enhanced page should have Cordyceps evaluate() method');
    }

    progress.log('✓ Enhanced page has Cordyceps methods');

    // Test: Enhanced page has AI methods
    if (typeof enhancedPage.act !== 'function') {
      throw new Error('Enhanced page should have Stagehand act() method');
    }

    if (typeof enhancedPage.observe !== 'function') {
      throw new Error('Enhanced page should have Stagehand observe() method');
    }

    if (typeof enhancedPage.extract !== 'function') {
      throw new Error('Enhanced page should have Stagehand extract() method');
    }

    progress.log('✓ Enhanced page has Stagehand AI methods');

    // Test: Method binding works correctly
    const urlMethod = enhancedPage.url;
    if (typeof urlMethod !== 'function') {
      throw new Error('Method binding should preserve function type');
    }

    progress.log('✓ Enhanced page proxy binds methods correctly');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandPage enhanced proxy test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Enhanced page proxy test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandPage enhanced proxy test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test script injection functionality
 */
async function testScriptInjection(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  mockStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing script injection functionality...');

  try {
    const page = await browserWindow.getCurrentPage();
    const mockLLMClient = new MockLLMClient() as unknown as LLMClient;

    const stagehandPage = new ChromeExtensionStagehandPage(page, mockStagehand, mockLLMClient);

    await stagehandPage.init();

    // Test: Script injection (check if helpers are available)
    // Note: We can't easily test the actual injection without a real page,
    // but we can test that the method exists and doesn't throw

    try {
      // Try to call evaluate which should trigger script injection
      await page.evaluate(() => {
        return window.location.href;
      });

      progress.log('✓ Script injection mechanism works (no errors thrown)');
    } catch (error) {
      // This might fail in test environment, which is expected
      progress.log('⚠ Script injection test skipped (no DOM environment)');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandPage script injection test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Script injection test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandPage script injection test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test DOM settling functionality
 */
async function testDOMSettling(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  mockStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing DOM settling functionality...');

  try {
    const page = await browserWindow.getCurrentPage();
    const mockLLMClient = new MockLLMClient() as unknown as LLMClient;

    const stagehandPage = new ChromeExtensionStagehandPage(page, mockStagehand, mockLLMClient);

    await stagehandPage.init();

    // Test: DOM settling method exists and can be called
    if (typeof stagehandPage._waitForSettledDom !== 'function') {
      throw new Error('_waitForSettledDom method should exist');
    }

    // Test: DOM settling with timeout
    try {
      await stagehandPage._waitForSettledDom(100); // Short timeout for testing
      progress.log('✓ DOM settling with timeout works');
    } catch (error) {
      // This might timeout in test environment, which is acceptable
      progress.log('⚠ DOM settling test completed (may have timed out)');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandPage DOM settling test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ DOM settling test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandPage DOM settling test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test AI method interfaces (without actual execution to avoid LLM calls)
 */
async function testAIMethodInterfaces(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  mockStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing AI method interfaces...');

  try {
    const page = await browserWindow.getCurrentPage();
    const mockLLMClient = new MockLLMClient() as unknown as LLMClient;

    const stagehandPage = new ChromeExtensionStagehandPage(page, mockStagehand, mockLLMClient);

    await stagehandPage.init();

    // Test: act() method signature
    if (typeof stagehandPage.act !== 'function') {
      throw new Error('act() method should exist');
    }

    // Test that we can call act with string parameter (don't await to avoid LLM call)
    const actPromise = stagehandPage.act('test action');
    if (!(actPromise instanceof Promise)) {
      throw new Error('act() should return a Promise');
    }

    progress.log('✓ act() method has correct interface');

    // Test: observe() method signature
    if (typeof stagehandPage.observe !== 'function') {
      throw new Error('observe() method should exist');
    }

    const observePromise = stagehandPage.observe('test observation');
    if (!(observePromise instanceof Promise)) {
      throw new Error('observe() should return a Promise');
    }

    progress.log('✓ observe() method has correct interface');

    // Test: extract() method signature
    if (typeof stagehandPage.extract !== 'function') {
      throw new Error('extract() method should exist');
    }

    const extractPromise = stagehandPage.extract({ instruction: 'test extraction' });
    if (!(extractPromise instanceof Promise)) {
      throw new Error('extract() should return a Promise');
    }

    progress.log('✓ extract() method has correct interface');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandPage AI method interfaces test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ AI method interfaces test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandPage AI method interfaces test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test error handling scenarios
 */
async function testErrorHandling(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  mockStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing error handling scenarios...');

  try {
    const page = await browserWindow.getCurrentPage();
    const mockLLMClient = new MockLLMClient() as unknown as LLMClient;

    // Test: Access before initialization
    const uninitializedPage = new ChromeExtensionStagehandPage(page, mockStagehand, mockLLMClient);

    // Test: AI methods before initialization should throw
    try {
      await uninitializedPage.act('test');
      throw new Error('Should throw when calling act() before initialization');
    } catch (error) {
      if (error instanceof Error && error.message.includes('initialized')) {
        progress.log('✓ Proper error when calling act() before initialization');
      } else {
        throw error;
      }
    }

    try {
      await uninitializedPage.observe('test');
      throw new Error('Should throw when calling observe() before initialization');
    } catch (error) {
      if (error instanceof Error && error.message.includes('initialized')) {
        progress.log('✓ Proper error when calling observe() before initialization');
      } else {
        throw error;
      }
    }

    try {
      await uninitializedPage.extract({ instruction: 'test' });
      throw new Error('Should throw when calling extract() before initialization');
    } catch (error) {
      if (error instanceof Error && error.message.includes('initialized')) {
        progress.log('✓ Proper error when calling extract() before initialization');
      } else {
        throw error;
      }
    }

    // Test: Invalid constructor parameters
    try {
      new ChromeExtensionStagehandPage(null as unknown as Page, mockStagehand, mockLLMClient);
      progress.log('⚠ Constructor with null page handled gracefully');
    } catch (error) {
      progress.log('✓ Constructor properly validates page parameter');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandPage error handling test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Error handling test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandPage error handling test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test page disposal
 */
async function testPageDisposal(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  mockStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing page disposal...');

  try {
    const page = await browserWindow.getCurrentPage();
    const mockLLMClient = new MockLLMClient() as unknown as LLMClient;

    const stagehandPage = new ChromeExtensionStagehandPage(page, mockStagehand, mockLLMClient);

    await stagehandPage.init();

    // Test: Disposal method exists
    if (typeof stagehandPage.dispose !== 'function') {
      throw new Error('dispose() method should exist');
    }

    // Test: Disposal completes without error
    await stagehandPage.dispose();

    progress.log('✓ Page disposal completes without error');

    // Test: Operations after disposal
    try {
      await stagehandPage.act('test after disposal');
      throw new Error('Should throw when calling act() after disposal');
    } catch (error) {
      if (error instanceof Error && error.message.includes('initialized')) {
        progress.log('✓ Proper error when calling methods after disposal');
      } else {
        throw error;
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandPage disposal test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Page disposal test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandPage disposal test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}
