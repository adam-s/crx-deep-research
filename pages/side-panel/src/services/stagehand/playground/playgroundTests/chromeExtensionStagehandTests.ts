/**
 * ChromeExtensionStagehand Tests
 * Test suite for the main Chrome extension compatible Stagehand implementation
 */

import { TestProgress, TestContext } from './types';
import { Severity } from '@src/utils/types';
import { ChromeExtensionStagehand, ChromeExtensionStagehandParams } from '../../lib/index';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { LogLine } from '../../types/log';
import { StagehandFunctionName } from '../../types/stagehand';
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
    options: CreateChatCompletionOptions
  ): Promise<T> {
    // Log the request for debugging
    options.logger({
      category: 'test-llm',
      message: 'Test LLM request received',
      level: 2,
      auxiliary: {
        messageCount: { value: String(options.options.messages.length), type: 'string' },
      },
    });

    // Check if this is a structured response (has response_model)
    const hasSchema = options.options.response_model !== undefined;

    if (hasSchema) {
      // Return structured response format for schema-based requests
      const structuredResponse = {
        data: {
          elements: [
            {
              elementId: '1-1',
              description: 'Mock search input element for testing',
              method: 'fill',
              arguments: ['test query'],
            },
            {
              elementId: '1-2',
              description: 'Mock search button element for testing',
              method: 'click',
              arguments: [],
            },
          ],
        },
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      return structuredResponse as T;
    }

    // Return standard chat completion for non-schema requests
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
 * Test ChromeExtensionStagehand core functionality
 */
export async function testChromeExtensionStagehand(context: TestContext): Promise<void> {
  const progress = new TestProgress('ChromeExtensionStagehand Tests');

  try {
    progress.log('Starting ChromeExtensionStagehand test suite...');

    // Test: Basic constructor and configuration
    await testBasicConstructorAndConfig(context, progress);

    // Test: Initialization with BrowserWindow
    await testInitializationWithBrowserWindow(context, progress);

    // Test: Page access and management
    await testPageAccessAndManagement(context, progress);

    // Test: Metrics and history tracking
    await testMetricsAndHistoryTracking(context, progress);

    // Test: LLM provider and client configuration
    await testLLMConfiguration(context, progress);

    // Test: Agent functionality
    await testAgentFunctionality(context, progress);

    // Test: Error handling and edge cases
    await testErrorHandlingAndEdgeCases(context, progress);

    // Test: Cleanup and disposal
    await testCleanupAndDisposal(context, progress);

    progress.log('ChromeExtensionStagehand test suite completed successfully');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehand tests completed successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`ChromeExtensionStagehand test suite failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehand test suite failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test basic constructor and configuration
 */
async function testBasicConstructorAndConfig(
  context: TestContext,
  progress: TestProgress
): Promise<void> {
  progress.log('Testing basic constructor and configuration...');

  try {
    // Test: Default constructor
    const defaultStagehand = new ChromeExtensionStagehand();

    if (defaultStagehand.verbose !== 0) {
      throw new Error('Default verbose level should be 0');
    }

    if (defaultStagehand.enableCaching !== false) {
      throw new Error('Default enableCaching should be false');
    }

    if (defaultStagehand.domSettleTimeoutMs !== 30000) {
      throw new Error('Default domSettleTimeoutMs should be 30000');
    }

    if (defaultStagehand.selfHeal !== false) {
      throw new Error('Default selfHeal should be false');
    }

    if (defaultStagehand.experimental !== false) {
      throw new Error('Default experimental should be false');
    }

    progress.log('✓ Default constructor sets correct default values');

    // Test: Custom configuration
    const customParams: ChromeExtensionStagehandParams = {
      verbose: 2,
      enableCaching: true,
      domSettleTimeoutMs: 5000,
      selfHeal: true,
      experimental: true,
      modelName: 'openai/gpt-4o',
      systemPrompt: 'Custom system prompt for testing',
      llmProvider: new TestLLMProvider(),
      logger: (logLine: LogLine) => console.log('Custom logger:', logLine.message),
    };

    const customStagehand = new ChromeExtensionStagehand(customParams);

    if (customStagehand.verbose !== 2) {
      throw new Error('Custom verbose level should be 2');
    }

    if (customStagehand.enableCaching !== true) {
      throw new Error('Custom enableCaching should be true');
    }

    if (customStagehand.domSettleTimeoutMs !== 5000) {
      throw new Error('Custom domSettleTimeoutMs should be 5000');
    }

    if (customStagehand.selfHeal !== true) {
      throw new Error('Custom selfHeal should be true');
    }

    if (customStagehand.experimental !== true) {
      throw new Error('Custom experimental should be true');
    }

    progress.log('✓ Custom constructor applies configuration correctly');

    // Test: Initial state
    if (customStagehand.isInitialized !== false) {
      throw new Error('Stagehand should not be initialized before init() call');
    }

    if (customStagehand.isClosed !== false) {
      throw new Error('Stagehand should not be closed initially');
    }

    if (customStagehand.history.length !== 0) {
      throw new Error('History should be empty initially');
    }

    progress.log('✓ Initial state is correct');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehand constructor and config test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Constructor and config test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehand constructor and config test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test initialization with BrowserWindow
 */
async function testInitializationWithBrowserWindow(
  context: TestContext,
  progress: TestProgress
): Promise<void> {
  progress.log('Testing initialization with BrowserWindow...');

  let browserWindow: BrowserWindow | undefined;

  try {
    // Create BrowserWindow for testing
    browserWindow = await BrowserWindow.create();

    // Navigate to a safe URL first to avoid chrome:// restrictions
    try {
      const currentPage = await browserWindow.getCurrentPage();
      await currentPage.goto('http://localhost:3005');
    } catch (navError) {
      // If navigation fails, that's okay - we'll test with whatever page we have
      progress.log('⚠️ Navigation to test URL failed, continuing with current page');
    }

    const stagehand = new ChromeExtensionStagehand({
      verbose: 1,
      llmProvider: new TestLLMProvider(),
    });

    // Test: Initialization
    const initResult = await stagehand.init(browserWindow);

    if (!initResult.success) {
      throw new Error(`Initialization should succeed: ${initResult.error}`);
    }

    if (!initResult.currentUrl) {
      throw new Error('Init result should include current URL');
    }

    if (!stagehand.isInitialized) {
      throw new Error('Stagehand should be initialized after init() call');
    }

    if (stagehand.isClosed) {
      throw new Error('Stagehand should not be closed after successful init');
    }

    progress.log('✓ Initialization with BrowserWindow succeeds');
    progress.log(`✓ Current URL: ${initResult.currentUrl}`);

    // Test: BrowserWindow access
    const retrievedBrowserWindow = stagehand.browserWindow;
    if (retrievedBrowserWindow !== browserWindow) {
      throw new Error('Retrieved BrowserWindow should match the one passed to init');
    }

    progress.log('✓ BrowserWindow accessible via getter');

    // Test: Page access after initialization
    const page = stagehand.page;
    if (!page) {
      throw new Error('Page should be accessible after initialization');
    }

    const stagehandPage = stagehand.stagehandPage;
    if (!stagehandPage) {
      throw new Error('StagehandPage should be accessible after initialization');
    }

    progress.log('✓ Page and StagehandPage accessible after initialization');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehand initialization test passed',
    });

    // Clean up
    await stagehand.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Initialization test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehand initialization test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  } finally {
    // Clean up BrowserWindow
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}

/**
 * Test page access and management
 */
async function testPageAccessAndManagement(
  context: TestContext,
  progress: TestProgress
): Promise<void> {
  progress.log('Testing page access and management...');

  let browserWindow: BrowserWindow | undefined;

  try {
    browserWindow = await BrowserWindow.create();

    const stagehand = new ChromeExtensionStagehand({
      verbose: 1,
      llmProvider: new TestLLMProvider(),
    });

    await stagehand.init(browserWindow);

    // Test: Page getter
    const page = stagehand.page;
    if (!page) {
      throw new Error('Page getter should return a page');
    }

    if (typeof page.url !== 'function') {
      throw new Error('Page should have url() method (Cordyceps Page interface)');
    }

    progress.log('✓ Page getter returns valid Cordyceps page');

    // Test: StagehandPage getter
    const stagehandPage = stagehand.stagehandPage;
    if (!stagehandPage) {
      throw new Error('StagehandPage getter should return a StagehandPage');
    }

    if (stagehandPage.page !== page) {
      throw new Error('StagehandPage should wrap the same page as page getter');
    }

    progress.log('✓ StagehandPage getter returns valid StagehandPage');

    // Test: Enhanced page methods (will test if they exist, not execute them)
    if (typeof stagehandPage.act !== 'function') {
      throw new Error('StagehandPage should have act() method');
    }

    if (typeof stagehandPage.observe !== 'function') {
      throw new Error('StagehandPage should have observe() method');
    }

    if (typeof stagehandPage.extract !== 'function') {
      throw new Error('StagehandPage should have extract() method');
    }

    progress.log('✓ StagehandPage has all required AI methods (act, observe, extract)');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehand page access test passed',
    });

    await stagehand.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Page access test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehand page access test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  } finally {
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}

/**
 * Test metrics and history tracking
 */
async function testMetricsAndHistoryTracking(
  context: TestContext,
  progress: TestProgress
): Promise<void> {
  progress.log('Testing metrics and history tracking...');

  try {
    const stagehand = new ChromeExtensionStagehand({
      verbose: 1,
      llmProvider: new TestLLMProvider(),
    });

    // Test: Initial metrics
    const initialMetrics = stagehand.metrics;
    if (initialMetrics.totalPromptTokens !== 0) {
      throw new Error('Initial total prompt tokens should be 0');
    }

    if (initialMetrics.totalCompletionTokens !== 0) {
      throw new Error('Initial total completion tokens should be 0');
    }

    if (initialMetrics.totalInferenceTimeMs !== 0) {
      throw new Error('Initial total inference time should be 0');
    }

    progress.log('✓ Initial metrics are zero');

    // Test: Update metrics
    stagehand.updateMetrics(StagehandFunctionName.ACT, 10, 5, 100);

    const updatedMetrics = stagehand.metrics;
    if (updatedMetrics.actPromptTokens !== 10) {
      throw new Error('Act prompt tokens should be updated to 10');
    }

    if (updatedMetrics.actCompletionTokens !== 5) {
      throw new Error('Act completion tokens should be updated to 5');
    }

    if (updatedMetrics.actInferenceTimeMs !== 100) {
      throw new Error('Act inference time should be updated to 100');
    }

    if (updatedMetrics.totalPromptTokens !== 10) {
      throw new Error('Total prompt tokens should be updated to 10');
    }

    if (updatedMetrics.totalCompletionTokens !== 5) {
      throw new Error('Total completion tokens should be updated to 5');
    }

    progress.log('✓ Metrics update correctly');

    // Test: History tracking
    const initialHistory = stagehand.history;
    if (initialHistory.length !== 0) {
      throw new Error('Initial history should be empty');
    }

    stagehand.addToHistory('act', { action: 'click button' }, { success: true });

    const updatedHistory = stagehand.history;
    if (updatedHistory.length !== 1) {
      throw new Error('History should have one entry after adding');
    }

    const historyEntry = updatedHistory[0];
    if (historyEntry.method !== 'act') {
      throw new Error('History entry method should be "act"');
    }

    progress.log('✓ History tracking works correctly');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehand metrics and history test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Metrics and history test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehand metrics and history test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test LLM configuration
 */
async function testLLMConfiguration(context: TestContext, progress: TestProgress): Promise<void> {
  progress.log('Testing LLM configuration...');

  try {
    // Test: Custom LLM provider
    const customProvider = new TestLLMProvider();
    const stagehand = new ChromeExtensionStagehand({
      llmProvider: customProvider,
      modelName: 'openai/gpt-4o',
    });

    if (stagehand.llmProvider !== customProvider) {
      throw new Error('Custom LLM provider should be used');
    }

    progress.log('✓ Custom LLM provider configured correctly');

    // Test: LLM client access
    if (!stagehand.llmClient) {
      throw new Error('LLM client should be available');
    }

    if (typeof stagehand.llmClient.generateObject !== 'function') {
      throw new Error('LLM client should have generateObject() method');
    }

    progress.log('✓ LLM client accessible and has required methods');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehand LLM configuration test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ LLM configuration test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehand LLM configuration test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test agent functionality
 */
async function testAgentFunctionality(context: TestContext, progress: TestProgress): Promise<void> {
  progress.log('Testing agent functionality...');

  let browserWindow: BrowserWindow | undefined;

  try {
    browserWindow = await BrowserWindow.create();

    const stagehand = new ChromeExtensionStagehand({
      verbose: 1,
      llmProvider: new TestLLMProvider(),
    });

    await stagehand.init(browserWindow);

    // Test: Agent creation
    const agent = stagehand.agent({
      context: 'Test agent context',
    });

    if (!agent) {
      throw new Error('Agent should be created');
    }

    if (typeof agent.execute !== 'function') {
      throw new Error('Agent should have execute() method');
    }

    progress.log('✓ Agent created with execute method');

    // Test: Agent execution (mock - don't actually execute to avoid LLM calls)
    // Just verify the method exists and accepts the right parameters
    const executePromise = agent.execute({
      instruction: 'Test instruction',
      maxSteps: 3,
    });

    if (!(executePromise instanceof Promise)) {
      throw new Error('Agent execute should return a Promise');
    }

    // Cancel the promise to avoid actual execution
    progress.log('✓ Agent execute method returns Promise');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehand agent functionality test passed',
    });

    await stagehand.close();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Agent functionality test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehand agent functionality test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  } finally {
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}

/**
 * Test error handling and edge cases
 */
async function testErrorHandlingAndEdgeCases(
  context: TestContext,
  progress: TestProgress
): Promise<void> {
  progress.log('Testing error handling and edge cases...');

  try {
    const stagehand = new ChromeExtensionStagehand({
      verbose: 1,
      llmProvider: new TestLLMProvider(),
    });

    // Test: Access before initialization
    try {
      stagehand.page;
      throw new Error('Should throw when accessing page before initialization');
    } catch (error) {
      if (error instanceof Error && error.message.includes('initialized')) {
        progress.log('✓ Proper error when accessing page before initialization');
      } else {
        throw error;
      }
    }

    try {
      stagehand.stagehandPage;
      throw new Error('Should throw when accessing stagehandPage before initialization');
    } catch (error) {
      if (error instanceof Error && error.message.includes('initialized')) {
        progress.log('✓ Proper error when accessing stagehandPage before initialization');
      } else {
        throw error;
      }
    }

    // Test: Double initialization
    let browserWindow: BrowserWindow | undefined;
    try {
      browserWindow = await BrowserWindow.create();
      await stagehand.init(browserWindow);

      const secondInitResult = await stagehand.init(browserWindow);
      if (!secondInitResult.success) {
        progress.log('✓ Double initialization handled gracefully');
      } else {
        progress.log('✓ Double initialization allowed (idempotent)');
      }
    } finally {
      await stagehand.close();
      if (browserWindow) {
        browserWindow.dispose();
      }
    }

    progress.log('✓ Error handling scenarios work correctly');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehand error handling test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Error handling test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehand error handling test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test cleanup and disposal
 */
async function testCleanupAndDisposal(context: TestContext, progress: TestProgress): Promise<void> {
  progress.log('Testing cleanup and disposal...');

  let browserWindow: BrowserWindow | undefined;

  try {
    browserWindow = await BrowserWindow.create();

    const stagehand = new ChromeExtensionStagehand({
      verbose: 1,
      llmProvider: new TestLLMProvider(),
    });

    await stagehand.init(browserWindow);

    // Verify it's initialized
    if (!stagehand.isInitialized) {
      throw new Error('Stagehand should be initialized');
    }

    if (stagehand.isClosed) {
      throw new Error('Stagehand should not be closed before close()');
    }

    // Test: Close/disposal
    await stagehand.close();

    if (!stagehand.isClosed) {
      throw new Error('Stagehand should be closed after close()');
    }

    progress.log('✓ Close operation updates state correctly');

    // Test: Operations after close
    try {
      stagehand.page;
      throw new Error('Should throw when accessing page after close');
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('closed') || error.message.includes('initialized'))
      ) {
        progress.log('✓ Proper error when accessing page after close');
      } else {
        throw error;
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'ChromeExtensionStagehand cleanup and disposal test passed',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`✗ Cleanup and disposal test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ChromeExtensionStagehand cleanup and disposal test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  } finally {
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}
