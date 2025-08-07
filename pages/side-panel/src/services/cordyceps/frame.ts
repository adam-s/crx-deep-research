import { Disposable } from 'vs/base/common/lifecycle';
import { Progress, executeWithProgress, isAbortError } from './progress';
import { helper } from './helper';
import type { FrameManager } from './frameManager';
import type { FrameExecutionContext } from './frameExecutionContext';
import type {
  NavigationEvent,
  LifecycleEvent,
  NavigateOptionsWithProgress,
  WaitForElementOptions,
} from './types';
import { Event } from 'vs/base/common/event';
import * as dom from './utilsDOM';
import { FrameSelectors } from './frameSelectors';
import { isSessionClosedError } from './protocolError';
import {
  getByTestIdSelector,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByTextSelector,
  getByTitleSelector,
  ByRoleOptions,
  getByRoleSelector,
} from '@injected/isomorphic/locatorUtils';
import { LocatorOptions, Locator } from './locator';
import { isString } from '@injected/isomorphic/stringUtils';
import { ElementHandle } from './elementHandle';

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

/**
 * Frame class with enhanced navigation event handling to solve race conditions.
 *
 * This implementation uses two key strategies from Playwright's approach:
 *
 * 1. **Navigation Event Buffering**:
 *    - Captures navigation events in a buffer from the moment the Frame is created
 *    - When triggering navigation, checks the buffer first before waiting for future events
 *    - Prevents race conditions where events fire between "start listening" and "trigger navigation"
 *
 * 2. **Lifecycle Event Caching**:
 *    - Maintains a Set of already-fired lifecycle events ('load', 'commit', etc.)
 *    - Before waiting for a lifecycle event, checks if it's already been seen
 *    - Prevents hanging when trying to wait for events that already occurred
 *
 * This approach ensures that navigation and lifecycle waiting never misses events,
 * eliminating the common race condition where events fire before listeners are set up.
 */
export class Frame extends Disposable {
  private _parentFrame: Frame | null;
  private _childFrames = new Set<Frame>();
  public frameId: number;
  public readonly frameManager: FrameManager;
  public readonly tabId: number;
  private _url?: string;
  private _context?: FrameExecutionContext;
  readonly selectors: FrameSelectors;

  // Buffering for navigation events to solve race conditions
  private _navigationBuffer: NavigationEvent[] = [];

  // Caching for lifecycle events to avoid waiting for already-fired events
  private _firedLifecycleEvents = new Set<LifecycleEvent>();

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
    this.selectors = new FrameSelectors(this);

    // Set up navigation event buffering - capture all navigation events for this frame
    this._register(
      this.frameManager.page.session.onCompleted(details => {
        if (details.frameId === this.frameId && details.tabId === this.tabId) {
          const navEvent: NavigationEvent = {
            frameId: details.frameId,
            url: details.url,
            lifecycleEvents: ['load'], // onCompleted typically means 'load' lifecycle
          };
          this._navigationBuffer.push(navEvent);
          this._firedLifecycleEvents.add('load');
        }
      }),
    );

    this._register(
      this.frameManager.page.session.onCommitted(details => {
        if (details.frameId === this.frameId && details.tabId === this.tabId) {
          const navEvent: NavigationEvent = {
            frameId: details.frameId,
            url: details.url,
            lifecycleEvents: ['commit'],
          };
          this._navigationBuffer.push(navEvent);
          this._firedLifecycleEvents.add('commit');
        }
      }),
    );

    this._register(
      this.frameManager.page.session.onErrorOccurred(details => {
        if (details.frameId === this.frameId && details.tabId === this.tabId) {
          const navEvent: NavigationEvent = {
            frameId: details.frameId,
            url: details.url,
            error: new Error(details.error || 'Navigation error'),
          };
          this._navigationBuffer.push(navEvent);
        }
      }),
    );

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

  _setContext(context: FrameExecutionContext): void {
    this._context = context;
  }

