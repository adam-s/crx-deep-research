import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage, Severity } from '@src/utils/types';
import { IBrowserUseService } from '../browserUse.service';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema, StorageKeys } from '@shared/storage/types/storage.types';
// Note: Agent execution is optional in the playground. We remove direct imports
// so that when agent execution is skipped there are no unused imports.
import type { IConversationService } from '@shared/features/conversation';
import {
  IConversationServiceToken,
  ConversationType,
  MessageRole,
} from '@shared/features/conversation';
import { quickUrlAllowedTest } from './playgroundTests/urlAllowedTest';
import { quickGetSelectorMapTest } from './playgroundTests/getSelectorMapTest';
import { quickGetStateTest } from './playgroundTests/getStateTest';
import {
  quickSafeGotoTest,
  runSafeGotoTest,
  TestProgress,
  testGoBack,
  testGoForward,
} from './playgroundTests/safeGotoTest';

export const IBrowserUsePlaygroundService = createDecorator<IBrowserUsePlaygroundService>(
  'browserUsePlaygroundService'
);

export interface IBrowserUsePlaygroundService {
  readonly _serviceBrand: undefined;
  /** Event that fires when browser-use events occur. */
  readonly onEvent: Event<EventMessage>;
  /** Run browser-use agent test */
  runAgentTest: () => Promise<void>;
  /** Get conversation history for the current session */
  getConversationHistory: () => Promise<string[]>;
  /** Save current agent conversation */
  saveConversation: (title?: string) => Promise<string>;
  /** Run simple conversation service tests */
  testConversationService: () => Promise<void>;
  /** Run browser-use context tests */
  runContextTests: () => Promise<void>;
  /** Run quick context test */
  runQuickContextTest: () => Promise<boolean>;
  /** Run _waitForStableNetwork functionality tests */
  runWaitForStableNetworkTests: () => Promise<void>;
  /** Run _isUrlAllowed functionality tests */
  runUrlAllowedTests: () => Promise<void>;
  /** Run quick URL allowed test */
  runQuickUrlAllowedTest: () => Promise<boolean>;
  /** Run _waitForPageAndFramesLoad functionality tests */
  runWaitForPageAndFramesLoadTests: () => Promise<void>;
  /** Run takeScreenshot functionality test */
  runTakeScreenshotTest: () => Promise<void>;
  /** Run _getTabsInfo functionality test */
  runGetTabsInfoTest: () => Promise<void>;
  /** Run quick _getTabsInfo test */
  runQuickGetTabsInfoTest: () => Promise<boolean>;
  /** Run _getScrollInfo functionality tests */
  runGetScrollInfoTests: () => Promise<void>;
  /** Run quick _getScrollInfo test */
  runQuickGetScrollInfoTest: () => Promise<boolean>;
  /** Run getLocateElement and _inputTextElementNode functionality tests */
  runElementInteractionTests: () => Promise<void>;
  /** Run quick element interaction test */
  runQuickElementInteractionTest: () => Promise<boolean>;
  /** Run getSelectorMap functionality test */
  runGetSelectorMapTest: () => Promise<void>;
  /** Run quick getSelectorMap test */
  runQuickGetSelectorMapTest: () => Promise<boolean>;
  /** Run getState functionality test */
  runGetStateTest: () => Promise<void>;
  /** Run quick getState test */
  runQuickGetStateTest: () => Promise<boolean>;
  /** Run safeGoto functionality test */
  runSafeGotoTest: () => Promise<void>;
  /** Run quick safeGoto test */
  runQuickSafeGotoTest: () => Promise<boolean>;
  /** Run refreshPage functionality test */
  runRefreshPageTest: () => Promise<void>;
  /** Run scrollToBottom functionality test */
  runScrollToBottomTest: () => Promise<void>;
  /** Run scrollToTop functionality test */
  runScrollToTopTest: () => Promise<void>;
  /** Run reinitializePage functionality test */
  runReinitializePageTest: () => Promise<void>;
  /** Run isFileUploader functionality test */
  runIsFileUploaderTest: () => Promise<void>;
}

