import { z } from 'zod/v3';
import { Page } from '../../cordyceps/page';
import { LLMClient } from './llm/LLMClient';
import { StagehandExtractHandler } from './handlers/extractHandler';
import { StagehandObserveHandler } from './handlers/observeHandler';
import { StagehandActHandler } from './handlers/actHandler';
import { LogLine } from '../types/log';
import { ClientOptions } from '../types/model';
import {
  ActOptions,
  ActResult,
  ExtractOptions,
  ExtractResult,
  ObserveOptions,
  ObserveResult,
} from '../types/stagehand';
import {
  StagehandError,
  StagehandDefaultError,
  HandlerNotInitializedError,
  MissingLLMConfigurationError,
  StagehandNotInitializedError,
} from '../types/stagehandErrors';

// Define a simple extract schema for when none is provided
const defaultExtractSchema = z.object({
  data: z.any(),
});

/**
 * Extended window interface for Stagehand script injection
 */
declare global {
  interface Window {
    __stagehandInjected?: boolean;
    __stagehandHelpers?: {
      getElementText: (element: Element) => string;
      isElementVisible: (element: Element) => boolean;
      highlightElement: (element: Element, color?: string) => void;
      removeHighlights: () => void;
    };
  }
}
async function clearOverlays(page: Page): Promise<void> {
  try {
    // TODO: Implement overlay clearing using Cordyceps
    // This would use page.evaluate() to remove any visual highlight overlays
    await page.evaluate(() => {
      const overlays = document.querySelectorAll('[data-stagehand-overlay]');
      overlays.forEach(overlay => overlay.remove());
    });
  } catch (error) {
    // Silently fail if overlay clearing fails
    console.warn('Failed to clear overlays:', error);
  }
}

/**
 * Handler logger interface that's compatible with the existing handlers
 */
interface HandlerLogger {
  (message: {
    category?: string;
    message: string;
    level?: number;
    auxiliary?: { [key: string]: { value: string; type: string } };
  }): void;
}

/**
 * Simplified Stagehand interface for Chrome extension context
 */
interface ChromeExtensionStagehandInterface {
  logger: (logLine: LogLine) => void;
  domSettleTimeoutMs: number;
  addToHistory: (method: string, parameters: unknown, result?: unknown) => void;
  llmProvider: {
    getClient: (modelName: string, options?: ClientOptions) => LLMClient;
    cleanRequestCache?: (requestId: string) => void;
  };
  enableCaching: boolean;
  log: (logLine: LogLine) => void;
}

/**
 * Enhanced page interface that combines Cordyceps Page with Stagehand AI methods
 * This creates the same API surface as the original Stagehand which combined Playwright + AI
 *
 * Usage example:
 * ```typescript
 * const stagehandPage = new ChromeExtensionStagehandPage(cordycepsPage, stagehand, llmClient);
 * await stagehandPage.init();
 *
 * // Use the enhanced page that has both Cordyceps AND Stagehand methods
 * const page = stagehandPage.enhancedPage;
 *
 * // Cordyceps methods work as normal
 * await page.goto('https://example.com');
 * await page.click('.button');
 *
 * // Stagehand AI methods also work
 * await page.act('click the submit button');
 * const data = await page.extract({ instruction: 'get user info' });
 * const elements = await page.observe('find all buttons');
 * ```
 */
export interface EnhancedCordycepsPage extends Page {
  act(actionOrOptions: string | ActOptions | ObserveResult): Promise<ActResult>;
  extract<T extends z.AnyZodObject = typeof defaultExtractSchema>(
    instructionOrOptions?: string | ExtractOptions<T>
  ): Promise<ExtractResult<T>>;
  observe(instructionOrOptions?: string | ObserveOptions): Promise<ObserveResult[]>;
}

