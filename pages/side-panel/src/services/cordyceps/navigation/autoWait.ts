import { LifecycleEvent } from '../utilities/types';
import { getNavigationTracker } from './navigationTracker';
import type { Progress } from '../core/progress';

export type WaitUntil = LifecycleEvent;

/**
 * Helper to add timeout to a promise with proper cleanup
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onCancel: () => void,
  label: string,
): Promise<T> {
  let isComplete = false;

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      if (isComplete) return;
      isComplete = true;
      onCancel();
      reject(new Error(`${label} timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(value => {
        if (isComplete) return;
        isComplete = true;
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch(error => {
        if (isComplete) return;
        isComplete = true;
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export class SignalBarrier {
  private readonly _tabId: number;
  private readonly _frameId: number;
  private _seenUrl: string | null = null;
  private _dispose: (() => void) | null = null;

  constructor(tabId: number, frameId = 0) {
    this._tabId = tabId;
    this._frameId = frameId;

    const nav = getNavigationTracker();
    const disposable = nav.onInternalNavigation(ev => {
      if (ev.tabId === this._tabId && ev.frameId === this._frameId) {
        this._seenUrl ??= ev.url;
      }
    });
    this._dispose = () => disposable.dispose();
  }

  async wait(opts: { waitUntil?: WaitUntil; timeoutMs?: number } = {}): Promise<void> {
    // Yield once to allow immediate same-task events to flush
    await Promise.resolve();
    if (!this._seenUrl) {
      this.dispose();
      return;
    }

    const nav = getNavigationTracker();
    await nav.waitForNavigation(this._tabId, this._frameId, {
      toUrl: this._seenUrl,
      waitUntil: opts.waitUntil ?? 'load',
      timeoutMs: opts.timeoutMs ?? 15000,
    });
    this.dispose();
  }

  dispose(): void {
    if (this._dispose) {
      this._dispose();
      this._dispose = null;
    }
  }
}

/**
 * Wrap an action that may trigger navigation with auto-wait semantics.
 * If the action doesn't cause navigation, returns immediately after a tick.
 */
export async function withAutoWait<T>(
  tabId: number,
  action: () => Promise<T>,
  opts: { waitUntil?: WaitUntil; timeoutMs?: number } = {},
): Promise<T> {
  const barrier = new SignalBarrier(tabId, 0);
  try {
    const result = await action();
    await barrier.wait(opts);
    return result;
  } finally {
    barrier.dispose();
  }
}

/**
 * Wait for a condition with race condition handling and progress support.
 * This is a general-purpose utility for waiting with proper abort support.
 *
 * @param progress Progress controller for abort handling
 * @param condition Function that returns true when condition is met
 * @param options Waiting options
 * @returns Promise that resolves when condition is met
 */
/**
 * Wait for a condition with race condition handling and progress support.
 * This is a general-purpose utility for waiting with proper abort support.
 *
 * @param progress Progress controller for abort handling
 * @param condition Function that returns true when condition is met
 * @param options Waiting options
 * @returns Promise that resolves when condition is met
 */
export async function waitForCondition(
  progress: Progress,
  condition: () => boolean | Promise<boolean>,
  options: {
    pollInterval?: number;
    timeout?: number;
    description?: string;
  } = {},
): Promise<void> {
  const { pollInterval = 100, timeout = 30000, description = 'condition' } = options;

  progress.log(`Waiting for ${description} (polling: ${pollInterval}ms, timeout: ${timeout}ms)`);

  const conditionPromise = new Promise<void>((resolve, reject) => {
    let pollId: ReturnType<typeof setTimeout> | undefined;

    const checkCondition = async () => {
      try {
        const result = await condition();
        if (result) {
          progress.log(`${description} met`);
          if (pollId) {
            clearTimeout(pollId);
          }
          resolve();
          return;
        }
      } catch (error) {
        progress.log(`Error checking ${description}: ${error}`);
        if (pollId) {
          clearTimeout(pollId);
        }
        reject(error);
        return;
      }

      // Schedule next check
      pollId = setTimeout(checkCondition, pollInterval);
    };

    // Set up cleanup
    progress.cleanupWhenAborted(() => {
      if (pollId) {
        clearTimeout(pollId);
      }
    });

    // Start checking
    checkCondition();
  });

  // Use withTimeout helper to avoid Promise resolve reassignment bugs
  const timeoutPromise = withTimeout(
    conditionPromise,
    timeout,
    () => {
      // Cleanup is handled by the conditionPromise itself
    },
    description,
  );

  // Race against progress abort signal
  return progress.race(timeoutPromise);
}
