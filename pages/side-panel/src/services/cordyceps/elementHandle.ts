import { Disposable } from 'vs/base/common/lifecycle';
import type { FrameExecutionContext } from './frameExecutionContext';
import { Rect, WaitForElementOptions } from './types';
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

  async contentFrame(): Promise<Frame | null> {
    const isFrameElement = throwRetargetableDOMError(await this.isIframeElement());
    if (!isFrameElement) return null;
    return this.frame.frameManager.page.getContentFrame(this);
  }
}
