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
   * Modified querySelector that returns a UUID handle instead of an Element.
   *
   * @param selector - The parsed selector to query
   * @param root - The root element to search within
   * @param strict - Whether to enforce strict mode (single element match)
   * @returns UUID handle of the found element, or undefined if not found
   */
  querySelector(selector: ParsedSelector, root: Node, strict: boolean = false): string | undefined {
    const element = this._injectedScript.querySelector(selector, root, strict);
    if (!element) {
      return undefined;
    }
    return this._handleManager.getHandleForElement(element);
  }

  /**
   * Modified querySelectorAll that returns UUID handles instead of Elements.
   *
   * @param selector - The parsed selector to query
   * @param root - The root element to search within
   * @returns Array of UUID handles for all found elements
   */
  querySelectorAll(selector: ParsedSelector, root: Node): string[] {
    const elements = this._injectedScript.querySelectorAll(selector, root);
    return elements.map(element => this._handleManager.getHandleForElement(element));
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
}
