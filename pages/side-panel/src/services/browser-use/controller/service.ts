/**
 * TypeScript implementation of browser-use controller service
 */
import { ActionResult } from './types';
// import { ExtendedBrowserContext } from '../browser/interfaces';
import { Registry } from './registry/service';
import { ActionModel } from './registry/views';

// Define interfaces for action-related types
interface ActionData {
  [actionName: string]: Record<string, unknown> | null | undefined;
}

interface ActionWithModelDump {
  modelDump?(options?: { excludeUnset?: boolean }): ActionData;
}

interface OutputModelConstructor {
  new (): ActionModel & {
    success: boolean;
    data: unknown;
  };
}

// import TurndownService from 'turndown';
import {
  //   ClickElementAction,
  DoneAction,
  //   GoToUrlAction,
  //   InputTextAction,
  //   NoParamsAction,
  //   OpenTabAction,
  //   ScrollAction,
  SearchGoogleAction,
  //   SendKeysAction,
  //   SwitchTabAction,
  //   ExtractPageContentAction,
  //   SelectDropdownOptionAction,
  //   WaitAction,
  //   ScrollToTextAction,
  //   GetDropdownOptionsAction,
} from './views';
import { ExtendedBrowserContext } from '../browser/interfaces';
import { BrowserContext } from '../browser/context';

/**
 * Controller class for managing browser actions
 */
export class Controller<Context = unknown> {
  registry: Registry<Context>;

  /**
   * Execute an action with the given parameters
   */
  async execute(
    action: ActionData | ActionWithModelDump,
    browserContext: BrowserContext,
    pageExtractionLlm?: unknown,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context,
  ): Promise<ActionResult> {
    // Extract the action name and parameters just like Python's model_dump
    const actionData: ActionData =
      action && typeof action === 'object' ? (action as ActionData) : {};

    for (const actionName of Object.keys(actionData)) {
      const params = actionData[actionName];

      if (params !== null && params !== undefined) {
        // Execute the action
        const result = await this.executeAction(
          actionName,
          params,
          browserContext,
          pageExtractionLlm,
          sensitiveData,
          availableFilePaths,
          context,
        );

        // Match Python's type checking and return logic
        if (typeof result === 'string') {
          return new ActionResult({
            isDone: false,
            success: true,
            extractedContent: result,
            includeInMemory: false,
            error: '',
          });
        } else if (result instanceof ActionResult) {
          return result;
        } else if (result === null || result === undefined) {
          return new ActionResult({
            isDone: false,
            success: true,
            extractedContent: '',
            includeInMemory: false,
            error: '',
          });
        } else {
          throw new Error(`Invalid action result type: ${typeof result} of ${result}`);
        }
      }
    }
    return new ActionResult({
      isDone: false,
      success: true,
      extractedContent: '',
      includeInMemory: false,
      error: '',
    });
  }

  /**
   * Execute an action by name with the given parameters
   */
  async executeAction(
    actionName: string,
    params: Record<string, unknown> | null | undefined,
    browser?: BrowserContext,
    pageExtractionLlm?: unknown,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context,
  ): Promise<ActionResult> {
    if (!actionName) {
      return new ActionResult({
        isDone: false,
        success: false,
        extractedContent: 'Action name is required',
        includeInMemory: false,
        error: 'Action name is required',
      });
    }

    if (
      !this.registry ||
      !this.registry.registry ||
      !this.registry.registry.actions ||
      !(actionName in this.registry.registry.actions)
    ) {
      return new ActionResult({
        isDone: false,
        success: false,
        extractedContent: `Action ${actionName} not found in registry`,
        includeInMemory: false,
        error: `Action ${actionName} not found in registry`,
      });
    }

    try {
      // Get the action function directly from the registry
      const registeredAction = this.registry.registry.actions[actionName];

      if (registeredAction && typeof registeredAction.function === 'function') {
        // Ensure params is properly typed as Record<string, unknown>
        const typedParams = params || {};

        // Call the function with the context of 'this'
        return (await registeredAction.function.call(this, typedParams, {
          browser,
          pageExtractionLlm,
          sensitiveData,
          availableFilePaths,
          context,
        })) as unknown as ActionResult;
      } else {
        throw new Error(`Action ${actionName} does not have a valid function implementation`);
      }
    } catch (e) {
      console.error(`Error executing action ${actionName}:`, e);
      return new ActionResult({
        isDone: false,
        success: false,
        error: String(e),
        includeInMemory: true,
        extractedContent: `Error executing action ${actionName}: ${String(e)}`,
      });
    }
  }

