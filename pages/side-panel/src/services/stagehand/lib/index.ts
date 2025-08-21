import { BrowserWindow } from '../../cordyceps/browserWindow';
import { Page } from '../../cordyceps/page';
import { LogLine } from '../types/log';
import { AvailableModel, ClientOptions } from '../types/model';
import { LLMClient } from './llm/LLMClient';
import { LLMProvider } from './llm/LLMProvider';
import { StagehandLogger } from './logger';
import {
  StagehandMetrics,
  StagehandFunctionName,
  HistoryEntry,
  ActOptions,
  ActResult,
  ObserveOptions,
  ObserveResult,
  ExtractOptions,
  ExtractResult,
} from '../types/stagehand';
import { AgentOptions, AgentExecuteOptions, AgentResult } from '../types/agent';
import { z } from 'zod/v3';
import { executeWithProgress } from '../../cordyceps/core/progress';
import type { Locator } from '../../cordyceps/locator';

/**
 * Simple wrapper for Cordyceps Page to provide Stagehand-compatible interface
 * TODO: This will be expanded to include act/observe/extract methods
 */
class ChromeExtensionStagehandPage {
  constructor(
    public readonly page: Page,
    private readonly stagehand: ChromeExtensionStagehand,
    private readonly llmClient: LLMClient,
    private readonly userProvidedInstructions?: string
  ) {}

  async init(): Promise<ChromeExtensionStagehandPage> {
    // TODO: Initialize handlers for act/observe/extract
    return this;
  }

  /**
   * Perform an action on the page using AI
   * TODO: Implement using Cordyceps-compatible act handler
   */
  async act(actionOrOptions: string | ActOptions | ObserveResult): Promise<ActResult> {
    this.stagehand.log({
      category: 'act',
      message: 'ChromeExtensionStagehandPage.act() not yet implemented',
      level: 0,
      auxiliary: {
        action: {
          value: typeof actionOrOptions === 'string' ? actionOrOptions : 'object',
          type: 'string',
        },
      },
    });

    // TODO: Implement act functionality using Cordyceps
    return {
      success: false,
      message: 'Act functionality not yet implemented in Chrome extension version',
      action: typeof actionOrOptions === 'string' ? actionOrOptions : 'unknown',
    };
  }

  /**
   * Observe elements on the page using AI
   * TODO: Implement using Cordyceps-compatible observe handler
   */
  async observe(instructionOrOptions?: string | ObserveOptions): Promise<ObserveResult[]> {
    this.stagehand.log({
      category: 'observe',
      message: 'ChromeExtensionStagehandPage.observe() not yet implemented',
      level: 0,
      auxiliary: {
        instruction: {
          value: typeof instructionOrOptions === 'string' ? instructionOrOptions : 'object',
          type: 'string',
        },
      },
    });

    // TODO: Implement observe functionality using Cordyceps
    return [];
  }

  /**
   * Extract data from the page using AI
   * TODO: Implement using Cordyceps-compatible extract handler
   */
  async extract<T extends z.AnyZodObject>(_options?: ExtractOptions<T>): Promise<ExtractResult<T>> {
    this.stagehand.log({
      category: 'extract',
      message: 'ChromeExtensionStagehandPage.extract() not yet implemented',
      level: 0,
    });

    // TODO: Implement extract functionality using Cordyceps
    throw new Error('Extract functionality not yet implemented in Chrome extension version');
  }

  async dispose(): Promise<void> {
    // TODO: Clean up resources
  }
}

/**
 * Chrome Extension specific constructor parameters for Stagehand
 * Removes Node.js/Playwright dependencies and browser launching options
 */
export interface ChromeExtensionStagehandParams {
  /**
   * The model to use for Stagehand AI operations
   * @default 'openai/gpt-4o-mini'
   */
  modelName?: AvailableModel;

  /**
   * The parameters to use for the LLM client
   * Useful for parameterizing LLM API Keys
   */
  modelClientOptions?: ClientOptions;

