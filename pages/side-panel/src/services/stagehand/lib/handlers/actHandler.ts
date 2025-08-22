import { BrowserWindow } from '../../../cordyceps/browserWindow';
import { LogLine } from '../../types/log';
import {
  PlaywrightCommandException,
  PlaywrightCommandMethodNotSupportedException,
} from '../../types/playwright';
import { LLMClient } from '../llm/LLMClient';
import { ActResult, ObserveResult, ActOptions, ObserveOptions } from '../../types/stagehand';
import { SupportedPlaywrightAction } from '../../types/act';
import { buildActObservePrompt } from '../prompt';
import {
  methodHandlerMap,
  fallbackLocatorMethod,
  deepLocator,
  deepLocatorWithShadow,
} from './actHandlerUtils';
import { StagehandObserveHandler } from './observeHandler';
import { StagehandInvalidArgumentError } from '../../types/stagehandErrors';

/**
 * Chrome Extension compatible ActHandler using Cordyceps engine
 *
 * This Redux implementation replaces Playwright dependencies with Cordyceps APIs
 * and provides comprehensive action execution capabilities within Chrome extension
 * security constraints.
 */
export class StagehandActHandler {
  private readonly logger: (logLine: LogLine) => void;
  private readonly browserWindow: BrowserWindow;
  private readonly selfHeal: boolean;
  private readonly experimental: boolean;

  constructor({
    logger,
    browserWindow,
    selfHeal = true,
    experimental = false,
  }: {
    logger: (logLine: LogLine) => void;
    browserWindow: BrowserWindow;
    selfHeal?: boolean;
    experimental?: boolean;
  }) {
    console.log(`[StagehandActHandler.constructor] initializing ######`);
    this.logger = logger;
    this.browserWindow = browserWindow;
    this.selfHeal = selfHeal;
    this.experimental = experimental;
    console.log(`[StagehandActHandler.constructor] initialization complete ######`);
  }

  /**
   * Perform an immediate action based on an ObserveResult object
   * that was returned from `page.observe(...)`.
   */
  public async actFromObserveResult(
    observe: ObserveResult,
    domSettleTimeoutMs?: number
  ): Promise<ActResult> {
    console.log(
      `[StagehandActHandler.actFromObserveResult] starting with method=${observe.method} selector=${observe.selector} ######`
    );

    this.logger({
      category: 'action',
      message: 'Performing act from an ObserveResult',
      level: 1,
      auxiliary: {
        observeResult: {
          value: JSON.stringify(observe),
          type: 'object',
        },
      },
    });

    const method = observe.method;
    if (!method || method === 'not-supported') {
      console.log(`[StagehandActHandler.actFromObserveResult] unsupported method ######`);
      this.logger({
        category: 'action',
        message: 'Cannot execute ObserveResult with unsupported method',
        level: 1,
        auxiliary: {
          error: {
            value:
              'NotSupportedError: The method requested in this ObserveResult is not supported by Stagehand.',
            type: 'string',
          },
          trace: {
            value: `Cannot execute act from ObserveResult with unsupported method: ${method}`,
            type: 'string',
          },
        },
      });
      return {
        success: false,
        message: `Unable to perform action: The method '${method}' is not supported in ObserveResult. Please use a supported Cordyceps locator method.`,
        action: observe.description || `ObserveResult action (${method})`,
      };
    }

    const args = observe.arguments ?? [];
    // Remove the xpath prefix on the selector - replace() always returns a string
    const selector: string = observe.selector.replace('xpath=', '');

    try {
      console.log(`[StagehandActHandler.actFromObserveResult] executing method=${method} ######`);
      await this._performCordycepsMethod(method, args, selector, domSettleTimeoutMs ?? 1000);

      console.log(
        `[StagehandActHandler.actFromObserveResult] action completed successfully ######`
      );
      return {
        success: true,
        message: `Action [${method}] performed successfully on selector: ${selector}`,
        action: observe.description || `ObserveResult action (${method})`,
      };
    } catch (err: unknown) {
      const error = err as Error;
      console.log(`[StagehandActHandler.actFromObserveResult] error: ${error.message} ######`);
      if (!this.selfHeal || err instanceof PlaywrightCommandMethodNotSupportedException) {
        this.logger({
          category: 'action',
          message: 'Error performing act from an ObserveResult',
          level: 1,
          auxiliary: {
            error: { value: error.message, type: 'string' },
            trace: { value: error.stack || '', type: 'string' },
          },
        });
        return {
          success: false,
          message: `Failed to perform act: ${error.message}`,
          action: observe.description || `ObserveResult action (${method})`,
        };
      }

      // Try to use observeAct on a failed ObserveResult-act if selfHeal is true
      console.log(`[StagehandActHandler.actFromObserveResult] attempting self-heal ######`);
      this.logger({
        category: 'action',
        message:
          'Error performing act from an ObserveResult. Reprocessing the page and trying again',
        level: 1,
        auxiliary: {
          error: { value: error.message, type: 'string' },
          trace: { value: error.stack || '', type: 'string' },
          observeResult: { value: JSON.stringify(observe), type: 'object' },
        },
      });

      try {
        // Create a basic self-heal implementation
        // This would require integration with the observe handler
        console.log(
          `[StagehandActHandler.actFromObserveResult] self-heal not implemented, returning error ######`
        );
        return {
          success: false,
          message: `Failed to perform act: ${error.message} (self-heal not implemented)`,
          action: observe.description || `ObserveResult action (${method})`,
        };
      } catch (healErr: unknown) {
        const healError = healErr as Error;
        this.logger({
          category: 'action',
          message: 'Error performing act from an ObserveResult on fallback',
          level: 1,
          auxiliary: {
            error: { value: healError.message, type: 'string' },
            trace: { value: healError.stack || '', type: 'string' },
          },
        });
        return {
          success: false,
          message: `Failed to perform act: ${healError.message}`,
          action: observe.description || `ObserveResult action (${method})`,
        };
      }
    }
  }