  /**
   * Python original implementation of act
   */
  async act(
    action: ActionData | ActionWithModelDump,
    browserContext: BrowserContext,
    pageExtractionLlm?: unknown,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context,
  ): Promise<ActionResult> {
    // Match Python's model_dump method
    if (!action) {
      return new ActionResult({
        isDone: false,
        success: true,
        extractedContent: '',
        includeInMemory: false,
        error: '',
      });
    }

    const actionData: ActionData =
      typeof (action as ActionWithModelDump).modelDump === 'function'
        ? (action as ActionWithModelDump).modelDump!({ excludeUnset: true })
        : action && typeof action === 'object'
          ? (action as ActionData)
          : {};

    for (const actionName of Object.keys(actionData)) {
      const params = actionData[actionName];

      if (params !== null && params !== undefined) {
        // Ensure params is typed as Record<string, unknown>
        const typedParams =
          typeof params === 'object' && params !== null ? (params as Record<string, unknown>) : {};

        // Execute the action
        const result = await this.registry.executeAction(
          actionName,
          typedParams,
          browserContext,
          pageExtractionLlm,
          sensitiveData,
          availableFilePaths,
          context,
        );

        // Match Python's type checking and return logic
        if (typeof result === 'string') {
          return new ActionResult({
            extractedContent: result,
            isDone: false,
            success: true,
            includeInMemory: false,
            error: '',
          });
        } else if (result instanceof ActionResult) {
          return result;
        } else if (result === null || result === undefined) {
          return new ActionResult({
            isDone: false,
            success: true,
            extractedContent: '',
            includeInMemory: false,
            error: '',
          });
        } else {
          throw new Error(`Invalid action result type: ${typeof result} of ${result}`);
        }
      }
    }

    return new ActionResult({
      isDone: false,
      success: true,
      extractedContent: '',
      includeInMemory: false,
      error: '',
    });
  }

  /**
   * Initialize the controller with optional excluded actions and output model
   */
  constructor(excludeActions: string[] = [], outputModel?: unknown) {
    this.registry = new Registry<Context>(excludeActions);

    /**
     * Register all default browser actions
     */
    if (outputModel) {
      class ExtendedOutputModel extends ActionModel {
        success: boolean = true;
        data: unknown;

        constructor() {
          super();
          this.success = true;
          this.data = undefined;
        }
      }
      this.registerDoneActionWithModel(ExtendedOutputModel);
    } else {
      this.registerDoneAction();
    }

    // Register all the standard browser actions
    // this.registerBasicActions();
  }

  /**
   * Register the done action with a custom output model
   */
  private registerDoneActionWithModel(ExtendedOutputModel: OutputModelConstructor): void {
    this.registry.action(
      'Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached',
      ExtendedOutputModel,
    )(this, 'done', {
      value: async function (params: unknown): Promise<ActionResult> {
        // Type guard to ensure params has the expected structure
        const typedParams = params as { success: boolean; data: Record<string, unknown> };

        // Convert the output model to a plain object
        const outputDict = typedParams.data || {};

        // Handle enums by converting them to string values
        for (const [key, value] of Object.entries(outputDict)) {
          if (value && typeof value === 'object' && 'value' in value) {
            outputDict[key] = (value as { value: unknown }).value;
          }
        }

        return new ActionResult({
          isDone: true,
          success: typedParams.success || false,
          extractedContent: JSON.stringify(outputDict),
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  /**
   * Register the standard done action
   */
  private registerDoneAction(): void {
    this.registry.action(
      'Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached',
      DoneAction,
    )(this, 'done', {
      value: async function (params: unknown): Promise<ActionResult> {
        // Type guard for the expected parameters structure
        const typedParams = params as { text?: string; success?: boolean };

        // Create a DoneAction instance with the validated params
        const doneAction =
          params instanceof DoneAction
            ? params
            : new DoneAction({
                text: typedParams.text || '',
                success: typedParams.success || false,
              });

        // Create our result, matching the Python implementation
        // In Python: return ActionResult(is_done=True, success=params.success, extracted_content=params.text)
        return new ActionResult({
          isDone: true,
          success: doneAction.success,
          extractedContent: doneAction.text,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }

  private registerBasicActions(): void {
    // Search Google action
    this.registry.action(
      'Search the query in Google in the current tab, the query should be a search query like humans search in Google, concrete and not vague or super long. More the single most important items.',
      SearchGoogleAction,
    )(this, 'search_google', {
      value: async function (
        params: SearchGoogleAction,
        { browser }: { browser: ExtendedBrowserContext },
      ): Promise<ActionResult> {
        const page = await browser.getCurrentPage();
        await page.goto(`https://www.google.com/search?q=${params.query}&udm=14`);
        await page.waitForLoadState();
        const msg = `🔍 Searched for "${params.query}" in Google`;
        console.info(msg);
        return new ActionResult({
          isDone: false,
          success: true,
          extractedContent: msg,
          includeInMemory: true,
          error: '',
        });
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}
