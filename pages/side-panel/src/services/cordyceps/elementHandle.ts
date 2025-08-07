import { Disposable } from 'vs/base/common/lifecycle';
import type { FrameExecutionContext } from './frameExecutionContext';
import { Rect, WaitForElementOptions, ClickOptions } from './types';
import { Progress, executeWithProgress } from './progress';
import { Frame } from './frame';

export function throwRetargetableDOMError<T>(result: T | 'error:notconnected'): T {
  if (result === 'error:notconnected') throwElementIsNotAttached();
  return result;
}

export function throwElementIsNotAttached(): never {
  throw new Error('Element is not attached to the DOM');
}

// This needs to know it's world, tab id, frame id, and element id that
// exists in the dom
export class JSHandle extends Disposable {
  public readonly remoteObject: string;
  protected readonly _context: FrameExecutionContext;

  constructor(context: FrameExecutionContext, remoteObject: string) {
    super();
    this._context = context;
    this.remoteObject = remoteObject;
  }

  public get context(): FrameExecutionContext {
    return this._context;
  }

  public toString(): string {
    return this.remoteObject;
  }
}

export class ElementHandle extends JSHandle {
  public readonly frame;

  constructor(context: FrameExecutionContext, remoteObject: string) {
    super(context, remoteObject);
    this.frame = context.frame;
  }

  async waitForSelector(
    progress: Progress,
    selector: string,
    options: WaitForElementOptions,
  ): Promise<ElementHandle | null> {
    return await this.frame.waitForSelector(progress, selector, true, options, this);
  }

  async boundingBox(): Promise<Rect | null> {
    try {
      const result = await this._context.getBoundingBox(this.remoteObject);
      return result || null;
    } catch (e) {
      // Handle disconnected elements or other errors
      return null;
    }
  }

  async check(): Promise<void> {
    return executeWithProgress(
      async progress => {
        const result = await this._setChecked(progress, true);
        if (result !== 'done') {
          throw new Error(`Check failed: ${result}`);
        }
      },
      { timeout: 30000 },
    );
  }

  async uncheck(): Promise<void> {
    return executeWithProgress(
      async progress => {
        const result = await this._setChecked(progress, false);
        if (result !== 'done') {
          throw new Error(`Uncheck failed: ${result}`);
        }
      },
      { timeout: 30000 },
    );
  }

  async click(): Promise<void> {
    return executeWithProgress(
      async progress => {
        const result = await this._click(progress);
        if (result !== 'done') {
          throw new Error(`Click failed: ${result}`);
        }
      },
      { timeout: 30000 },
    );
  }

  /**
   * Click an element following Playwright patterns.
   * This method implements enhanced clicking with proper error handling.
   */
  async clickWithProgress(progress: Progress, options?: ClickOptions): Promise<void> {
    const result = await this._click(progress, options);
    if (result !== 'done') {
      throw new Error(`Click failed: ${result}`);
    }
  }

  /**
   * Simple click method using executeWithProgress wrapper.
   */
  async clickSimple(): Promise<void> {
    return executeWithProgress(
      async progress => {
        const result = await this._click(progress);
        if (result !== 'done') {
          throw new Error(`Click failed: ${result}`);
        }
      },
      { timeout: 30000 },
    );
  }

  /**
   * Internal method to perform click following Playwright patterns.
   * This method handles the core click logic with proper error handling.
   */
  async _click(progress: Progress, options?: ClickOptions): Promise<'error:notconnected' | 'done'> {
    // Use enhanced click if options are provided
    if (options && (options.position || options.force || options.button || options.clickCount)) {
      const clickResult = await progress.race(
        this._context.clickElementWithOptions(this.remoteObject, {
          position: options.position,
          force: options.force,
          button: options.button,
          clickCount: options.clickCount,
        }),
      );

      if (!clickResult) {
        return 'error:notconnected';
      }

      if (!clickResult.success) {
        throw new Error(clickResult.error || 'Failed to click element');
      }

      // Handle delay if specified
      if (options.delay) {
        await progress.race(new Promise(resolve => setTimeout(resolve, options.delay)));
      }

      return 'done';
    }

    // Use simple click for basic cases
    const clickResult = await progress.race(this._context.clickElement(this.remoteObject));
    if (!clickResult) {
      return 'error:notconnected';
    }

    if (!clickResult.success) {
      throw new Error(clickResult.error || 'Failed to click element');
    }

    return 'done';
  }

