import { Progress, executeWithProgress } from './progress';
import { OperationResult, STANDARD_TIMEOUT } from './utils';
import { Frame } from './frame';
import { ElementHandle } from './elementHandle';
import { LocatorOptions } from './locator';
import { escapeForTextSelector } from '@injected/isomorphic/stringUtils';

export async function executeProgressElementOperation(
  selector: string,
  frame: Frame,
  operation: (handle: ElementHandle, progress: Progress) => Promise<OperationResult>,
  operationName: string,
  timeout?: number,
): Promise<void> {
  return executeWithProgress(
    async progress => {
      const handle = await frame.waitForSelector(progress, selector, false, {
        strict: true,
      });

      if (!handle) {
        throw new Error(`Element not found for selector: ${selector}`);
      }

      try {
        const result = await operation(handle, progress);
        if (result !== 'done') {
          throw new Error(`${operationName} failed: ${result}`);
        }
      } finally {
        handle.dispose();
      }
    },
    { timeout: timeout || STANDARD_TIMEOUT },
  );
}

export function buildSelectorWithOptions(
  baseSelector: string,
  options: LocatorOptions,
  frame: Frame,
): string {
  let selector = baseSelector;

  if (options.hasText) {
    selector += ` >> internal:has-text=${escapeForTextSelector(options.hasText, false)}`;
  }

  if (options.hasNotText) {
    selector += ` >> internal:has-not-text=${escapeForTextSelector(options.hasNotText, false)}`;
  }

  if (options.has) {
    const locator = options.has;
    if (locator._frame !== frame) {
      throw new Error(`Inner "has" locator must belong to the same frame.`);
    }
    selector += ` >> internal:has=` + JSON.stringify(locator._selector);
  }

  if (options.hasNot) {
    const locator = options.hasNot;
    if (locator._frame !== frame) {
      throw new Error(`Inner "hasNot" locator must belong to the same frame.`);
    }
    selector += ` >> internal:has-not=` + JSON.stringify(locator._selector);
  }

  if (options.visible !== undefined) {
    selector += ` >> visible=${options.visible ? 'true' : 'false'}`;
  }

  return selector;
}

export function createChainedSelector(baseSelector: string, chainSelector: string): string {
  return baseSelector + ' >> ' + chainSelector;
}

export function createInternalChainSelector(baseSelector: string, chainSelector: string): string {
  return baseSelector + ' >> internal:chain=' + JSON.stringify(chainSelector);
}

export function createNthSelector(baseSelector: string, index: number): string {
  return baseSelector + ` >> nth=${index}`;
}

export function createFirstSelector(baseSelector: string): string {
  return createNthSelector(baseSelector, 0);
}

export function createLastSelector(baseSelector: string): string {
  return createNthSelector(baseSelector, -1);
}

export function createAndSelector(baseSelector: string, andSelector: string): string {
  return baseSelector + ` >> internal:and=` + JSON.stringify(andSelector);
}

export function createOrSelector(baseSelector: string, orSelector: string): string {
  return baseSelector + ` >> internal:or=` + JSON.stringify(orSelector);
}

export function createVisibleSelector(baseSelector: string, visible: boolean): string {
  return baseSelector + ` >> visible=${visible ? 'true' : 'false'}`;
}

export function validateSameFrame(frame1: Frame, frame2: Frame, operation: string): void {
  if (frame1 !== frame2) {
    throw new Error(`${operation} requires locators to belong to the same frame.`);
  }
}

export function createElementNotFoundError(selector: string): Error {
  return new Error(`Element not found for selector: ${selector}`);
}

export function createOperationFailedError(operationName: string, result: string): Error {
  return new Error(`${operationName} failed: ${result}`);
}

export function isLocatorEqual(
  locator1: { _frame: Frame; _selector: string },
  locator2: { _frame: Frame; _selector: string },
): boolean {
  return locator1._frame === locator2._frame && locator1._selector === locator2._selector;
}

export function createFrameLocatorSelector(baseSelector: string, frameSelector: string): string {
  return baseSelector + ' >> ' + frameSelector;
}

export function createDragAndDropFrameError(): Error {
  return new Error('Drag and drop between different frames is not supported');
}

export function createDifferentFrameError(operation: string = 'operation'): Error {
  return new Error(`${operation} requires locators to belong to the same frame.`);
}

export type LocatorSelector = {
  base: string;
  options?: LocatorOptions;
};

export function createSelector(base: string, options?: LocatorOptions, frame?: Frame): string {
  if (!options) {
    return base;
  }

  if (!frame) {
    throw new Error('Frame is required when options are provided');
  }

  return buildSelectorWithOptions(base, options, frame);
}

export function joinSelectors(baseSelector: string, ...additionalSelectors: string[]): string {
  return [baseSelector, ...additionalSelectors].join(' >> ');
}