  /**
   * Perform an act based on an instruction.
   * This method will observe the page and then perform the act on the first element returned.
   */
  public async observeAct(
    actionOrOptions: ActOptions,
    observeHandler: StagehandObserveHandler,
    llmClient: LLMClient,
    requestId: string
  ): Promise<ActResult> {
    console.log(`[StagehandActHandler.observeAct] starting with requestId=${requestId} ######`);

    // Extract the action string
    let action: string;
    const observeOptions: Partial<ObserveOptions> = {};

    if (typeof actionOrOptions === 'object' && actionOrOptions !== null) {
      if (!('action' in actionOrOptions)) {
        throw new StagehandInvalidArgumentError(
          'Invalid argument. Action options must have an `action` field.'
        );
      }

      if (typeof actionOrOptions.action !== 'string' || actionOrOptions.action.length === 0) {
        throw new StagehandInvalidArgumentError('Invalid argument. No action provided.');
      }

      action = actionOrOptions.action;

      // Extract options that should be passed to observe
      if (actionOrOptions.modelName) observeOptions.modelName = actionOrOptions.modelName;
      if (actionOrOptions.modelClientOptions)
        observeOptions.modelClientOptions = actionOrOptions.modelClientOptions;
    } else {
      throw new StagehandInvalidArgumentError(
        'Invalid argument. Valid arguments are: a string, an ActOptions object with an `action` field not empty, or an ObserveResult with a `selector` and `method` field.'
      );
    }

    // doObserveAndAct is just a wrapper of observeAct and actFromObserveResult.
    const doObserveAndAct = async (): Promise<ActResult> => {
      console.log(
        `[StagehandActHandler.observeAct] building instruction for action="${action}" ######`
      );
      const instruction = buildActObservePrompt(
        action,
        Object.values(SupportedPlaywrightAction),
        actionOrOptions.variables
      );

      console.log(`[StagehandActHandler.observeAct] calling observe handler ######`);
      const observeResults = await observeHandler.observe({
        instruction,
        llmClient,
        requestId,
        drawOverlay: false,
        returnAction: true,
        fromAct: true,
        iframes: actionOrOptions?.iframes,
      });

      if (observeResults.length === 0) {
        console.log(`[StagehandActHandler.observeAct] no observe results found ######`);
        return {
          success: false,
          message: `Failed to perform act: No observe results found for action`,
          action,
        };
      }

      const element: ObserveResult = observeResults[0];
      console.log(
        `[StagehandActHandler.observeAct] found element with method=${element.method} ######`
      );

      if (actionOrOptions.variables) {
        Object.keys(actionOrOptions.variables).forEach(key => {
          if (element.arguments) {
            element.arguments = element.arguments.map(arg =>
              arg.replace(`%${key}%`, actionOrOptions.variables![key])
            );
          }
        });
      }

      return this.actFromObserveResult(element, actionOrOptions.domSettleTimeoutMs);
    };

    // If no user defined timeoutMs, just do observeAct + actFromObserveResult with no timeout
    if (!actionOrOptions.timeoutMs) {
      return doObserveAndAct();
    }

    // Race observeAct + actFromObserveResult vs. the timeoutMs
    const { timeoutMs } = actionOrOptions;
    console.log(`[StagehandActHandler.observeAct] racing with timeout=${timeoutMs}ms ######`);
    return await Promise.race([
      doObserveAndAct(),
      new Promise<ActResult>(resolve => {
        setTimeout(() => {
          console.log(`[StagehandActHandler.observeAct] timeout reached ######`);
          resolve({
            success: false,
            message: `Action timed out after ${timeoutMs}ms`,
            action,
          });
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Private method to perform Cordyceps method execution
   */
  private async _performCordycepsMethod(
    method: string,
    args: unknown[],
    rawXPath: string,
    domSettleTimeoutMs: number
  ): Promise<void> {
    console.log(
      `[StagehandActHandler._performCordycepsMethod] method=${method} xpath=${rawXPath} ######`
    );

    const xpath = rawXPath.replace(/^xpath=/i, '').trim();
    const page = await this.browserWindow.getCurrentPage();

    let locator;
    if (this.experimental) {
      console.log(
        `[StagehandActHandler._performCordycepsMethod] using experimental deepLocatorWithShadow ######`
      );
      locator = await deepLocatorWithShadow(page, xpath);
    } else {
      console.log(
        `[StagehandActHandler._performCordycepsMethod] using standard deepLocator ######`
      );
      locator = deepLocator(page, xpath);
    }

    const initialUrl = page.url();

    this.logger({
      category: 'action',
      message: 'performing cordyceps method',
      level: 2,
      auxiliary: {
        xpath: { value: xpath, type: 'string' },
        method: { value: method, type: 'string' },
      },
    });

    // Create a logger adapter for the MethodHandlerContext
    const contextLogger = (logData: {
      category: string;
      message: string;
      level: number;
      auxiliary?: Record<string, { value: unknown; type: string }>;
    }) => {
      const clampedLevel = Math.max(0, Math.min(2, logData.level)) as 0 | 1 | 2;
      const convertedAuxiliary: Record<
        string,
        { value: string; type: 'string' | 'boolean' | 'object' | 'html' | 'integer' | 'float' }
      > = {};

      if (logData.auxiliary) {
        Object.entries(logData.auxiliary).forEach(([key, value]) => {
          convertedAuxiliary[key] = {
            value: String(value.value),
            type: ['string', 'boolean', 'object', 'html', 'integer', 'float'].includes(value.type)
              ? (value.type as 'string' | 'boolean' | 'object' | 'html' | 'integer' | 'float')
              : 'string',
          };
        });
      }

      this.logger({
        category: logData.category,
        message: logData.message,
        level: clampedLevel,
        auxiliary: Object.keys(convertedAuxiliary).length > 0 ? convertedAuxiliary : undefined,
      });
    };

    const context = {
      method,
      locator,
      xpath,
      args: args.map(arg => String(arg)), // Convert unknown[] to string[]
      logger: contextLogger,
      stagehandPage: {
        page,
        _waitForSettledDom: (timeout?: number) => this._waitForSettledDom(timeout),
        context: {
          on: () => {},
          once: () => {},
        },
      },
      initialUrl,
      domSettleTimeoutMs,
    };

    try {
      console.log(`[StagehandActHandler._performCordycepsMethod] looking up method handler ######`);
      // 1) Look up a function in the map
      const methodFn = methodHandlerMap[method];

      // 2) If found, call it
      if (methodFn) {
        console.log(`[StagehandActHandler._performCordycepsMethod] calling method handler ######`);
        await methodFn(context);

        // 3) Otherwise, see if it's a valid locator method
      } else if (typeof locator[method as keyof typeof locator] === 'function') {
        console.log(
          `[StagehandActHandler._performCordycepsMethod] calling fallback locator method ######`
        );
        await fallbackLocatorMethod(context);

        // 4) If still unknown, we can't handle it
      } else {
        console.log(`[StagehandActHandler._performCordycepsMethod] unsupported method ######`);
        this.logger({
          category: 'action',
          message: 'chosen method is invalid',
          level: 1,
          auxiliary: {
            method: { value: method, type: 'string' },
          },
        });
        throw new PlaywrightCommandMethodNotSupportedException(`Method ${method} not supported`);
      }

      // Always wait for DOM to settle
      console.log(`[StagehandActHandler._performCordycepsMethod] waiting for DOM to settle ######`);
      await this._waitForSettledDom(domSettleTimeoutMs);
    } catch (e: unknown) {
      const error = e as Error;
      console.log(
        `[StagehandActHandler._performCordycepsMethod] error executing method: ${error.message} ######`
      );
      this.logger({
        category: 'action',
        message: 'error performing method',
        level: 1,
        auxiliary: {
          error: { value: error.message, type: 'string' },
          trace: { value: error.stack || '', type: 'string' },
          method: { value: method, type: 'string' },
          xpath: { value: xpath, type: 'string' },
          args: { value: JSON.stringify(args), type: 'object' },
        },
      });
      throw new PlaywrightCommandException(error.message);
    }
  }

  /**
   * Wait for DOM to settle using Cordyceps
   */
  private async _waitForSettledDom(timeoutMs = 1000): Promise<void> {
    console.log(
      `[StagehandActHandler._waitForSettledDom] waiting for DOM settle (${timeoutMs}ms) ######`
    );

    try {
      const page = await this.browserWindow.getCurrentPage();

      // Wait for network idle state
      await page.waitForLoadState('networkidle', { timeout: timeoutMs });

      // Additional small delay for DOM mutations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log(`[StagehandActHandler._waitForSettledDom] DOM settled successfully ######`);
    } catch (error: unknown) {
      const err = error as Error;
      console.log(
        `[StagehandActHandler._waitForSettledDom] timeout or error: ${err.message} ######`
      );
      // Don't throw, just log and continue
      this.logger({
        category: 'action',
        message: 'DOM settle timeout - continuing anyway',
        level: 2,
        auxiliary: {
          timeout: { value: String(timeoutMs), type: 'integer' },
          error: { value: err.message, type: 'string' },
        },
      });
    }
  }
}