  /**
   * Customize the Stagehand system prompt
   */
  systemPrompt?: string;

  /**
   * The verbosity of the Stagehand logger
   * 0 - No logs, 1 - Only errors, 2 - All logs
   * @default 0
   */
  verbose?: 0 | 1 | 2;

  /**
   * Enable caching of LLM responses
   * @default false
   */
  enableCaching?: boolean;

  /**
   * The timeout to use for the DOM to settle
   * @default 30000
   */
  domSettleTimeoutMs?: number;

  /**
   * Custom logger function for Stagehand
   */
  logger?: (logLine: LogLine) => void;

  /**
   * Enable self-healing when actions fail
   * @default false
   */
  selfHeal?: boolean;

  /**
   * Enable experimental features
   * @default false
   */
  experimental?: boolean;

  /**
   * Provided LLM provider instance
   */
  llmProvider?: LLMProvider;

  /**
   * Provided LLM client instance
   */
  llmClient?: LLMClient;
}

/**
 * Chrome Extension initialization result
 * Simplified version without browser session details
 */
export interface ChromeExtensionInitResult {
  /**
   * Whether initialization was successful
   */
  success: boolean;

  /**
   * Current page URL after initialization
   */
  currentUrl?: string;

  /**
   * Any error message if initialization failed
   */
  error?: string;
}

/**
 * Chrome Extension compatible Stagehand implementation
 *
 * This version removes all Node.js/Playwright dependencies and browser launching logic.
 * It integrates with the existing Cordyceps system for browser automation within
 * the Chrome extension environment.
 *
 * Key differences from the full Stagehand:
 * - No browser launching or context management
 * - Uses BrowserWindow from Cordyceps instead of Playwright context
 * - No file system operations (uses chrome.storage instead)
 * - No Browserbase integration
 * - Simplified initialization that connects to existing browser
 */
export class ChromeExtensionStagehand {
  // Core browser integration
  private _browserWindow!: BrowserWindow;
  private _currentPage!: ChromeExtensionStagehandPage;

  // LLM and AI functionality (keep - this is the valuable part)
  public llmProvider: LLMProvider;
  public llmClient: LLMClient;
  private _modelName: AvailableModel;
  private _modelClientOptions: ClientOptions;
  public readonly userProvidedInstructions?: string;

  // State management and metrics (keep - essential for debugging)
  public stagehandMetrics: StagehandMetrics = {
    actPromptTokens: 0,
    actCompletionTokens: 0,
    actInferenceTimeMs: 0,
    extractPromptTokens: 0,
    extractCompletionTokens: 0,
    extractInferenceTimeMs: 0,
    observePromptTokens: 0,
    observeCompletionTokens: 0,
    observeInferenceTimeMs: 0,
    agentPromptTokens: 0,
    agentCompletionTokens: 0,
    agentInferenceTimeMs: 0,
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalInferenceTimeMs: 0,
  };

  private _history: Array<HistoryEntry> = [];

  // Configuration options
  private _stagehandLogger: StagehandLogger;
  public verbose: 0 | 1 | 2;
  public enableCaching: boolean;
  public readonly domSettleTimeoutMs: number;
  public readonly selfHeal: boolean;
  public readonly experimental: boolean;

  // State tracking
  private _isInitialized: boolean = false;
  private _isClosed: boolean = false;

  constructor(params: ChromeExtensionStagehandParams = {}) {
    // Set default configuration
    this._modelName = params.modelName ?? 'openai/gpt-4o-mini';
    this._modelClientOptions = params.modelClientOptions ?? {};
    this.userProvidedInstructions = params.systemPrompt;
    this.verbose = params.verbose ?? 0;
    this.enableCaching = params.enableCaching ?? false;
    this.domSettleTimeoutMs = params.domSettleTimeoutMs ?? 30_000;
    this.selfHeal = params.selfHeal ?? false;
    this.experimental = params.experimental ?? false;

    // Initialize logger for Chrome extension (no Pino, no file system)
    this._stagehandLogger = new StagehandLogger(
      {
        pretty: true,
        usePino: false, // Never use Pino in Chrome extension
      },
      params.logger
    );
    this._stagehandLogger.setVerbosity(this.verbose);

    // Initialize LLM provider and client
    this.llmProvider = params.llmProvider || new LLMProvider(this.logger, this.enableCaching);
    this.llmClient =
      params.llmClient || this.llmProvider.getClient(this._modelName, this._modelClientOptions);

    if (this.experimental) {
      this._stagehandLogger.warn(
        'Experimental mode is enabled. This is a beta feature and may break at any time.'
      );
    }
  }

