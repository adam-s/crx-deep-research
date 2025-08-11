import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage, Severity } from '@src/utils/types';
import { IBrowserUseService } from '../browserUse.service';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema, StorageKeys } from '@shared/storage/types/storage.types';
import { ChatOpenAI } from '@langchain/openai';
import { Agent } from '../agent/service';
import type { IConversationService } from '@shared/features/conversation';
import {
  IConversationServiceToken,
  ConversationType,
  MessageRole,
} from '@shared/features/conversation';

export const IBrowserUsePlaygroundService = createDecorator<IBrowserUsePlaygroundService>(
  'browserUsePlaygroundService',
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
}

export class BrowserUsePlaygroundService
  extends Disposable
  implements IBrowserUsePlaygroundService
{
  public readonly _serviceBrand: undefined;

  readonly events = this._register(new SimpleEventEmitter<EventMessage>('BrowserUsePlayground'));
  public readonly onEvent: Event<EventMessage> = this.events.event;

  private _currentAgent?: Agent;
  private _currentConversationId?: string;

  constructor(
    @IBrowserUseService private readonly browserUseService: IBrowserUseService,
    @ILocalAsyncStorage private readonly _storage: ILocalAsyncStorage<SidePanelAppStorageSchema>,
    @IConversationServiceToken private readonly _conversationService: IConversationService,
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

      // Get browser instance
      const browser = await this.browserUseService.getBrowser();

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Browser instance obtained',
      });

      // Create LLM
      const llm = new ChatOpenAI({
        openAIApiKey: openAIKey,
        modelName: 'gpt-4o',
        temperature: 0.0,
      });

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'LLM initialized',
        details: {
          model: 'gpt-4o',
          temperature: 0.0,
        },
      });

      // Create agent
      const task =
        'Navigate to the browser-use GitHub repository at https://github.com/browser-use/browser-use and find information about the project and its contributors';

      // Add task message to conversation
      await this._conversationService.addMessage(conversationId, {
        role: MessageRole.USER,
        content: task,
        metadata: {
          event: 'task_assignment',
        },
      });

      this._currentAgent = this._register(new Agent(task, llm, { browser }));

      // Forward agent events to our events and conversation
      this._register(
        this._currentAgent.onEvent(event => {
          this.events.emit({
            ...event,
            source: 'Agent',
          });

          // Log significant events to conversation
          if (event.severity === Severity.Error || event.severity === Severity.Success) {
            this._conversationService
              .addMessage(conversationId, {
                role: MessageRole.ASSISTANT,
                content: event.message,
                metadata: {
                  event: 'agent_event',
                  severity: event.severity,
                  details: event.details,
                  error: event.error?.message,
                },
              })
              .catch(err => {
                console.warn('Failed to log agent event to conversation:', err);
              });
          }
        }),
      );

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Agent created, starting execution',
        details: {
          task,
        },
      });

      // Run the agent
      await this._currentAgent.run();

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
        ConversationType.BROWSER_USE,
      );
      return conversations.map(
        conv =>
          `${conv.title} (${new Date(conv.createdTimestamp).toISOString()}) - ${conv.messages.length} messages`,
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
      const { runBrowserUseContextTests } = await import('./browserUseContextTests');
      const { runBrowserContextMethodTests, TestProgress } = await import(
        './browserContextMethodTests'
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
      const { quickBrowserUseContextTest } = await import('./browserUseContextTests');

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
      const { runAllWaitForStableNetworkTests } = await import('./waitForStableNetworkTest');

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
}
