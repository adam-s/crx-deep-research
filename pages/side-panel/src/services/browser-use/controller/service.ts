/**
 * TypeScript implementation of browser-use controller service
 */
import { ActionResult } from './types';
import { BrowserContext } from '../browser/context';
import { Registry } from './registry/service';
import TurndownService from 'turndown';
import {
  ClickElementAction,
  DoneAction,
  GoToUrlAction,
  InputTextAction,
  NoParamsAction,
  OpenTabAction,
  ScrollAction,
  SearchGoogleAction,
  SendKeysAction,
  SwitchTabAction,
  ExtractPageContentAction,
  SelectDropdownOptionAction,
  WaitAction,
  ScrollToTextAction,
  GetDropdownOptionsAction,
} from './views';
import { RegisteredAction, ActionModel } from './registry/views';

// Minimal interface for the LLM used to extract page content
interface PageExtractionLLM {
  invoke(messages: Array<{ type: string; content: string }>): Promise<{ content: string }>;
}

// Interface for actions that have a modelDump method (like Pydantic models)
interface ModelDumpAction {
  modelDump(options: { excludeUnset: boolean }): Record<string, unknown>;
}

/**
 * Controller class for managing browser actions
 */
export class Controller<Context = unknown> {
  registry: Registry<Context>;

