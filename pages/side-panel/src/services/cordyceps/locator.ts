import { escapeForTextSelector, isString } from '@injected/isomorphic/stringUtils';
import {
  getByTestIdSelector,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByTextSelector,
  getByTitleSelector,
  ByRoleOptions,
  getByRoleSelector,
} from '@injected/isomorphic/locatorUtils';
import { Frame, FrameLocator, testIdAttributeName } from './frame';
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

  /**
   * Execute an element method with clean error handling and progress tracking
   */
  private async _executeElementMethod<T>(
    methodName: keyof ElementHandle,
    ...args: unknown[]
  ): Promise<T> {
    return executeWithProgress(
      async progress => {
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
        });

        if (!handle) {
          throw new Error(`Element not found for selector: ${this._selector}`);
        }

        try {
          const method = handle[methodName] as (...args: unknown[]) => Promise<T>;
          return await method.apply(handle, args);
        } finally {
          handle.dispose();
        }
      },
      { timeout: 30000 },
    );
  }

  async boundingBox(options?: TimeoutOptions): Promise<Rect | null> {
    return await this._withElement(h => h.boundingBox(), {
      title: 'Bounding box',
      timeout: options?.timeout,
    });
  }

  async check(): Promise<void> {
    return this._executeElementMethod<void>('check');
  }

  async uncheck(): Promise<void> {
    return this._executeElementMethod<void>('uncheck');
  }

  async fill(value: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    return await this._withElement(h => h.fill(value, options), {
      title: 'Fill',
      timeout: options?.timeout || 30000,
    });
  }

  async clear(options?: { timeout?: number; force?: boolean }): Promise<void> {
    return await this._withElement(h => h.clear(options), {
      title: 'Clear',
      timeout: options?.timeout || 30000,
    });
  }

  async highlight(options?: { timeout?: number }): Promise<void> {
    return await executeWithProgress(
      async () => {
        await this._frame.context.highlight(this._selector);
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async hideHighlight(): Promise<void> {
    return await executeWithProgress(
      async () => {
        await this._frame.context.hideHighlight();
      },
      { timeout: 30000 },
    );
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

  locator(selectorOrLocator: string | Locator, options?: Omit<LocatorOptions, 'visible'>): Locator {
    if (isString(selectorOrLocator))
      return new Locator(this._frame, this._selector + ' >> ' + selectorOrLocator, options);
    if (selectorOrLocator._frame !== this._frame)
      throw new Error(`Locators must belong to the same frame.`);
    return new Locator(
      this._frame,
      this._selector + ' >> internal:chain=' + JSON.stringify(selectorOrLocator._selector),
      options,
    );
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(testIdAttributeName(), testId));
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTitleSelector(text, options));
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.locator(getByRoleSelector(role, options));
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(this._frame, this._selector + ' >> ' + selector);
  }

  filter(options?: LocatorOptions): Locator {
    return new Locator(this._frame, this._selector, options);
  }

  async elementHandle(options?: TimeoutOptions): Promise<ElementHandle> {
    return await executeWithProgress(
      async progress => {
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
          state: 'attached',
          ...options,
        });
        if (!handle) {
          throw new Error(`Element not found for selector: ${this._selector}`);
        }
        return handle;
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async elementHandles(): Promise<ElementHandle[]> {
    return await executeWithProgress(
      async () => {
        // Use the frame's context to get all elements matching the selector
        const handles = await this._frame.context.querySelectorAll(
          this._selector,
          undefined, // no root element handle
          'ISOLATED',
        );
        return handles || [];
      },
      { timeout: 30000 },
    );
  }

  async count(): Promise<number> {
    return await this._frame.selectors.queryCount(this._selector);
  }

  async all(): Promise<Locator[]> {
    const count = await this.count();
    return new Array(count).fill(0).map((_, i) => this.nth(i));
  }

  async allInnerTexts(): Promise<string[]> {
    return await executeWithProgress(
      async () => {
        const handles = await this.elementHandles();
        const texts: string[] = [];

        for (const handle of handles) {
          try {
            const text = await handle.getInnerText();
            texts.push(text || '');
          } finally {
            handle.dispose();
          }
        }

        return texts;
      },
      { timeout: 30000 },
    );
  }

  async allTextContents(): Promise<string[]> {
    return await executeWithProgress(
      async () => {
        const handles = await this.elementHandles();
        const texts: string[] = [];

        for (const handle of handles) {
          try {
            const text = await handle.getTextContent();
            texts.push(text || '');
          } finally {
            handle.dispose();
          }
        }

        return texts;
      },
      { timeout: 30000 },
    );
  }

  contentFrame(): FrameLocator {
    return new FrameLocator(this._frame, this._selector);
  }

  describe(description: string): Locator {
    return new Locator(
      this._frame,
      this._selector + ' >> internal:describe=' + JSON.stringify(description),
    );
  }

  first(): Locator {
    return new Locator(this._frame, this._selector + ' >> nth=0');
  }

  last(): Locator {
    return new Locator(this._frame, this._selector + ` >> nth=-1`);
  }

  nth(index: number): Locator {
    return new Locator(this._frame, this._selector + ` >> nth=${index}`);
  }

  and(locator: Locator): Locator {
    if (locator._frame !== this._frame) throw new Error(`Locators must belong to the same frame.`);
    return new Locator(
      this._frame,
      this._selector + ` >> internal:and=` + JSON.stringify(locator._selector),
    );
  }

  or(locator: Locator): Locator {
    if (locator._frame !== this._frame) throw new Error(`Locators must belong to the same frame.`);
    return new Locator(
      this._frame,
      this._selector + ` >> internal:or=` + JSON.stringify(locator._selector),
    );
  }

  // #region Simple Element Operations for Locator

  /**
   * Get text content of the first matching element
   */
  async getTextContent(): Promise<string> {
    return this._executeElementMethod<string>('getTextContent');
  }

  /**
   * Get inner text of the first matching element
   */
  async getInnerText(): Promise<string> {
    return this._executeElementMethod<string>('getInnerText');
  }

  /**
   * Get value of the first matching input element
   */
  async getValue(): Promise<string> {
    return this._executeElementMethod<string>('getValue');
  }

  /**
   * Check if the first matching input element is checked
   */
  async isChecked(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isChecked');
  }

  /**
   * Get tag name of the first matching element
   */
  async getTagName(): Promise<string> {
    return this._executeElementMethod<string>('getTagName');
  }

  /**
   * Set value of the first matching input element
   */
  async setValue(value: string): Promise<void> {
    return this._executeElementMethod<void>('setValue', value);
  }

  /**
   * Set text content of the first matching element
   */
  async setTextContent(text: string): Promise<void> {
    return this._executeElementMethod<void>('setTextContent', text);
  }

  /**
   * Set checked state of the first matching input element
   */
  async setChecked(checked: boolean): Promise<void> {
    return this._executeElementMethod<void>('setChecked', checked);
  }

  /**
   * Get attribute value of the first matching element
   */
  async getAttribute(name: string): Promise<string | null> {
    return this._executeElementMethod<string | null>('getAttribute', name);
  }

  /**
   * Set attribute value of the first matching element
   */
  async setAttribute(name: string, value: string): Promise<void> {
    return this._executeElementMethod<void>('setAttribute', name, value);
  }

  /**
   * Check if the first matching element has an attribute
   */
  async hasAttribute(name: string): Promise<boolean> {
    return this._executeElementMethod<boolean>('hasAttribute', name);
  }

  /**
   * Check if the first matching element has a CSS class
   */
  async hasClass(className: string): Promise<boolean> {
    return this._executeElementMethod<boolean>('hasClass', className);
  }

  /**
   * Check if the first matching element is visible
   */
  async isVisible(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isVisible');
  }

  /**
   * Check if the first matching element is enabled
   */
  async isEnabled(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isEnabled');
  }

  /**
   * Focus the first matching element
   */
  async focus(): Promise<void> {
    return this._executeElementMethod<void>('focus');
  }

  // #endregion Simple Element Operations for Locator
}
