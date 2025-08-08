export {}; // Ensure this file is treated as a module.

declare global {
  interface Window {
    ariaSnapshot(node: Node, options: { forAI: boolean; refPrefix: string }): string | boolean;
  }
}

import { generateUuid } from 'vs/base/common/uuid';
import { InjectedScript } from '@injected/injectedScript';
import type { ParsedSelector } from '@injected/isomorphic/selectorParser';
import type { SelectorEngine } from '@injected/selectorEngine';

/**
 * HandleManager is responsible for managing the bidirectional mapping between
 * DOM Elements and their UUID handles for safe serialization across contexts.
 *
 * This class encapsulates all handle lifecycle management, following the
 * Single Responsibility Principle.
 */
export class HandleManager {
  private readonly _elementCache = new Map<string, Element>();
  private readonly _elementToUuid = new WeakMap<Element, string>();

  /**
   * Gets or creates a UUID handle for a DOM Element.
   * Maintains bidirectional mapping for efficient lookups.
   */
  getHandleForElement(element: Element): string {
    let uuid = this._elementToUuid.get(element);

    if (!uuid) {
      uuid = generateUuid();
      this._elementCache.set(uuid, element);
      this._elementToUuid.set(element, uuid);
    }

    return uuid;
  }

  /**
   * Retrieves a DOM Element by its UUID handle.
   */
  getElementByHandle(handle: string): Element | undefined {
    return this._elementCache.get(handle);
  }

  /**
   * Converts an Element to its handle, or returns the value unchanged if not an Element.
   */
  convertElementToHandle(value: unknown): unknown {
    if (value instanceof Element) {
      return this.getHandleForElement(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.convertElementToHandle(item));
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      const converted: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        converted[key] = this.convertElementToHandle(val);
      }
      return converted;
    }

    return value;
  }

  /**
   * Converts a handle back to its Element, or returns the value unchanged if not a handle.
   */
  convertHandleToElement(value: unknown): unknown {
    if (typeof value === 'string' && this._elementCache.has(value)) {
      return this._elementCache.get(value);
    }

    if (Array.isArray(value)) {
      return value.map(item => this.convertHandleToElement(item));
    }

    if (value && typeof value === 'object' && value.constructor === Object) {
      const converted: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        converted[key] = this.convertHandleToElement(val);
      }
      return converted;
    }

    return value;
  }

  /**
   * Manually registers an Element with a specific handle (useful for testing).
   */
  registerElement(element: Element, handle?: string): string {
    const finalHandle = handle || generateUuid();

    // Remove any existing mapping for this element
    const existingHandle = this._elementToUuid.get(element);
    if (existingHandle) {
      this._elementCache.delete(existingHandle);
    }

    // Store the new mappings
    this._elementCache.set(finalHandle, element);
    this._elementToUuid.set(element, finalHandle);

    return finalHandle;
  }

  /**
   * Removes an Element and its handle from the cache.
   */
  unregisterElement(element: Element): boolean {
    const handle = this._elementToUuid.get(element);
    if (handle) {
      this._elementCache.delete(handle);
      this._elementToUuid.delete(element);
      return true;
    }
    return false;
  }

  /**
   * Removes a handle and its Element from the cache.
   */
  unregisterHandle(handle: string): boolean {
    const element = this._elementCache.get(handle);
    if (element) {
      this._elementCache.delete(handle);
      this._elementToUuid.delete(element);
      return true;
    }
    return false;
  }

  /**
   * Clears all cached Elements and handles.
   */
  clear(): void {
    this._elementCache.clear();
    // WeakMap doesn't have a clear method, but clearing strong references
    // allows weak references to be garbage collected
  }

  /**
   * Gets the number of cached Elements.
   */
  get cacheSize(): number {
    return this._elementCache.size;
  }
}

/**
 * HandledInjectedScript provides handle-based DOM interaction by wrapping InjectedScript.
 *
 * This class uses composition instead of inheritance to provide a modified interface
 * where querySelector and querySelectorAll return UUID handles instead of DOM Elements.
 * This design follows the composition-over-inheritance principle and provides clean
 * type safety without violating TypeScript's method override constraints.
 *
 * The class maintains compatibility with InjectedScript's API while enabling safe
 * serialization across different JavaScript contexts.
 */
export class HandledInjectedScript {
  private readonly _injectedScript: InjectedScript;
  private readonly _handleManager: HandleManager;