  async dblclick(options?: ClickOptions): Promise<void> {
    return executeWithProgress(
      async progress => {
        const result = await this._dblclick(progress, options);
        if (result !== 'done') {
          throw new Error(`Double click failed: ${result}`);
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  /**
   * Double click an element following Playwright patterns.
   * This method implements enhanced double clicking with proper error handling.
   */
  async dblclickWithProgress(progress: Progress, options?: ClickOptions): Promise<void> {
    const result = await this._dblclick(progress, options);
    if (result !== 'done') {
      throw new Error(`Double click failed: ${result}`);
    }
  }

  /**
   * Internal method to perform double click following Playwright patterns.
   * Double click is essentially a click with clickCount: 2.
   */
  async _dblclick(
    progress: Progress,
    options?: ClickOptions,
  ): Promise<'error:notconnected' | 'done'> {
    // Merge options with clickCount: 2 for double click
    const dblclickOptions: ClickOptions = {
      ...options,
      clickCount: 2,
    };

    // Use the existing _click method with modified options
    return await this._click(progress, dblclickOptions);
  }

  /**
   * Check a checkbox or radio button following Playwright patterns.
   * This method implements the _setChecked logic similar to Playwright's ElementHandle.
   */
  async checkWithProgress(progress: Progress): Promise<void> {
    const result = await this._setChecked(progress, true);
    if (result !== 'done') {
      throw new Error(`Check failed: ${result}`);
    }
  }

  /**
   * Uncheck a checkbox or radio button following Playwright patterns.
   */
  async uncheckWithProgress(progress: Progress): Promise<void> {
    const result = await this._setChecked(progress, false);
    if (result !== 'done') {
      throw new Error(`Uncheck failed: ${result}`);
    }
  }

  /**
   * Internal method to set checked state following Playwright patterns.
   * This method handles the core check/uncheck logic with proper error handling.
   */
  async _setChecked(progress: Progress, state: boolean): Promise<'error:notconnected' | 'done'> {
    // Helper function to check current state
    const isChecked = async (): Promise<boolean> => {
      const result = await progress.race(this._context.isChecked(this.remoteObject));
      if (result === undefined) {
        throwElementIsNotAttached();
      }
      return result;
    };

    // Check if element is already in the desired state
    const currentState = await isChecked();
    if (currentState === state) {
      return 'done';
    }

    // Attempt to set the checked state
    const setResult = await progress.race(this._context.setChecked(this.remoteObject, state));
    if (!setResult) {
      return 'error:notconnected';
    }

    if (!setResult.success) {
      throw new Error(setResult.error || 'Failed to set checked state');
    }

    // If a click is needed to change the state, perform the click
    if (setResult.needsClick) {
      const clickResult = await progress.race(this._context.clickElement(this.remoteObject));
      if (!clickResult) {
        return 'error:notconnected';
      }

      if (!clickResult.success) {
        throw new Error(clickResult.error || 'Failed to click element');
      }

      // Verify the state changed after clicking
      const newState = await isChecked();
      if (newState !== state) {
        throw new Error('Clicking the checkbox did not change its state');
      }
    }

    return 'done';
  }

  /**
   * Get bounding box with progress tracking.
   * Similar to Playwright's ElementHandle.boundingBox method with progress.
   */
  async boundingBoxWithProgress(progress: Progress): Promise<Rect | null> {
    const value = await progress.race(this.boundingBox());
    return value || null;
  }

  async isIframeElement(): Promise<boolean | 'error:notconnected'> {
    try {
      const resultHandle = await this._context.evaluateHandle(
        (handle: string): string | null => {
          const injectedScript = window.__cordyceps_handledInjectedScript;
          const el = injectedScript.getElementByHandle(handle);
          if (el && (el.nodeName === 'IFRAME' || el.nodeName === 'FRAME')) {
            return handle;
          }
          return null;
        },
        'ISOLATED',
        this.remoteObject,
      );
      return !!resultHandle;
    } catch (e) {
      return 'error:notconnected';
    }
  }

  async _dispatchEvent(
    progress: Progress,
    type: string,
    eventInit: Record<string, unknown> = {},
  ): Promise<'error:notconnected' | 'done'> {
    const result = await progress.race(
      this._context.dispatchEvent(this.remoteObject, type, eventInit),
    );

    if (!result) {
      return 'error:notconnected';
    }

    if (!result.success) {
      throw new Error(`Failed to dispatch event: ${result.error || 'Unknown error'}`);
    }

    return 'done';
  }

  async dispatchEvent(type: string, eventInit: Record<string, unknown> = {}): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const result = await this._dispatchEvent(progress, type, eventInit);
        if (result !== 'done') {
          throw new Error(`Dispatch event failed: ${result}`);
        }
      },
      { timeout: 30000 },
    );
  }

  async dispatchEventWithProgress(
    progress: Progress,
    type: string,
    eventInit: Record<string, unknown> = {},
  ): Promise<void> {
    const result = await this._dispatchEvent(progress, type, eventInit);
    if (result !== 'done') {
      throw new Error(`Dispatch event failed: ${result}`);
    }
  }

  async contentFrame(): Promise<Frame | null> {
    const isFrameElement = throwRetargetableDOMError(await this.isIframeElement());
    if (!isFrameElement) return null;
    return this.frame.frameManager.page.getContentFrame(this);
  }

  async evaluate<R, Arg>(
    pageFunction: (element: Element, arg: Arg) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<R> {
    return await executeWithProgress(
      async () => {
        // Since Chrome extensions can't serialize function references,
        // we need to approach this differently. Let's check if the simpler
        // direct function call works by using the existing pattern from Frame

        if (arg !== undefined) {
          // For now, let's try a direct approach and see what happens
          const result = await this._context.executeScript(
            (handle: string) => {
              const injected = window.__cordyceps_handledInjectedScript;
              const element = injected.getElementByHandle(handle);
              if (!element) {
                throw new Error('Element not found for handle');
              }
              // Let's see if we can access element properties directly
              return (element as Element).tagName;
            },
            'ISOLATED',
            this.remoteObject,
          );
          return result as R;
        } else {
          // Test with a simple hardcoded function first
          const result = await this._context.executeScript(
            (handle: string) => {
              const injected = window.__cordyceps_handledInjectedScript;
              const element = injected.getElementByHandle(handle);
              if (!element) {
                throw new Error('Element not found for handle');
              }
              // Return tagName directly to test if this works
              return (element as Element).tagName;
            },
            'ISOLATED',
            this.remoteObject,
          );
          return result as R;
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async evaluateAll<R, Arg>(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pageFunction: (elements: Element[], arg: Arg) => R,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    arg?: Arg,
  ): Promise<R> {
    // Note: Due to Chrome extension CSP restrictions, we cannot pass functions as arguments
    // This is a simplified implementation that works for basic use cases
    throw new Error(
      'evaluateAll is not implemented due to Chrome extension function serialization restrictions. Use evaluate() instead for single elements.',
    );
  }

  async evaluateHandle<R, Arg>(
    pageFunction: (element: Element, arg: Arg) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<ElementHandle | null> {
    return await executeWithProgress(
      async () => {
        if (arg !== undefined) {
          // Create wrapper function for case with argument
          const wrapperWithArg = (handle: string, arg: Arg) => {
            const injected = window.__cordyceps_handledInjectedScript;
            const element = injected.getElementByHandle(handle);
            if (!element) {
              throw new Error('Element not found for handle');
            }
            // Call user function directly with element and arg
            const result = (pageFunction as (element: Element, arg: Arg) => R)(element, arg);
            // Return the result as a handle if it's an Element, otherwise return null
            if (result instanceof Element) {
              // We would need to register this element and return its handle
              // For now, return the original handle
              return handle;
            }
            return null;
          };

          return await this._context.evaluateHandle(
            wrapperWithArg,
            'ISOLATED',
            this.remoteObject,
            arg,
          );
        } else {
          // Create wrapper function for case without argument
          const wrapperNoArg = (handle: string) => {
            const injected = window.__cordyceps_handledInjectedScript;
            const element = injected.getElementByHandle(handle);
            if (!element) {
              throw new Error('Element not found for handle');
            }
            // Call user function directly with element only
            const result = (pageFunction as (element: Element) => R)(element);
            // Return the result as a handle if it's an Element, otherwise return null
            if (result instanceof Element) {
              // We would need to register this element and return its handle
              // For now, return the original handle
              return handle;
            }
            return null;
          };

          return await this._context.evaluateHandle(wrapperNoArg, 'ISOLATED', this.remoteObject);
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }
}