  get context(): FrameExecutionContext {
    if (!this._context) {
      throw new Error(`Frame ${this.frameId} has no execution context`);
    }
    return this._context;
  }

  /**
   * Access the shared Session via its manager.
   */
  get session() {
    return this.frameManager.page.session;
  }

  get mainFrame() {
    return this.frameManager.mainFrame();
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

  private static readonly kDefaultTimeouts = [0, 20, 50, 100, 100, 500];

  public async _retryWithProgressAndTimeouts<R>(
    progress: Progress,
    timeouts: number[] = Frame.kDefaultTimeouts,
    action: (continuePolling: symbol) => Promise<R | symbol>,
  ): Promise<R> {
    const continuePolling = Symbol('continuePolling');
    // Prepend zero to ensure immediate first attempt
    const delays = [0, ...timeouts];
    let idx = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const delay = delays[Math.min(idx++, delays.length - 1)];
      if (delay) {
        // race a simple timeout against any page/frame abort signals
        await progress.race(new Promise(f => setTimeout(f, delay)));
      }
      try {
        const result = await action(continuePolling);
        if (result !== continuePolling) {
          return result as R;
        }
        // else loop and retry
      } catch (e) {
        // If it's a "hard" error, bubble up; otherwise retry
        if ((e as Error).message.includes('not connected')) {
          continue;
        }
        throw e;
      }
    }
  }

  /**
   * Navigate with buffering to avoid race conditions.
   * First checks if navigation event is already in buffer, otherwise waits for it.
   */
  private async _navigateWithBuffer(
    url: string,
    options: { timeout?: number; progress?: Progress } = {},
  ): Promise<NavigationEvent> {
    const { progress } = options;

    return new Promise((resolve, reject) => {
      // Clear old navigation buffer
      this._navigationBuffer.length = 0;

      // Set up cleanup for progress
      const cleanup = () => {
        // Cleanup is handled by the registered listeners
      };

      if (progress) {
        progress.cleanupWhenAborted(cleanup);
      }

      // Trigger the navigation
      chrome.tabs.update(this.tabId, { url });
      progress?.log(`Frame ${this.frameId} navigating to "${url}"`);

      // Check buffer after a short delay to catch immediate events
      setTimeout(() => {
        // Check if event is already in buffer (fired synchronously)
        const match = this._navigationBuffer.find(
          event => event.frameId === this.frameId && event.url === url,
        );

        if (match) {
          progress?.log(`Frame ${this.frameId} navigation found in buffer`);
          resolve(match);
          return;
        }

        // Otherwise wait for the next matching navigation event
        const { promise, dispose } = helper.waitForEvent(
          progress!,
          this.frameManager.page.session.onCompleted,
          details => details.frameId === this.frameId && details.tabId === this.tabId,
        );

        promise
          .then(() => {
            // Find the matching event in our buffer
            const bufferMatch = this._navigationBuffer.find(
              event => event.frameId === this.frameId,
            );
            if (bufferMatch) {
              progress?.log(`Frame ${this.frameId} navigation completed`);
              resolve(bufferMatch);
            } else {
              // Fallback - create event from completed details
              const fallbackEvent: NavigationEvent = {
                frameId: this.frameId,
                url,
                lifecycleEvents: ['load'],
              };
              resolve(fallbackEvent);
            }
          })
          .catch(reject)
          .finally(() => dispose());
      }, 10); // Small delay to catch synchronous events
    });
  }

