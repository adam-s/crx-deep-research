import { Disposable } from 'vs/base/common/lifecycle';
import { ProtocolError } from './protocolError';
import { ElementHandle } from './elementHandle';
import type { Frame } from './frame';
import type { Session } from './session';

type ScriptInjectionResult<T> = chrome.scripting.InjectionResult<Awaited<T>> & {
  error?: { message: string };
};

declare global {
  interface Window {
    __cordyceps_handledInjectedScript: CordycepsInjectedScript;
  }
}

interface CordycepsInjectedScript {
  parseSelector(selector: string): unknown;
  querySelector(parsedSelector: unknown, root: Node, strict: boolean): string | null;
  querySelectorAll(parsedSelector: unknown, root: Node): string[];
  ariaSnapshot(node: Node, options: { forAI: boolean; refPrefix: string }): string | undefined;
  getElementByHandle(handle: string): Element | undefined;
  document?: Document;
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
  };
  frameSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string,
  ): string | null;
  getBoundingBox(handle: string): { x: number; y: number; width: number; height: number } | null;
  isChecked(handle: string): boolean;
  setChecked(
    handle: string,
    state: boolean,
  ): {
    success: boolean;
    error?: string;
    needsClick: boolean;
    currentState: boolean;
  };
  clickElement(handle: string): { success: boolean; error?: string };
  clickElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
      button?: 'left' | 'right' | 'middle';
      clickCount?: number;
    },
  ): { success: boolean; error?: string; needsForce?: boolean };
  tapElement(handle: string): { success: boolean; error?: string };
  tapElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
    },
  ): { success: boolean; error?: string; needsForce?: boolean };
  dispatchEvent(
    handle: string,
    type: string,
    eventInit: Record<string, unknown>,
  ): { success: boolean; error?: string };
  highlight(parsedSelector: unknown): void;
  hideHighlight(): void;
  markTargetElements(markedElements: Set<Element>, callId: string): void;
}

export class FrameExecutionContext extends Disposable {
  public readonly frame: Frame;
  public readonly session: Session;

  public constructor(frame: Frame) {
    super();
    console.log('Creating FrameExecutionContext for frame:', frame.frameId);
    this.frame = frame;
    this.session = frame.session;
  }

  async executeScript<T, Args extends unknown[]>(
    func: (...args: Args) => T,
    world: chrome.scripting.ExecutionWorld,
    ...args: Args
  ): Promise<Awaited<T> | undefined> {
    try {
      const results = (await chrome.scripting.executeScript({
        target: {
          tabId: this.frame.tabId,
          frameIds: [this.frame.frameId],
        },
        world,
        func,
        args,
      })) as ScriptInjectionResult<T>[];

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      const mainResult = results?.[0];
      if (mainResult?.error) {
        throw new Error(mainResult.error.message);
      }
      return mainResult?.result;
    } catch (e) {
      const method = func.name || 'executeScript';
      throw ProtocolError.from(e, method);
    }
  }

  /**
   * Like executeScript, but returns an ElementHandle for a handle string returned by the injected script.
   */
  public async evaluateHandle<Args extends unknown[], T = string>(
    func: (...args: Args) => T,
    world: chrome.scripting.ExecutionWorld,
    ...args: Args
  ): Promise<ElementHandle | null> {
    try {
      const results = (await chrome.scripting.executeScript({
        target: { tabId: this.frame.tabId, frameIds: [this.frame.frameId] },
        world,
        func,
        args,
      })) as ScriptInjectionResult<T>[];

      if (chrome.runtime.lastError) {
        throw new Error(chrome.runtime.lastError.message);
      }

      const main = results[0];
      if (main?.error) {
        throw new Error(main.error.message);
      }

      const handleId = main.result as unknown as string | null;
      if (!handleId) {
        return null;
      }

      return new ElementHandle(this, handleId);
    } catch (e) {
      const method = func.name || 'evaluateHandle';
      throw ProtocolError.from(e, method);
    }
  }

  // Note: Generic evaluate() methods removed due to MV3 CSP restrictions
  // Use specific methods like elementExists(), clickSelector(), etc. instead

  public async clickSelector(
    selector: string,
    rootElementHandle?: ElementHandle,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<void> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    await this.executeScript(
      (selector: string, rootHandle: string | null) => {
        const injectedScript = window.__cordyceps_handledInjectedScript;
        const parsed = injectedScript.parseSelector(selector);
        const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
        if (!root) {
          throw new Error('Root element not found for handle');
        }
        const elHandle = injectedScript.querySelector(parsed, root, false);
        if (!elHandle) {
          throw new Error('No element found for selector');
        }
        const el = injectedScript.getElementByHandle(elHandle);
        if (!el) {
          throw new Error('Handle did not resolve to an element');
        }
        (el as HTMLElement).click();
      },
      world,
      selector,
      rootHandle,
    );
  }

