import { Disposable } from 'vs/base/common/lifecycle';
import { Progress } from './progress';
import type { FrameManager } from './frame-manager';

export type DocumentLifecycle = 'prerender' | 'active' | 'cached' | 'pending_deletion'; // extensionTypes.DocumentLifecycle

export type FrameType = 'outermost_frame' | 'sub_frame' | 'fenced_frame'; // extensionTypes.FrameType

export type TabStatus = 'unloaded' | 'loading' | 'complete'; // tabs.TabStatus

export interface FrameConfiguration {
  // Frame properties (from webNavigation.getFrame / getAllFrames)
  documentId: string;
  documentLifecycle: DocumentLifecycle;
  errorOccurred: boolean;
  frameType: FrameType;
  parentFrameId: number;
  parentDocumentId?: string;
  url: string;

  // Sender / runtime.MessageSender bits
  frameId: number;
  extensionId: string; // sender.id
  origin: string; // sender.origin

  // Tab properties (flattened from sender.tab)
  tabId: number;
  tabActive: boolean;
  tabAudible?: boolean;
  tabAutoDiscardable: boolean;
  tabDiscarded: boolean;
  tabFavIconUrl?: string;
  tabFrozen: boolean;
  tabGroupId: number;
  tabHeight?: number;
  tabHighlighted: boolean;
  tabIncognito: boolean;
  tabIndex: number;
  tabLastAccessed: number;
  tabMuted: boolean;
  tabPinned: boolean;
  /** Deprecated upstream — keep only if you still read it from sender.tab */
  tabSelected: boolean;
  tabStatus: TabStatus;
  tabTitle?: string;
  tabUrl?: string;
  tabWidth?: number;
  tabWindowId: number;
}

/**
 * Merges frame details and sender information into a typed FrameConfiguration object
 * @param frameDetails Frame details from webNavigation.getFrame or getAllFrames
 * @param sender MessageSender from runtime.onMessage or similar
 * @returns Flattened FrameConfiguration object
 */
export function createFrameConfiguration(
  frameDetails: {
    documentId: string;
    documentLifecycle: DocumentLifecycle;
    errorOccurred: boolean;
    frameType: FrameType;
    parentFrameId: number;
    parentDocumentId?: string;
    url: string;
  },
  sender: chrome.runtime.MessageSender,
): FrameConfiguration {
  const tab = sender.tab;

  if (!tab) {
    throw new Error('MessageSender must include tab information');
  }

  return {
    // Frame properties
    documentId: frameDetails.documentId,
    documentLifecycle: frameDetails.documentLifecycle,
    errorOccurred: frameDetails.errorOccurred,
    frameType: frameDetails.frameType,
    parentFrameId: frameDetails.parentFrameId,
    parentDocumentId: frameDetails.parentDocumentId,
    url: frameDetails.url,

    // Sender properties
    frameId: sender.frameId ?? 0,
    extensionId: sender.id ?? '',
    origin: sender.origin ?? '',

    // Tab properties (flattened)
    tabId: tab.id ?? -1,
    tabActive: tab.active ?? false,
    tabAudible: tab.audible,
    tabAutoDiscardable: tab.autoDiscardable ?? true,
    tabDiscarded: tab.discarded ?? false,
    tabFavIconUrl: tab.favIconUrl,
    tabFrozen: false, // Not available on chrome.tabs.Tab, always false
    tabGroupId: tab.groupId ?? -1,
    tabHeight: tab.height,
    tabHighlighted: tab.highlighted ?? false,
    tabIncognito: tab.incognito ?? false,
    tabIndex: tab.index ?? -1,
    tabLastAccessed: tab.lastAccessed ?? 0,
    tabMuted: tab.mutedInfo?.muted ?? false,
    tabPinned: tab.pinned ?? false,
    tabSelected: tab.selected ?? false,
    tabStatus: (tab.status as TabStatus) ?? 'unloaded',
    tabTitle: tab.title,
    tabUrl: tab.url,
    tabWidth: tab.width,
    tabWindowId: tab.windowId ?? -1,
  };
}

/**
 * Gets frame details from Chrome's webNavigation API
 * @param tabId The tab ID
 * @param frameId The frame ID
 * @returns Frame details or null if frame not found
 */
export function getFrame(
  tabId: number,
  frameId: number,
): Promise<chrome.webNavigation.GetFrameResultDetails | null> {
  return new Promise((resolve, reject) => {
    chrome.webNavigation.getFrame({ tabId, frameId }, frame => {
      const err = chrome.runtime.lastError;
      err ? reject(err) : resolve(frame);
    });
  });
}