  /**
   * Wait for a lifecycle event, but only if we haven't already seen it.
   */
  private async _waitForLifecycle(
    state: LifecycleEvent,
    options: { timeout?: number; progress?: Progress } = {},
  ): Promise<void> {
    const { progress } = options;

    // If we've already seen this lifecycle event, return immediately
    if (this._firedLifecycleEvents.has(state)) {
      progress?.log(`Frame ${this.frameId} already fired lifecycle event: ${state}`);
      return;
    }

    // Otherwise wait for it
    await executeWithProgress<void>(async p => {
      let event: Event<chrome.webNavigation.WebNavigationFramedCallbackDetails>;
      let predicate: (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => boolean;

      switch (state) {
        case 'load':
          event = this.frameManager.page.session.onCompleted;
          predicate = details => details.tabId === this.tabId && details.frameId === this.frameId;
          break;
        case 'commit':
          // Use onCompleted for commit as well, but could use onCommitted if needed
          event = this.frameManager.page.session.onCompleted;
          predicate = details => details.tabId === this.tabId && details.frameId === this.frameId;
          break;
        case 'domcontentloaded':
          // For now, treat as load - could be enhanced with DOM content loaded detection
          event = this.frameManager.page.session.onCompleted;
          predicate = details => details.tabId === this.tabId && details.frameId === this.frameId;
          break;
        case 'networkidle':
          // For now, treat as load - could be enhanced with network idle detection
          event = this.frameManager.page.session.onCompleted;
          predicate = details => details.tabId === this.tabId && details.frameId === this.frameId;
          break;
        default:
          throw new Error(`Unsupported lifecycle event: ${state}`);
      }

      const { promise, dispose } = helper.waitForEvent(p, event, predicate);

      try {
        await promise;
        this._firedLifecycleEvents.add(state);
        p.log(`Frame ${this.frameId} finished waiting for lifecycle event: ${state}`);
      } finally {
        dispose();
      }
    }, options);
  }

  /**
   * Navigate this frame using the session's abstracted events with buffering.
   */
  async goto(url: string, options?: NavigateOptionsWithProgress): Promise<Response | null> {
    if (this._parentFrame) throw new Error('Child frame navigation not yet implemented');

    return executeWithProgress(async p => {
      // 1) Trigger navigation and wait for it to complete
      await this._navigateWithBuffer(url, { ...options, progress: p });

      // 2) If waitUntil is set (default "load"), wait for that lifecycle event
      const waitUntil = options?.waitUntil ?? 'load';
      await this._waitForLifecycle(waitUntil, { ...options, progress: p });

      // 3) Update our URL
      this.setUrl(url);

      // 4) Return null for now (could return Response in the future)
      return null;
    }, options);
  }

  async waitForSelector(
    progress: Progress,
    selector: string,
    performActionPreChecksAndLog: boolean,
    options: WaitForElementOptions,
    scope?: ElementHandle,
  ): Promise<ElementHandle | null> {
    const { state = 'visible' } = options;
    if (!['attached', 'detached', 'visible', 'hidden'].includes(state))
      throw new Error(`state: expected one of (attached|detached|visible|hidden)`);

    if (performActionPreChecksAndLog) {
      progress.log(
        `waiting for selector "${selector}"${state === 'attached' ? '' : ' to be ' + state}`,
      );
    }

    return this._retryWithProgressAndTimeouts(
      progress,
      [0, 20, 50, 100, 100, 500],
      async continuePolling => {
        const resolved = await progress.race(
          this.selectors.resolveInjectedForSelector(selector, options, scope),
        );
        if (!resolved) {
          if (state === 'hidden' || state === 'detached') return null;
          return continuePolling;
        }

        // Use the frame's context directly since it's a FrameExecutionContext
        const frameContext = resolved.frame.context;

        // Execute the selector evaluation logic similar to Playwright
        const result = await progress.race(
          frameContext.executeScript(
            (
              parsedSelector: unknown,
              strict: boolean,
              scopeHandle: string | null,
              selectorString: string,
            ) => {
              const injected = window.__cordyceps_handledInjectedScript;

              // Get root element
              const root = scopeHandle
                ? injected.getElementByHandle(scopeHandle)
                : injected.document || document;

              if (!root) {
                throw injected.createStacklessError('Root element not found');
              }

              // Check if root is connected (for scoped searches)
              if (scopeHandle && root && !(root as Element).isConnected) {
                throw injected.createStacklessError('Element is not attached to the DOM');
              }

              // Get all matching elements
              const elementHandles = injected.querySelectorAll(parsedSelector, root);
              const elements = elementHandles
                .map(handle => injected.getElementByHandle(handle))
                .filter(Boolean);

              const element = elements[0];
              // Basic visibility check - can be enhanced with injected.isElementVisible if available
              const visible = element ? (element as HTMLElement).offsetParent !== null : false;

              let log = '';
              if (elements.length > 1) {
                if (strict) {
                  throw injected.createStacklessError(
                    `Selector "${selectorString}" resolved to ${elements.length} elements. Use a more specific selector.`,
                  );
                }
                const firstElement = elements[0];
                if (firstElement) {
                  log = `  locator resolved to ${elements.length} elements. Proceeding with the first one: ${injected.previewNode(firstElement)}`;
                }
              } else if (element) {
                log = `  locator resolved to ${visible ? 'visible' : 'hidden'} ${injected.previewNode(element)}`;
              }

              return {
                log,
                elementHandle: elementHandles[0] || null,
                visible,
                attached: !!element,
              };
            },
            resolved.info.world,
            resolved.info.parsed,
            resolved.info.strict,
            resolved.frame === this && scope ? scope.remoteObject : null,
            selector,
          ),
        );

        if (!result) {
          if (state === 'hidden' || state === 'detached') return null;
          return continuePolling;
        }

        const resultData = result as {
          log: string;
          elementHandle: string | null;
          visible: boolean;
          attached: boolean;
        };
        const { log, elementHandle, visible, attached } = resultData;

        if (log) {
          progress.log(log);
        }

        // Check if the current state matches what we're waiting for
        const success = { attached, detached: !attached, visible, hidden: !visible }[state];
        if (!success) {
          return continuePolling;
        }

        // If we don't need to return the element, return null
        if (options.omitReturnValue) {
          return null;
        }

        // For detached/hidden states, return null since element shouldn't be used
        if (state === 'detached' || state === 'hidden') {
          return null;
        }

        // Return ElementHandle for attached/visible states
        if (elementHandle) {
          return new ElementHandle(frameContext, elementHandle);
        }

        return null;
      },
    );
  }

  private async _retryWithProgressIfNotConnected<R>(
    progress: Progress,
    selector: string,
    strict: boolean | undefined, // Whether to enforce that the selector matches exactly one element
    performActionPreChecks: boolean, // Whether to run pre-action checks before performing the main
    action: (handle: dom.ElementHandle<Element>) => Promise<R | 'error:notconnected'>,
  ): Promise<R> {
    progress.log(`waiting for ${selector}`);
    return this._retryWithProgressAndTimeouts(progress, undefined, async continuePolling => {
      // 1. Check if we have an execution context
      if (!this._context) {
        progress.log('no execution context available, retrying');
        return continuePolling;
      }

      const resolved = await progress.race(
        this.selectors.resolveInjectedForSelector(selector, { strict }),
      );

      if (!resolved) {
        // Element not found → retry
        progress.log(`element not found for selector "${selector}", retrying`);
        return continuePolling;
      }

      // 2. Check if element exists using the execution context
      try {
        const elementExists = await this._context.elementExists(selector);

        if (!elementExists) {
          // Element not found → retry
          return continuePolling;
        }
      } catch (e) {
        // Error checking element existence → retry
        progress.log('error checking element existence, retrying');
        return continuePolling;
      }

      // 3. Create element handle that uses the real click functionality
      const handle: dom.ElementHandle<Element> = {
        element: document.createElement('div'), // Placeholder - not used in our implementation
        dispose: () => {}, // No cleanup needed for chrome.scripting approach
        click: async () => {
          if (!this._context) {
            throw new Error('No execution context available');
          }
          await this._context.clickSelector(selector);
        },
      };

      // Ensure cleanup if aborted mid‐flight
      progress.cleanupWhenAborted(() => {
        handle.dispose();
      });

      // 4. Perform the user‐supplied action
      try {
        const result = await action(handle);
        if (result === 'error:notconnected') {
          progress.log('element detached, retrying');
          return continuePolling;
        }
        return result;
      } finally {
        handle.dispose();
      }
    });
  }

  isNonRetriableError(e: Error) {
    if (isAbortError(e)) return true;
    if (isSessionClosedError(e)) return true;
    return false;
  }

  // #region Dom Interaction
  /**
   * Click a selector, but only after the frame has loaded.
   */
  async click(selector: string, options?: NavigateOptionsWithProgress): Promise<void> {
    const waitUntil = options?.waitUntil ?? 'load';

    return executeWithProgress(async p => {
      // 1) Wait for the specified lifecycle event (default: load)
      await this._waitForLifecycle(waitUntil, { ...options, progress: p });

      // 2) Then run the click logic
      p.log(`Clicking on selector "${selector}"`);
      return dom.assertDone(
        await this._retryWithProgressIfNotConnected(p, selector, false, false, async handle => {
          try {
            // Use the real click functionality via chrome.scripting
            console.log(`###### Clicking selector "${selector}" in frame ${this.frameId}`);
            await handle.click();
            return 'done' as const;
          } catch (e) {
            const errorMessage = (e as Error).message;
            // Handle specific chrome.scripting errors that indicate element issues
            if (
              errorMessage.includes('No element found for selector') ||
              errorMessage.includes('detached') ||
              errorMessage.includes('not connected') ||
              errorMessage.includes('Script execution failed')
            ) {
              return 'error:notconnected' as const;
            }
            throw e;
          }
        }),
      );
    });
  }

  /**
   * Direct click using chrome.scripting.executeScript - simpler alternative to click()
   * This bypasses the retry-with-progress pattern for cases where you want direct control
   */
  async clickSelector(
    selector: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<void> {
    if (!this._context) {
      throw new Error(`Frame ${this.frameId} has no execution context`);
    }
    await this._context.clickSelector(selector, undefined, world);
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return new Locator(this, selector, options);
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(testIdAttributeName(), testId));
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTitleSelector(text, options));
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.locator(getByRoleSelector(role, options));
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(this, selector);
  }
}

