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
  querySelector(parsedSelector: unknown, root: Node, all: boolean): string | null;
  querySelectorAll(parsedSelector: unknown, root: Node): string[];
  ariaSnapshot(node: Node, options: { forAI: boolean; refPrefix: string }): string | undefined;
  getElementByHandle(handle: string): Element | undefined;
  document?: Document;
  createStacklessError(message: string): Error;
  previewNode(node: Node): string;
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

  public toString(): string {
    return `FrameExecutionContext@${this.frame.frameId}`;
  }
}
