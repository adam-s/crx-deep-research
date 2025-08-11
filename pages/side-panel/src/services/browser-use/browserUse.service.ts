import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { BrowserWindow } from '../cordyceps/browserWindow';
import { ILogService } from '@shared/services/log.service';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';
import {
  IConversationServiceToken,
  type IConversationService,
} from '@shared/features/conversation';
import {
  ConversationType,
  MessageRole,
} from '@shared/features/conversation/ConversationDataAccessObject';

export const IBrowserUseService = createDecorator<IBrowserUseService>('browserUseService');

export interface IBrowserUseService {
  readonly _serviceBrand: undefined;
  readonly getBrowser: () => Promise<BrowserWindow>;
  readonly runExample: () => Promise<void>;
  readonly runExampleWithTests: () => Promise<void>;
}

export class BrowserUseService implements IBrowserUseService {
  public readonly _serviceBrand: undefined;
  // Promise-based lazy initialization pattern - similar to FrameManager._mainFramePromise
  // See: pages/side-panel/src/services/cordyceps/frameManager.ts for reference implementation
  private _browser?: BrowserWindow;
  private _browserResolve!: (browser: BrowserWindow) => void;
  private _browserPromise: Promise<BrowserWindow>;

  constructor(
    @ILogService private readonly _logService: ILogService,
    @ILocalAsyncStorage private readonly _storage: ILocalAsyncStorage<SidePanelAppStorageSchema>,
    @IConversationServiceToken private readonly _conversationService: IConversationService,
  ) {
    this._logService.info('BrowserUseService is running');
    // Initialize promise before async initialization - follows FrameManager pattern
    this._browserPromise = new Promise(resolve => (this._browserResolve = resolve));
    this._initializeBrowser();
  }

  /**
   * Initialize browser asynchronously with proper error handling.
   * Pattern follows FrameManager._attachMainFrame approach for promise resolution.
   */
  private async _initializeBrowser(): Promise<void> {
    try {
      this._logService.info('BrowserUseService: Initializing browser instance');
      this._browser = await BrowserWindow.create();
      this._browserResolve(this._browser);
      this._logService.info('BrowserUseService: Browser initialized successfully');
    } catch (error) {
      this._logService.error('BrowserUseService: Failed to initialize browser', error);
      throw error;
    }
  }

  public async getBrowser(): Promise<BrowserWindow> {
    // Return the promise that resolves when browser initialization completes
    // This ensures callers always get a fully initialized BrowserWindow instance
    return await this._browserPromise;
  }

  async runExample(): Promise<void> {
    await this.runExampleWithTests();
  }

  async runExampleWithTests(): Promise<void> {
    this._logService.info('Starting browser use example with conversation tests');

    try {
      // Run conversation service tests first
      await this._testConversationService();

      // Then run the main example
      this._logService.info('Running browser use agent...');

      // For now, just log that we would run the browser agent
      // since we don't have the BrowserUseAgent implementation here
      this._logService.info('Browser use agent would run here');

      this._logService.info('Browser use example completed successfully');
    } catch (error) {
      this._logService.error('Browser use example failed:', error);
      throw error;
    }
  }

  private async _testConversationService(): Promise<void> {
    this._logService.info('Running conversation service tests...');

    try {
      // Test 1: Create a conversation
      const conversationId = await this._conversationService.createConversation({
        title: 'Test Conversation',
        type: ConversationType.BROWSER_USE,
        messages: [],
        metadata: {
          sessionId: 'test-session-id',
        },
        isArchived: false,
        tags: ['test'],
      });
      this._logService.info(`✅ Created conversation: ${conversationId}`);

      // Test 2: Add a message
      await this._conversationService.addMessage(conversationId, {
        role: MessageRole.USER,
        content: 'Hello, this is a test message',
      });
      this._logService.info('✅ Added user message');

      // Test 3: Get conversation
      const conversation = await this._conversationService.getConversation(conversationId);
      this._logService.info(
        `✅ Retrieved conversation with ${conversation?.messages.length || 0} messages`,
      );

      // Test 4: List conversations
      const conversations = await this._conversationService.listConversations();
      this._logService.info(`✅ Listed ${conversations.length} conversations`);

      // Test 5: Delete the test conversation
      await this._conversationService.deleteConversation(conversationId);
      this._logService.info('✅ Deleted test conversation');

      this._logService.info('All conversation service tests passed!');
    } catch (error) {
      this._logService.error('Conversation service tests failed:', error);
      throw error;
    }
  }
}