/**
 * Chrome Extension compatible StagehandPage implementation
 *
 * This version removes all Playwright/Node.js dependencies and adapts to use
 * the Cordyceps browser automation system within a Chrome extension context.
 *
 * Key differences from the full StagehandPage:
 * - No CDP session management (Cordyceps handles browser communication)
 * - Uses Cordyceps Page proxy system instead of Playwright
 * - No Playwright selector engine registration
 * - Simplified script injection using Cordyceps
 * - Simplified network monitoring using Cordyceps load states
 * - No Browserbase-specific features (captcha handling, etc.)
 */
export class ChromeExtensionStagehandPage {
  // Core browser integration
  private rawPage: Page;
  private _enhancedPage!: EnhancedCordycepsPage;

  // Parent Stagehand instance (simplified interface)
  private stagehand: ChromeExtensionStagehandInterface;

  // AI/LLM functionality (keep - this is the valuable part)
  private actHandler?: StagehandActHandler;
  private extractHandler?: StagehandExtractHandler;
  private observeHandler?: StagehandObserveHandler;
  private llmClient: LLMClient;
  private userProvidedInstructions?: string;

  // State tracking
  private initialized: boolean = false;

  constructor(
    page: Page,
    stagehand: ChromeExtensionStagehandInterface,
    llmClient: LLMClient,
    userProvidedInstructions?: string
  ) {
    this.rawPage = page;
    this.stagehand = stagehand;
    this.llmClient = llmClient;
    this.userProvidedInstructions = userProvidedInstructions;

    // Create a logger adapter for handlers
    const handlerLogger: HandlerLogger = message => {
      // Map the handler auxiliary format to LogLine auxiliary format
      const auxiliary = message.auxiliary
        ? Object.fromEntries(
            Object.entries(message.auxiliary).map(([key, val]) => [
              key,
              {
                value: val.value,
                type: val.type as 'object' | 'string' | 'html' | 'integer' | 'float' | 'boolean',
              },
            ])
          )
        : undefined;

      this.stagehand.log({
        category: message.category,
        message: message.message,
        level: (message.level ?? 1) as 0 | 1 | 2,
        auxiliary,
      });
    };

    // Initialize handlers if LLM client is available
    if (this.llmClient) {
      this.actHandler = new StagehandActHandler({
        logger: handlerLogger,
        stagehandPage: this as unknown as StagehandActHandler['stagehandPage'],
        selfHeal: false,
        experimental: false,
      });

      this.extractHandler = new StagehandExtractHandler({
        stagehand: this.stagehand as unknown as StagehandExtractHandler['stagehand'],
        logger: handlerLogger,
        stagehandPage: this as unknown as StagehandExtractHandler['stagehandPage'],
        userProvidedInstructions,
        experimental: false,
      });

      this.observeHandler = new StagehandObserveHandler({
        stagehand: this.stagehand as unknown as StagehandObserveHandler['stagehand'],
        logger: handlerLogger,
        stagehandPage: this as unknown as StagehandObserveHandler['stagehandPage'],
        userProvidedInstructions,
        experimental: false,
      });
    }

    // Create the enhanced page proxy that combines Cordyceps Page + Stagehand AI methods
    this.createEnhancedPageProxy();
  }