  public async elementExists(
    selector: string,
    rootElementHandle?: ElementHandle,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<boolean> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    const result = await this.executeScript(
      (selector: string, rootHandle: string | null) => {
        const injectedScript = window.__cordyceps_handledInjectedScript;
        const parsed = injectedScript.parseSelector(selector);
        const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
        if (!root) {
          return false;
        }
        return injectedScript.querySelector(parsed, root, false) !== undefined;
      },
      world,
      selector,
      rootHandle,
    );
    return result || false;
  }

  public async querySelector(
    selector: string,
    rootElementHandle?: ElementHandle,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<ElementHandle | null> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    const handle = await this.executeScript(
      (selector: string, rootHandle: string | null) => {
        const injectedScript = window.__cordyceps_handledInjectedScript;
        const parsed = injectedScript.parseSelector(selector);
        const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
        if (!root) {
          return null;
        }
        return injectedScript.querySelector(parsed, root, false);
      },
      world,
      selector,
      rootHandle,
    );

    if (!handle) {
      return null;
    }
    return new ElementHandle(this, handle as string);
  }

  public async querySelectorAll(
    selector: string,
    rootElementHandle?: ElementHandle,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<ElementHandle[]> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    const handles = await this.executeScript(
      (selector: string, rootHandle: string | null) => {
        const injectedScript = window.__cordyceps_handledInjectedScript;
        const parsed = injectedScript.parseSelector(selector);
        if (!parsed || !injectedScript.querySelectorAll) return [];
        const root = rootHandle ? injectedScript.getElementByHandle(rootHandle) : document;
        if (!root) {
          return [];
        }
        return injectedScript.querySelectorAll(parsed, root);
      },
      world,
      selector,
      rootHandle,
    );

    if (!handles) {
      return [];
    }
    return (handles as string[]).map(handle => new ElementHandle(this, handle));
  }

  public async ariaSnapshot(
    forAI: boolean,
    refPrefix: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
    rootElementHandle?: ElementHandle,
  ): Promise<string | boolean> {
    const rootHandle = rootElementHandle ? rootElementHandle.remoteObject : null;
    const result = await this.executeScript(
      (ai: boolean, prefix: string, rootHandle: string | null): string | undefined => {
        const cordyceps = window.__cordyceps_handledInjectedScript;
        const node = rootHandle
          ? cordyceps.getElementByHandle(rootHandle)
          : cordyceps.document?.body;
        if (!node) {
          return;
        }
        return cordyceps.ariaSnapshot(node, {
          forAI: ai,
          refPrefix: prefix,
        });
      },
      world,
      forAI,
      refPrefix,
      rootHandle,
    );
    return result ?? true;
  }

  public async evaluate<T, Args extends unknown[]>(
    func: (...args: Args) => T,
    world: chrome.scripting.ExecutionWorld,
    ...args: Args
  ): Promise<Awaited<T> | undefined> {
    return this.executeScript(func, world, ...args);
  }

