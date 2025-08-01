import {
  InvalidSelectorError,
  ParsedSelector,
  splitSelectorByFrame,
  visitAllSelectorParts,
  parseSelector,
} from '@injected/isomorphic/selectorParser';
import { ElementHandle, JSHandle } from './elementHandle';
import { Frame } from './frame';
import { asLocator } from '@injected/isomorphic/locatorGenerators';

export type SelectorInfo = {
  parsed: ParsedSelector;
  world: chrome.scripting.ExecutionWorld;
  strict: boolean;
};

export type SelectorInFrame = {
  frame: Frame;
  info: SelectorInfo;
  scope?: ElementHandle;
};

type StrictOptions = {
  strict?: boolean;
};

export class FrameSelectors {
  private _frame: Frame;
  constructor(frame: Frame) {
    this._frame = frame;
  }

  async resolveInjectedForSelector(
    selector: string,
    options?: { strict?: boolean; mainWorld?: boolean },
    scope?: ElementHandle,
  ): Promise<
    | {
        injected: JSHandle;
        info: SelectorInfo;
        frame: Frame;
        scope?: ElementHandle;
      }
    | undefined
  > {
    await this.resolveFrameForSelector(selector, options, scope);
    return undefined;
  }

  async resolveFrameForSelector(
    selector: string,
    options: StrictOptions = {},
    scope?: ElementHandle,
  ): Promise<SelectorInFrame | null> {
    let frame: Frame = this._frame;
    scope; // get rid of typescript error

    // This is for later when we support frame navigation
    const frameChunks = splitSelectorByFrame(selector);

    for (const chunk of frameChunks) {
      visitAllSelectorParts(chunk, (part, nested) => {
        if (nested && part.name === 'internal:control' && part.body === 'enter-frame') {
          const locator = asLocator('javascript', selector);
          throw new InvalidSelectorError(
            `Frame locators are not allowed inside composite locators, while querying "${locator}"`,
          );
        }
      });
    }

    // If there are multiple frame chunks, parse each for validation (currently unused)
    for (let i = 0; i < frameChunks.length - 1; ++i) {
      const info = this._parseSelector(frameChunks[i], options);

      // This uses a mechanism to jump to the correct frame by adding
      // info to a frame aria-ref selector.
      // @see https://chatgpt.com/share/68894910-90f8-8004-9173-1fcbf62d9913
      frame = this._jumpToAriaRefFrameIfNeeded(selector, info, frame);
    }
    // No frame navigation implemented yet, so return null
    return null;
  }

  private _parseSelector(
    selector: string | ParsedSelector,
    options: StrictOptions = {},
  ): SelectorInfo {
    // 1. determine strictness
    const strict = typeof options.strict === 'boolean' ? options.strict : false;

    // 2. parse if it's a string
    const parsed: ParsedSelector =
      typeof selector === 'string' ? parseSelector(selector) : selector;

    // 3. walk parts and decide if we need MAIN world
    let needsMain = false;
    visitAllSelectorParts(parsed, part => {
      // adjust these rules to taste — here any “_”-prefixed or “internal:” engine
      // will force MAIN. Everything else is ISOLATED.
      if (part.name.startsWith('_') || part.name.startsWith('internal:')) {
        needsMain = true;
      }
    });

    return {
      parsed,
      world: needsMain ? 'MAIN' : 'ISOLATED',
      strict,
    };
  }

  private _jumpToAriaRefFrameIfNeeded(selector: string, info: SelectorInfo, frame: Frame): Frame {
    if (info.parsed.parts[0].name !== 'aria-ref') return frame;
    const body = info.parsed.parts[0].body as string;
    const match = body.match(/^f(\d+)e\d+$/);
    if (!match) return frame;
    const frameIndex = +match[1];
    const page = this._frame.frameManager.page;
    const frameId = page.lastSnapshotFrameIds[frameIndex - 1];
    const jumptToFrame = frameId ? page.frameManager.frame(frameId) : null;
    if (!jumptToFrame)
      throw new InvalidSelectorError(`Invalid frame in aria-ref selector "${selector}"`);
    return jumptToFrame;
  }
}
