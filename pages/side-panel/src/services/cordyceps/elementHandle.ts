import { Disposable } from 'vs/base/common/lifecycle';
import type { FrameExecutionContext } from './frameExecutionContext';
import { Rect, WaitForElementOptions, ClickOptions } from './types';
import { Progress, executeWithProgress } from './progress';
import { Frame } from './frame';
import {
  throwRetargetableDOMError,
  throwElementIsNotAttached,
  handleOperationResult,
  OperationResult,
  STANDARD_TIMEOUT,
} from './utils';
import { ElementAction, executeElementOp } from './elementOperations';

// #region Helper Functions

/**
 * Helper function to validate element handle operation results
 */
function validateElementOperationResult(result: OperationResult, operation: string): void {
  handleOperationResult(result, operation);
}

/**
 * Execute element operation with standard error handling
 */
async function executeElementOperation(
  operation: (progress: Progress) => Promise<OperationResult>,
  operationName: string,
  timeout: number = STANDARD_TIMEOUT,
): Promise<void> {
  return executeWithProgress(
    async progress => {
      const result = await operation(progress);
      validateElementOperationResult(result, operationName);
    },
    { timeout },
  );
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
    return executeElementOperation(
      async progress => await this._setChecked(progress, true),
      'Check',
    );
  }

  async uncheck(): Promise<void> {
    return executeElementOperation(
      async progress => await this._setChecked(progress, false),
      'Uncheck',
    );
  }

  async click(): Promise<void> {
    return executeElementOperation(async progress => await this._click(progress), 'Click');
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
    return executeElementOperation(
      async progress => await this._dblclick(progress, options),
      'Double click',
      options?.timeout,
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
    return executeElementOperation(
      async progress => await this._dispatchEvent(progress, type, eventInit),
      'Dispatch event',
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

  async fill(value: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    return executeElementOperation(
      async progress => await this._fill(progress, value, options),
      'Fill',
      options?.timeout,
    );
  }

  async fillWithProgress(
    progress: Progress,
    value: string,
    options?: { force?: boolean },
  ): Promise<void> {
    const result = await this._fill(progress, value, options);
    if (result !== 'done') {
      throw new Error(`Fill failed: ${result}`);
    }
  }

  async _fill(
    progress: Progress,
    value: string,
    options?: { force?: boolean },
  ): Promise<'error:notconnected' | 'done'> {
    progress.log(`  fill("${value}")`);

    // Create a function to fill the element
    const fillElement = (handle: string, fillValue: string, force: boolean) => {
      const injected = window.__cordyceps_handledInjectedScript;
      const element = injected.getElementByHandle(handle);
      if (!element) {
        throw new Error('Element not found for handle');
      }

      const inputElement = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

      // Check if element is editable unless force is true
      if (!force) {
        // Check if element is visible
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          throw new Error('Element is not visible');
        }

        // Check if element is enabled
        if ('disabled' in inputElement && inputElement.disabled) {
          throw new Error('Element is disabled');
        }

        // Check if element is editable
        if ('readOnly' in inputElement && inputElement.readOnly) {
          throw new Error('Element is readonly');
        }
      }

      // Focus the element first
      inputElement.focus();

      // Clear existing value and set new value
      if ('value' in inputElement) {
        inputElement.value = fillValue;

        // Trigger input events to simulate user typing
        const inputEvent = new Event('input', { bubbles: true });
        const changeEvent = new Event('change', { bubbles: true });

        inputElement.dispatchEvent(inputEvent);
        inputElement.dispatchEvent(changeEvent);

        return 'done';
      } else {
        throw new Error('Element is not fillable');
      }
    };

    try {
      const result = await progress.race(
        this._context.executeScript(
          fillElement,
          'ISOLATED',
          this.remoteObject,
          value,
          options?.force || false,
        ),
      );
      return result === 'done' ? 'done' : 'error:notconnected';
    } catch (error) {
      console.error('Fill operation failed:', error);
      return 'error:notconnected';
    }
  }

  async clear(options?: { timeout?: number; force?: boolean }): Promise<void> {
    return this.fill('', { ...options });
  }

  async clearWithProgress(progress: Progress, options?: { force?: boolean }): Promise<void> {
    return this.fillWithProgress(progress, '', options);
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

  // #region Simple Element Operations

  /**
   * Execute element operation with standard wrapper
   * This reduces repetition across all element operation methods
   */
  private async _executeElementOp<T>(action: ElementAction): Promise<T> {
    return await executeWithProgress(
      async () => {
        const result = await this._context.executeScript(
          executeElementOp,
          'ISOLATED',
          this.remoteObject,
          action,
        );
        return result as T;
      },
      { timeout: STANDARD_TIMEOUT },
    );
  }

  /**
   * Get text content - simple and clean
   * Replaces: await handle.evaluate(el => el.textContent)
   * With: await handle.getTextContent()
   */
  async getTextContent(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'textContent' });
  }

  /**
   * Get inner text - simple and clean
   * Replaces: await handle.evaluate(el => el.innerText)
   * With: await handle.getInnerText()
   */
  async getInnerText(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'innerText' });
  }

  /**
   * Get input value - simple and clean
   * Replaces: await handle.evaluate(el => el.value)
   * With: await handle.getValue()
   */
  async getValue(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'value' });
  }

  /**
   * Check if input is checked - simple and clean
   * Replaces: await handle.evaluate(el => el.checked)
   * With: await handle.isChecked()
   */
  async isChecked(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'checked' });
  }

  /**
   * Get tag name - simple and clean
   * Replaces: await handle.evaluate(el => el.tagName)
   * With: await handle.getTagName()
   */
  async getTagName(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'tagName' });
  }

  /**
   * Get inner HTML - simple and clean
   * Replaces: await handle.evaluate(el => el.innerHTML)
   * With: await handle.getInnerHTML()
   */
  async getInnerHTML(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'innerHTML' });
  }

  /**
   * Get outer HTML - simple and clean
   * Replaces: await handle.evaluate(el => el.outerHTML)
   * With: await handle.getOuterHTML()
   */
  async getOuterHTML(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'outerHTML' });
  }

  /**
   * Get class name - simple and clean
   * Replaces: await handle.evaluate(el => el.className)
   * With: await handle.getClassName()
   */
  async getClassName(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'className' });
  }

  /**
   * Get element ID - simple and clean
   * Replaces: await handle.evaluate(el => el.id)
   * With: await handle.getId()
   */
  async getId(): Promise<string> {
    return this._executeElementOp<string>({ op: 'get', prop: 'id' });
  }

  /**
   * Set input value - simple and clean
   * Replaces: await handle.evaluate((el, value) => { el.value = value; }, newValue)
   * With: await handle.setValue(newValue)
   */
  async setValue(value: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'set', prop: 'value', value });
  }

  /**
   * Set text content - simple and clean
   * Replaces: await handle.evaluate((el, text) => { el.textContent = text; }, newText)
   * With: await handle.setTextContent(newText)
   */
  async setTextContent(text: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'set', prop: 'textContent', value: text });
  }

  /**
   * Set checked state - simple and clean
   * Replaces: await handle.evaluate((el, checked) => { el.checked = checked; }, newState)
   * With: await handle.setChecked(newState)
   */
  async setChecked(checked: boolean): Promise<void> {
    await this._executeElementOp<void>({ op: 'set', prop: 'checked', value: checked });
  }

  /**
   * Get attribute value - simple and clean
   * Replaces: await handle.evaluate(el => el.getAttribute('name'))
   * With: await handle.getAttribute('name')
   */
  async getAttribute(name: string): Promise<string | null> {
    return this._executeElementOp<string | null>({ op: 'attr', name });
  }

  /**
   * Set attribute value - simple and clean
   * Replaces: await handle.evaluate((el, name, value) => { el.setAttribute(name, value); }, 'id', '123')
   * With: await handle.setAttribute('id', '123')
   */
  async setAttribute(name: string, value: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'attr', name, value });
  }

  /**
   * Remove attribute - simple and clean
   * Replaces: await handle.evaluate((el, name) => { el.removeAttribute(name); }, 'disabled')
   * With: await handle.removeAttribute('disabled')
   */
  async removeAttribute(name: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'attr', name, value: null });
  }

  /**
   * Check if element has attribute - simple and clean
   * Replaces: await handle.evaluate(el => el.hasAttribute('disabled'))
   * With: await handle.hasAttribute('disabled')
   */
  async hasAttribute(name: string): Promise<boolean> {
    return await executeWithProgress(
      async () => {
        const result = await this.getAttribute(name);
        return result !== null;
      },
      { timeout: STANDARD_TIMEOUT },
    );
  }

  /**
   * Check if element has CSS class - simple and clean
   * Replaces: await handle.evaluate(el => el.classList.contains('active'))
   * With: await handle.hasClass('active')
   */
  async hasClass(className: string): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'class', name: className, action: 'has' });
  }

  /**
   * Add CSS class - simple and clean
   * Replaces: await handle.evaluate((el, cls) => { el.classList.add(cls); }, 'active')
   * With: await handle.addClass('active')
   */
  async addClass(className: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'class', name: className, action: 'add' });
  }

  /**
   * Remove CSS class - simple and clean
   * Replaces: await handle.evaluate((el, cls) => { el.classList.remove(cls); }, 'active')
   * With: await handle.removeClass('active')
   */
  async removeClass(className: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'class', name: className, action: 'remove' });
  }

  /**
   * Toggle CSS class - simple and clean
   * Replaces: await handle.evaluate((el, cls) => { el.classList.toggle(cls); }, 'active')
   * With: await handle.toggleClass('active')
   */
  async toggleClass(className: string): Promise<void> {
    await this._executeElementOp<void>({ op: 'class', name: className, action: 'toggle' });
  }

  /**
   * Get bounding rectangle - simple and clean
   * Replaces: await handle.evaluate(el => el.getBoundingClientRect())
   * With: await handle.getBoundingRect()
   */
  async getBoundingRect(): Promise<DOMRect> {
    return this._executeElementOp<DOMRect>({ op: 'rect' });
  }

  /**
   * Check if element is visible - simple and clean
   * Replaces: await handle.evaluate(el => { const rect = el.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; })
   * With: await handle.isVisible()
   */
  async isVisible(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isVisible' });
  }

  /**
   * Check if element is enabled - simple and clean
   * Replaces: await handle.evaluate(el => !el.disabled)
   * With: await handle.isEnabled()
   */
  async isEnabled(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isEnabled' });
  }

  /**
   * Check if element is focused - simple and clean
   * Replaces: await handle.evaluate(el => document.activeElement === el)
   * With: await handle.isFocused()
   */
  async isFocused(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isFocused' });
  }

  /**
   * Focus element - simple and clean
   * Replaces: await handle.evaluate(el => el.focus())
   * With: await handle.focus()
   */
  async focus(): Promise<void> {
    await this._executeElementOp<void>({ op: 'action', name: 'focus' });
  }

  /**
   * Blur element - simple and clean
   * Replaces: await handle.evaluate(el => el.blur())
   * With: await handle.blur()
   */
  async blur(): Promise<void> {
    await this._executeElementOp<void>({ op: 'action', name: 'blur' });
  }

  /**
   * Click element (DOM click) - simple and clean
   * Replaces: await handle.evaluate(el => el.click())
   * With: await handle.clickElement()
   */
  async clickElement(): Promise<void> {
    await this._executeElementOp<void>({ op: 'action', name: 'click' });
  }

  /**
   * Hover element - dispatches mouseover/mouseenter/mousemove
   * Mirrors Playwright's hover semantics at a basic level.
   */
  async hover(): Promise<void> {
    await this._executeElementOp<void>({ op: 'action', name: 'hover' });
  }

  /**
   * Press a key on the focused element. Focuses first if needed.
   * Basic implementation: dispatches keydown / keypress (printable) / keyup and updates value for simple characters.
   */
  async press(key: string, options: { delay?: number } = {}): Promise<void> {
    await executeWithProgress(
      async progress => {
        // Ensure focus
        await this.focus();
        const isPrintable = key.length === 1;
        const dispatch = async (type: string) => {
          const result = await this._context.executeScript(
            (handle: string, eventType: string, keyValue: string, printable: boolean): void => {
              const injected = (
                window as unknown as {
                  __cordyceps_handledInjectedScript?: {
                    getElementByHandle: (h: string) => Element | null;
                  };
                }
              ).__cordyceps_handledInjectedScript;
              if (!injected) throw new Error('Injected script not found');
              const el = injected.getElementByHandle(handle) as HTMLElement | null;
              if (!el) throw new Error('Element not found');
              const eventInit: KeyboardEventInit = {
                key: keyValue,
                bubbles: true,
                cancelable: true,
              };
              const ev = new KeyboardEvent(eventType, eventInit);
              el.dispatchEvent(ev);
              if (printable && eventType === 'keypress') {
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                  el.value += keyValue;
                  el.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }
            },
            'ISOLATED',
            this.remoteObject,
            type,
            key,
            isPrintable,
          );
          return result;
        };
        await dispatch('keydown');
        if (isPrintable) await dispatch('keypress');
        if (options.delay) await progress.race(new Promise(r => setTimeout(r, options.delay)));
        await dispatch('keyup');
      },
      { timeout: STANDARD_TIMEOUT },
    );
  }

  /** Convenience alias for getInnerHTML */
  async innerHTML(): Promise<string> {
    return this.getInnerHTML();
  }
  /** Convenience alias for getInnerText */
  async innerText(): Promise<string> {
    return this.getInnerText();
  }
  /** Convenience alias for getValue */
  async inputValue(): Promise<string> {
    return this.getValue();
  }
  /** Convenience alias for getAttribute */
  async attribute(name: string): Promise<string | null> {
    return this.getAttribute(name);
  }

  /** Whether element has disabled attribute or property true */
  async isDisabled(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'disabled' });
  }

  /** Whether element is hidden (inverse of isVisible) */
  async isHidden(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isHidden' });
  }

  /** Whether element is editable (contentEditable or enabled writable form control) */
  async isEditable(): Promise<boolean> {
    return this._executeElementOp<boolean>({ op: 'get', prop: 'isEditable' });
  }

  // #endregion Simple Element Operations

  /**
   * @deprecated Use type-safe methods instead of evaluate()
   * This method is kept for backward compatibility but should be replaced with
   * specific type-safe methods like getProperty(), setProperty(), getAttribute(), etc.
   */
  async evaluate<R, Arg>(
    pageFunction: (element: Element, arg: Arg) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<R> {
    console.warn(
      'ElementHandle.evaluate() is deprecated. Use type-safe methods like getProperty(), setProperty(), getAttribute(), etc. instead.',
    );

    return await executeWithProgress(
      async () => {
        // For Chrome extensions, we need to handle common evaluation patterns
        // Since we can't use eval() or new Function(), we need predefined functions

        // Create a wrapper that gets the element and applies a predefined operation
        const evaluateElement = (handle: string, operation: string, ...args: unknown[]) => {
          const injected = window.__cordyceps_handledInjectedScript;
          const element = injected.getElementByHandle(handle);
          if (!element) {
            throw new Error('Element not found for handle');
          }

          // Handle common evaluation patterns
          switch (operation) {
            case 'tagName':
              return element.tagName;
            case 'textContent':
              return element.textContent;
            case 'innerHTML':
              return element.innerHTML;
            case 'outerHTML':
              return element.outerHTML;
            case 'className':
              return element.className;
            case 'id':
              return element.id;
            case 'value':
              return (element as HTMLInputElement).value;
            case 'checked':
              return (element as HTMLInputElement).checked;
            case 'disabled':
              return (element as HTMLInputElement).disabled;
            case 'href':
              return (element as HTMLAnchorElement).href;
            case 'src':
              return (element as HTMLImageElement).src;
            case 'innerText':
              return (element as HTMLElement).innerText;
            default: {
              // For unknown operations, try to apply the function directly
              // This is a fallback for when pattern detection fails
              try {
                // If we have an argument, call the function with element and arg
                if (args.length > 0) {
                  return (pageFunction as (element: Element, arg: unknown) => R)(element, args[0]);
                } else {
                  // Call the function with just the element
                  return (pageFunction as (element: Element) => R)(element);
                }
              } catch (error) {
                // If direct function call fails, return safe default
                return element.textContent as R;
              }
            }
          }
        };

        // Try to detect the operation from the function
        const funcStr = pageFunction.toString();
        let operation = 'unknown';

        // More flexible pattern matching that handles different parameter names
        if (funcStr.includes('.tagName')) {
          operation = 'tagName';
        } else if (funcStr.includes('.textContent')) {
          operation = 'textContent';
        } else if (funcStr.includes('.innerHTML')) {
          operation = 'innerHTML';
        } else if (funcStr.includes('.outerHTML')) {
          operation = 'outerHTML';
        } else if (funcStr.includes('.className')) {
          operation = 'className';
        } else if (funcStr.includes('.id')) {
          operation = 'id';
        } else if (funcStr.includes('.value')) {
          operation = 'value';
        } else if (funcStr.includes('.checked')) {
          operation = 'checked';
        } else if (funcStr.includes('.disabled')) {
          operation = 'disabled';
        } else if (funcStr.includes('.href')) {
          operation = 'href';
        } else if (funcStr.includes('.src')) {
          operation = 'src';
        } else if (funcStr.includes('.innerText')) {
          operation = 'innerText';
        }

        const result = await this._context.executeScript(
          evaluateElement,
          'ISOLATED',
          this.remoteObject,
          operation,
          arg,
        );
        return result as R;
      },
      { timeout: options?.timeout || STANDARD_TIMEOUT },
    );
  }

  /**
   * Generate an ARIA snapshot for this element.
   *
   * @param options Configuration options for the ARIA snapshot
   * @param options.forAI Whether to optimize the snapshot for AI consumption (default: true)
   * @param options.refPrefix Prefix to use for element references in the snapshot (default: '')
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: 30000)
   * @returns A string representation of the ARIA accessibility tree for this element
   *
   * @example
   * ```typescript
   * const buttonHandle = await page.locator('#submit-button').elementHandle();
   * const snapshot = await buttonHandle.ariaSnapshot({
   *   forAI: true,
   *   refPrefix: 'button'
   * });
   * buttonHandle.dispose();
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
      async () => {
        const result = await this._context.ariaSnapshot(forAI, refPrefix, 'ISOLATED', this);
        return typeof result === 'string' ? result : '';
      },
      { timeout },
    );
  }
}