  /**
   * Initialize the Chrome extension Stagehand with an existing BrowserWindow
   *
   * Unlike the full Stagehand which launches a browser, this connects to
   * the existing browser context provided by the Cordyceps system.
   */
  async init(browserWindow?: BrowserWindow): Promise<ChromeExtensionInitResult> {
    if (this._isInitialized) {
      this.log({
        category: 'init',
        message: 'ChromeExtensionStagehand already initialized',
        level: 1,
      });
      return {
        success: true,
        currentUrl: this._currentPage?.page?.url(),
      };
    }

    try {
      // Use provided BrowserWindow or create a new one
      this._browserWindow = browserWindow || (await BrowserWindow.create());

      // Get the current page from the browser window
      const cordycepsPage = await this._browserWindow.getCurrentPage();

      // Wrap the Cordyceps page with our enhanced StagehandPage
      this._currentPage = new ChromeExtensionStagehandPage(
        cordycepsPage,
        this,
        this.llmClient,
        this.userProvidedInstructions
      );

      // Initialize the page wrapper
      await this._currentPage.init();

      this._isInitialized = true;

      const currentUrl = cordycepsPage.url();

      this.log({
        category: 'init',
        message: 'ChromeExtensionStagehand initialized successfully',
        level: 1,
        auxiliary: {
          currentUrl: { value: currentUrl, type: 'string' },
          modelName: { value: this._modelName, type: 'string' },
          experimental: { value: String(this.experimental), type: 'boolean' },
        },
      });

      return {
        success: true,
        currentUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.log({
        category: 'init',
        message: 'Failed to initialize ChromeExtensionStagehand',
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get the current page instance
   * Provides compatibility with the original Stagehand API
   */
  public get page(): Page {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return this._currentPage.page;
  }

  /**
   * Get the enhanced StagehandPage instance with act/observe/extract methods
   */
  public get stagehandPage(): ChromeExtensionStagehandPage {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return this._currentPage;
  }

  /**
   * Get the action history
   */
  public get history(): ReadonlyArray<HistoryEntry> {
    return Object.freeze([...this._history]);
  }

  /**
   * Get current metrics
   */
  public get metrics(): StagehandMetrics {
    return { ...this.stagehandMetrics };
  }

  /**
   * Check if the instance has been closed
   */
  public get isClosed(): boolean {
    return this._isClosed;
  }

  /**
   * Check if the instance is initialized
   */
  public get isInitialized(): boolean {
    return this._isInitialized;
  }

  /**
   * Get the logger function
   */
  public get logger(): (logLine: LogLine) => void {
    return (logLine: LogLine) => {
      this.log(logLine);
    };
  }

  /**
   * Update performance metrics for LLM operations
   */
  public updateMetrics(
    functionName: StagehandFunctionName,
    promptTokens: number,
    completionTokens: number,
    inferenceTimeMs: number
  ): void {
    switch (functionName) {
      case StagehandFunctionName.ACT:
        this.stagehandMetrics.actPromptTokens += promptTokens;
        this.stagehandMetrics.actCompletionTokens += completionTokens;
        this.stagehandMetrics.actInferenceTimeMs += inferenceTimeMs;
        break;

      case StagehandFunctionName.EXTRACT:
        this.stagehandMetrics.extractPromptTokens += promptTokens;
        this.stagehandMetrics.extractCompletionTokens += completionTokens;
        this.stagehandMetrics.extractInferenceTimeMs += inferenceTimeMs;
        break;

      case StagehandFunctionName.OBSERVE:
        this.stagehandMetrics.observePromptTokens += promptTokens;
        this.stagehandMetrics.observeCompletionTokens += completionTokens;
        this.stagehandMetrics.observeInferenceTimeMs += inferenceTimeMs;
        break;

      case StagehandFunctionName.AGENT:
        this.stagehandMetrics.agentPromptTokens += promptTokens;
        this.stagehandMetrics.agentCompletionTokens += completionTokens;
        this.stagehandMetrics.agentInferenceTimeMs += inferenceTimeMs;
        break;
    }

    this._updateTotalMetrics(promptTokens, completionTokens, inferenceTimeMs);
  }

  /**
   * Add an entry to the action history
   */
  public addToHistory(method: HistoryEntry['method'], parameters: unknown, result?: unknown): void {
    this._history.push({
      method,
      parameters,
      result: result ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Create an agent instance that can execute AI-powered instructions
   * This is one of the most valuable features from the original Stagehand
   */
  agent(options?: AgentOptions): {
    execute: (instructionOrOptions: string | AgentExecuteOptions) => Promise<AgentResult>;
  } {
    return {
      execute: async (instructionOrOptions: string | AgentExecuteOptions) => {
        if (!this._isInitialized) {
          throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
        }

        // Convert string instruction to options object
        const executeOptions: AgentExecuteOptions =
          typeof instructionOrOptions === 'string'
            ? { instruction: instructionOrOptions }
            : instructionOrOptions;

        // Merge with agent config
        const finalOptions = {
          ...executeOptions,
          ...(options || {}),
        };

        return await this._executeAgentInstruction(finalOptions);
      },
    };
  }

  /**
   * Log a message using the Stagehand logger
   */
  log(logObj: LogLine): void {
    logObj.level = logObj.level ?? 1;
    this._stagehandLogger.log(logObj);
  }

  /**
   * Navigate to a URL using the current page
   * This is a common operation that should be easy to access
   */
  async goto(
    url: string,
    options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }
  ): Promise<void> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'navigation',
      message: `Navigating to: ${url}`,
      level: 1,
      auxiliary: {
        url: { value: url, type: 'string' },
        options: { value: JSON.stringify(options || {}), type: 'object' },
      },
    });

    try {
      // Use Cordyceps page.goto method
      await this._currentPage.page.goto(url, options);

      this.addToHistory('navigate', { url, options }, { success: true });

      this.log({
        category: 'navigation',
        message: `Successfully navigated to: ${url}`,
        level: 1,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.addToHistory('navigate', { url, options }, { success: false, error: errorMessage });

      this.log({
        category: 'navigation',
        message: `Failed to navigate to: ${url}`,
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      throw error;
    }
  }

  /**
   * Get the current URL of the page
   */
  get currentUrl(): string {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return this._currentPage.page.url();
  }

  /**
   * Get the current page title
   */
  async getTitle(): Promise<string> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return await this._currentPage.page.title();
  }

  /**
   * Wait for a selector to appear on the page
   * This is a common operation useful for page automation
   */
  async waitForSelector(selector: string, options?: { timeout?: number }): Promise<void> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'wait',
      message: `Waiting for selector: ${selector}`,
      level: 2,
      auxiliary: {
        selector: { value: selector, type: 'string' },
        timeout: { value: String(options?.timeout || this.domSettleTimeoutMs), type: 'string' },
      },
    });

    // Use Cordyceps locator.waitFor() method instead of page.waitForSelector()
    const locator = this._currentPage.page.locator(selector);
    await locator.waitFor({
      timeout: options?.timeout || this.domSettleTimeoutMs,
    });
  }

  /**
   * Get a locator for a CSS selector
   * This provides access to the full Cordyceps locator API
   */
  locator(selector: string): Locator {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }
    return this._currentPage.page.locator(selector);
  }

  /**
   * Take a screenshot of the current page
   * Useful for debugging and visual verification
   */
  async screenshot(options?: { fullPage?: boolean; quality?: number }): Promise<Buffer> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'screenshot',
      message: 'Taking screenshot',
      level: 2,
      auxiliary: {
        fullPage: { value: String(options?.fullPage || false), type: 'boolean' },
        quality: { value: String(options?.quality || 80), type: 'string' },
      },
    });

    // Use Cordyceps screenshot method with progress
    return await executeWithProgress(async progress => {
      return await this._currentPage.page.screenshot(progress, {
        fullPage: options?.fullPage,
        quality: options?.quality,
      });
    });
  }