  /**
   * Create a proxy that enhances the Cordyceps Page with Stagehand AI methods
   * This mimics the original Playwright proxy pattern but for Cordyceps
   */
  private createEnhancedPageProxy(): void {
    this._enhancedPage = new Proxy(this.rawPage, {
      get: (target: Page, prop: string | symbol) => {
        // Special handling for Stagehand AI methods before initialization
        if (!this.initialized && (prop === 'act' || prop === 'extract' || prop === 'observe')) {
          return () => {
            throw new StagehandNotInitializedError(String(prop));
          };
        }

        // Handle Stagehand AI methods
        if (prop === 'act') {
          return this.act.bind(this);
        }
        if (prop === 'extract') {
          return this.extract.bind(this);
        }
        if (prop === 'observe') {
          return this.observe.bind(this);
        }

        // Handle special method interception for script injection
        if (
          prop === 'evaluate' ||
          prop === 'evaluateHandle' ||
          prop === '$eval' ||
          prop === '$$eval'
        ) {
          return async (...args: unknown[]) => {
            // Ensure our helper scripts are injected before evaluation
            await this.ensureStagehandScript();
            const value = target[prop as keyof Page];
            if (typeof value === 'function') {
              return (value as (...args: unknown[]) => unknown).apply(target, args);
            }
            return value;
          };
        }

        // Handle goto specially to clear overlays and inject scripts
        if (prop === 'goto') {
          return async (...args: unknown[]) => {
            // Clear any existing overlays before navigation
            await clearOverlays(target).catch(() => {
              // Silently fail if page is already navigating
            });

            const value = target[prop as keyof Page];
            if (typeof value === 'function') {
              const result = await (value as (...args: unknown[]) => unknown).apply(target, args);
              // Re-inject scripts after navigation
              await this.ensureStagehandScript();
              return result;
            }
            return value;
          };
        }

        // For all other properties and methods, delegate to the original page
        const value = target[prop as keyof Page];

        // If it's a function, bind it to the original target
        if (typeof value === 'function') {
          return value.bind(target);
        }

        return value;
      },
    }) as EnhancedCordycepsPage;
  }

  /**
   * Simplified script injection for Chrome extension using Cordyceps
   * Replaces the complex Playwright script injection system
   */
  private async ensureStagehandScript(): Promise<void> {
    try {
      // Check if our helper scripts are already injected
      const injected = await this.rawPage.evaluate(() => {
        return !!window.__stagehandInjected;
      });

      if (injected) {
        return;
      }

      // Inject basic helper scripts using Cordyceps evaluate
      await this.rawPage.evaluate(() => {
        if (!window.__stagehandInjected) {
          window.__stagehandInjected = true;

          // Basic helper functions for element interaction
          window.__stagehandHelpers = {
            isElementVisible: (element: Element) => {
              if (!element) return false;
              const style = getComputedStyle(element);
              return (
                style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
              );
            },

            getElementText: (element: Element) => {
              return element.textContent || (element as HTMLElement).innerText || '';
            },

            highlightElement: (element: Element, color = 'red') => {
              if (!element) return;
              (element as HTMLElement).style.outline = `2px solid ${color}`;
              element.setAttribute('data-stagehand-overlay', 'true');
            },

            removeHighlights: () => {
              const highlighted = document.querySelectorAll('[data-stagehand-overlay]');
              highlighted.forEach(el => {
                (el as HTMLElement).style.outline = '';
                el.removeAttribute('data-stagehand-overlay');
              });
            },
          };
        }
      });

      this.stagehand.log({
        category: 'dom',
        message: 'Stagehand helper scripts injected successfully',
        level: 2,
      });
    } catch (err) {
      this.stagehand.log({
        category: 'dom',
        message: 'Failed to inject Stagehand helper script',
        level: 1,
        auxiliary: {
          error: { value: (err as Error).message, type: 'string' },
        },
      });
      throw err;
    }
  }

  /**
   * Simplified DOM settling using Cordyceps load states
   * Replaces the complex CDP-based network monitoring
   */
  public async _waitForSettledDom(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this.stagehand.domSettleTimeoutMs;

    this.stagehand.log({
      category: 'dom',
      message: 'Waiting for DOM to settle',
      level: 2,
      auxiliary: {
        timeout: { value: String(timeout), type: 'string' },
      },
    });

    try {
      // First wait for basic DOM content to load
      await this.rawPage.waitForLoadState('domcontentloaded');

      // Then wait for network to be idle (simpler than CDP monitoring)
      await this.rawPage.waitForLoadState('networkidle');

      this.stagehand.log({
        category: 'dom',
        message: 'DOM settled successfully using Cordyceps',
        level: 2,
      });
    } catch (error) {
      this.stagehand.log({
        category: 'dom',
        message: 'DOM settling timed out or failed',
        level: 1,
        auxiliary: {
          error: { value: (error as Error).message, type: 'string' },
          timeout: { value: String(timeout), type: 'string' },
        },
      });
      // Don't throw - continue with best effort
    }
  }

