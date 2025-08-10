import { LifecycleEvent } from '../utilities/types';
import { getNavigationTracker } from './navigationTracker';

export type WaitUntil = LifecycleEvent;

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