  /**
   * Evaluate JavaScript in the page context
   * Provides access to DOM manipulation and data extraction
   */
  async evaluate<T>(pageFunction: () => T): Promise<T> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'evaluate',
      message: 'Evaluating JavaScript in page context',
      level: 2,
      auxiliary: {
        function: { value: pageFunction.toString(), type: 'string' },
      },
    });

    // Use Cordyceps main frame evaluate method
    return await this._currentPage.page.mainFrame().evaluate(pageFunction);
  }

  /**
   * Reload the current page
   */
  async reload(options?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  }): Promise<void> {
    if (!this._isInitialized || !this._currentPage) {
      throw new Error('ChromeExtensionStagehand not initialized. Call init() first.');
    }

    this.log({
      category: 'navigation',
      message: 'Reloading page',
      level: 1,
      auxiliary: {
        url: { value: this._currentPage.page.url(), type: 'string' },
        options: { value: JSON.stringify(options || {}), type: 'object' },
      },
    });

    try {
      await this._currentPage.page.reload(options);

      this.addToHistory('navigate', { action: 'reload', options }, { success: true });

      this.log({
        category: 'navigation',
        message: 'Page reloaded successfully',
        level: 1,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.addToHistory(
        'navigate',
        { action: 'reload', options },
        { success: false, error: errorMessage }
      );

      this.log({
        category: 'navigation',
        message: 'Failed to reload page',
        level: 0,
        auxiliary: {
          error: { value: errorMessage, type: 'string' },
        },
      });

      throw error;
    }
  }

  /**
   * Clean up resources when done
   * Chrome extension version doesn't need to close browser since it's shared
   */
  async close(): Promise<void> {
    if (this._isClosed) {
      return;
    }

    this.log({
      category: 'close',
      message: 'Closing ChromeExtensionStagehand',
      level: 1,
    });

    // Clean up the page wrapper
    if (this._currentPage) {
      await this._currentPage.dispose();
    }

    this._isClosed = true;
    this._isInitialized = false;

    this.log({
      category: 'close',
      message: 'ChromeExtensionStagehand closed successfully',
      level: 1,
    });
  }

  // Private helper methods

  private _updateTotalMetrics(
    promptTokens: number,
    completionTokens: number,
    inferenceTimeMs: number
  ): void {
    this.stagehandMetrics.totalPromptTokens += promptTokens;
    this.stagehandMetrics.totalCompletionTokens += completionTokens;
    this.stagehandMetrics.totalInferenceTimeMs += inferenceTimeMs;
  }

  private async _executeAgentInstruction(options: AgentExecuteOptions): Promise<AgentResult> {
    // TODO: Implement agent instruction execution using Cordyceps
    // This would use the existing act/observe/extract methods from ChromeExtensionStagehandPage
    // and integrate with the LLM client for AI-powered decision making

    this.log({
      category: 'agent',
      message: 'Agent instruction execution not yet implemented',
      level: 0,
      auxiliary: {
        instruction: { value: options.instruction || 'Unknown', type: 'string' },
      },
    });

    throw new Error(
      'Agent instruction execution not yet implemented - needs Cordyceps integration'
    );
  }
}

// Export everything needed for Chrome extension usage
export * from '../types/log';
export * from '../types/model';
export * from '../types/stagehand';
export * from '../types/agent';
export * from './llm/LLMClient';
export * from './llm/LLMProvider';