export class Frame extends Disposable {
  private _parentFrame: Frame | null;
  private _childFrames = new Set<Frame>();
  public frameId: number;
  public readonly frameManager: FrameManager;
  public readonly tabId: number;
  private _url?: string;
  private _context?: unknown; // Replace 'unknown' with your FrameExecutionContext type

  constructor(
    frameId: number,
    frameManager: FrameManager,
    parentFrame: Frame | null,
    url?: string,
  ) {
    super();
    this.frameId = frameId;
    this.frameManager = parentFrame ? parentFrame.frameManager : frameManager;
    this.tabId = this.frameManager.tabId;
    this._parentFrame = parentFrame;
    this._url = url;

    // Add this frame to parent's children
    if (parentFrame) {
      parentFrame._childFrames.add(this);
      // Ensure this frame is removed from parent when disposed
      this._register({
        dispose: () => {
          if (parentFrame) {
            parentFrame._childFrames.delete(this);
            console.log(
              `🗑️ Frame ${this.frameId} removed from parent frame ${parentFrame.frameId} (tab ${this.tabId})`,
            );
          }
        },
      });
    }

    console.log(
      `✅ Frame ${frameId} created in tab ${this.tabId} with parent ${parentFrame?.frameId ?? 'none'} - URL: ${url ?? 'no url'}`,
    );
  }

  dispose(): void {
    console.log(`🗑️ Disposing Frame ${this.frameId} in tab ${this.tabId}`);

    // Log child frames that will be disposed
    if (this._childFrames.size > 0) {
      console.log(
        `🗑️ Frame ${this.frameId} disposing ${this._childFrames.size} child frames: [${Array.from(
          this._childFrames,
        )
          .map(f => f.frameId)
          .join(', ')}]`,
      );
    }

    // Dispose execution context if it exists
    if (this._context) {
      console.log(`🗑️ Frame ${this.frameId} disposing execution context`);
    }

    super.dispose();
    console.log(`✅ Frame ${this.frameId} disposed successfully`);
  }

  _setContext(context: unknown): void {
    this._context = context;
  }

  /**
   * Access the shared Session via its manager.
   */
  public get session() {
    return this.frameManager.session;
  }

  parentFrame(): Frame | null {
    return this._parentFrame;
  }

  childFrames(): Frame[] {
    return Array.from(this._childFrames);
  }

  clearChildFrames(): void {
    console.log(
      `🗑️ Frame ${this.frameId} clearing ${this._childFrames.size} child frames: [${Array.from(
        this._childFrames,
      )
        .map(f => f.frameId)
        .join(', ')}]`,
    );
    for (const childFrame of this._childFrames) {
      childFrame.dispose();
    }
    this._childFrames.clear();
    console.log(`✅ Frame ${this.frameId} cleared all child frames`);
  }

  url(): string | undefined {
    return this._url;
  }

  setUrl(url: string): void {
    this._url = url;
  }

  /**
   * Navigate this frame using the session's abstracted events.
   */
  async goto(
    url: string,
    options: { timeout?: number; progress?: Progress } = {},
  ): Promise<Response | null> {
    const progress = options.progress;
    if (!this._parentFrame) {
      progress?.log(`Frame ${this.frameId} navigating to "${url}"`);
      return (
        progress?.race(
          new Promise<Response | null>((resolve, reject) => {
            const timeoutId = setTimeout(
              () => reject(new Error(`Navigation timeout after ${options.timeout ?? 30000}ms`)),
              options.timeout ?? 30000,
            );
            const completed = this.session.onCompleted(details => {
              if (details.frameId === this.frameId && details.tabId === this.tabId) {
                completed.dispose();
                error.dispose();
                clearTimeout(timeoutId);
                progress?.log(`Frame ${this.frameId} navigation completed`);
                resolve(null);
              }
            });
            const error = this.session.onErrorOccurred(details => {
              if (details.frameId === this.frameId && details.tabId === this.tabId) {
                completed.dispose();
                error.dispose();
                clearTimeout(timeoutId);
                resolve(null);
              }
            });
            progress?.cleanupOnAbort(() => {
              completed.dispose();
              error.dispose();
              clearTimeout(timeoutId);
            });
            chrome.tabs.update(this.tabId, { url });
          }),
        ) ||
        new Promise<Response | null>((resolve, reject) => {
          const timeoutId = setTimeout(
            () => reject(new Error(`Navigation timeout after ${options.timeout ?? 30000}ms`)),
            options.timeout ?? 30000,
          );
          const completed = this.session.onCompleted(details => {
            if (details.frameId === this.frameId && details.tabId === this.tabId) {
              completed.dispose();
              clearTimeout(timeoutId);
              resolve(null);
            }
          });
          chrome.tabs.update(this.tabId, { url });
        })
      );
    } else {
      throw new Error('Child frame navigation not yet implemented');
    }
  }
}
