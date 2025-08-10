import { isString } from '@injected/isomorphic/stringUtils';
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
import { asLocator } from '@injected/isomorphic/locatorGenerators';
import { Frame, FrameLocator } from './frame';
import { testIdAttributeName } from './frameUtils';
import {
  Rect,
  TimeoutOptions,
  ClickOptions,
  SelectOption,
  SelectOptionOptions,
  CommonActionOptions,
  WaitForElementOptions,
  FrameDragAndDropOptions,
} from './types';
import { ElementHandle } from './elementHandle';
import { executeWithProgress } from './progress';
import type { FilePayload } from '@shared/utils/fileInputTypes';
import {
  executeProgressElementOperation,
  buildSelectorWithOptions,
  createAndSelector,
  createOrSelector,
  validateSameFrame,
  createFirstSelector,
  createLastSelector,
  createNthSelector,
  createDragAndDropFrameError,
  createChainedSelector,
  createInternalChainSelector,
  createFrameLocatorSelector,
} from './locatorUtils';

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
  private _description?: string;

  constructor(frame: Frame, selector: string, options?: LocatorOptions) {
    this._frame = frame;
    this._selector = options ? buildSelectorWithOptions(selector, options, frame) : selector;
  }

  _equals(locator: Locator) {
    return this._frame === locator._frame && this._selector === locator._selector;
  }

  page() {
    return this._frame.frameManager.page;
  }

  private async _withElement<R>(
    task: (handle: ElementHandle) => Promise<R>,
    options: { title: string; internal?: boolean; timeout?: number },
  ): Promise<R> {
    return executeWithProgress(
      async progress => {
        // Use 'attached' state instead of default 'visible' so we can operate on hidden elements
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
          state: 'attached',
        });

        if (!handle) {
          throw new Error(`Element not found for selector: ${this._selector}`);
        }

        try {
          return await task(handle);
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
        // Use 'attached' state instead of default 'visible' so we can operate on hidden elements
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
          state: 'attached',
        });

        if (!handle) {
          throw new Error(`Element not found for selector: ${this._selector}`);
        }

        try {
          const method = handle[methodName] as (...args: unknown[]) => Promise<T>;
          const result = await method.apply(handle, args);

          return result;
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

  async check(options?: {
    force?: boolean;
    position?: { x: number; y: number };
    timeout?: number;
  }): Promise<void> {
    return this._executeElementMethod<void>('check', options);
  }

  async uncheck(options?: {
    force?: boolean;
    position?: { x: number; y: number };
    timeout?: number;
  }): Promise<void> {
    return this._executeElementMethod<void>('uncheck', options);
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

  /**
   * Set files on an input element.
   * Similar to Playwright's Locator.setInputFiles method.
   *
   * @example
   * ```typescript
   * await locator.setInputFiles([file1, file2]);
   *
   * await locator.setInputFiles([
   *   { name: 'data.json', mimeType: 'application/json', buffer: jsonBuffer }
   * ]);
   * ```
   */
  async setInputFiles(
    files: FilePayload[] | File[],
    options?: { force?: boolean; directoryUpload?: boolean; timeout?: number },
  ): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._setInputFiles(progress, files, options),
      'Set input files',
      options?.timeout,
    );
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

  async tap(options?: ClickOptions): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (h, progress) => h._tap(progress, options),
      'Tap',
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

  /**
   * Perform a drag and drop operation from this locator to the target locator.
   *
   * @param target The target locator to drop the element onto
   * @param options Optional drag and drop configuration
   * @returns Promise that resolves when drag and drop is complete
   *
   * @example
   * ```typescript
   * const source = page.locator('#draggable-item');
   * const target = page.locator('#drop-zone');
   *
   * // Basic drag and drop
   * await source.dragTo(target);
   *
   * // With custom positions and options
   * await source.dragTo(target, {
   *   sourcePosition: { x: 10, y: 10 },
   *   targetPosition: { x: 50, y: 50 },
   *   timeout: 10000
   * });
   * ```
   */
  async dragTo(
    target: Locator,
    options: FrameDragAndDropOptions & { timeout?: number } = {},
  ): Promise<void> {
    // Check if both locators are on the same frame
    if (this._frame !== target._frame) {
      throw createDragAndDropFrameError();
    }

    return await this._frame.dragAndDrop(this._selector, target._selector, {
      strict: true,
      ...options,
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

  locator(selectorOrLocator: string | Locator, options?: Omit<LocatorOptions, 'visible'>): Locator {
    if (isString(selectorOrLocator))
      return new Locator(
        this._frame,
        createChainedSelector(this._selector, selectorOrLocator),
        options,
      );

    validateSameFrame(this._frame, selectorOrLocator._frame, 'locator');

    return new Locator(
      this._frame,
      createInternalChainSelector(this._selector, selectorOrLocator._selector),
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
    return new FrameLocator(this._frame, createFrameLocatorSelector(this._selector, selector));
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
    // Metadata-only: do not alter selector string to avoid changing world resolution.
    const locator = new Locator(this._frame, this._selector);
    locator._description = description;
    return locator;
  }

  first(): Locator {
    return new Locator(this._frame, createFirstSelector(this._selector));
  }

  last(): Locator {
    return new Locator(this._frame, createLastSelector(this._selector));
  }

  nth(index: number): Locator {
    return new Locator(this._frame, createNthSelector(this._selector, index));
  }

  get description(): string | undefined {
    return this._description;
  }

  and(locator: Locator): Locator {
    validateSameFrame(this._frame, locator._frame, 'and');
    const newSelector = createAndSelector(this._selector, locator._selector);
    return new Locator(this._frame, newSelector);
  }

  or(locator: Locator): Locator {
    validateSameFrame(this._frame, locator._frame, 'or');
    const newSelector = createOrSelector(this._selector, locator._selector);
    return new Locator(this._frame, newSelector);
  }

  // #region Simple Element Operations for Locator

  /**
   * Get text content of the first matching element
   */
  async getTextContent(): Promise<string> {
    const result = await this._executeElementMethod<string>('getTextContent');
    return result;
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
   * Select option(s) in the first matching select element
   *
   * @example
   * // Select by value
   * await locator.selectOption('option-value');
   * await locator.selectOption(['value1', 'value2']); // Multiple selection
   *
   * // Select by label text
   * await locator.selectOption({ label: 'Option Label' });
   *
   * // Select by index
   * await locator.selectOption({ index: 0 });
   */
  async selectOption(
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions,
  ): Promise<string[]> {
    return this._executeElementMethod<string[]>('selectOption', values, options);
  }

  /**
   * Selects all text content within the first matching element.
   * For input/textarea elements, this will select all text in the field.
   * For other elements, this will select all text content within the element.
   *
   * @param options Action options including timeout and force
   * @returns Promise that resolves when text selection is complete
   */
  async selectText(options?: CommonActionOptions): Promise<void> {
    return executeProgressElementOperation(
      this._selector,
      this._frame,
      async (handle, progress) => {
        await handle.selectTextWithProgress(progress, options);
        return 'done';
      },
      'SelectText',
      options?.timeout,
    );
  }

  /**
   * Set text content of the first matching element
   */
  async setTextContent(text: string): Promise<void> {
    return this._executeElementMethod<void>('setTextContent', text);
  }

  /**
   * Set checked state of the first matching input element by calling check() or uncheck()
   */
  async setChecked(
    checked: boolean,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    if (checked) {
      await this.check(options);
    } else {
      await this.uncheck(options);
    }
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
   * Check if the first matching element is hidden
   */
  async isHidden(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isHidden');
  }

  /**
   * Check if the first matching element is enabled
   */
  async isEnabled(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isEnabled');
  }

  /**
   * Check if the first matching element is disabled
   */
  async isDisabled(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isDisabled');
  }

  /**
   * Check if the first matching element is editable
   */
  async isEditable(): Promise<boolean> {
    return this._executeElementMethod<boolean>('isEditable');
  }

  /**
   * Focus the first matching element
   */
  async focus(): Promise<void> {
    return this._executeElementMethod<void>('focus');
  }

  /**
   * Hover over the first matching element
   */
  async hover(): Promise<void> {
    return this._executeElementMethod<void>('hover');
  }

  /**
   * Press a key on the first matching element
   */
  async press(key: string, options: { delay?: number; timeout?: number } = {}): Promise<void> {
    return this._executeElementMethod<void>('press', key, options);
  }

  /**
   * Type text into the first matching element
   */
  async type(text: string, options: { delay?: number; timeout?: number } = {}): Promise<void> {
    return this._executeElementMethod<void>('type', text, options);
  }

  /**
   * Get the innerHTML of the first matching element
   */
  async innerHTML(): Promise<string> {
    return this._executeElementMethod<string>('innerHTML');
  }

  /**
   * Get the innerText of the first matching element
   */
  async innerText(): Promise<string> {
    return this._executeElementMethod<string>('innerText');
  }

  /**
   * Get the textContent of the first matching element
   */
  async textContent(): Promise<string> {
    const result = await this._executeElementMethod<string>('textContent');
    return result;
  }

  /**
   * Get the input value of the first matching element
   */
  async inputValue(): Promise<string> {
    return this._executeElementMethod<string>('inputValue');
  }

  /**
   * Generate an ARIA snapshot for the first matching element.
   *
   * @param options Configuration options for the ARIA snapshot
   * @param options.forAI Whether to optimize the snapshot for AI consumption (default: true)
   * @param options.refPrefix Prefix to use for element references in the snapshot (default: '')
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: 30000)
   * @returns A string representation of the ARIA accessibility tree for the element
   *
   * @example
   * ```typescript
   * // Get ARIA snapshot of a form element
   * const formLocator = page.locator('#registration-form');
   * const snapshot = await formLocator.ariaSnapshot({
   *   forAI: true,
   *   refPrefix: 'form'
   * });
   * ```
   */
  async ariaSnapshot(options?: {
    forAI?: boolean;
    refPrefix?: string;
    timeout?: number;
  }): Promise<string> {
    const forAI = options?.forAI ?? true;
    const refPrefix = options?.refPrefix ?? '';
    const timeout = options?.timeout ?? 30000;

    return executeWithProgress(
      async progress => {
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
        });

        if (!handle) {
          throw new Error(`Element not found for selector: ${this._selector}`);
        }

        try {
          return await handle.ariaSnapshot({ forAI, refPrefix, timeout });
        } finally {
          handle.dispose();
        }
      },
      { timeout },
    );
  }

  /**
   * Scroll the first matching element into view if needed.
   * This method scrolls the page to ensure the element is visible in the viewport.
   *
   * @param options Configuration options for the scroll operation
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: 30000)
   *
   * @example
   * ```typescript
   * const element = page.locator('#submit-button');
   * await element.scrollIntoViewIfNeeded();
   * ```
   */
  async scrollIntoViewIfNeeded(options: TimeoutOptions = {}): Promise<void> {
    const timeout = options?.timeout ?? 30000;

    return executeWithProgress(
      async progress => {
        const handle = await this._frame.waitForSelector(progress, this._selector, false, {
          strict: true,
        });

        if (!handle) {
          throw new Error(`Element not found for selector: ${this._selector}`);
        }

        try {
          await handle.scrollIntoViewIfNeeded({ timeout });
        } finally {
          handle.dispose();
        }
      },
      { timeout },
    );
  }

  /**
   * Wait for the locator to match an element in the given state.
   * This method waits for the element to be attached, visible, hidden, or detached based on the state option.
   *
   * @param options Configuration options for the wait operation
   * @param options.state The state to wait for: 'attached', 'detached', 'visible', or 'hidden' (default: 'visible')
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: 30000)
   *
   * @example
   * ```typescript
   * const element = page.locator('#submit-button');
   *
   * // Wait for element to be visible (default)
   * await element.waitFor();
   *
   * // Wait for element to be attached but possibly hidden
   * await element.waitFor({ state: 'attached' });
   *
   * // Wait for element to be hidden
   * await element.waitFor({ state: 'hidden' });
   *
   * // Wait for element to be detached (removed from DOM)
   * await element.waitFor({ state: 'detached' });
   * ```
   */
  waitFor(
    options: WaitForElementOptions & TimeoutOptions & { state: 'attached' | 'visible' },
  ): Promise<void>;
  waitFor(options?: WaitForElementOptions & TimeoutOptions): Promise<void>;
  async waitFor(options?: WaitForElementOptions & TimeoutOptions): Promise<void> {
    const state = options?.state ?? 'visible';
    const timeout = options?.timeout ?? 30000;

    return executeWithProgress(
      async progress => {
        await this._frame.waitForSelector(progress, this._selector, true, {
          strict: true,
          omitReturnValue: true,
          state,
          ...options,
        });
      },
      { timeout },
    );
  }

  /**
   * Private inspection method for debugging and development tools.
   * Returns the string representation of this locator.
   */
  private _inspect(): string {
    return this.toString();
  }

  /**
   * Returns a string representation of the locator in JavaScript format.
   * This can be useful for debugging, logging, or generating test code.
   *
   * @returns A string representation of the locator
   *
   * @example
   * ```typescript
   * const locator = page.locator('#submit-button');
   * console.log(locator.toString()); // "page.locator('#submit-button')"
   * ```
   */
  toString(): string {
    return asLocator('javascript', this._selector);
  }

  // #endregion Simple Element Operations for Locator
}