// #region FrameLocator
export class FrameLocator {
  private _frame: Frame;
  private _frameSelector: string;

  constructor(frame: Frame, selector: string) {
    this._frame = frame;
    this._frameSelector = selector;
  }

  locator(selectorOrLocator: string | Locator, options?: LocatorOptions): Locator {
    if (isString(selectorOrLocator))
      return new Locator(
        this._frame,
        this._frameSelector + ' >> internal:control=enter-frame >> ' + selectorOrLocator,
        options,
      );
    if (selectorOrLocator._frame !== this._frame)
      throw new Error(`Locators must belong to the same frame.`);
    return new Locator(
      this._frame,
      this._frameSelector + ' >> internal:control=enter-frame >> ' + selectorOrLocator._selector,
      options,
    );
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(testIdAttributeName(), testId));
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTitleSelector(text, options));
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.locator(getByRoleSelector(role, options));
  }

  owner() {
    return new Locator(this._frame, this._frameSelector);
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(
      this._frame,
      this._frameSelector + ' >> internal:control=enter-frame >> ' + selector,
    );
  }

  first(): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ' >> nth=0');
  }

  last(): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ` >> nth=-1`);
  }

  nth(index: number): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ` >> nth=${index}`);
  }
}

let _testIdAttributeName: string = 'data-testid';

export function testIdAttributeName(): string {
  return _testIdAttributeName;
}

export function setTestIdAttribute(attributeName: string) {
  _testIdAttributeName = attributeName;
}