  constructor(
    window: Window & typeof globalThis,
    isUnderTest: boolean,
    sdkLanguage: 'javascript' | 'python' | 'java' | 'csharp',
    testIdAttributeNameForStrictErrorAndConsoleCodegen: string,
    stableRafCount: number,
    browserName: string,
    customEngines: { name: string; engine: SelectorEngine }[],
    handleManager?: HandleManager,
  ) {
    this._injectedScript = new InjectedScript(window, {
      isUnderTest,
      sdkLanguage,
      testIdAttributeName: testIdAttributeNameForStrictErrorAndConsoleCodegen,
      stableRafCount,
      browserName,
      customEngines: customEngines.map(engine => ({ name: engine.name, source: '' })),
    });

    this._handleManager = handleManager || new HandleManager();
  }

  // Delegate all non-overridden methods to the wrapped InjectedScript
  parseSelector(selector: string): ParsedSelector {
    return this._injectedScript.parseSelector(selector);
  }

  /**
   * Mark target elements for debugging/tracing purposes.
   * This method provides access to the underlying InjectedScript's markTargetElements functionality.
   */
  markTargetElements(markedElements: Set<Element>, callId: string): void {
    return this._injectedScript.markTargetElements(markedElements, callId);
  }

  /**
   * Perform a tap on an element by its handle.
   * This method handles the core tap logic using touch events.
   */
  tapElement(handle: string): { success: boolean; error?: string } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    try {
      const htmlElement = element as HTMLElement;

      // Get element center point for touch
      const rect = htmlElement.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;

      // Create and dispatch touch events
      const touchStartEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [
          new Touch({
            identifier: 0,
            target: htmlElement,
            clientX,
            clientY,
            pageX: clientX + window.pageXOffset,
            pageY: clientY + window.pageYOffset,
          }),
        ],
      });

      const touchEndEvent = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({
            identifier: 0,
            target: htmlElement,
            clientX,
            clientY,
            pageX: clientX + window.pageXOffset,
            pageY: clientY + window.pageYOffset,
          }),
        ],
      });

      htmlElement.dispatchEvent(touchStartEvent);
      htmlElement.dispatchEvent(touchEndEvent);

      // Also dispatch a click event for compatibility
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
      });
      htmlElement.dispatchEvent(clickEvent);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to tap element',
      };
    }
  }

  /**
   * Enhanced tap with position and options support.
   * This method handles advanced tapping with validation.
   */
  tapElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
    } = {},
  ): { success: boolean; error?: string; needsForce?: boolean } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    const htmlElement = element as HTMLElement;

    // Check if element is visible (unless forced)
    if (!options.force && !this._injectedScript.utils.isElementVisible(element)) {
      return {
        success: false,
        error: 'Element is not visible',
        needsForce: true,
      };
    }

    // Check if element is enabled (for form controls)
    if (!options.force && htmlElement.tagName) {
      const tagName = htmlElement.tagName.toLowerCase();
      if (['button', 'input', 'select', 'textarea'].includes(tagName)) {
        const formElement = htmlElement as
          | HTMLInputElement
          | HTMLButtonElement
          | HTMLSelectElement
          | HTMLTextAreaElement;
        if (formElement.disabled) {
          return {
            success: false,
            error: 'Element is disabled',
          };
        }
      }
    }

    try {
      const rect = htmlElement.getBoundingClientRect();
      // Use specified position or center of element
      const clientX = options.position
        ? rect.left + options.position.x
        : rect.left + rect.width / 2;
      const clientY = options.position ? rect.top + options.position.y : rect.top + rect.height / 2;

      // Create and dispatch touch events
      const touchStartEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [
          new Touch({
            identifier: 0,
            target: htmlElement,
            clientX,
            clientY,
            pageX: clientX + window.pageXOffset,
            pageY: clientY + window.pageYOffset,
          }),
        ],
      });

      const touchEndEvent = new TouchEvent('touchend', {
        bubbles: true,
        cancelable: true,
        changedTouches: [
          new Touch({
            identifier: 0,
            target: htmlElement,
            clientX,
            clientY,
            pageX: clientX + window.pageXOffset,
            pageY: clientY + window.pageYOffset,
          }),
        ],
      });

      htmlElement.dispatchEvent(touchStartEvent);
      htmlElement.dispatchEvent(touchEndEvent);

      // Also dispatch a click event for compatibility
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX,
        clientY,
      });
      htmlElement.dispatchEvent(clickEvent);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to tap element',
      };
    }
  }

  /**
   * Modified querySelector that returns a UUID handle instead of an Element.
   * This method matches the interface expected by FrameExecutionContext.
   *
   * @param parsedSelector - The parsed selector to query
   * @param root - The root element to search within
   * @param strict - Whether to enforce strict mode (single element match)
   * @returns UUID handle of the found element, or null if not found
   */
  querySelector(parsedSelector: unknown, root: Node, strict: boolean): string | null {
    const element = this._injectedScript.querySelector(
      parsedSelector as ParsedSelector,
      root,
      strict,
    );
    if (!element) {
      return null;
    }
    return this._handleManager.getHandleForElement(element);
  }

  /**
   * Modified querySelectorAll that returns UUID handles instead of Elements.
   *
   * @param parsedSelector - The parsed selector to query
   * @param root - The root element to search within
   * @returns Array of UUID handles for all found elements
   */
  querySelectorAll(parsedSelector: unknown, root: Node): string[] {
    const elements = this._injectedScript.querySelectorAll(parsedSelector as ParsedSelector, root);

    const handles = elements.map(element => this._handleManager.getHandleForElement(element));

    return handles;
  }

  /**
   * Captures an ARIA snapshot for an element specified by its handle.
   *
   * @param handle - The UUID handle of the element.
   * @returns A string representation of the ARIA tree, or undefined if the handle is invalid.
   */
  ariaSnapshot(node: Node, options: { forAI: boolean; refPrefix: string }): string | undefined {
    if (!node) {
      return undefined;
    }
    return this._injectedScript.ariaSnapshot(node, options);
  }

  /**
   * Provides access to the underlying HandleManager for advanced operations.
   */
  get handleManager(): HandleManager {
    return this._handleManager;
  }

  /**
   * Provides access to the underlying InjectedScript for methods not wrapped.
   */
  get injectedScript(): InjectedScript {
    return this._injectedScript;
  }

  get document(): Document {
    return this._injectedScript.document;
  }

  /**
   * Convenience method to get an Element by its handle.
   */
  getElementByHandle(handle: string): Element | undefined {
    return this._handleManager.getElementByHandle(handle);
  }

  /**
   * Convenience method to get a handle for an Element.
   */
  getHandleForElement(element: Element): string {
    return this._handleManager.getHandleForElement(element);
  }

  /**
   * Wait for selector evaluation logic moved from FrameExecutionContext.
   * This method handles the core selector resolution and state checking.
   */
  waitForSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string,
  ): {
    log: string;
    elementHandle: string | null;
    visible: boolean;
    attached: boolean;
    error?: string;
  } {
    try {
      // Get root element
      const root = scopeHandle ? this.getElementByHandle(scopeHandle) : this.document || document;

      if (!root) {
        return {
          log: '',
          elementHandle: null,
          visible: false,
          attached: false,
          error: 'Root element not found',
        };
      }

      // Check if root is connected (for scoped searches)
      if (scopeHandle && root && !(root as Element).isConnected) {
        return {
          log: '',
          elementHandle: null,
          visible: false,
          attached: false,
          error: 'Element is not attached to the DOM',
        };
      }

      // Get all matching elements
      const elementHandles = this.querySelectorAll(parsedSelector, root);

      const elements = elementHandles
        .map(handle => this.getElementByHandle(handle))
        .filter(Boolean);

      const element = elements[0];
      const visible = element ? this._injectedScript.utils.isElementVisible(element) : false;

      let log = '';
      if (elements.length > 1) {
        if (strict) {
          return {
            log: '',
            elementHandle: null,
            visible: false,
            attached: false,
            error: `Selector "${selectorString}" resolved to ${elements.length} elements. Use a more specific selector.`,
          };
        }
        const firstElement = elements[0];
        if (firstElement) {
          log = `  locator resolved to ${elements.length} elements. Proceeding with the first one: ${this._injectedScript.previewNode(firstElement)}`;
        }
      } else if (element) {
        log = `  locator resolved to ${visible ? 'visible' : 'hidden'} ${this._injectedScript.previewNode(element)}`;
      }

      const result = {
        log,
        elementHandle: elementHandles[0] || null,
        visible,
        attached: !!element,
      };

      return result;
    } catch (error) {
      // Catch any unexpected errors and return them as error results
      return {
        log: '',
        elementHandle: null,
        visible: false,
        attached: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Frame selector evaluation logic moved from FrameSelectors.
   * This method handles iframe/frame element validation.
   */
  frameSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string,
  ): string | null {
    const root = scopeHandle ? this.getElementByHandle(scopeHandle) : this.document;
    if (!root) {
      throw new Error('Root element not found for scope');
    }

    const elementHandle = this.querySelector(parsedSelector, root, strict);
    if (!elementHandle) {
      return null;
    }

    const element = this.getElementByHandle(elementHandle);
    if (element && element.nodeName !== 'IFRAME' && element.nodeName !== 'FRAME') {
      // This will throw inside the content script, and the error will be propagated.
      throw this._injectedScript.createStacklessError(
        `Selector "${selectorString}" resolved to ${this._injectedScript.previewNode(
          element,
        )}, but an <iframe> was expected`,
      );
    }
    return elementHandle;
  }

  /**
   * Get bounding box for an element by its handle.
   * This method handles the core bounding box calculation logic.
   */
  getBoundingBox(handle: string): { x: number; y: number; width: number; height: number } | null {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return null;
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return null;
    }

    // Get the bounding client rect
    const rect = (element as Element).getBoundingClientRect();

    // Return null if element has no dimensions
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }

    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }

  /**
   * Check if an element is currently checked (for checkboxes and radio buttons).
   * This method handles the core checked state evaluation logic.
   */
  isChecked(handle: string): boolean {
    const element = this.getElementByHandle(handle) as HTMLInputElement;
    if (!element) {
      return false;
    }

    // Check if element is connected to the DOM
    if (!element.isConnected) {
      return false;
    }

    // Check if it's a checkable element
    if (element.tagName !== 'INPUT') {
      return false;
    }

    const inputType = element.type.toLowerCase();
    if (inputType !== 'checkbox' && inputType !== 'radio') {
      return false;
    }

    return element.checked;
  }

  /**
   * Set the checked state of a checkbox or radio button.
   * This method handles the core check/uncheck logic following Playwright patterns.
   */
  setChecked(
    handle: string,
    state: boolean,
  ): {
    success: boolean;
    error?: string;
    needsClick: boolean;
    currentState: boolean;
  } {
    const element = this.getElementByHandle(handle) as HTMLInputElement;
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
        needsClick: false,
        currentState: false,
      };
    }

    // Check if element is connected to the DOM
    if (!element.isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
        needsClick: false,
        currentState: false,
      };
    }

    // Check if it's a checkable element
    if (element.tagName !== 'INPUT') {
      return {
        success: false,
        error: 'Element is not an input element',
        needsClick: false,
        currentState: false,
      };
    }

    const inputType = element.type.toLowerCase();
    if (inputType !== 'checkbox' && inputType !== 'radio') {
      return {
        success: false,
        error: `Input element type "${inputType}" is not checkable. Only 'checkbox' and 'radio' are supported.`,
        needsClick: false,
        currentState: false,
      };
    }

    const currentState = element.checked;

    // If already in the desired state, no action needed
    if (currentState === state) {
      return {
        success: true,
        needsClick: false,
        currentState,
      };
    }

    // Check if element is disabled
    if (element.disabled) {
      return {
        success: false,
        error: 'Element is disabled',
        needsClick: false,
        currentState,
      };
    }

    // Check if element is visible using InjectedScript utilities
    if (!this._injectedScript.utils.isElementVisible(element)) {
      return {
        success: false,
        error: 'Element is not visible',
        needsClick: false,
        currentState,
      };
    }

    // Return that a click is needed to change the state
    return {
      success: true,
      needsClick: true,
      currentState,
    };
  }

  /**
   * Perform a click on an element by its handle.
   * This method handles the core click logic.
   */
  clickElement(handle: string): { success: boolean; error?: string } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    try {
      (element as HTMLElement).click();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to click element',
      };
    }
  }

  /**
   * Enhanced click with position and options support.
   * This method handles advanced clicking with validation.
   */
  clickElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
      button?: 'left' | 'right' | 'middle';
      clickCount?: number;
    } = {},
  ): { success: boolean; error?: string; needsForce?: boolean } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    const htmlElement = element as HTMLElement;

    // Check if element is visible (unless forced)
    if (!options.force && !this._injectedScript.utils.isElementVisible(element)) {
      return {
        success: false,
        error: 'Element is not visible',
        needsForce: true,
      };
    }

    // Check if element is enabled (for form controls)
    if (!options.force && htmlElement.tagName) {
      const tagName = htmlElement.tagName.toLowerCase();
      if (['button', 'input', 'select', 'textarea'].includes(tagName)) {
        const formElement = htmlElement as
          | HTMLInputElement
          | HTMLButtonElement
          | HTMLSelectElement
          | HTMLTextAreaElement;
        if (formElement.disabled) {
          return {
            success: false,
            error: 'Element is disabled',
          };
        }
      }
    }

    try {
      // Use enhanced mouse events for right/middle clicks or when position is specified
      if (options.position || options.button === 'right' || options.button === 'middle') {
        const rect = htmlElement.getBoundingClientRect();
        // Use center of element if no position specified
        const clientX = options.position
          ? rect.left + options.position.x
          : rect.left + rect.width / 2;
        const clientY = options.position
          ? rect.top + options.position.y
          : rect.top + rect.height / 2;

        // Create and dispatch mouse events
        const mouseDownEvent = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          button: options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0,
        });

        const mouseUpEvent = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          button: options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0,
        });

        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          button: options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0,
          detail: options.clickCount || 1,
        });

        htmlElement.dispatchEvent(mouseDownEvent);
        htmlElement.dispatchEvent(mouseUpEvent);
        htmlElement.dispatchEvent(clickEvent);

        // Dispatch contextmenu event for right-clicks
        if (options.button === 'right') {
          const contextMenuEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            button: 2,
          });
          htmlElement.dispatchEvent(contextMenuEvent);
        }

        // Handle multiple clicks
        if (options.clickCount && options.clickCount > 1) {
          for (let i = 1; i < options.clickCount; i++) {
            const multiClickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              clientX,
              clientY,
              button: options.button === 'right' ? 2 : options.button === 'middle' ? 1 : 0,
              detail: i + 1,
            });
            htmlElement.dispatchEvent(multiClickEvent);
          }
        }
      } else {
        // Use simple click for better compatibility
        htmlElement.click();

        // Handle multiple clicks
        if (options.clickCount && options.clickCount > 1) {
          for (let i = 1; i < options.clickCount; i++) {
            htmlElement.click();
          }
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to click element',
      };
    }
  }

  /**
   * Dispatch a custom event on an element by its handle.
   * This method handles event creation and dispatching with proper browser compatibility.
   */
  dispatchEvent(
    handle: string,
    type: string,
    eventInit: Record<string, unknown> = {},
  ): { success: boolean; error?: string } {
    const element = this.getElementByHandle(handle);
    if (!element) {
      return {
        success: false,
        error: 'Element not found',
      };
    }

    // Check if element is connected to the DOM
    if (!(element as Element).isConnected) {
      return {
        success: false,
        error: 'Element is not attached to the DOM',
      };
    }

    try {
      const htmlElement = element as HTMLElement;

      // Create the appropriate event based on type
      let event: Event;

      // Common event types with their proper constructors
      if (type.startsWith('mouse') || ['click', 'dblclick', 'contextmenu'].includes(type)) {
        event = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          ...eventInit,
        });
      } else if (type.startsWith('key')) {
        event = new KeyboardEvent(type, {
          bubbles: true,
          cancelable: true,
          ...eventInit,
        });
      } else if (['focus', 'blur', 'focusin', 'focusout'].includes(type)) {
        event = new FocusEvent(type, {
          bubbles: type === 'focusin' || type === 'focusout',
          cancelable: false,
          ...eventInit,
        });
      } else if (['input', 'change'].includes(type)) {
        event = new Event(type, {
          bubbles: true,
          cancelable: true,
          ...eventInit,
        });
      } else {
        // Generic event for custom event types
        event = new CustomEvent(type, {
          bubbles: true,
          cancelable: true,
          detail: eventInit.detail,
          ...eventInit,
        });
      }

      // Dispatch the event
      htmlElement.dispatchEvent(event);

      return {
        success: true,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to dispatch event',
      };
    }
  }

  /**
   * Highlight elements matching the given parsed selector.
   */
  highlight(parsedSelector: unknown): void {
    this._injectedScript.highlight(parsedSelector as ParsedSelector);
  }

  /**
   * Hide any currently displayed highlights.
   */
  hideHighlight(): void {
    this._injectedScript.hideHighlight();
  }
}