  /**
   * Initialize the Chrome extension StagehandPage
   * Much simpler than the Playwright version
   */
  async init(): Promise<ChromeExtensionStagehandPage> {
    try {
      this.stagehand.log({
        category: 'init',
        message: 'Initializing Chrome extension StagehandPage',
        level: 1,
      });

      // Inject our helper scripts
      await this.ensureStagehandScript();

      this.initialized = true;

      this.stagehand.log({
        category: 'init',
        message: 'Chrome extension StagehandPage initialized successfully',
        level: 1,
        auxiliary: {
          url: { value: this.rawPage.url(), type: 'string' },
        },
      });

      return this;
    } catch (err: unknown) {
      this.stagehand.log({
        category: 'init',
        message: 'Failed to initialize Chrome extension StagehandPage',
        level: 0,
        auxiliary: {
          error: { value: (err as Error).message, type: 'string' },
        },
      });

      if (err instanceof StagehandError) {
        throw err;
      }
      throw new StagehandDefaultError(err);
    }
  }

  /**
   * Get the underlying Cordyceps page
   * Provides compatibility with the original Stagehand API
   */
  public get page(): Page {
    return this.rawPage;
  }

  /**
   * Get the enhanced page that includes both Cordyceps methods and Stagehand AI methods
   * This is what users should primarily interact with
   */
  public get enhancedPage(): EnhancedCordycepsPage {
    return this._enhancedPage;
  }

  /**
   * Perform an action on the page using AI
   * Core Stagehand functionality - adapted for Cordyceps
   */
  async act(actionOrOptions: string | ActOptions | ObserveResult): Promise<ActResult> {
    try {
      if (!this.initialized) {
        throw new StagehandNotInitializedError('act');
      }

      if (!this.actHandler) {
        throw new HandlerNotInitializedError('Act');
      }

      if (!this.llmClient) {
        throw new MissingLLMConfigurationError();
      }

      // Clear any existing visual overlays
      await clearOverlays(this.page);

      // Handle ObserveResult input (direct action from observe result)
      if (typeof actionOrOptions === 'object' && actionOrOptions !== null) {
        if ('selector' in actionOrOptions && 'method' in actionOrOptions) {
          const observeResult = actionOrOptions as ObserveResult;
          return await this.actHandler.actFromObserveResult(observeResult);
        } else if (!('action' in actionOrOptions)) {
          throw new StagehandError(
            'Invalid argument. Valid arguments are: a string, an ActOptions object, ' +
              "or an ObserveResult WITH 'selector' and 'method' fields."
          );
        }
      } else if (typeof actionOrOptions === 'string') {
        // Convert string to ActOptions
        actionOrOptions = { action: actionOrOptions };
      } else {
        throw new StagehandError(
          'Invalid argument: you may have called act with an empty ObserveResult.'
        );
      }

      const { action, modelName, modelClientOptions } = actionOrOptions;
      const requestId = Math.random().toString(36).substring(2);

      // Use provided model or default LLM client
      const llmClient: LLMClient = modelName
        ? this.stagehand.llmProvider.getClient(modelName, modelClientOptions)
        : this.llmClient;

      this.stagehand.log({
        category: 'act',
        message: 'running act',
        level: 1,
        auxiliary: {
          action: { value: action, type: 'string' },
          requestId: { value: requestId, type: 'string' },
          modelName: { value: llmClient.modelName, type: 'string' },
        },
      });

      // Execute the action using the act handler
      const result = await this.actHandler.observeAct(
        actionOrOptions,
        this.observeHandler!,
        llmClient,
        requestId
      );

      // Track the action in history
      this.stagehand.addToHistory('act', actionOrOptions, result);
      return result;
    } catch (err: unknown) {
      this.stagehand.log({
        category: 'act',
        message: 'error in act',
        level: 0,
        auxiliary: {
          error: { value: (err as Error).message, type: 'string' },
          action: {
            value:
              typeof actionOrOptions === 'string'
                ? actionOrOptions
                : JSON.stringify(actionOrOptions),
            type: 'string',
          },
        },
      });

      if (err instanceof StagehandError) {
        throw err;
      }
      throw new StagehandDefaultError(err);
    }
  }

