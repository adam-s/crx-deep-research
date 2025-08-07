import { Disposable } from 'vs/base/common/lifecycle';
import type { FrameExecutionContext } from './frameExecutionContext';
import { Rect, WaitForElementOptions } from './types';
import { Progress } from './progress';
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
    const value = this.frame.context;
    return value === undefined ? null : ({} as Rect);
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