  /**
   * Evaluate waitForSelector logic using the content script method.
   * This replaces the inline script execution with a call to the content script.
   */
  public async waitForSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<
    | {
        log: string;
        elementHandle: string | null;
        visible: boolean;
        attached: boolean;
        error?: string;
      }
    | undefined
  > {
    return this.executeScript(
      (
        parsedSelector: unknown,
        strict: boolean,
        scopeHandle: string | null,
        selectorString: string,
      ) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.waitForSelectorEvaluation(
          parsedSelector,
          strict,
          scopeHandle,
          selectorString,
        );
      },
      world,
      parsedSelector,
      strict,
      scopeHandle,
      selectorString,
    );
  }

  /**
   * Evaluate frame selector logic using the content script method.
   * This replaces the inline script execution with a call to the content script.
   */
  public async frameSelectorEvaluation(
    parsedSelector: unknown,
    strict: boolean,
    scopeHandle: string | null,
    selectorString: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<string | null | undefined> {
    return this.executeScript(
      (
        parsedSelector: unknown,
        strict: boolean,
        scopeHandle: string | null,
        selectorString: string,
      ) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.frameSelectorEvaluation(
          parsedSelector,
          strict,
          scopeHandle,
          selectorString,
        );
      },
      world,
      parsedSelector,
      strict,
      scopeHandle,
      selectorString,
    );
  }

  /**
   * Get bounding box for an element using the content script method.
   * This replaces direct DOM access with a call to the content script.
   */
  public async getBoundingBox(
    handle: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<{ x: number; y: number; width: number; height: number } | null | undefined> {
    return this.executeScript(
      (handle: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.getBoundingBox(handle);
      },
      world,
      handle,
    );
  }

  /**
   * Check if an element is currently checked (for checkboxes and radio buttons).
   * This method uses the content script to evaluate the checked state.
   */
  public async isChecked(
    handle: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<boolean | undefined> {
    return this.executeScript(
      (handle: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.isChecked(handle);
      },
      world,
      handle,
    );
  }

  /**
   * Set the checked state of an element following Playwright patterns.
   * This method handles the core check/uncheck logic via content script.
   */
  public async setChecked(
    handle: string,
    state: boolean,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<
    | {
        success: boolean;
        error?: string;
        needsClick: boolean;
        currentState: boolean;
      }
    | undefined
  > {
    return this.executeScript(
      (handle: string, state: boolean) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.setChecked(handle, state);
      },
      world,
      handle,
      state,
    );
  }

  /**
   * Click an element using the content script method.
   * This method handles clicking via content script.
   */
  public async clickElement(
    handle: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<{ success: boolean; error?: string } | undefined> {
    return this.executeScript(
      (handle: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.clickElement(handle);
      },
      world,
      handle,
    );
  }

  /**
   * Click an element with advanced options using the content script method.
   * This method handles enhanced clicking with position and options.
   */
  public async clickElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
      button?: 'left' | 'right' | 'middle';
      clickCount?: number;
    } = {},
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<{ success: boolean; error?: string; needsForce?: boolean } | undefined> {
    return this.executeScript(
      (
        handle: string,
        options: {
          position?: { x: number; y: number };
          force?: boolean;
          button?: 'left' | 'right' | 'middle';
          clickCount?: number;
        },
      ) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.clickElementWithOptions(handle, options);
      },
      world,
      handle,
      options,
    );
  }

  /**
   * Perform a tap on an element by its handle.
   * This method handles the core tap logic.
   */
  public async tapElement(
    handle: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<{ success: boolean; error?: string } | undefined> {
    return this.executeScript(
      (h: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.tapElement(h);
      },
      world,
      handle,
    );
  }

  /**
   * Enhanced tap with position and options support.
   * This method handles advanced tapping with validation.
   */
  public async tapElementWithOptions(
    handle: string,
    options: {
      position?: { x: number; y: number };
      force?: boolean;
    } = {},
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<{ success: boolean; error?: string; needsForce?: boolean } | undefined> {
    return this.executeScript(
      (h: string, opts: { position?: { x: number; y: number }; force?: boolean }) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.tapElementWithOptions(h, opts);
      },
      world,
      handle,
      options,
    );
  }

  /**
   * Dispatch a custom event on an element using the content script method.
   * This method handles event creation and dispatching with proper browser compatibility.
   */
  public async dispatchEvent(
    handle: string,
    type: string,
    eventInit: Record<string, unknown> = {},
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<{ success: boolean; error?: string } | undefined> {
    return this.executeScript(
      (handle: string, type: string, eventInit: Record<string, unknown>) => {
        const injected = window.__cordyceps_handledInjectedScript;
        return injected.dispatchEvent(handle, type, eventInit);
      },
      world,
      handle,
      type,
      eventInit,
    );
  }

  /**
   * Highlight elements matching the given selector.
   */
  public async highlight(
    selector: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<void> {
    return this.executeScript(
      (selector: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        const parsed = injected.parseSelector(selector);
        return injected.highlight(parsed);
      },
      world,
      selector,
    );
  }

  /**
   * Hide any currently displayed highlights.
   */
  public async hideHighlight(world: chrome.scripting.ExecutionWorld = 'ISOLATED'): Promise<void> {
    return this.executeScript(() => {
      const injected = window.__cordyceps_handledInjectedScript;
      return injected.hideHighlight();
    }, world);
  }

  /**
   * Mark target elements for debugging/tracing purposes.
   * This method provides access to the underlying InjectedScript's markTargetElements functionality.
   */
  public async markTargetElements(
    elementHandles: string[],
    callId: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<void> {
    return this.executeScript(
      (handles: string[], callId: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        const elements = new Set<Element>();

        for (const handle of handles) {
          const element = injected.getElementByHandle(handle);
          if (element) {
            elements.add(element);
          }
        }

        if (elements.size > 0) {
          injected.markTargetElements(elements, callId);
        }
      },
      world,
      elementHandles,
      callId,
    );
  }

  public toString(): string {
    return `FrameExecutionContext@${this.frame.frameId}`;
  }
}
