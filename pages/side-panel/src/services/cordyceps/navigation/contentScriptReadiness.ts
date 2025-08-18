import { ManualPromise } from '@injected/isomorphic/manualPromise';
import { Progress } from '../core/progress';
import { Disposable } from 'vs/base/common/lifecycle';

/**
 * Simple readiness barrier that waits for content script navigation events
 * instead of complex network request tracking. This is much more reliable
 * as it indicates that both MAIN and ISOLATED contexts are ready.
 */
export class ContentScriptReadinessBarrier extends Disposable {
  private _readyPromise: ManualPromise<void> | null = null;
  private _isReady = false;

  constructor(
    public readonly frameId: number,
    public readonly tabId: number
  ) {
    super();
    this._readyPromise = new ManualPromise<void>();
  }

  /**
   * Mark this frame as ready (called when CRX_DEEP_RESEARCH_NAVIGATION_EVENT is received)
   */
  markReady(): void {
    if (this._isReady) return;

    this._isReady = true;
    this._readyPromise?.resolve();
    console.log(`📋 Frame ${this.frameId} in tab ${this.tabId} is ready`);
  }

  /**
   * Check if the frame is already ready
   */
  isReady(): boolean {
    return this._isReady;
  }

  /**
   * Wait for the frame to be ready with optional timeout via Progress
   */
  async waitForReady(progress?: Progress): Promise<void> {
    if (this._isReady) return;

    if (!this._readyPromise) {
      this._readyPromise = new ManualPromise<void>();
    }

    if (progress) {
      return progress.race(this._readyPromise);
    }

    return this._readyPromise;
  }

  dispose(): void {
    this._readyPromise?.reject(new Error('ContentScriptReadinessBarrier disposed'));
    super.dispose();
  }
}

/**
 * Manager for content script readiness barriers across frames and tabs
 */
export class ContentScriptReadinessManager extends Disposable {
  private static _instance: ContentScriptReadinessManager | null = null;

  private readonly _barriers = new Map<string, ContentScriptReadinessBarrier>();

  private constructor() {
    super();
    this._setupNavigationListener();
  }

  public static getInstance(): ContentScriptReadinessManager {
    if (!ContentScriptReadinessManager._instance) {
      ContentScriptReadinessManager._instance = new ContentScriptReadinessManager();
    }
    return ContentScriptReadinessManager._instance;
  }

  /**
   * Get or create a barrier for a specific frame
   */
  getBarrier(tabId: number, frameId: number): ContentScriptReadinessBarrier {
    const key = `${tabId}:${frameId}`;

    let barrier = this._barriers.get(key);
    if (!barrier) {
      barrier = this._register(new ContentScriptReadinessBarrier(frameId, tabId));
      this._barriers.set(key, barrier);
    }

    return barrier;
  }

  /**
   * Remove barrier for a frame (cleanup)
   */
  removeBarrier(tabId: number, frameId: number): void {
    const key = `${tabId}:${frameId}`;
    const barrier = this._barriers.get(key);
    if (barrier) {
      barrier.dispose();
      this._barriers.delete(key);
    }
  }

  /**
   * Remove all barriers for a tab (when tab is closed)
   */
  removeTabBarriers(tabId: number): void {
    const keysToRemove: string[] = [];
    for (const [key, barrier] of this._barriers) {
      if (key.startsWith(`${tabId}:`)) {
        barrier.dispose();
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => this._barriers.delete(key));
  }

  private _setupNavigationListener(): void {
    // Listen for the navigation events that indicate content script is ready
    const messageListener = (
      message: { type: string; detail?: { url: string } },
      sender: chrome.runtime.MessageSender
    ) => {
      if (message.type === 'cordyceps:navigation-event') {
        const tabId = sender.tab?.id;
        const frameId = sender.frameId;

        if (tabId !== undefined && frameId !== undefined) {
          const barrier = this.getBarrier(tabId, frameId);
          barrier.markReady();

          console.log(`🎯 Content script ready signal received for tab ${tabId}, frame ${frameId}`);
        }
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Cleanup listener on dispose
    this._register({
      dispose: () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      },
    });
  }

  dispose(): void {
    // Dispose all barriers
    for (const barrier of this._barriers.values()) {
      barrier.dispose();
    }
    this._barriers.clear();

    super.dispose();
    ContentScriptReadinessManager._instance = null;
  }
}