  /**
   * Execute an action with the given parameters
   */
  async execute(
    action: unknown,
    browserContext: BrowserContext,
    pageExtractionLlm?: PageExtractionLLM,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context
  ): Promise<ActionResult> {
    /**
     * Execute an action
     */
    // Extract the action name and parameters just like Python's model_dump
    const actionData =
      action && typeof action === 'object' ? (action as Record<string, unknown>) : {};

    for (const actionName of Object.keys(actionData)) {
      const params = actionData[actionName] as Record<string, unknown>;

      if (params !== null && params !== undefined) {
        // Execute the action
        const result = await this.executeAction(
          actionName,
          params,
          browserContext,
          pageExtractionLlm,
          sensitiveData,
          availableFilePaths,
          context
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
    params: Record<string, unknown>,
    browser?: BrowserContext,
    pageExtractionLlm?: PageExtractionLLM,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context
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
      const registeredAction = this.registry.registry.actions[actionName] as RegisteredAction<
        Record<string, unknown>
      >;

      if (registeredAction && typeof registeredAction.function === 'function') {
        // Call the function with the context of 'this'
        return (await registeredAction.function.call(this, params, {
          browser,
          pageExtractionLlm,
          sensitiveData,
          availableFilePaths,
          context,
        })) as ActionResult;
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
    action: unknown,
    browserContext: BrowserContext,
    pageExtractionLlm?: PageExtractionLLM,
    sensitiveData?: Record<string, string>,
    availableFilePaths?: string[],
    context?: Context
  ): Promise<ActionResult> {
    /**
     * Execute an action
     */
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

    const actionData =
      typeof (action as ModelDumpAction).modelDump === 'function'
        ? (action as ModelDumpAction).modelDump({ excludeUnset: true })
        : action && typeof action === 'object'
          ? (action as Record<string, unknown>)
          : ({} as Record<string, unknown>);

    for (const actionName of Object.keys(actionData)) {
      const params = actionData[actionName];

      if (params !== null && params !== undefined) {
        // Execute the action
        const result = await this.registry.executeAction(
          actionName,
          params as Record<string, unknown>,
          browserContext,
          pageExtractionLlm,
          sensitiveData,
          availableFilePaths,
          context
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
      // Create a wrapper for the output model
      class ExtendedOutputModel extends ActionModel {
        success: boolean = true;
        data: unknown;

        getIndex(): number | null {
          return null;
        }

        setIndex(_index: number): void {
          // No-op for this model
        }

        toJSON(): Record<string, unknown> {
          return { success: this.success, data: this.data };
        }
      }

      // Register the done action with output model
      this.registerDoneActionWithModel(ExtendedOutputModel as new () => ActionModel);
    } else {
      // Register the standard done action
      this.registerDoneAction();
    }

    // Register all the standard browser actions
    this.registerBasicActions();
  }

  /**
   * Register the done action with a custom output model
   */
  private registerDoneActionWithModel(ExtendedOutputModel: new () => ActionModel): void {
    this.registry.action(
      // eslint-disable-next-line max-len
      'Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached',
      ExtendedOutputModel
    )(this, 'done', {
      value: async function (params: { success: boolean; data: unknown }): Promise<ActionResult> {
        // Convert the output model to a plain object
        const outputDict = params.data as Record<string, unknown>;

        // Handle enums by converting them to string values
        for (const [key, value] of Object.entries(outputDict)) {
          if (value && typeof value === 'object' && 'value' in value) {
            outputDict[key] = (value as { value: unknown }).value;
          }
        }

        return new ActionResult({
          isDone: true,
          success: params.success,
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
  // #region bookmark

  /**
   * Register the standard done action
   */
  private registerDoneAction(): void {
    this.registry.action(
      // eslint-disable-next-line max-len
      'Complete task - with return text and if the task is finished (success=True) or not yet completely finished (success=False), because last step is reached',
      DoneAction
    )(this, 'done', {
      value: async function (
        params: DoneAction | { text: string; success: boolean }
      ): Promise<ActionResult> {
        // In Python, Pydantic would validate that required fields exist
        // If fields are missing, it would raise a ValidationError

        // Create a DoneAction instance with the validated params
        const doneAction =
          params instanceof DoneAction
            ? params
            : new DoneAction({
                text: params.text,
                success: params.success,
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
      // eslint-disable-next-line max-len
      'Search the query in Google in the current tab, the query should be a search query like humans search in Google, concrete and not vague or super long. More the single most important items.',
      SearchGoogleAction
    )(this, 'search_google', {
      value: async function (
        params: SearchGoogleAction,
        { browser }: { browser: BrowserContext }
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

    // Go to URL action
    this.registry.action('Navigate to URL in the current tab', GoToUrlAction)(this, 'go_to_url', {
      value: async function (
        params: GoToUrlAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        const page = await browser.getCurrentPage();

        console.info(`Navigating to ${params.url}...`);
        try {
          // Use more robust navigation options
          await page.goto(params.url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000, // Increase timeout to 60 seconds
          });

          // Wait for multiple load states to ensure page is fully loaded
          await page.waitForLoadState('domcontentloaded');
          await page.waitForLoadState('load');

          // Additional wait to ensure the page is stable
          await page.waitForTimeout(2000);

          const msg = `🔗 Successfully navigated to ${params.url}`;
          console.info(msg);

          return new ActionResult({
            isDone: false,
            success: true,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (error) {
          console.error(`Navigation error: ${error}`);

          // Even if there's an error, the page might still have loaded partially
          // So we'll return a failure with an informative message
          const errorMsg = `Navigation to ${params.url} may have encountered issues: ${error}`;
          return new ActionResult({
            isDone: false,
            success: false,
            error: String(error),
            extractedContent: errorMsg,
            includeInMemory: true,
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Go back action
    this.registry.action('Go back', NoParamsAction)(this, 'go_back', {
      value: async function (
        _: NoParamsAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        await browser.goBack();
        const msg = '🔙 Navigated back';
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

    // Wait action
    this.registry.action('Wait for x seconds default 3', WaitAction)(this, 'wait', {
      value: async function (params: WaitAction): Promise<ActionResult> {
        // Get seconds from params, default to 3 if not specified
        const seconds = params.seconds || 3;

        const msg = `🕒 Waiting for ${seconds} seconds`;
        console.info(msg);
        await new Promise(resolve => setTimeout(resolve, seconds * 1000));
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

    // Scroll to text action
    this.registry.action(
      'If you dont find something which you want to interact with, scroll to it',
      ScrollToTextAction
    )(this, 'scroll_to_text', {
      value: async function (
        params: ScrollToTextAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        try {
          // Get text directly from params
          const textToFind = params.text;

          // Match Python implementation exactly
          const page = await browser.getCurrentPage();
          // Try different locator strategies, just like Python implementation
          const locators = [
            page.getByText(textToFind, { exact: false }),
            page.locator(`text=${textToFind}`),
            page.locator(`//*[contains(text(), '${textToFind}')]`),
          ];

          for (const locator of locators) {
            try {
              // First check if element exists and is visible
              if ((await locator.count()) > 0 && (await locator.first().isVisible())) {
                await locator.first().scrollIntoViewIfNeeded();
                await page.waitForTimeout(500); // Wait for scroll to complete
                const msg = `🔍 Scrolled to text: ${textToFind}`;
                console.info(msg);
                return new ActionResult({
                  isDone: false,
                  success: true,
                  extractedContent: msg,
                  includeInMemory: true,
                  error: '',
                });
              }
            } catch (e) {
              continue;
            }
          }

          const msg = `Text '${textToFind}' not found or not visible on page`;
          console.info(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (e) {
          const msg = `Failed to scroll to text '${params.text}': ${e}`;
          console.error(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            error: msg,
            extractedContent: '', // Add empty string for required property
            includeInMemory: false,
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Click element action
    this.registry.action('Click element', ClickElementAction)(this, 'click_element', {
      value: async function (
        params: ClickElementAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        // Check if the index is defined
        if (params.index === undefined) {
          throw new Error('Failed to click element with index undefined');
        }

        const session = await browser.getSession();

        if (session.cachedState) {
          if (session.cachedState.selectorMap) {
            9;
          }
        }

        const selectorMap = await browser.getSelectorMap();

        // Convert the index to string to match how it's stored in the selector map
        const indexKey = params.index.toString();

        if (!(indexKey in selectorMap)) {
          throw new Error(
            `Element with index ${params.index} does not exist - retry or use alternative actions`
          );
        }

        // Get element descriptor directly from selector map using getDomElementByIndex
        // This matches Python implementation's approach exactly
        const elementNode = await browser.getDomElementByIndex(params.index);
        if (!elementNode) {
          throw new Error(`Element with index ${params.index} not found`);
        }

        // Get the initial page count safely
        // In the Python implementation, this is used to detect new tabs/windows after clicking
        let initialPages = 0;
        try {
          // Get the current page count from the browser window
          initialPages = browser.browserWindow.pages().length;
        } catch (e) {
          console.warn('Could not get initial page count:', e);
        }

        // Check if element is a file uploader
        if (await browser.isFileUploader(elementNode)) {
          // eslint-disable-next-line max-len
          const msg = `Index ${params.index} - has an element which opens file upload dialog. To upload files please use a specific function to upload files`;
          console.info(msg);
          return new ActionResult({
            isDone: true,
            success: true,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        }

        let msg: string;

        try {
          const downloadPath = await browser._clickElementNode(elementNode);
          if (downloadPath) {
            msg = `💾 Downloaded file to ${downloadPath}`;
          } else {
            msg = `🖱️ Clicked button with index ${params.index}: ${elementNode.getAllTextTillNextClickableElement(2)}`;
          }

          console.info(msg);

          // Check for new tabs safely, following Python implementation approach
          let currentPageCount = 0;
          try {
            // Get the current page count from the browser window
            currentPageCount = browser.browserWindow.pages().length;
          } catch (e) {
            console.warn('Could not get current page count:', e);
          }

          if (currentPageCount > initialPages) {
            const newTabMsg = 'New tab opened - switching to it';
            msg += ` - ${newTabMsg}`;
            console.info(newTabMsg);
            await browser.switchToTab(-1);
          }

          // Only mark downloads as done; regular clicks should allow the agent to continue
          // This matches the Python implementation's behavior
          return new ActionResult({
            isDone: downloadPath ? true : false,
            success: true,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (e) {
          console.warn(
            `Element not clickable with index ${params.index} - most likely the page changed`
          );
          return new ActionResult({
            isDone: false,
            success: false,
            error: String(e),
            extractedContent: `Element not clickable: ${String(e)}`,
            includeInMemory: false,
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Input text action
    this.registry.action('Input text into a input interactive element', InputTextAction)(
      this,
      'input_text',
      {
        value: async function (
          params: InputTextAction,
          {
            browser,
            hasSensitiveData = false,
          }: { browser: BrowserContext; hasSensitiveData?: boolean }
        ): Promise<ActionResult> {
          // Check if the index is defined
          if (params.index === undefined) {
            throw new Error('Failed to input text into index undefined');
          }

          // Get element descriptor directly from selector map using getDomElementByIndex
          // This matches Python implementation's approach exactly
          const elementNode = await browser.getDomElementByIndex(params.index);
          if (!elementNode) {
            throw new Error(`Element with index ${params.index} not found`);
          }
          await browser._inputTextElementNode(elementNode, params.text);

          let msg: string;
          if (!hasSensitiveData) {
            msg = `⌨️ Input ${params.text} into index ${params.index}`;
          } else {
            msg = `⌨️ Input sensitive data into index ${params.index}`;
          }

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
      }
    );

    // Switch tab action
    this.registry.action('Switch tab', SwitchTabAction)(this, 'switch_tab', {
      value: async function (
        params: SwitchTabAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        await browser.switchToTab(params.pageId);
        // Wait for tab to be ready
        const page = await browser.getCurrentPage();
        await page.waitForLoadState();
        const msg = `🔄 Switched to tab ${params.pageId}`;
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

    // Open tab action
    this.registry.action('Open url in new tab', OpenTabAction)(this, 'open_tab', {
      value: async function (
        params: OpenTabAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        await browser.createNewTab(params.url);
        const msg = `🔗 Opened new tab with ${params.url}`;
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

    // Scroll down action
    this.registry.action(
      'Scroll down the page by pixel amount - if no amount is specified, scroll down one page',
      ScrollAction
    )(this, 'scroll_down', {
      value: async function (
        params: ScrollAction | { amount?: number },
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        const page = await browser.getCurrentPage();
        let amount: number | undefined;

        // Handle both direct ScrollAction and object with empty properties
        if (params && typeof params === 'object') {
          if ('amount' in params && typeof params.amount === 'number') {
            amount = params.amount;
          }
        }

        if (amount !== undefined) {
          await page.evaluate((amount: number) => {
            window.scrollBy(0, amount);
          }, amount);
        } else {
          await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight);
          });
        }

        const amountText = amount !== undefined ? `${amount} pixels` : 'one page';
        const msg = `🔍 Scrolled down the page by ${amountText}`;
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

    // Scroll up action
    this.registry.action(
      'Scroll up the page by pixel amount - if no amount is specified, scroll up one page',
      ScrollAction
    )(this, 'scroll_up', {
      value: async function (
        params: ScrollAction | { amount?: number },
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        const page = await browser.getCurrentPage();
        let amount: number | undefined;

        // Handle both direct ScrollAction and object with empty properties
        if (params && typeof params === 'object') {
          if ('amount' in params && typeof params.amount === 'number') {
            amount = params.amount;
          }
        }

        if (amount !== undefined) {
          await page.evaluate((amount: number) => {
            window.scrollBy(0, -amount);
          }, amount);
        } else {
          await page.evaluate(() => {
            window.scrollBy(0, -window.innerHeight);
          });
        }

        const amountText = amount !== undefined ? `${amount} pixels` : 'one page';
        const msg = `🔍 Scrolled up the page by ${amountText}`;
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

    // Send keys action
    this.registry.action(
      // eslint-disable-next-line max-len
      'Send strings of special keys like Escape,Backspace, Insert, PageDown, Delete, Enter, Shortcuts such as `Control+o`, `Control+Shift+T` are supported as well. This gets used in keyboard.press.',
      SendKeysAction
    )(this, 'send_keys', {
      value: async function (
        params: SendKeysAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        const page = await browser.getCurrentPage();

        try {
          // Prefer a native keyboard API if the Page exposes one (Playwright-like).
          const pageWithKeyboard = page as unknown as {
            press?: (selector: string, key: string) => Promise<void>;
          };
          const keys = params.keys as string | string[];

          if (typeof pageWithKeyboard.press === 'function') {
            // keyboard.press expects a single key string (e.g. 'Escape' or 'Control+o')
            if (Array.isArray(keys)) {
              // If given an array of keys, send them one at a time
              for (const key of keys) await pageWithKeyboard.press!('body', key);
            } else {
              await pageWithKeyboard.press!('body', keys);
            }
          } else {
            // Last resort: dispatch a KeyboardEvent in the page context
            const singleKeys: string[] = Array.isArray(keys) ? keys : [keys];
            for (const k of singleKeys) {
              await page.evaluate((key: string) => {
                const ev = new KeyboardEvent('keydown', { key });
                (document.activeElement || document.body).dispatchEvent(ev);
                const ev2 = new KeyboardEvent('keyup', { key });
                (document.activeElement || document.body).dispatchEvent(ev2);
              }, k);
            }
          }
        } catch (e) {
          if (String(e).includes('Unknown key')) {
            // If Playwright-style keyboard failed with Unknown key and keys is an array, try each individually
            const keys = params.keys as unknown;
            if (Array.isArray(keys)) {
              for (const key of keys) {
                try {
                  const pageWithKeyboard = page as unknown as {
                    keyboard?: { press?: (keys: string) => Promise<void> };
                    press?: (selector: string, key: string) => Promise<void>;
                  };
                  if (
                    pageWithKeyboard.keyboard &&
                    typeof pageWithKeyboard.keyboard.press === 'function'
                  ) {
                    await pageWithKeyboard.keyboard.press!(key);
                  } else if (typeof pageWithKeyboard.press === 'function') {
                    await pageWithKeyboard.press('body', key);
                  } else {
                    await page.evaluate((k: string) => {
                      const ev = new KeyboardEvent('keydown', { key: k });
                      (document.activeElement || document.body).dispatchEvent(ev);
                      const ev2 = new KeyboardEvent('keyup', { key: k });
                      (document.activeElement || document.body).dispatchEvent(ev2);
                    }, key);
                  }
                } catch (inner) {
                  console.warn(`Failed to press fallback key '${key}': ${String(inner)}`);
                }
              }
            } else {
              throw e;
            }
          } else {
            throw e;
          }
        }

        const msg = `⌨️ Sent keys: ${params.keys}`;
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

    // Note: The scroll_to_text action is already registered above with the proper schema class

    // Get dropdown options action
    this.registry.action('Get all options from a native dropdown', GetDropdownOptionsAction)(
      this,
      'get_dropdown_options',
      {
        value: async function (
          params: GetDropdownOptionsAction,
          { browser }: { browser: BrowserContext }
        ): Promise<ActionResult> {
          const page = await browser.getCurrentPage();
          const selectorMap = await browser.getSelectorMap();

          const domElement = selectorMap[params.index];

          try {
            // Frame-aware approach
            const allOptions: string[] = [];
            let frameIndex = 0;

            for (const frame of page.frames()) {
              try {
                // Strictly-typed page evaluation to narrow to HTMLSelectElement and return a shaped SelectInfo
                interface DropdownOption {
                  text: string;
                  value: string;
                  index: number;
                }

                interface SelectInfo {
                  options: DropdownOption[];
                  id: string;
                  name: string;
                }

                const selectInfo = await frame.evaluate<SelectInfo | null, string>(xpath => {
                  const result = document.evaluate(
                    xpath,
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                  );

                  const node = result.singleNodeValue;
                  if (!node || !(node instanceof HTMLSelectElement)) return null;

                  const select = node as HTMLSelectElement;

                  // Do not trim text; exact match elsewhere depends on it
                  const options: DropdownOption[] = Array.from(select.options, opt => ({
                    text: opt.text,
                    value: opt.value,
                    index: opt.index,
                  }));

                  return {
                    options,
                    id: select.id,
                    name: select.name,
                  };
                }, domElement.xpath);

                if (selectInfo) {
                  const formattedOptions: string[] = [];
                  for (const opt of selectInfo.options) {
                    // Encoding ensures AI uses the exact string in select_dropdown_option
                    const encodedText = JSON.stringify(opt.text);
                    formattedOptions.push(`${opt.index}: text=${encodedText}`);
                  }

                  allOptions.push(...formattedOptions);
                  break;
                }
              } catch (e) {
                console.debug(`frame ${frameIndex} evaluation error: ${String(e)}`);
              }
              frameIndex++;
            }

            if (allOptions.length === 0) {
              return new ActionResult({
                isDone: false,
                success: false,
                error: `No dropdown options found for element with index ${params.index}`,
                includeInMemory: false,
                extractedContent: `No dropdown options found for element with index ${params.index}`,
              });
            }

            const msg = `Dropdown options for element ${params.index}:\n${allOptions.join('\n')}`;
            console.info(msg);

            return new ActionResult({
              isDone: true,
              success: true,
              extractedContent: msg,
              includeInMemory: true,
              error: '',
            });
          } catch (e) {
            const msg = `Error getting dropdown options: ${String(e)}`;
            console.error(msg);

            return new ActionResult({
              isDone: false,
              success: false,
              error: msg,
              extractedContent: '', // Add empty string for required property
              includeInMemory: false,
            });
          }
        },
        writable: true,
        enumerable: true,
        configurable: true,
      }
    );

    // Content Actions
    this.registry.action(
      // eslint-disable-next-line max-len
      'Extract page content to retrieve specific information from the page, e.g. all company names, a specifc description, all information about, links with companies in structured format or simply links',
      ExtractPageContentAction
    )(this, 'extract_content', {
      value: async function (
        params: ExtractPageContentAction,
        {
          browser,
          pageExtractionLlm,
        }: { browser: BrowserContext; pageExtractionLlm?: PageExtractionLLM }
      ): Promise<ActionResult> {
        const goal = params.value;
        const page = await browser.getCurrentPage();
        // Get the page content first - exactly like Python does
        const pageContent = await page.content();

        // Create turndown service (equivalent to Python's markdownify)
        const turndownService = new TurndownService();

        // Remove script, style, and other non-content tags
        // This matches the behavior of Python's markdownify
        // The .remove() method ensures these tags and their contents are completely removed
        turndownService.remove(['script', 'style', 'meta', 'link', 'noscript', 'img']);

        // Remove link URLs, but keep the text
        turndownService.addRule('plainLink', {
          filter: 'a',

          replacement(content) {
            return content; // no Markdown URL, just the text
          },
        });

        // Convert HTML to markdown
        const content = turndownService.turndown(pageContent);
        // Use the exact same prompt as Python
        const prompt =
          // eslint-disable-next-line max-len
          'Your task is to extract the content of the page. You will be given a page and a goal and you should extract all relevant information around this goal from the page. If the goal is vague, summarize the page. Respond in json format. Extraction goal: {goal}, Page: {page}';

        try {
          // In Python, this uses a PromptTemplate with input_variables=['goal', 'page']
          // Create a similar structure in TypeScript
          const templateVars = {
            goal: goal,
            page: content,
          };

          // Format the prompt with the goal and content (similar to Python's template.format())
          const formattedPrompt = prompt
            .replace('{goal}', templateVars.goal)
            .replace('{page}', templateVars.page);

          // In TypeScript, the LLM.invoke method expects an array of message objects
          const messages = [
            {
              type: 'human',
              content: formattedPrompt,
            },
          ];

          // Invoke LLM with message array - equivalent to Python's page_extraction_llm.invoke(template.format(...))
          const output = await pageExtractionLlm!.invoke(messages);

          // Use exact same format for message
          const msg = `📄 Extracted from page\n: ${output.content}\n`;
          console.info(msg);

          // Match Python implementation exactly:
          // return ActionResult(extracted_content=msg, include_in_memory=True)
          return new ActionResult({
            success: true,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (error) {
          // Match Python's error handling exactly
          // In Python: logger.debug(f'Error extracting content: {e}')
          console.debug(`Error extracting content: ${error}`);

          // In Python: msg = f'📄 Extracted from page\n: {content}\n'
          const msg = `📄 Extracted from page\n: ${content}\n`;
          console.info(msg);

          // Match Python implementation exactly:
          // return ActionResult(extracted_content=msg)
          // Note: Python doesn't include includeInMemory parameter in the error case
          // This means it defaults to False in Python, so content isn't added to memory
          return new ActionResult({
            success: true, // Note: Python doesn't explicitly set success=false
            extractedContent: msg,
            includeInMemory: false, // This is the key difference - don't include in memory on error
            error: '',
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });

    // Select dropdown option action
    this.registry.action(
      'Select dropdown option for interactive element index by the text of the option you want to select',
      SelectDropdownOptionAction
    )(this, 'select_dropdown_option', {
      value: async function (
        params: SelectDropdownOptionAction,
        { browser }: { browser: BrowserContext }
      ): Promise<ActionResult> {
        const { index, text } = params;
        const page = await browser.getCurrentPage();
        // Get element descriptor directly from browser using getDomElementByIndex
        const domElement = await browser.getDomElementByIndex(index);

        // Validate domElement exists and is a select element
        if (!domElement) {
          const msg = `Cannot select option: No element found for index ${index}`;
          console.error(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        }

        console.debug(`Attempting to select '${text}' using xpath: ${domElement.xpath}`);
        console.debug(`Element attributes: ${JSON.stringify(domElement.attributes)}`);
        console.debug(`Element tag: ${domElement.tagName}`);

        if (domElement.tagName.toLowerCase() !== 'select') {
          const msg = `Cannot select option: Element with index ${index} is a ${domElement.tagName}, not a select`;
          console.error(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        }

        try {
          let frameIndex = 0;
          for (const frame of page.frames()) {
            try {
              console.debug(`Trying frame ${frameIndex} URL: ${frame.url()}`);

              type DropdownCheckResult = {
                id?: string;
                name?: string;
                found: boolean;
                tagName?: string;
                optionCount?: number;
                currentValue?: string;
                availableOptions?: string[];
                error?: string;
              };

              const dropdownInfo = await frame.evaluate<DropdownCheckResult | null, string>(
                xpath => {
                  try {
                    const node = document.evaluate(
                      xpath,
                      document,
                      null,
                      XPathResult.FIRST_ORDERED_NODE_TYPE,
                      null
                    ).singleNodeValue;

                    if (!node) return null;
                    if (!(node instanceof HTMLSelectElement)) {
                      return {
                        found: false,
                        error: `Found element but it's a ${(node as Element).tagName}, not a SELECT`,
                      } as DropdownCheckResult;
                    }

                    const select = node as HTMLSelectElement;
                    return {
                      id: select.id,
                      name: select.name,
                      found: true,
                      tagName: select.tagName,
                      optionCount: select.options.length,
                      currentValue: select.value,
                      availableOptions: Array.from(select.options).map(o => o.text.trim()),
                    } as DropdownCheckResult;
                  } catch (e) {
                    return {
                      found: false,
                      error: String(e),
                    } as DropdownCheckResult;
                  }
                },
                domElement.xpath
              );

              if (dropdownInfo) {
                if (!dropdownInfo.found) {
                  console.error(`Frame ${frameIndex} error: ${dropdownInfo.error}`);
                  continue;
                }

                console.debug(
                  `Found dropdown in frame ${frameIndex}: ${JSON.stringify(dropdownInfo)}`
                );

                // "label" because we are selecting by text
                // nth(0) to disable error thrown by strict mode
                // timeout=1000 because we are already waiting for all network events
                const selectedOptionValues = await frame
                  .locator('//' + domElement.xpath)
                  .first()
                  .selectOption({ label: text }, { timeout: 1000 });

                const msg = `Selected option ${text} with value ${selectedOptionValues}`;
                console.info(msg + ` in frame ${frameIndex}`);

                return new ActionResult({
                  isDone: false,
                  success: true,
                  extractedContent: msg,
                  includeInMemory: true,
                  error: '',
                });
              }
            } catch (frameError) {
              console.error(`Frame ${frameIndex} attempt failed: ${String(frameError)}`);
              console.error(`Frame URL: ${frame.url()}`);
            }

            frameIndex++;
          }

          const msg = `Could not select option '${text}' in any frame`;
          console.info(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            extractedContent: msg,
            includeInMemory: true,
            error: '',
          });
        } catch (e) {
          const msg = `Selection failed: ${String(e)}`;
          console.error(msg);
          return new ActionResult({
            isDone: false,
            success: false,
            error: msg,
            extractedContent: msg,
            includeInMemory: true,
          });
        }
      },
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
}