  /**
   * Extract data from the page using AI
   * Core Stagehand functionality - adapted for Cordyceps
   */
  async extract<T extends z.AnyZodObject = typeof defaultExtractSchema>(
    instructionOrOptions?: string | ExtractOptions<T>
  ): Promise<ExtractResult<T>> {
    try {
      if (!this.initialized) {
        throw new StagehandNotInitializedError('extract');
      }

      if (!this.extractHandler) {
        throw new HandlerNotInitializedError('Extract');
      }

      // Clear any existing visual overlays
      await clearOverlays(this.page);

      // Handle no arguments case - extract all visible content
      if (!instructionOrOptions) {
        const result = await this.extractHandler.extract({
          instruction: 'Extract all visible content from the page',
          schema: defaultExtractSchema as T,
          llmClient: this.llmClient,
          requestId: Math.random().toString(36).substring(2),
        });
        this.stagehand.addToHistory('extract', instructionOrOptions, result);
        return result;
      }

      // Normalize input to ExtractOptions
      const options: ExtractOptions<T> =
        typeof instructionOrOptions === 'string'
          ? {
              instruction: instructionOrOptions,
              schema: defaultExtractSchema as T,
            }
          : instructionOrOptions.schema
            ? instructionOrOptions
            : {
                ...instructionOrOptions,
                schema: defaultExtractSchema as T,
              };

      const {
        instruction,
        schema,
        modelName,
        modelClientOptions,
        domSettleTimeoutMs,
        useTextExtract,
        selector,
        iframes,
      } = options;

      const requestId = Math.random().toString(36).substring(2);

      // Use provided model or default LLM client
      const llmClient = modelName
        ? this.stagehand.llmProvider.getClient(modelName, modelClientOptions)
        : this.llmClient;

      this.stagehand.log({
        category: 'extract',
        message: 'running extract',
        level: 1,
        auxiliary: {
          instruction: { value: instruction ?? 'No instruction provided', type: 'string' },
          requestId: { value: requestId, type: 'string' },
          modelName: { value: llmClient.modelName, type: 'string' },
        },
      });

      // Execute the extraction using the extract handler
      const result = await this.extractHandler
        .extract({
          instruction,
          schema,
          llmClient,
          requestId,
          domSettleTimeoutMs,
          useTextExtract,
          selector,
          iframes,
        })
        .catch(e => {
          this.stagehand.log({
            category: 'extract',
            message: 'error extracting',
            level: 1,
            auxiliary: {
              error: { value: e.message, type: 'string' },
              trace: { value: e.stack, type: 'string' },
            },
          });

          // Clean up request cache if enabled
          if (this.stagehand.enableCaching && this.stagehand.llmProvider.cleanRequestCache) {
            this.stagehand.llmProvider.cleanRequestCache(requestId);
          }

          throw e;
        });

      // Track the extraction in history
      this.stagehand.addToHistory('extract', instructionOrOptions, result);
      return result;
    } catch (err: unknown) {
      this.stagehand.log({
        category: 'extract',
        message: 'error in extract',
        level: 0,
        auxiliary: {
          error: { value: (err as Error).message, type: 'string' },
          instruction: {
            value:
              typeof instructionOrOptions === 'string'
                ? instructionOrOptions
                : JSON.stringify(instructionOrOptions),
            type: 'string',
          },
        },
      });

      if (err instanceof StagehandError) {
        throw err;
      }
      throw new StagehandDefaultError(err);
    }
  }

