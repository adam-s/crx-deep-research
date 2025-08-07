import { escapeForTextSelector } from '@injected/isomorphic/stringUtils';
import { Frame } from './frame';
import { Rect, TimeoutOptions, ClickOptions } from './types';
import { ElementHandle } from './elementHandle';
import { executeWithProgress, Progress } from './progress';
import { OperationResult, STANDARD_TIMEOUT } from './utils';

// #region Helper Functions

/**
 * Execute progress-based operation with element handle
 */
async function executeProgressElementOperation(
  selector: string,
  frame: Frame,
  operation: (handle: ElementHandle, progress: Progress) => Promise<OperationResult>,
  operationName: string,
  timeout?: number,
): Promise<void> {
  return executeWithProgress(
    async progress => {
      const handle = await frame.waitForSelector(progress, selector, false, {
        strict: true,
      });

      if (!handle) {
        throw new Error(`Element not found for selector: ${selector}`);
      }

      try {
        const result = await operation(handle, progress);
        if (result !== 'done') {
          throw new Error(`${operationName} failed: ${result}`);
        }
      } finally {
        handle.dispose();
      }
    },
    { timeout: timeout || STANDARD_TIMEOUT },
  );
}

export type LocatorOptions = {
  hasText?: string | RegExp;
  hasNotText?: string | RegExp;
  has?: Locator;
  hasNot?: Locator;
  visible?: boolean;
};

export class Locator {
  _frame: Frame;
  _selector: string;

  constructor(frame: Frame, selector: string, options?: LocatorOptions) {
    this._frame = frame;
    this._selector = selector;

    if (options?.hasText)
      this._selector += ` >> internal:has-text=${escapeForTextSelector(options.hasText, false)}`;

    if (options?.hasNotText)
      this._selector += ` >> internal:has-not-text=${escapeForTextSelector(options.hasNotText, false)}`;

    if (options?.has) {
      const locator = options.has;
      if (locator._frame !== frame)
        throw new Error(`Inner "has" locator must belong to the same frame.`);
      this._selector += ` >> internal:has=` + JSON.stringify(locator._selector);
    }

    if (options?.hasNot) {
      const locator = options.hasNot;
      if (locator._frame !== frame)
        throw new Error(`Inner "hasNot" locator must belong to the same frame.`);
      this._selector += ` >> internal:has-not=` + JSON.stringify(locator._selector);
    }

    if (options?.visible !== undefined)
      this._selector += ` >> visible=${options.visible ? 'true' : 'false'}`;
  }

  _equals(locator: Locator) {
    return this._frame === locator._frame && this._selector === locator._selector;
  }

  page() {
    return this._frame.frameManager.page;
  }

  private async _withElement<R>(
    task: (handle: ElementHandle, timeout?: number) => Promise<R>,
    options: { title: string; internal?: boolean; timeout?: number },
  ): Promise<R> {
    return executeWithProgress(
      async progress => {
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
        });

        if (!handle) {
          throw new Error(`Element not found for selector: ${this._selector}`);
        }

        try {
          // Use the ElementHandle directly - no need to recreate it
          return await task(handle, options.timeout);
        } finally {
          handle.dispose();
        }
      },
      { timeout: options.timeout },
    );
  }

  async boundingBox(options?: TimeoutOptions): Promise<Rect | null> {
    return await this._withElement(h => h.boundingBox(), {
      title: 'Bounding box',
      timeout: options?.timeout,
    });
  }

  async check(): Promise<void> {
    return await this._withElement(h => h.check(), {
      title: 'Check',
      timeout: 30000,
    });
  }

  async uncheck(): Promise<void> {
    return await this._withElement(h => h.uncheck(), {
      title: 'Uncheck',
      timeout: 30000,
    });
  }

  async click(options?: ClickOptions): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._click(progress, options),
      'Click',
      options?.timeout,
    );
  }

  async dblclick(options?: ClickOptions): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._dblclick(progress, options),
      'Double Click',
      options?.timeout,
    );
  }

  async dispatchEvent(
    type: string,
    eventInit: Record<string, unknown> = {},
    options?: { timeout?: number },
  ): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._dispatchEvent(progress, type, eventInit),
      'Dispatch Event',
      options?.timeout,
    );
  }

  async evaluate<R, Arg>(
    pageFunction: (element: Element, arg: Arg) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<R> {
    return await this._withElement(h => h.evaluate(pageFunction, arg, options), {
      title: 'Evaluate',
      timeout: options?.timeout || 30000,
    });
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
    return await this._withElement(h => h.evaluateHandle(pageFunction, arg, options), {
      title: 'EvaluateHandle',
      timeout: options?.timeout || 30000,
    });
  }
}
