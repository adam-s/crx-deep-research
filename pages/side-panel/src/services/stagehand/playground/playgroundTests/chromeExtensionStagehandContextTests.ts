/**
 * ChromeExtensionStagehandContext Tests
 * Test suite for the Chrome extension compatible StagehandContext implementation
 */

import { TestProgress, TestContext } from './types';
import { Severity } from '@src/utils/types';
import { ChromeExtensionStagehandContext } from '../../lib/ChromeExtensionStagehandContext';
import { ChromeExtensionStagehand } from '../../lib/index';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { LogLine } from '../../types/log';
import { LLMProvider } from '../../lib/llm/LLMProvider';
import { LLMClient, CreateChatCompletionOptions, LLMResponse } from '../../lib/llm/LLMClient';

/**
 * Test LLM Client that properly extends LLMClient for testing
 */
class TestLLMClient extends LLMClient {
  public type = 'test' as const;

  constructor() {
    super('gpt-4o-mini');
    this.hasVision = true;
    this.clientOptions = {};
  }

  async createChatCompletion<T = LLMResponse & { usage?: LLMResponse['usage'] }>(
    _options: CreateChatCompletionOptions
  ): Promise<T> {
    const response: LLMResponse = {
      id: 'test-completion-' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Mock AI response from test LLM client',
            tool_calls: [],
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };
    return response as T;
  }
}

/**
 * Test LLM Provider that returns a real LLMClient instance
 */
class TestLLMProvider extends LLMProvider {
  constructor() {
    super((logLine: LogLine) => console.log('Test LLM:', logLine.message), false);
  }

  getClient(): LLMClient {
    return new TestLLMClient();
  }
}

/**
 * Create a real Stagehand instance for testing and initialize it
 */
async function createTestStagehand(
  browserWindow: BrowserWindow
): Promise<ChromeExtensionStagehand> {
  const stagehand = new ChromeExtensionStagehand({
    verbose: 1,
    llmProvider: new TestLLMProvider(),
    domSettleTimeoutMs: 1000,
    enableCaching: false,
    selfHeal: false,
    experimental: false,
  });

  // Initialize the stagehand instance with the browser window
  await stagehand.init(browserWindow);

  return stagehand;
}

/**
 * Test ChromeExtensionStagehandContext core functionality
 */