  /**
   * Observe elements on the page using AI
   * Core Stagehand functionality - adapted for Cordyceps
   */
  async observe(instructionOrOptions?: string | ObserveOptions): Promise<ObserveResult[]> {
    try {
      if (!this.initialized) {
        throw new StagehandNotInitializedError('observe');
      }

      if (!this.observeHandler) {
        throw new HandlerNotInitializedError('Observe');
      }

      // Clear any existing visual overlays
      await clearOverlays(this.page);

      // Normalize input to ObserveOptions
      const options: ObserveOptions =
        typeof instructionOrOptions === 'string'
          ? { instruction: instructionOrOptions }
          : instructionOrOptions || {};

      const {
        instruction,
        modelName,
        modelClientOptions,
        domSettleTimeoutMs,
        returnAction = true,
        onlyVisible,
        drawOverlay,
        iframes,
      } = options;

      const requestId = Math.random().toString(36).substring(2);

      // Use provided model or default LLM client
      const llmClient = modelName
        ? this.stagehand.llmProvider.getClient(modelName, modelClientOptions)
        : this.llmClient;

      this.stagehand.log({
        category: 'observe',
        message: 'running observe',
        level: 1,
        auxiliary: {
          instruction: { value: instruction || 'observe all interactive elements', type: 'string' },
          requestId: { value: requestId, type: 'string' },
          modelName: { value: llmClient.modelName, type: 'string' },
          ...(onlyVisible !== undefined && {
            onlyVisible: { value: onlyVisible ? 'true' : 'false', type: 'boolean' },
          }),
        },
      });

      // Execute the observation using the observe handler
      const result = await this.observeHandler
        .observe({
          instruction: instruction ?? 'Find all interactive elements on the page',
          llmClient,
          requestId,
          domSettleTimeoutMs,
          returnAction,
          onlyVisible,
          drawOverlay,
          iframes,
        })
        .catch(e => {
          this.stagehand.log({
            category: 'observe',
            message: 'error observing',
            level: 1,
            auxiliary: {
              error: { value: e.message, type: 'string' },
              trace: { value: e.stack, type: 'string' },
              requestId: { value: requestId, type: 'string' },
              instruction: {
                value: instruction || 'observe all interactive elements',
                type: 'string',
              },
            },
          });

          // Clean up request cache if enabled
          if (this.stagehand.enableCaching && this.stagehand.llmProvider.cleanRequestCache) {
            this.stagehand.llmProvider.cleanRequestCache(requestId);
          }

          throw e;
        });

      // Track the observation in history
      this.stagehand.addToHistory('observe', instructionOrOptions, result);
      return result as ObserveResult[];
    } catch (err: unknown) {
      this.stagehand.log({
        category: 'observe',
        message: 'error in observe',
        level: 0,
        auxiliary: {
          error: { value: (err as Error).message, type: 'string' },
          instruction: {
            value:
              typeof instructionOrOptions === 'string'
                ? instructionOrOptions
                : JSON.stringify(instructionOrOptions),
            type: 'string',
          },
        },
      });

      if (err instanceof StagehandError) {
        throw err;
      }
      throw new StagehandDefaultError(err);
    }
  }

  /**
   * Clean up resources when the page is disposed
   */
  async dispose(): Promise<void> {
    this.stagehand.log({
      category: 'dispose',
      message: 'Disposing Chrome extension StagehandPage',
      level: 1,
    });

    // Clear any visual overlays
    await clearOverlays(this.page).catch(() => {
      // Silently fail if page is already gone
    });

    // Clear initialization flag
    this.initialized = false;

    this.stagehand.log({
      category: 'dispose',
      message: 'Chrome extension StagehandPage disposed successfully',
      level: 1,
    });
  }
}

// Export alias for compatibility with existing handlers
export { ChromeExtensionStagehandPage as StagehandPage };
