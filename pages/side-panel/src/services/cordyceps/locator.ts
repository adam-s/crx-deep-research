import { escapeForTextSelector } from '@injected/isomorphic/stringUtils';
import { Frame } from './frame';
import { Rect, TimeoutOptions, ClickOptions } from './types';
import { ElementHandle } from './elementHandle';
import { executeWithProgress } from './progress';

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
    return await this._withElement(
      async (h, timeout) => {
        return executeWithProgress(
          async progress => {
            const result = await h._click(progress, options);
            if (result !== 'done') {
              throw new Error(`Click failed: ${result}`);
            }
          },
          { timeout: timeout || options?.timeout || 30000 },
        );
      },
      {
        title: 'Click',
        timeout: options?.timeout || 30000,
      },
    );
  }

  async dblclick(options?: ClickOptions): Promise<void> {
    return await this._withElement(
      async (h, timeout) => {
        return executeWithProgress(
          async progress => {
            const result = await h._dblclick(progress, options);
            if (result !== 'done') {
              throw new Error(`Double click failed: ${result}`);
            }
          },
          { timeout: timeout || options?.timeout || 30000 },
        );
      },
      {
        title: 'Double Click',
        timeout: options?.timeout || 30000,
      },
    );
  }
}