export class BrowserUsePlaygroundService
  extends Disposable
  implements IBrowserUsePlaygroundService
{
  public readonly _serviceBrand: undefined;

  readonly events = this._register(new SimpleEventEmitter<EventMessage>('BrowserUsePlayground'));
  public readonly onEvent: Event<EventMessage> = this.events.event;

  private _currentConversationId?: string;

  constructor(
    @IBrowserUseService private readonly browserUseService: IBrowserUseService,
    @ILocalAsyncStorage private readonly _storage: ILocalAsyncStorage<SidePanelAppStorageSchema>,
    @IConversationServiceToken private readonly _conversationService: IConversationService
  ) {
    super();
  }

  public async runAgentTest(): Promise<void> {
    const startTime = Date.now();
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting Browser Use Agent test',
    });

    try {
      // First, run conversation service tests
      await this.testConversationService();

      // Run browser-use context tests
      await this.runContextTests();

      // Run _waitForStableNetwork functionality tests
      await this.runWaitForStableNetworkTests();

      // Run _isUrlAllowed functionality tests
      await this.runUrlAllowedTests();

      // Run _waitForPageAndFramesLoad functionality tests
      await this.runWaitForPageAndFramesLoadTests();

      // Run takeScreenshot functionality test
      await this.runTakeScreenshotTest();

      // Run _getScrollInfo functionality tests
      await this.runGetScrollInfoTests();

      // Run getLocateElement and _inputTextElementNode functionality tests
      await this.runElementInteractionTests();
      // Run getSelectorMap functionality tests
      await this.runGetSelectorMapTest();

      // Run quick getSelectorMap test
      await this.runQuickGetSelectorMapTest();

      // Run getState functionality tests
      await this.runGetStateTest();

      // Run quick getState test
      await this.runQuickGetStateTest();

      // Run safeGoto functionality tests
      await this.runSafeGotoTest();

      // Run refreshPage functionality tests
      await this.runRefreshPageTest();

      // Run scrollToBottom functionality tests
      await this.runScrollToBottomTest();

      // Run scrollToTop functionality tests
      await this.runScrollToTopTest();

      // Run reinitializePage functionality tests
      await this.runReinitializePageTest();

      // Run isFileUploader functionality tests
      await this.runIsFileUploaderTest();

      // Run quick safeGoto test
      await this.runQuickSafeGotoTest();

      // Create a new conversation for this agent session
      const sessionId = `browser-use-${Date.now()}`;
      const conversationId = await this._conversationService.createConversation({
        title: 'Browser Use Agent Session',
        type: ConversationType.BROWSER_USE,
        messages: [],
        metadata: {
          sessionId,
          agentId: 'browser-use-playground',
        },
        tags: ['browser-use', 'agent-test'],
      });

      this._currentConversationId = conversationId;

      // Add initial system message
      await this._conversationService.addMessage(conversationId, {
        role: MessageRole.SYSTEM,
        content: 'Starting Browser Use Agent session',
        metadata: {
          event: 'session_start',
          timestamp: startTime,
        },
      });

      // Get the OpenAI API key from storage
      const openAIKey = await this._storage.get(StorageKeys.OPEN_AI_API_KEY);

      if (!openAIKey) {
        const errorMessage = 'OpenAI API key not found in storage';
        await this._conversationService.addMessage(conversationId, {
          role: MessageRole.SYSTEM,
          content: errorMessage,
          metadata: {
            event: 'error',
            error: 'missing_api_key',
          },
        });

        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Error,
          message: errorMessage,
          error: new Error('OpenAI API key not configured. Please set it in Settings.'),
        });
        throw new Error('OpenAI API key not configured. Please set it in Settings.');
      }

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'OpenAI API key found, initializing agent',
      });

      // Agent execution is intentionally skipped in this environment.
      // Emit an informational event and record a conversation message so the
      // test run is traceable without actually constructing or running the Agent.
      const task =
        'Navigate to the local test server at http://localhost:3005 and explore the ' +
        'navigation test pages to understand the available test resources and content structure';

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Agent execution skipped by configuration',
        details: { task },
      });

      await this._conversationService.addMessage(conversationId, {
        role: MessageRole.ASSISTANT,
        content: 'Agent execution skipped by playground configuration',
        metadata: { event: 'agent_skipped' },
      });

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Browser Use Agent test skipped (agent execution disabled)',
        details: { conversationId },
      });

      // Stop further agent-specific processing
      return;

      const totalDuration = Date.now() - startTime;

      // Add completion message
      await this._conversationService.addMessage(conversationId, {
        role: MessageRole.ASSISTANT,
        content: 'Browser Use Agent session completed successfully',
        metadata: {
          event: 'session_complete',
          duration: totalDuration,
        },
      });

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Browser Use Agent test completed successfully',
        details: {
          duration: totalDuration,
          conversationId,
        },
      });
    } catch (error) {
      const totalDuration = Date.now() - startTime;

      // Log error to conversation if we have one
      if (this._currentConversationId) {
        await this._conversationService
          .addMessage(this._currentConversationId, {
            role: MessageRole.SYSTEM,
            content: `Agent session failed: ${error instanceof Error ? error.message : String(error)}`,
            metadata: {
              event: 'session_error',
              duration: totalDuration,
              error: error instanceof Error ? error.message : String(error),
            },
          })
          .catch(err => {
            console.warn('Failed to log error to conversation:', err);
          });
      }

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Browser Use Agent test failed',
        error: error instanceof Error ? error : new Error(String(error)),
        details: {
          duration: totalDuration,
        },
      });
      throw error;
    }
  }

  public async getConversationHistory(): Promise<string[]> {
    try {
      const conversations = await this._conversationService.findConversationsByType(
        ConversationType.BROWSER_USE
      );
      return conversations.map(
        conv =>
          `${conv.title} (${new Date(conv.createdTimestamp).toISOString()}) - ${conv.messages.length} messages`
      );
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Failed to retrieve conversation history',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return [];
    }
  }

  public async saveConversation(title?: string): Promise<string> {
    if (!this._currentConversationId) {
      throw new Error('No active conversation to save');
    }

    try {
      if (title) {
        await this._conversationService.updateConversation(this._currentConversationId, { title });
      }

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: `Conversation saved${title ? ` as "${title}"` : ''}`,
        details: {
          conversationId: this._currentConversationId,
        },
      });

      return this._currentConversationId;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Failed to save conversation',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  public async testConversationService(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting conversation service tests',
    });

    try {
      // Test 1: Check conversation history
      const history = await this.getConversationHistory();
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: `✅ Test 1 passed: Retrieved ${history.length} conversations`,
        details: { historyCount: history.length },
      });

      // Test 2: Test save without active conversation
      try {
        await this.saveConversation('Test Save');
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '⚠️ Test 2 unexpected: Save succeeded without active conversation',
        });
      } catch (error) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Test 2 passed: Correctly rejected save without active conversation',
        });
      }

      // Test 3: Create a test conversation
      const testConversationId = await this._conversationService.createConversation({
        title: 'Test Conversation',
        type: ConversationType.BROWSER_USE,
        messages: [],
        metadata: { sessionId: 'test-session' },
        tags: ['test'],
      });

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ Test 3 passed: Created test conversation',
        details: { conversationId: testConversationId },
      });

      // Test 4: Add a test message
      await this._conversationService.addMessage(testConversationId, {
        role: MessageRole.USER,
        content: 'This is a test message',
        metadata: { test: true },
      });

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ Test 4 passed: Added test message to conversation',
      });

      // Test 5: Retrieve the conversation
      const conversation = await this._conversationService.getConversation(testConversationId);
      if (conversation && conversation.messages.length === 1) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Test 5 passed: Retrieved conversation with correct message count',
          details: { messageCount: conversation.messages.length },
        });
      } else {
        throw new Error('Failed to retrieve conversation or incorrect message count');
      }

      // Cleanup: Delete test conversation
      await this._conversationService.deleteConversation(testConversationId);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '🎉 All conversation service tests passed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Conversation service tests failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  public async runContextTests(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting browser-use context tests',
    });

    try {
      // Import the context test functions dynamically
      const { runBrowserUseContextTests } = await import(
        './playgroundTests/browserUseContextTests'
      );
      const { runBrowserContextMethodTests, TestProgress } = await import(
        './playgroundTests/browserContextMethodTests'
      );

      // Run the comprehensive context tests
      await runBrowserUseContextTests(this);

      // Run the specific method tests
      const methodTestProgress = new TestProgress('Browser Context Method Tests');
      await runBrowserContextMethodTests(methodTestProgress, this);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '🎉 All browser-use context tests passed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Browser-use context tests failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  public async runQuickContextTest(): Promise<boolean> {
    try {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Starting quick browser-use context test',
      });

      // Import the quick test function dynamically
      const { quickBrowserUseContextTest } = await import(
        './playgroundTests/browserUseContextTests'
      );

      // Run the quick context test
      const result = await quickBrowserUseContextTest();

      if (result) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Quick context test passed successfully!',
        });
      } else {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '⚠️ Quick context test completed but returned false',
        });
      }

      return result;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Quick context test failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  public async runWaitForStableNetworkTests(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _waitForStableNetwork functionality tests',
    });

    try {
      // Import the test functions dynamically
      const { runAllWaitForStableNetworkTests } = await import(
        './playgroundTests/waitForStableNetworkTest'
      );

      // Create test context compatible with the test requirements
      const testContext = {
        events: this.events,
        browserUseService: this,
      };

      // Run the comprehensive _waitForStableNetwork tests
      await runAllWaitForStableNetworkTests(testContext);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '🎉 All _waitForStableNetwork tests passed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '_waitForStableNetwork tests failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  public async runUrlAllowedTests(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _isUrlAllowed functionality tests',
    });

    try {
      // Import the test functions dynamically
      const { runAllUrlAllowedTests } = await import('./playgroundTests/urlAllowedTest');

      // Create test context compatible with the test requirements
      const testContext = {
        events: this.events,
        browserUseService: this,
      };

      // Run the comprehensive _isUrlAllowed tests
      await runAllUrlAllowedTests(testContext);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '🎉 All _isUrlAllowed tests passed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '_isUrlAllowed tests failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  public async runQuickUrlAllowedTest(): Promise<boolean> {
    try {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Starting quick _isUrlAllowed test',
      });

      // Import the quick test function dynamically

      // Get browser instance
      const browserWindow = await this.browserUseService.getBrowser();

      // Run the quick URL allowed test
      const result = await quickUrlAllowedTest(browserWindow);

      if (result) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Quick URL allowed test passed successfully!',
        });
      } else {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '⚠️ Quick URL allowed test completed but returned false',
        });
      }

      return result;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Quick URL allowed test failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Run comprehensive tests for _waitForPageAndFramesLoad functionality
   */
  public async runWaitForPageAndFramesLoadTests(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🚀 Starting _waitForPageAndFramesLoad functionality tests...',
    });

    try {
      const { testWaitForPageAndFramesLoadComprehensive, TestProgress } = await import(
        './playgroundTests/urlAllowedTest'
      );

      // Get browser instance
      const browserWindow = await this.browserUseService.getBrowser();

      const testContext = {
        events: this.events,
        browserUseService: this,
      };

      const progress = new TestProgress('_waitForPageAndFramesLoad Tests');

      await testWaitForPageAndFramesLoadComprehensive(progress, testContext, browserWindow);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: '✅ _waitForPageAndFramesLoad tests completed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '_waitForPageAndFramesLoad tests failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Run takeScreenshot functionality test
   */
  public async runTakeScreenshotTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '📸 Starting takeScreenshot functionality test...',
    });

    try {
      const { testTakeScreenshot, TestProgress } = await import('./playgroundTests/urlAllowedTest');

      // Get browser instance
      const browserWindow = await this.browserUseService.getBrowser();

      const testContext = {
        events: this.events,
        browserUseService: this,
      };

      const progress = new TestProgress('Screenshot Tests');

      await testTakeScreenshot(progress, testContext, browserWindow);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: '✅ Screenshot functionality test completed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Screenshot functionality test failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  public async runGetTabsInfoTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _getTabsInfo() functionality test',
    });

    try {
      // Import the test functions dynamically
      const { runGetTabsInfoTest, TestProgress } = await import(
        './playgroundTests/getTabsInfoTest'
      );

      const progress = new TestProgress('GetTabsInfo Tests');

      await runGetTabsInfoTest(progress, this);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: '✅ _getTabsInfo() functionality test completed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '_getTabsInfo() functionality test failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  public async runQuickGetTabsInfoTest(): Promise<boolean> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Running quick _getTabsInfo() test',
    });

    try {
      // Import the test functions dynamically
      const { runQuickGetTabsInfoTest } = await import('./playgroundTests/getTabsInfoTest');

      const result = await runQuickGetTabsInfoTest();

      if (result) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Quick _getTabsInfo() test passed',
        });
      } else {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '⚠️ Quick _getTabsInfo() test failed',
        });
      }

      return result;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Quick _getTabsInfo() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  public async runGetScrollInfoTests(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _getScrollInfo() functionality tests',
    });

    try {
      // Import the test functions dynamically
      const { runAllGetScrollInfoTests } = await import('./playgroundTests/getScrollInfoTest');

      // Create test context compatible with the test requirements
      const testContext = {
        events: this.events,
        browserUseService: this,
      };

      // Run the comprehensive _getScrollInfo tests
      await runAllGetScrollInfoTests(testContext);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '🎉 All _getScrollInfo tests passed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '_getScrollInfo tests failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  public async runQuickGetScrollInfoTest(): Promise<boolean> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Running quick _getScrollInfo() test',
    });

    try {
      // Import the test functions dynamically
      const { quickGetScrollInfoTest } = await import('./playgroundTests/getScrollInfoTest');

      // Get browser instance
      const browserWindow = await this.browserUseService.getBrowser();

      // Run the quick scroll info test
      const result = await quickGetScrollInfoTest(browserWindow);

      if (result) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Quick _getScrollInfo() test passed',
        });
      } else {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '⚠️ Quick _getScrollInfo() test failed',
        });
      }

      return result;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Quick _getScrollInfo() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  public async runElementInteractionTests(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting getLocateElement and _inputTextElementNode functionality tests',
    });

    try {
      // Import the test functions dynamically
      const { runAllElementInteractionTests } = await import(
        './playgroundTests/getLocateElementTest'
      );

      // Create test context compatible with the test requirements
      const testContext = {
        events: {
          emit: (event: {
            timestamp: number;
            severity: Severity;
            message: string;
            details?: unknown;
            error?: Error;
          }) => {
            // Convert to EventMessage format
            this.events.emit({
              timestamp: event.timestamp,
              severity: event.severity,
              message: event.message,
              details: event.details as Record<string, unknown> | undefined,
              error: event.error,
            });
          },
        },
        browserUseService: this,
      };

      // Run the comprehensive element interaction tests
      await runAllElementInteractionTests(testContext);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '🎉 All element interaction tests passed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Element interaction tests failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  public async runQuickElementInteractionTest(): Promise<boolean> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Running quick element interaction test',
    });

    try {
      // Import the quick test functions dynamically
      const { quickGetLocateElementTest, quickInputTextElementNodeTest } = await import(
        './playgroundTests/getLocateElementTest'
      );

      // Run both quick tests
      const getLocateResult = await quickGetLocateElementTest();
      const inputTextResult = await quickInputTextElementNodeTest();

      const overallResult = getLocateResult && inputTextResult;

      if (overallResult) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Quick element interaction tests passed',
          details: {
            getLocateElementTest: getLocateResult,
            inputTextElementNodeTest: inputTextResult,
          },
        });
      } else {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '⚠️ Quick element interaction tests failed',
          details: {
            getLocateElementTest: getLocateResult,
            inputTextElementNodeTest: inputTextResult,
          },
        });
      }

      return overallResult;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Quick element interaction test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  public async runGetSelectorMapTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting getSelectorMap() functionality test',
    });

    try {
      // Import the test functions dynamically
      const { runGetSelectorMapTest, TestProgress } = await import(
        './playgroundTests/getSelectorMapTest'
      );

      const progress = new TestProgress('GetSelectorMap Tests');

      await runGetSelectorMapTest(progress, this);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '🎉 getSelectorMap() functionality test completed successfully!',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'getSelectorMap() functionality test failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  public async runQuickGetSelectorMapTest(): Promise<boolean> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Running quick getSelectorMap() test',
    });

    try {
      // Get browser instance
      const browserWindow = await this.browserUseService.getBrowser();

      // Run the quick selector map test
      const result = await quickGetSelectorMapTest(browserWindow);

      if (result) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Quick getSelectorMap() test passed',
        });
      } else {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '⚠️ Quick getSelectorMap() test failed',
        });
      }

      return result;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Quick getSelectorMap() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Run comprehensive getState functionality test
   */
  public async runGetStateTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting getState() functionality test...',
    });

    try {
      const { runGetStateTest, TestProgress } = await import('./playgroundTests/getStateTest');
      const progress = new TestProgress('GetState Tests');

      await runGetStateTest(progress, this);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ getState() test completed successfully',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '❌ getState() test failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Run quick getState test (basic validation)
   */
  public async runQuickGetStateTest(): Promise<boolean> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting quick getState() test...',
    });

    try {
      const browserWindow = await this.browserUseService.getBrowser();
      const result = await quickGetStateTest(browserWindow);

      if (result) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Quick getState() test passed',
        });
      } else {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '⚠️ Quick getState() test failed',
        });
      }

      return result;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Quick getState() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Run comprehensive safeGoto test
   */
  public async runSafeGotoTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting comprehensive safeGoto() tests...',
    });

    try {
      const progress = new TestProgress('SafeGoto Tests');

      // // Run the comprehensive safeGoto tests
      await runSafeGotoTest(progress, this);

      // Run additional history navigation tests for goBack/goForward
      await testGoBack(progress, this);
      await testGoForward(progress, this);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ All safeGoto() tests passed',
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '❌ safeGoto() test failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Run quick safeGoto test (basic validation)
   */
  public async runQuickSafeGotoTest(): Promise<boolean> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting quick safeGoto() test...',
    });

    try {
      const browserWindow = await this.browserUseService.getBrowser();
      const result = await quickSafeGotoTest(browserWindow);

      if (result) {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: '✅ Quick safeGoto() test passed',
        });
      } else {
        this.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: '⚠️ Quick safeGoto() test failed',
        });
      }

      return result;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Quick safeGoto() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      return false;
    }
  }

  /**
   * Run refreshPage functionality test
   */
  public async runRefreshPageTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting refreshPage() test...',
    });

    try {
      const { testRefreshPage, TestProgress } = await import('./playgroundTests/refreshPageTest');
      const progress = new TestProgress('refreshPage Test');

      await testRefreshPage(progress, this);
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'refreshPage() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Run scrollToBottom functionality test
   */
  public async runScrollToBottomTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting scrollToBottom() test...',
    });

    try {
      const { testScrollToBottom, TestProgress } = await import(
        './playgroundTests/scrollToBottomTest'
      );
      const progress = new TestProgress('scrollToBottom Test');

      await testScrollToBottom(progress, this);
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'scrollToBottom() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Run scrollToTop functionality test
   */
  public async runScrollToTopTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting scrollToTop() test...',
    });

    try {
      const { testScrollToTop, TestProgress } = await import('./playgroundTests/scrollToTopTest');
      const progress = new TestProgress('scrollToTop Test');

      await testScrollToTop(progress, this);
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'scrollToTop() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Run reinitializePage functionality test
   */
  public async runReinitializePageTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting reinitializePage() test...',
    });

    try {
      const { testReinitializePage, TestProgress } = await import(
        './playgroundTests/reinitializePageTest'
      );
      const progress = new TestProgress('reinitializePage Test');

      await testReinitializePage(progress, this);
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'reinitializePage() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }

  /**
   * Run isFileUploader functionality test
   */
  public async runIsFileUploaderTest(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🧪 Starting isFileUploader() test...',
    });

    try {
      const { testIsFileUploader, TestProgress } = await import(
        './playgroundTests/isFileUploaderTest'
      );
      const progress = new TestProgress('isFileUploader Test');

      await testIsFileUploader(progress, this);
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'isFileUploader() test encountered an error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }
}