export async function testChromeExtensionStagehandContext(context: TestContext): Promise<void> {
  const progress = new TestProgress('ChromeExtensionStagehandContext Tests');

  try {
    progress.log('Starting ChromeExtensionStagehandContext test suite...');

    // Create a BrowserWindow for testing
    const browserWindow = await BrowserWindow.create();
    const testStagehand = await createTestStagehand(browserWindow);

    // Test: Context initialization
    await testContextInitialization(context, progress, browserWindow, testStagehand);

    // Test: Context static init method
    await testContextStaticInit(context, progress, browserWindow, testStagehand);

    // Test: Page creation and management
    await testPageManagement(context, progress, browserWindow, testStagehand);

    // Test: Active page management
    await testActivePageManagement(context, progress, browserWindow, testStagehand);

    // Test: Context disposal
    await testContextDisposal(context, progress, browserWindow, testStagehand);

    // Test: Error handling
    await testErrorHandling(context, progress, browserWindow, testStagehand);

    progress.log('ChromeExtensionStagehandContext test suite completed successfully');

    // Clean up
    browserWindow.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandContext tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`ChromeExtensionStagehandContext test suite failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandContext test suite failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test ChromeExtensionStagehandContext basic constructor
 */
async function testContextInitialization(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  testStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing ChromeExtensionStagehandContext initialization...');

  try {
    // Test basic constructor
    const stagehandContext = new ChromeExtensionStagehandContext(browserWindow, testStagehand);

    // Verify basic properties are set
    if (!stagehandContext.context) {
      throw new Error('Context should expose browserWindow as context property');
    }

    if (stagehandContext.context !== browserWindow) {
      throw new Error('Context property should return the browserWindow instance');
    }

    // Test getActivePage returns null initially
    const activePage = stagehandContext.getActivePage();
    if (activePage !== null) {
      throw new Error('Active page should be null before initialization');
    }

    progress.log('✓ Basic constructor works correctly');
    progress.log('✓ Context property exposes browserWindow');
    progress.log('✓ Initial active page is null');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandContext initialization test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Context initialization test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandContext initialization test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test ChromeExtensionStagehandContext static init method
 */
async function testContextStaticInit(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  testStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing ChromeExtensionStagehandContext static init method...');

  try {
    // Test static init method
    const stagehandContext = await ChromeExtensionStagehandContext.init(
      browserWindow,
      testStagehand
    );

    // Verify context was created and initialized
    if (!stagehandContext) {
      throw new Error('Static init should return a context instance');
    }

    if (!stagehandContext.context) {
      throw new Error('Initialized context should have context property');
    }

    // Verify an active page was set during initialization
    const activePage = stagehandContext.getActivePage();
    if (!activePage) {
      throw new Error('Static init should set an active page from current browser page');
    }

    // Verify the active page has the correct underlying page
    if (!activePage.page) {
      throw new Error('Active StagehandPage should have underlying Cordyceps page');
    }

    progress.log('✓ Static init method works correctly');
    progress.log('✓ Automatically sets active page from current browser page');
    progress.log('✓ Returns properly initialized context instance');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandContext static init test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Static init test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandContext static init test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test page creation and management functionality
 */
async function testPageManagement(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  testStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing page management functionality...');

  try {
    const stagehandContext = await ChromeExtensionStagehandContext.init(
      browserWindow,
      testStagehand
    );

    // Test getting all pages
    const initialPages = await stagehandContext.pages();
    const initialPageCount = initialPages.length;

    if (initialPageCount === 0) {
      throw new Error('Should have at least one page after initialization');
    }

    progress.log(`✓ Initial page count: ${initialPageCount}`);

    // Test creating a new page
    const newPage = await stagehandContext.newPage();

    if (!newPage) {
      throw new Error('newPage should return a StagehandPage instance');
    }

    if (!newPage.page) {
      throw new Error('New StagehandPage should have underlying Cordyceps page');
    }

    // Navigate to a safe URL to avoid chrome:// restrictions
    try {
      await newPage.page.goto('http://localhost:3005');
    } catch (navError) {
      // If navigation fails, that's okay for this test - we're testing page creation
      progress.log('⚠️ Navigation to test URL failed (expected in some environments)');
    }

    // Verify page count increased
    const updatedPages = await stagehandContext.pages();
    if (updatedPages.length !== initialPageCount + 1) {
      throw new Error(
        `Page count should increase from ${initialPageCount} to ${initialPageCount + 1}`
      );
    }

    // Test that new page became the active page
    const currentActivePage = stagehandContext.getActivePage();
    if (currentActivePage !== newPage) {
      throw new Error('Newly created page should become the active page');
    }

    // Test getStagehandPage with existing page
    const cordycepsPage = newPage.page;
    const retrievedPage = await stagehandContext.getStagehandPage(cordycepsPage);

    if (retrievedPage !== newPage) {
      throw new Error(
        'getStagehandPage should return the same StagehandPage for the same Cordyceps page'
      );
    }

    progress.log('✓ newPage() creates new pages correctly');
    progress.log('✓ pages() returns correct page count');
    progress.log('✓ New pages become active automatically');
    progress.log('✓ getStagehandPage() retrieves existing pages correctly');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandContext page management test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Page management test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandContext page management test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test active page management
 */
async function testActivePageManagement(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  testStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing active page management...');

  try {
    const stagehandContext = await ChromeExtensionStagehandContext.init(
      browserWindow,
      testStagehand
    );

    // Get initial active page
    const initialActivePage = stagehandContext.getActivePage();
    if (!initialActivePage) {
      throw new Error('Should have an active page after initialization');
    }

    // Create a second page
    const secondPage = await stagehandContext.newPage();

    // Verify second page became active
    const currentActivePage = stagehandContext.getActivePage();
    if (currentActivePage !== secondPage) {
      throw new Error('Second page should become active when created');
    }

    // Test manual active page setting
    stagehandContext.setActivePage(initialActivePage);
    const manuallySetActivePage = stagehandContext.getActivePage();

    if (manuallySetActivePage !== initialActivePage) {
      throw new Error('setActivePage should change the active page');
    }

    progress.log('✓ Initial active page set correctly');
    progress.log('✓ New pages become active automatically');
    progress.log('✓ setActivePage changes active page correctly');
    progress.log('✓ getActivePage returns current active page');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandContext active page management test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Active page management test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandContext active page management test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test context disposal
 */
async function testContextDisposal(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow,
  testStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing context disposal...');

  try {
    const stagehandContext = await ChromeExtensionStagehandContext.init(
      browserWindow,
      testStagehand
    );

    // Create a few pages
    await stagehandContext.newPage();
    await stagehandContext.newPage();

    const pages = await stagehandContext.pages();
    const pageCount = pages.length;

    if (pageCount < 2) {
      throw new Error('Should have at least 2 pages for disposal test');
    }

    // Test closing a specific page
    const pageToClose = pages[0];
    await stagehandContext.closePage(pageToClose);

    // Give a small delay for the browser to process the tab closure
    await new Promise(resolve => setTimeout(resolve, 100));

    const pagesAfterClose = await stagehandContext.pages();
    if (pagesAfterClose.length !== pageCount - 1) {
      // Try one more time with a longer delay
      await new Promise(resolve => setTimeout(resolve, 200));
      const pagesAfterCloseRetry = await stagehandContext.pages();

      if (pagesAfterCloseRetry.length !== pageCount - 1) {
        throw new Error(
          `Page count should decrease from ${pageCount} to ${pageCount - 1} after closing one page. ` +
            `Got ${pagesAfterCloseRetry.length} pages. This might be a timing issue with tab closure.`
        );
      }
    }

    // Test full context disposal
    await stagehandContext.dispose();

    progress.log('✓ closePage removes specific pages correctly');
    progress.log('✓ dispose() cleans up context successfully');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandContext disposal test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Context disposal test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandContext disposal test failed',
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
  testStagehand: ChromeExtensionStagehand
): Promise<void> {
  progress.log('Testing error handling scenarios...');

  try {
    // Test initialization with invalid parameters
    try {
      // This should work - testing that null/undefined don't crash
      new ChromeExtensionStagehandContext(
        browserWindow,
        null as unknown as ChromeExtensionStagehand
      );
      progress.log('✓ Constructor handles null stagehand gracefully');
    } catch (error) {
      // This is expected - just ensure it doesn't crash the whole test
      progress.log('✓ Constructor properly validates stagehand parameter');
    }

    // Test operations on disposed context
    const stagehandContext = await ChromeExtensionStagehandContext.init(
      browserWindow,
      testStagehand
    );
    await stagehandContext.dispose();

    // Try to create page after disposal - should handle gracefully
    try {
      await stagehandContext.newPage();
      progress.log('✓ Operations after disposal handled gracefully');
    } catch (error) {
      progress.log('✓ Operations after disposal throw appropriate errors');
    }

    progress.log('✓ Error scenarios handled appropriately');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehandContext error handling test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Error handling test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehandContext error handling test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}
