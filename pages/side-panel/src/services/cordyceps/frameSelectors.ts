import {
  InvalidSelectorError,
  ParsedSelector,
  splitSelectorByFrame,
  visitAllSelectorParts,
  parseSelector,
  stringifySelector,
} from '@injected/isomorphic/selectorParser';
import { ElementHandle } from './elementHandle';
import { Frame } from './frame';
import { asLocator } from '@injected/isomorphic/locatorGenerators';
import { ExecutionContext } from './executionContext';

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
  constructor(private _frame: Frame) {}

  async resolveInjectedForSelector(
    selector: string,
    options?: { strict?: boolean; mainWorld?: boolean },
    scope?: ElementHandle,
  ): Promise<
    | {
        context: ExecutionContext;
        info: SelectorInfo;
        frame: Frame;
        scope?: ElementHandle;
      }
    | undefined
  > {
    const resolved = await this.resolveFrameForSelector(selector, options, scope);
    if (!resolved) {
      return undefined;
    }
    return {
      context: resolved.frame.context,
      info: resolved.info,
      frame: resolved.frame,
      scope: resolved.scope,
    };
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
      // info to a frame aria-ref selector.
      // @see https://chatgpt.com/share/68894910-90f8-8004-9173-1fcbf62d9913
      frame = this._jumpToAriaRefFrameIfNeeded(selector, info, frame);
      const context = frame.context;
      const handle = await context.evaluateHandle(
        (
          parsedSelector: ParsedSelector,
          strict: boolean,
          scopeHandle: string | null,
          selectorString: string,
        ) => {
          const injected = window.__cordyceps_handledInjectedScript;
          const root = scopeHandle ? injected.getElementByHandle(scopeHandle) : injected.document;
          if (!root) {
            throw new Error('Root element not found for scope');
          }

          const elementHandle = injected.querySelector(parsedSelector, root, strict);
          if (!elementHandle) {
            return null;
          }

          const element = injected.getElementByHandle(elementHandle);
          if (element && element.nodeName !== 'IFRAME' && element.nodeName !== 'FRAME') {
            // This will throw inside the content script, and the error will be propagated.
            // Note: createStacklessError and previewNode are on the raw injectedScript.
            throw injected.createStacklessError(
              `Selector "${selectorString}" resolved to ${injected.previewNode(
                element,
              )}, but an <iframe> was expected`,
            );
          }
          return elementHandle;
        },
        info.world,
        info.parsed,
        info.strict,
        i === 0 && scope?.remoteObject ? scope.remoteObject : null,
        stringifySelector(frameChunks[i]),
      );

      if (!handle) {
        throw new InvalidSelectorError(`Could not find frame for selector "${selector}"`);
      }
      const childFrame = await handle.contentFrame();
      if (!childFrame) {
        throw new InvalidSelectorError(`Selector "${selector}" did not resolve to an iframe`);
      }
      frame = childFrame;
    }
    if (frame !== this._frame) scope = undefined;
    const lastChunk = frame.selectors._parseSelector(frameChunks[frameChunks.length - 1], options);
    frame = this._jumpToAriaRefFrameIfNeeded(selector, lastChunk, frame);
    return { frame, info: lastChunk, scope };
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
