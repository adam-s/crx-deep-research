import { Disposable } from 'vs/base/common/lifecycle';
import { Progress, ProgressController, executeWithProgress } from './core/progress';
import { StateAwareEvent } from './utilities/pageUtils';
import type { FrameManager } from './frameManager';
import type { FrameExecutionContext } from './core/frameExecutionContext';
import type {
  NavigateOptionsWithProgress,
  WaitForElementOptions,
  ClickOptions,
  SelectOption,
  SelectOptionOptions,
  FrameDragAndDropOptions,
  ScreenshotOptions,
  NavigationEvent,
  LifecycleEvent,
  RegularLifecycleEvent,
  DocumentInfo,
  NavigationResponse,
  CallMetadata,
  NavigationRequest,
  ResponseInfo,
  RequestInfo,
  TimeoutOptions,
} from './utilities/types';
import { verifyLifecycle } from './utilities/types';
import { FrameSelectors } from './operations/frameSelectors';
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
import { DEFAULT_RETRY_TIMEOUTS } from './utilities/constants';
import {
  calculateCenterPosition,
  testIdAttributeName,
  createDragAndDropScript,
  validateWaitState,
  isNonRetriableError,
  doesStateMatch,
  shouldReturnElementHandle,
  getFileInputWaitState,
  createSelectorWaitMessage,
  createElementNotFoundError,
  createBoundingBoxError,
  createFrameEnterSelector,
  createFrameNthSelector,
} from './utilities/frameUtils';
import { parseURL } from './utilities/utils';
import { FileTransferPortController } from './file-transfer/fileTransferPortController';
import { ParsedSelector } from '@injected/isomorphic/selectorParser';
import { withAutoWait } from './navigation/autoWait';
import { getNavigationTracker } from './navigation/navigationTracker';
import { LongStandingScope, ManualPromise } from '@injected/isomorphic/manualPromise';
import { Event, Emitter } from 'vs/base/common/event';
import { assert } from '@injected/isomorphic/assert';

export type World = 'main' | 'utility';

export function serverSideCallMetadata(): CallMetadata {
  return {
    id: '',
    startTime: 0,
    endTime: 0,
    type: 'Internal',
    method: '',
    params: {},
    log: [],
    isServerSide: true,
  };
}

type ContextData = {
  contextPromise: ManualPromise<FrameExecutionContext | { destroyedReason: string }>;
  context: FrameExecutionContext | null;
};

export class NavigationAbortedError extends Error {
  readonly documentId?: string;
  constructor(documentId: string | undefined, message: string) {
    super(message);
    this.documentId = documentId;
  }
}

/**
 * Network classes for handling Chrome extension webRequest integration
 * Provides Playwright-compatible interfaces over Chrome's webRequest API
 */
class Network {
  /**
   * Request class implementing NavigationRequest interface
   * Maps Chrome webRequest details to Playwright-style request handling
   */
  static Request = class NetworkRequest implements NavigationRequest {
    id: string;
    url: string;
    method: string;
    resourceType: string;
    headers: Record<string, string>;
    timestamp: number;
    _documentId?: string;
    private _response: ResponseInfo | null = null;

    constructor(requestInfo: RequestInfo, documentId?: string) {
      this.id = requestInfo.id;
      this.url = requestInfo.url;
      this.method = requestInfo.method;
      this.resourceType = requestInfo.resourceType;
      this.headers = requestInfo.headers;
      this.timestamp = requestInfo.timestamp;
      this._documentId = documentId;
    }

    /**
     * Returns the response for this request
     * Implements NavigationRequest interface requirement
     */
    async response(): Promise<ResponseInfo | null> {
      return this._response;
    }

    /**
     * Sets the response for this request
     * Called when response is received from Chrome webRequest API
     */
    _setResponse(responseInfo: ResponseInfo): void {
      this._response = responseInfo;
    }

    /**
     * Returns the final request in a redirect chain
     * For Chrome extension compatibility - returns self since we don't track redirects at this level
     */
    _finalRequest(): NavigationRequest {
      return this;
    }
  };

  /**
   * Response class for handling Chrome webRequest response data
   * Provides structured access to response information
   */
  static ResponseData = class NetworkResponseData {
    id: string;
    url: string;
    status: number;
    headers: Record<string, string>;
    timestamp: number;
    request: RequestInfo;

    constructor(responseInfo: ResponseInfo) {
      this.id = responseInfo.id;
      this.url = responseInfo.url;
      this.status = responseInfo.status;
      this.headers = responseInfo.headers;
      this.timestamp = responseInfo.timestamp;
      this.request = responseInfo.request;
    }
  };

  /**
   * Simple NavigationResponse implementation for Frame.goto()
   * Provides basic response information for successful navigations
   */
  static NavigationResponse = class NavigationResponseImpl implements NavigationResponse {
    private _url: string;
    private _status: number;
    private _statusText: string;
    private _headers: Record<string, string>;
    private _request: NavigationRequest | null;

    constructor(
      url: string,
      status: number = 200,
      statusText: string = 'OK',
      headers: Record<string, string> = {},
      request: NavigationRequest | null = null,
    ) {
      this._url = url;
      this._status = status;
      this._statusText = statusText;
      this._headers = headers;
      this._request = request;
    }

    url(): string {
      return this._url;
    }

    status(): number {
      return this._status;
    }

    statusText(): string {
      return this._statusText;
    }

    headers(): Record<string, string> {
      return { ...this._headers };
    }

    headerValue(name: string): string | undefined {
      return this._headers[name.toLowerCase()];
    }

    request(): NavigationRequest {
      // For now, return a minimal request object if none provided
      return (
        this._request ||
        ({
          id: '',
          url: this._url,
          method: 'GET',
          resourceType: 'document',
          headers: {},
          timestamp: Date.now(),
          response: async () => null,
          _finalRequest: () => this._request!,
        } as NavigationRequest)
      );
    }

    ok(): boolean {
      return this._status >= 200 && this._status < 300;
    }
  };
}

/**
 * Frame class for managing frame interactions in Chrome extensions.
 *
 * This implementation provides a high-level API for interacting with frames,
 * including element selection, form interaction, and content execution.
 * Navigation is handled through the NavigationTracker for better reliability.
 */
export class Frame extends Disposable {
  // Event emitters for frame lifecycle events based on Playwright's Frame events
  private readonly _onInternalNavigation = this._register(new Emitter<NavigationEvent>());
  private readonly _onAddLifecycle = this._register(new Emitter<LifecycleEvent>());
  private readonly _onRemoveLifecycle = this._register(new Emitter<LifecycleEvent>());

  // StateAware lifecycle events for specific event types (similar to Page API)
  private readonly _onDomContentLoaded = this._register(new StateAwareEvent<LifecycleEvent>());
  private readonly _onLoad = this._register(new StateAwareEvent<LifecycleEvent>());

  // Public event interfaces matching Playwright's Frame event system
  public readonly onInternalNavigation: Event<NavigationEvent> = this._onInternalNavigation.event;
  public readonly onAddLifecycle: Event<LifecycleEvent> = this._onAddLifecycle.event;
  public readonly onRemoveLifecycle: Event<LifecycleEvent> = this._onRemoveLifecycle.event;

  // StateAware lifecycle events - fire immediately if already occurred
  public readonly onDomContentLoaded = this._onDomContentLoaded.event;
  public readonly onLoad = this._onLoad.event;

  _currentDocument: DocumentInfo;
  private _pendingDocument: DocumentInfo | undefined;
  private _raceAgainstEvaluationStallingEventsPromises = new Set<ManualPromise<unknown>>();
  _inflightRequests = new Set<InstanceType<typeof Network.Request>>();

  private _parentFrame: Frame | null;
  private _childFrames = new Set<Frame>();
  public frameId: number;
  public readonly frameManager: FrameManager;
  public readonly tabId: number;
  private _url?: string;
  private _name: string = '';
  private _context?: FrameExecutionContext;
  readonly selectors: FrameSelectors;
  readonly fileTransferPortController: FileTransferPortController;
  readonly _detachedScope = new LongStandingScope();
  _firedLifecycleEvents = new Set<LifecycleEvent>();
  private _firedNetworkIdleSelf = false;
  private _networkIdleTimer: ReturnType<typeof setTimeout> | undefined;
  private _contextData = new Map<World, ContextData>();
  readonly _redirectedNavigations = new Map<
    string,
    { url: string; gotoPromise: Promise<NavigationResponse | null> }
  >(); // documentId -> data

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
    this._currentDocument = { documentId: undefined, request: undefined };
    this.selectors = new FrameSelectors(this);
    this.fileTransferPortController = this._register(new FileTransferPortController());

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

  // #region START nav

  setPendingDocument(documentInfo: DocumentInfo | undefined) {
    this._pendingDocument = documentInfo;
    if (documentInfo)
      this._invalidateNonStallingEvaluations('Navigation interrupted the evaluation');
  }

  pendingDocument(): DocumentInfo | undefined {
    return this._pendingDocument;
  }

  _invalidateNonStallingEvaluations(message: string) {
    if (!this._raceAgainstEvaluationStallingEventsPromises.size) return;
    const error = new Error(message);
    for (const promise of this._raceAgainstEvaluationStallingEventsPromises) promise.reject(error);
  }

  async raceAgainstEvaluationStallingEvents<T>(cb: () => Promise<T>): Promise<T> {
    if (this._pendingDocument) throw new Error('Frame is currently attempting a navigation');

    const promise = new ManualPromise<T>();
    this._raceAgainstEvaluationStallingEventsPromises.add(promise as ManualPromise<unknown>);
    try {
      return await Promise.race([cb(), promise]);
    } finally {
      this._raceAgainstEvaluationStallingEventsPromises.delete(promise as ManualPromise<unknown>);
    }
  }

  _onClearLifecycle() {
    for (const event of this._firedLifecycleEvents) this._fireRemoveLifecycle(event);
    this._firedLifecycleEvents.clear();

    // Reset StateAware lifecycle events for new navigation
    this._onDomContentLoaded.reset();
    this._onLoad.reset();

    // Keep the current navigation request if any.
    this._inflightRequests = new Set(
      Array.from(this._inflightRequests).filter(
        request => request === this._currentDocument.request,
      ),
    );
    this._stopNetworkIdleTimer();
    if (this._inflightRequests.size === 0) this._startNetworkIdleTimer();
    try {
      this.frameManager.page.mainFrame()._recalculateNetworkIdle(this);
    } catch (error) {
      // Main frame not ready, skip network idle recalculation
    }
    this._onLifecycleEvent('commit');
  }

  /**
   * Called when the frame commits a navigation to a new document.
   * Invalidate and dispose the previous execution context so future evaluations
   * happen in a fresh context that will be re-created once the content script loads.
   */
  _onNewDocumentCommitted(reason: string = 'Navigated to new document'): void {
    const ctx = this._context;
    if (ctx) {
      try {
        ctx.contextDestroyed(reason);
      } catch {
        // Ignore teardown errors; the frame is transitioning to a new document.
      }
      this._context = undefined;
    } else {
      console.log(
        `[Frame._onNewDocumentCommitted] No existing context to destroy for frame ${this.frameId}`,
      );
    }
  }

  _startNetworkIdleTimer() {
    assert(!this._networkIdleTimer);
    // We should not start a timer and report networkidle in detached frames.
    // This happens at least in Firefox for child frames, where we may get requestFinished
    // after the frame was detached - probably a race in the Firefox itself.
    if (this._firedLifecycleEvents.has('networkidle') || this._detachedScope.isClosed()) return;
    this._networkIdleTimer = setTimeout(() => {
      this._firedNetworkIdleSelf = true;
      try {
        this.frameManager.page.mainFrame()._recalculateNetworkIdle();
      } catch (error) {
        // Main frame not ready, skip network idle recalculation
      }
    }, 500);
  }

  _stopNetworkIdleTimer() {
    if (this._networkIdleTimer) clearTimeout(this._networkIdleTimer);
    this._networkIdleTimer = undefined;
    this._firedNetworkIdleSelf = false;
  }

  // Helpers to integrate with per-frame inflight tracking
  _onRequestStarted() {
    this._stopNetworkIdleTimer();
  }
  _onRequestFinished() {
    if (this._inflightRequests.size === 0) {
      // Only start the timer if it's not already running. In MV3, we can miss
      // some request start events (e.g., listener attached late), so completion
      // can arrive while the idle timer is already active from commit.
      if (!this._networkIdleTimer) this._startNetworkIdleTimer();
    }
    try {
      this.frameManager.page.mainFrame()._recalculateNetworkIdle();
    } catch (error) {
      // Main frame not ready, skip network idle recalculation
    }
  }

  _recalculateNetworkIdle(frameThatAllowsRemovingNetworkIdle?: Frame) {
    let isNetworkIdle = this._firedNetworkIdleSelf;
    for (const child of this._childFrames) {
      child._recalculateNetworkIdle(frameThatAllowsRemovingNetworkIdle);
      // We require networkidle event to be fired in the whole frame subtree, and then consider it done.
      if (!child._firedLifecycleEvents.has('networkidle')) isNetworkIdle = false;
    }
    if (isNetworkIdle && !this._firedLifecycleEvents.has('networkidle')) {
      this._firedLifecycleEvents.add('networkidle');
      this._fireAddLifecycle('networkidle');
      if (this === this.frameManager.page.mainFrame() && this._url !== 'about:blank')
        console.log('api', `  "networkidle" event fired`);
    }
    if (
      frameThatAllowsRemovingNetworkIdle !== this &&
      this._firedLifecycleEvents.has('networkidle') &&
      !isNetworkIdle
    ) {
      // Usually, networkidle is fired once and not removed after that.
      // However, when we clear them right before a new commit, this is allowed for a particular frame.
      this._firedLifecycleEvents.delete('networkidle');
      this._fireRemoveLifecycle('networkidle');
    }
  }

  _onLifecycleEvent(event: RegularLifecycleEvent) {
    if (this._firedLifecycleEvents.has(event)) {
      return;
    }
    this._firedLifecycleEvents.add(event);
    this._fireAddLifecycle(event);
    if (this === this.frameManager.page.mainFrame() && this._url !== 'about:blank')
      console.log('api', `  "${event}" event fired`);
    try {
      this.frameManager.mainFrame()._recalculateNetworkIdle();
    } catch (error) {
      // Main frame not ready, skip network idle recalculation
    }
  }

  // #endregion END nav

  /**
   * Fire internal navigation event matching Playwright's NavigationEvent structure
   * This method can be called by FrameManager during navigation lifecycle
   */
  _fireInternalNavigation(
    url: string,
    name: string = '',
    newDocument?: DocumentInfo,
    error?: Error,
    isPublic: boolean = true,
  ): void {
    const navigationEvent: NavigationEvent = {
      url,
      name,
      newDocument,
      error,
      isPublic,
    };
    this._onInternalNavigation.fire(navigationEvent);
  }

  /**
   * Fire add lifecycle event
   */
  private _fireAddLifecycle(lifecycle: LifecycleEvent): void {
    this._onAddLifecycle.fire(lifecycle);

    // Also fire specific StateAwareEvent for the lifecycle type
    if (lifecycle === 'domcontentloaded') {
      this._onDomContentLoaded.fire(lifecycle);
    } else if (lifecycle === 'load') {
      this._onLoad.fire(lifecycle);
    }
  }

  /**
   * Fire remove lifecycle event
   */
  private _fireRemoveLifecycle(lifecycle: LifecycleEvent): void {
    this._onRemoveLifecycle.fire(lifecycle);
  }

  /**
   * Wait for navigation using VS Code Event system
   * Chrome extension-compatible version of Playwright's waitForNavigation
   */
  async waitForNavigation(
    progress: Progress,
    options: { waitUntil?: LifecycleEvent; timeout?: number } = {},
  ): Promise<NavigationResponse | null> {
    const waitUntil = verifyLifecycle('waitUntil', options.waitUntil || 'load');
    const timeout = options.timeout || 30000;

    return new Promise<NavigationResponse | null>((resolve, reject) => {
      const disposables: { dispose(): void }[] = [];
      let navigationReceived = false;
      let lifecycleReceived = false;
      let pendingNavigation: NavigationEvent | null = null;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        disposables.forEach(d => d.dispose());
        reject(new Error(`Navigation timeout of ${timeout}ms exceeded`));
      }, timeout);

      const cleanup = () => {
        clearTimeout(timeoutHandle);
        disposables.forEach(d => d.dispose());
      };

      const checkCompletion = () => {
        if (navigationReceived && lifecycleReceived && pendingNavigation) {
          cleanup();
          // Return null for now - response plumbing can be added later
          resolve(null);
        }
      };

      // Listen for navigation events
      const navigationDisposable = this.onInternalNavigation((navEvent: NavigationEvent) => {
        if (navEvent.error) {
          cleanup();
          reject(navEvent.error);
          return;
        }
        navigationReceived = true;
        pendingNavigation = navEvent;
        checkCompletion();
      });
      disposables.push(navigationDisposable);

      // Listen for lifecycle events
      const lifecycleDisposable = this.onAddLifecycle((lifecycle: LifecycleEvent) => {
        if (lifecycle === waitUntil) {
          lifecycleReceived = true;
          checkCompletion();
        }
      });
      disposables.push(lifecycleDisposable);

      // Clean up when progress is aborted
      progress.cleanupWhenAborted(cleanup);
    });
  }

  /**
   * Internal navigation waiting method with Playwright-compatible signature
   * Used by reload() and other navigation methods that need requiresNewDocument flag
   */
  async _waitForNavigation(
    progress: Progress,
    requiresNewDocument: boolean,
    options: { waitUntil?: LifecycleEvent; timeout?: number } = {},
  ): Promise<NavigationResponse | null> {
    const waitUntil = verifyLifecycle('waitUntil', options.waitUntil || 'load');
    console.log(
      `[Frame._waitForNavigation] Starting frame ${this.frameId}, tab ${this.tabId}, requiresNewDocument: ${requiresNewDocument}, waitUntil: "${waitUntil}", options:`,
      options,
    );

    // Safe progress logging - check if progress.log exists
    if (progress && typeof progress.log === 'function') {
      progress.log(`waiting for navigation until "${waitUntil}"`);
    } else {
      console.log(
        `[Frame._waitForNavigation] Progress object missing log method, progress:`,
        progress,
      );
    }

    // Wait for navigation event using our VS Code Event system
    console.log(
      `[Frame._waitForNavigation] Calling Frame.waitForEvent for onInternalNavigation, frame ${this.frameId}`,
    );
    const navigationEvent = await Frame.waitForEvent(
      progress,
      this.onInternalNavigation,
      (event: NavigationEvent) => {
        // Any failed navigation results in a rejection
        if (event.error) {
          return true;
        }
        // Check if we require a new document (for reload vs pushState distinction)
        if (requiresNewDocument && !event.newDocument) {
          return false;
        }

        // Safe progress logging
        if (progress && typeof progress.log === 'function') {
          progress.log(`  navigated to "${this._url}"`);
        }

        return true;
      },
      options.timeout || 30000,
    );

    console.log(
      `[Frame._waitForNavigation] Frame.waitForEvent completed for frame ${this.frameId}, navigationEvent:`,
      navigationEvent,
    );

    // Check for navigation error
    if (navigationEvent.error) {
      console.log(
        `[Frame._waitForNavigation] Throwing navigation error for frame ${this.frameId}:`,
        navigationEvent.error,
      );
      throw navigationEvent.error;
    }

    // Decide whether to wait for a lifecycle event.
    // For same-document navigations (no newDocument), Chrome won't fire 'domcontentloaded'/'load'.
    // In that case, treat the navigation as complete after the internal navigation signal.
    console.log(
      `[Frame._waitForNavigation] Checking lifecycle events for frame ${this.frameId}, firedEvents:`,
      Array.from(this._firedLifecycleEvents),
      `waitUntil: "${waitUntil}"`,
    );
    const isSameDocument = !navigationEvent.newDocument;
    const shouldSkipLifecycleWait = isSameDocument && waitUntil !== 'commit';
    if (!shouldSkipLifecycleWait && !this._firedLifecycleEvents.has(waitUntil)) {
      console.log(
        `[Frame._waitForNavigation] Waiting for lifecycle event "${waitUntil}" for frame ${this.frameId}`,
      );
      await Frame.waitForEvent(
        progress,
        this.onAddLifecycle,
        (e: LifecycleEvent) => {
          console.log(
            `[Frame._waitForNavigation] Lifecycle event received for frame ${this.frameId}: "${e}", waiting for: "${waitUntil}"`,
          );
          return e === waitUntil;
        },
        options.timeout || 30000,
      );
      console.log(
        `[Frame._waitForNavigation] Lifecycle event "${waitUntil}" received for frame ${this.frameId}`,
      );
    } else {
      console.log(
        shouldSkipLifecycleWait
          ? `[Frame._waitForNavigation] Same-document navigation detected; skipping lifecycle wait for "${waitUntil}"`
          : `[Frame._waitForNavigation] Lifecycle event "${waitUntil}" already fired for frame ${this.frameId}`,
      );
    }

    // Extract request and return response (or null)
    const request = navigationEvent.newDocument ? navigationEvent.newDocument.request : undefined;
    console.log(
      `[Frame._waitForNavigation] Extracting request for frame ${this.frameId}, request:`,
      request,
    );
    if (request) {
      // TODO: Implement proper ResponseInfo to NavigationResponse conversion
      // const responseInfo = await progress.race(request._finalRequest().response());
      // For now, return null since response mapping is not fully implemented
      console.log(
        `[Frame._waitForNavigation] Returning null for frame ${this.frameId} (response mapping not implemented)`,
      );
      return null;
    }
    console.log(`[Frame._waitForNavigation] Returning null for frame ${this.frameId} (no request)`);
    return null;
  }

  /**
   * Wait for a specific lifecycle state to be reached
   * Chrome extension-compatible version of Playwright's _waitForLoadState
   */
  async _waitForLoadState(progress: Progress, state: LifecycleEvent): Promise<void> {
    const waitUntil = verifyLifecycle('state', state);
    console.log(
      `[Frame._waitForLoadState] Starting for frame ${this.frameId}, state: "${state}", waitUntil: "${waitUntil}"`,
    );
    console.log(
      `[Frame._waitForLoadState] Current fired lifecycle events for frame ${this.frameId}:`,
      Array.from(this._firedLifecycleEvents),
    );
    if (!this._firedLifecycleEvents.has(waitUntil)) {
      console.log(
        `[Frame._waitForLoadState] Waiting for lifecycle event "${waitUntil}" for frame ${this.frameId}`,
      );
      await Frame.waitForEvent(
        progress,
        this.onAddLifecycle,
        (e: LifecycleEvent) => {
          console.log(
            `[Frame._waitForLoadState] Lifecycle event received for frame ${this.frameId}: "${e}", waiting for: "${waitUntil}"`,
          );
          return e === waitUntil;
        },
        30000,
      );
      console.log(
        `[Frame._waitForLoadState] Lifecycle event "${waitUntil}" received for frame ${this.frameId}`,
      );
    } else {
      console.log(
        `[Frame._waitForLoadState] Lifecycle event "${waitUntil}" already fired for frame ${this.frameId}`,
      );
    }
  }

  /**
   * Helper method to wait for specific events using VS Code Event system
   * Chrome extension-compatible replacement for Playwright's helper.waitForEvent
   */
  static waitForEvent<T>(
    progress: Progress,
    event: Event<T>,
    predicate?: (eventArg: T) => boolean,
    timeout: number = 30000,
  ): Promise<T> {
    console.log(
      `[Frame.waitForEvent] Starting waitForEvent with timeout ${timeout}ms, predicate:`,
      !!predicate,
    );
    return new Promise<T>((resolve, reject) => {
      let disposable: { dispose(): void } | null = null;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        console.log(`[Frame.waitForEvent] Timeout exceeded (${timeout}ms)`);
        if (disposable) disposable.dispose();
        reject(new Error(`Event timeout of ${timeout}ms exceeded`));
      }, timeout);

      const cleanup = () => {
        console.log(`[Frame.waitForEvent] Cleaning up event listener`);
        clearTimeout(timeoutHandle);
        if (disposable) disposable.dispose();
      };

      // Listen for the event
      console.log(`[Frame.waitForEvent] Setting up event listener`);
      disposable = event((eventArg: T) => {
        try {
          console.log(`[Frame.waitForEvent] Event received, evaluating predicate...`);
          if (predicate && !predicate(eventArg)) {
            console.log(`[Frame.waitForEvent] Predicate returned false, continuing to wait`);
            return; // Continue waiting
          }
          console.log(
            `[Frame.waitForEvent] Event matches criteria, resolving with eventArg:`,
            eventArg,
          );
          cleanup();
          resolve(eventArg);
        } catch (e) {
          console.log(`[Frame.waitForEvent] Exception in event handler:`, e);
          cleanup();
          reject(e);
        }
      });

      // Clean up when progress is aborted
      console.log(`[Frame.waitForEvent] Registering cleanup for progress abort`);
      // Safety check for progress.cleanupWhenAborted
      if (progress && typeof progress.cleanupWhenAborted === 'function') {
        progress.cleanupWhenAborted(cleanup);
      } else {
        console.log(
          `[Frame.waitForEvent] Progress object missing cleanupWhenAborted method, progress:`,
          progress,
        );
        // Still register cleanup in case we need it, but without progress support
      }
    });
  }

  public async _retryWithProgressAndTimeouts<R>(
    progress: Progress,
    timeouts: readonly number[] = DEFAULT_RETRY_TIMEOUTS,
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

  _onDetached() {
    this._stopNetworkIdleTimer();
    this._detachedScope.close(new Error('Frame was detached'));
    for (const data of this._contextData.values()) {
      if (data.context) data.context.contextDestroyed('Frame was detached');
      data.contextPromise.resolve({ destroyedReason: 'Frame was detached' });
    }
    if (this._parentFrame) this._parentFrame._childFrames.delete(this);
    this._parentFrame = null;
  }

  isDetached(): boolean {
    return this._detachedScope.isClosed();
  }

  async raceNavigationAction(
    progress: Progress,
    action: () => Promise<NavigationResponse | null>,
  ): Promise<NavigationResponse | null> {
    return LongStandingScope.raceMultiple(
      [this._detachedScope, this.frameManager.page.openScope],
      action().catch(e => {
        if (e instanceof NavigationAbortedError && e.documentId) {
          const data = this._redirectedNavigations.get(e.documentId);
          if (data) {
            // Safe progress logging
            if (progress && typeof progress.log === 'function') {
              progress.log(`waiting for redirected navigation to "${data.url}"`);
            }
            return progress.race(data.gotoPromise);
          }
        }
        throw e;
      }),
    );
  }

  redirectNavigation(url: string, documentId: string, referer: string | undefined) {
    const controller = new ProgressController(30000); // 30 second timeout
    const data = {
      url,
      gotoPromise: controller.run(() => this.goto(url, { referer, timeout: 30000 })),
    };
    this._redirectedNavigations.set(documentId, data);
    data.gotoPromise.finally(() => this._redirectedNavigations.delete(documentId));
  }

  /**
   * Navigate this frame using a Playwright-style algorithm backed by NavigationTracker.
   * - Initiates navigation via chrome.tabs.update
   * - Waits for 'commit', then for the requested lifecycle (default 'load')
   * - Returns null (response plumbing can be added later)
   */
  async goto(
    url: string,
    options?: NavigateOptionsWithProgress,
  ): Promise<NavigationResponse | null> {
    if (this._parentFrame) throw new Error('Child frame navigation not yet implemented');

    const waitUntil = options?.waitUntil ?? 'load';
    const timeoutMs = options?.timeout ?? 30000;

    return executeWithProgress(async p => {
      const tracker = getNavigationTracker();

      // Start listening for internal navigation events for this frame
      const events: Array<{ url: string; frameId: number; documentId?: string }> = [];
      const disposable = tracker.onInternalNavigation(ev => {
        if (ev.tabId === this.tabId && ev.frameId === this.frameId) {
          events.push({ url: ev.url, frameId: ev.frameId, documentId: ev.newDocument?.documentId });
        }
      });
      p.cleanupWhenAborted(() => disposable.dispose());

      // Initiate navigation directly via chrome.tabs.update
      p.log(`Frame ${this.frameId} navigating to "${url}"`);
      chrome.tabs.update(this.tabId, { url });

      // Wait for navigation to complete with the requested lifecycle
      const navEv = await tracker.waitForNavigation(this.tabId, this.frameId, {
        toUrl: url,
        waitUntil,
        timeoutMs,
      });
      // Update our URL to the committed one (could differ due to redirects)
      this.setUrl(navEv.url);

      // Fire internal navigation event
      this._fireInternalNavigation(
        navEv.url,
        '', // frame name - not available from NavigationTracker currently
        navEv.newDocument
          ? {
              documentId: navEv.newDocument.documentId,
              request: undefined, // request not available from NavigationTracker
            }
          : undefined,
      );

      // Create a NavigationResponse for the successful navigation
      const navigationResponse = new Network.NavigationResponse(
        navEv.url,
        200, // Assume success for now - we can enhance this later with actual response tracking
        'OK',
        {}, // Empty headers for now - can be enhanced later
        null, // No request object for now - can be enhanced later
      );

      return navigationResponse;
    }, options);
  }

  /**
   * Wait for a specific lifecycle state to be reached
   * Chrome extension-compatible version of Playwright's waitForLoadState
   */
  async waitForLoadState(
    state: LifecycleEvent = 'load',
    options: TimeoutOptions = {},
  ): Promise<void> {
    return executeWithProgress(async progress => {
      const verifiedState = verifyLifecycle('state', state);
      progress.log(`Waiting for load state "${verifiedState}"`);

      // For Chrome internal pages, apply timeout protection
      const url = this.url();
      if (url?.startsWith('chrome://') || url?.startsWith('chrome-untrusted://')) {
        progress.log(
          `Frame.waitForLoadState: Chrome internal page detected (${url}) - applying timeout protection`,
        );

        const timeout = options.timeout ?? 5000; // Shorter timeout for Chrome pages
        try {
          await Promise.race([
            this._waitForLoadState(progress, verifiedState),
            new Promise<void>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Frame load state timed out after ${timeout}ms`)),
                timeout,
              ),
            ),
          ]);
        } catch (error) {
          if (error instanceof Error && error.message.includes('timed out')) {
            progress.log(
              `Frame.waitForLoadState: Timeout for Chrome internal page - continuing gracefully`,
            );
            return;
          }
          throw error;
        }
      } else {
        // Normal behavior for regular pages
        await this._waitForLoadState(progress, verifiedState);
      }

      progress.log(`Load state "${verifiedState}" reached`);
    }, options);
  }

  origin(): string | undefined {
    if (!this._url || !this._url.startsWith('http')) {
      return undefined;
    }
    return parseURL(this._url)?.origin;
  }

  name(): string {
    return this._name;
  }

  setName(name: string): void {
    this._name = name;
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

  title(): Promise<string> {
    // For Chrome extension pages and other system pages that don't allow content script injection,
    // we should get the title from the tab metadata instead of trying to evaluate document.title
    const url = this._url;
    if (
      url &&
      (url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') ||
        url.startsWith('about:'))
    ) {
      // For system pages, get title from chrome.tabs API instead of script injection
      return this._getTitleFromTabMetadata();
    }

    // For regular pages, use the standard evaluate method
    return this.evaluate(() => document.title);
  }

  /**
   * Get page title from Chrome tabs API for system pages that don't allow script injection
   */
  private async _getTitleFromTabMetadata(): Promise<string> {
    try {
      const tab = await chrome.tabs.get(this.tabId);
      return tab.title || 'Unknown';
    } catch (error) {
      // Fallback to URL hostname or default
      const url = this._url;
      if (url) {
        try {
          return new URL(url).hostname;
        } catch {
          return 'Unknown';
        }
      }
      return 'Unknown';
    }
  }

  url(): string | undefined {
    return this._url;
  }
  setUrl(url: string): void {
    this._url = url;
  }

  async waitForSelector(
    progress: Progress,
    selector: string,
    performActionPreChecksAndLog: boolean,
    options: WaitForElementOptions,
    scope?: ElementHandle,
  ): Promise<ElementHandle | null> {
    // Validate options
    const { state = 'visible' } = options;
    validateWaitState(state);

    // Log once if requested
    if (performActionPreChecksAndLog) {
      progress.log(createSelectorWaitMessage(selector, state));
    }
    // Main retry loop
    return this._retryWithProgressAndTimeouts(
      progress,
      DEFAULT_RETRY_TIMEOUTS,
      async continuePolling => {
        // Step 1: Resolve selector metadata
        const resolved = await progress.race(
          this.selectors.resolveInjectedForSelector(selector, options, scope),
        );
        if (!resolved) {
          // For hidden/detached states, null means success
          if (state === 'hidden' || state === 'detached') {
            return null;
          }
          return continuePolling;
        }

        const context = resolved.frame.context;

        const result = await progress.race(
          context.waitForSelectorEvaluation(
            resolved.info.parsed,
            resolved.info.strict,
            resolved.frame === this && scope ? scope.remoteObject : null,
            selector,
            resolved.info.world,
          ),
        );

        if (!result) {
          // For hidden/detached states, null means success
          if (state === 'hidden' || state === 'detached') {
            return null;
          }
          return continuePolling;
        }

        // Step 3: Process result
        const { log, elementHandle, visible, attached, error } = result;

        // Handle errors from content script
        if (error) {
          throw new Error(`Selector evaluation failed: ${error}`);
        }

        // Log any messages from content script
        if (log) {
          progress.log(log);
        }

        // Step 4: Check if current state matches desired state
        if (!doesStateMatch(state, visible, attached)) {
          return continuePolling; // Keep retrying
        }

        // Step 5: Handle return value based on options and state
        if (!shouldReturnElementHandle(state, options.omitReturnValue)) {
          return null; // User doesn't need the element or element shouldn't be used
        }

        // Step 6: Return ElementHandle for attached/visible states
        if (elementHandle) {
          return new ElementHandle(resolved.frame.context, elementHandle);
        }

        return null;
      },
    );
  }

  isNonRetriableError(e: Error) {
    return isNonRetriableError(e);
  }

  // #region Dom Interaction

  /**
   * Helper method to execute an action with an ElementHandle, handling the lifecycle of
   * getting the handle, executing the action, and disposing of the handle.
   */
  private async _executeWithElementHandle<T>(
    selector: string,
    timeout: number,
    action: (handle: ElementHandle, progress: Progress) => Promise<T>,
  ): Promise<T> {
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, { strict: true });

        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }

        try {
          const result = await action(handle, progress);
          return result;
        } finally {
          handle.dispose();
        }
      },
      { timeout },
    );
  }

  /**
   * Click a selector, but only after the frame has loaded.
   */
  async click(selector: string, options?: ClickOptions): Promise<void> {
    // Auto-wait for potential navigation triggered by the click on top frame.
    return withAutoWait(
      this.tabId,
      () =>
        this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
          handle.clickWithProgress(progress, options),
        ),
      { waitUntil: 'commit', timeoutMs: options?.timeout ?? 30000 },
    );
  }

  async dblclick(selector: string, options?: ClickOptions): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.dblclickWithProgress(progress, options),
    );
  }

  async tap(selector: string, options?: ClickOptions): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.tapWithProgress(progress, options),
    );
  }

  async dispatchEvent(
    selector: string,
    type: string,
    eventInit: Record<string, unknown> = {},
    options?: { timeout?: number },
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.dispatchEventWithProgress(progress, type, eventInit),
    );
  }

  /**
   * Perform a drag and drop operation from source selector to target selector.
   *
   * @param source The CSS selector of the source element to drag from
   * @param target The CSS selector of the target element to drop to
   * @param options Optional drag and drop configuration
   * @returns Promise that resolves when drag and drop is complete
   *
   * @example
   * ```typescript
   * // Basic drag and drop
   * await frame.dragAndDrop('#source-element', '#target-element');
   *
   * // With custom positions
   * await frame.dragAndDrop('#source', '#target', {
   *   sourcePosition: { x: 10, y: 10 },
   *   targetPosition: { x: 50, y: 50 }
   * });
   * ```
   */
  async dragAndDrop(
    source: string,
    target: string,
    options: FrameDragAndDropOptions & { timeout?: number } = {},
  ): Promise<void> {
    const timeout = options.timeout || 30000;

    return await executeWithProgress(
      async progress => {
        progress.log(`Starting drag and drop from "${source}" to "${target}"`);

        // Get both source and target elements first to ensure they exist
        const sourceHandle = await this.waitForSelector(progress, source, false, { strict: true });
        if (!sourceHandle) {
          throw new Error(createElementNotFoundError(source));
        }

        const targetHandle = await this.waitForSelector(progress, target, false, { strict: true });
        if (!targetHandle) {
          sourceHandle.dispose();
          throw new Error(createElementNotFoundError(target));
        }

        try {
          // Get bounding boxes for position calculations
          const sourceBox = await sourceHandle.boundingBox();
          const targetBox = await targetHandle.boundingBox();

          if (!sourceBox) {
            throw new Error(createBoundingBoxError(source, 'no bounding box'));
          }
          if (!targetBox) {
            throw new Error(createBoundingBoxError(target, 'no bounding box'));
          }

          const sourcePosition = options.sourcePosition || calculateCenterPosition(sourceBox);
          const targetPosition = options.targetPosition || calculateCenterPosition(targetBox);

          // Use the improved drag and drop simulation with DataTransfer

          await this.context.executeScript(
            createDragAndDropScript(),
            'ISOLATED',
            source,
            target,
            sourcePosition,
            targetPosition,
          );

          progress.log(`Drag and drop from "${source}" to "${target}" completed successfully`);
        } finally {
          // Always dispose of handles
          sourceHandle.dispose();
          targetHandle.dispose();
        }
      },
      { timeout },
    );
  }

  /**
   * Chrome extension version of Playwright's rafrafTimeout.
   * Waits for double requestAnimationFrame and timeout using content script execution.
   */
  async rafrafTimeout(progress: Progress, timeout: number): Promise<void> {
    if (timeout === 0) {
      return;
    }
    // Execute double RAF directly without progress.race wrapper
    const rafPromise = this.context
      .executeScript(() => {
        return new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });
      }, 'ISOLATED')
      .then(() => {})
      .catch(error => {
        throw error;
      });

    // Create timeout promise with progress.wait
    const timeoutPromise = progress.wait(timeout).catch(error => {
      throw error;
    });
    // Wait for both to complete
    await Promise.all([rafPromise, timeoutPromise]);
  }

  /**
   * Chrome extension version of Playwright's rafrafTimeoutScreenshotElementWithProgress.
   * Takes a screenshot of an element after waiting for animations to settle.
   */
  async rafrafTimeoutScreenshotElementWithProgress(
    progress: Progress,
    selector: string,
    timeout: number,
    options: ScreenshotOptions,
  ): Promise<Buffer> {
    return await this._executeWithElementHandle(selector, 30000, async (handle, p) => {
      await this.rafrafTimeout(p, timeout);
      const bufferLike = await this.frameManager.page.screenshotter.screenshotElement(
        p,
        handle,
        options,
      );

      // Convert BrowserBuffer to Node.js Buffer for compatibility
      if (
        bufferLike &&
        typeof bufferLike.length === 'number' &&
        typeof bufferLike.toString === 'function'
      ) {
        const base64 = bufferLike.toString('base64');
        const result = Buffer.from(base64, 'base64');
        return result;
      }
      return bufferLike as unknown as Buffer;
    });
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

  async check(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, { strict: true });
        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }
        try {
          return await handle.checkWithProgress(progress);
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async uncheck(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, { strict: true });
        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }
        try {
          return await handle.uncheckWithProgress(progress);
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async setChecked(
    selector: string,
    checked: boolean,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    if (checked) {
      await this.check(selector, options);
    } else {
      await this.uncheck(selector, options);
    }
  }

  async fill(
    selector: string,
    value: string,
    options?: { timeout?: number; force?: boolean },
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.fillWithProgress(progress, value, options),
    );
  }

  async selectOption(
    selector: string,
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions,
  ): Promise<string[]> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.selectOptionWithProgress(progress, values, options),
    );
  }

  async clear(selector: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.clearWithProgress(progress, options),
    );
  }

  /**
   * Sets files on an input element following Playwright patterns.
   * This method provides a high-level interface for setting files with proper validation.
   *
   * @param selector CSS selector for the input element
   * @param files Array of file payloads or File objects to set
   * @param options Options for the operation including timeout and force
   * @returns Promise that resolves when files are set
   *
   * @example
   * ```typescript
   * // Set files from File objects
   * await frame.setInputFiles('#file-input', [file1, file2]);
   *
   * // Set files from data with custom options
   * await frame.setInputFiles('#file-input', [
   *   { name: 'test.txt', mimeType: 'text/plain', buffer: textBuffer }
   * ], { force: true, timeout: 60000 });
   * ```
   */
  async setInputFiles(
    selector: string,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[] | File[],
    options?: { force?: boolean; directoryUpload?: boolean; timeout?: number },
  ): Promise<void> {
    // For hidden elements with force option, wait for attached state instead of visible
    const waitState = getFileInputWaitState(options?.force);

    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, {
          strict: true,
          state: waitState,
        });

        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }

        try {
          const result = await handle.setInputFilesWithProgress(progress, files, options);
          return result;
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async highlight(selector: string, options?: { timeout?: number }): Promise<void> {
    return await executeWithProgress(
      async () => {
        await this.context.highlight(selector);
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async hideHighlight(): Promise<void> {
    return await executeWithProgress(
      async () => {
        await this.context.hideHighlight();
      },
      { timeout: 30000 },
    );
  }

  async evaluate<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<R> {
    return await executeWithProgress(
      async p => {
        // Ensure execution context is available. During history navigations
        // (e.g. goBack/goForward), the content script may not yet be reloaded
        // for the new document, causing this._context to be undefined briefly.
        // Wait a short period for the context to be re-created instead of
        // throwing synchronously.
        if (!this._context) {
          await this._retryWithProgressAndTimeouts(
            p,
            [50, 100, 200, 400, 800, 1200, 2000],
            async continuePolling => {
              return this._context ? true : continuePolling;
            },
          );
        }

        if (!this._context) {
          throw new Error(`Frame ${this.frameId} has no execution context`);
        }
        // Pass function directly, args as rest parameters
        if (arg !== undefined) {
          const result = await this.context.executeScript(pageFunction, 'ISOLATED', arg);
          return result as R;
        } else {
          // Cast to no-arg function when no argument provided
          const noArgFunction = pageFunction as () => R;
          const result = await this.context.executeScript(noArgFunction, 'ISOLATED');
          return result as R;
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async evaluateHandle<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<ElementHandle | null> {
    return await executeWithProgress(
      async () => {
        // Pass function directly, args as rest parameters
        if (arg !== undefined) {
          const result = await this.context.evaluateHandle(pageFunction, 'ISOLATED', arg);
          return result;
        } else {
          // Cast to no-arg function when no argument provided
          const noArgFunction = pageFunction as () => R;
          const result = await this.context.evaluateHandle(noArgFunction, 'ISOLATED');
          return result;
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async queryCount(selector: string): Promise<number> {
    return await this.selectors.queryCount(selector);
  }

  async queryAll(selector: string, scope?: ElementHandle): Promise<ElementHandle[]> {
    return await this.selectors.queryAll(selector, scope);
  }

  async getAttribute(
    selector: string,
    name: string,
    options?: { timeout?: number },
  ): Promise<string | null> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.getAttribute(name),
    );
  }

  async hover(selector: string, options?: { timeout?: number }): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.hover(),
    );
  }

  async innerHTML(selector: string, options?: { timeout?: number }): Promise<string> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.innerHTML(),
    );
  }

  async innerText(selector: string, options?: { timeout?: number }): Promise<string> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.innerText(),
    );
  }

  async textContent(selector: string, options?: { timeout?: number }): Promise<string> {
    const result = await this._executeWithElementHandle(
      selector,
      options?.timeout || 30000,
      handle => handle.textContent(),
    );
    return result;
  }

  async inputValue(selector: string, options?: { timeout?: number }): Promise<string> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.inputValue(),
    );
  }

  async isChecked(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isChecked(),
    );
  }

  async isDisabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isDisabled(),
    );
  }

  async isEditable(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isEditable(),
    );
  }

  async isEnabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isEnabled(),
    );
  }

  async isHidden(selector: string, options?: { timeout?: number }): Promise<boolean> {
    // For isHidden, we need to find the element whether it's visible or hidden
    // So we use state: 'attached' instead of the default 'visible'
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, {
          strict: true,
          state: 'attached',
        });

        if (!handle) {
          throw new Error(createElementNotFoundError(selector));
        }

        try {
          return await handle.isHidden();
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async isVisible(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isVisible(),
    );
  }

  async press(
    selector: string,
    key: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.press(key, { delay: options?.delay }),
    );
  }

  async type(
    selector: string,
    text: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.type(text, { delay: options?.delay }),
    );
  }

  /**
   * Generate an ARIA snapshot for the frame or a specific element within it.
   *
   * @param options Configuration options for the ARIA snapshot
   * @param options.forAI Whether to optimize the snapshot for AI consumption (default: true)
   * @param options.refPrefix Prefix to use for element references in the snapshot (default: '')
   * @param options.selector Optional CSS selector to target a specific element (default: entire frame)
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: 30000)
   * @returns A string representation of the ARIA accessibility tree
   *
   * @example
   * ```typescript
   * // Get ARIA snapshot of entire frame
   * const fullSnapshot = await frame.ariaSnapshot({ forAI: true });
   *
   * // Get ARIA snapshot of specific element
   * const formSnapshot = await frame.ariaSnapshot({
   *   forAI: true,
   *   selector: '#main-form',
   *   refPrefix: 'form'
   * });
   * ```
   */
  async ariaSnapshot(options?: {
    forAI?: boolean;
    refPrefix?: string;
    selector?: string;
    timeout?: number;
  }): Promise<string> {
    if (!this._context) {
      throw new Error('Frame context not available');
    }

    const forAI = options?.forAI ?? true;
    const refPrefix = options?.refPrefix ?? '';
    const timeout = options?.timeout ?? 30000;

    if (options?.selector) {
      // Get snapshot for specific element
      return this._executeWithElementHandle(options.selector, timeout, async handle => {
        if (!this._context) {
          throw new Error('Frame context not available');
        }
        const result = await this._context.ariaSnapshot(forAI, refPrefix, 'ISOLATED', handle);
        return typeof result === 'string' ? result : '';
      });
    } else {
      // Get snapshot for entire frame
      const result = await this._context.ariaSnapshot(forAI, refPrefix, 'ISOLATED');
      return typeof result === 'string' ? result : '';
    }
  }

  /**
   * Creates a file transfer port in the content script for transferring files and buffers.
   * This creates a temporary communication channel between the content script and side panel
   * specifically for file and buffer transfers.
   *
   * @param options Configuration options for the file transfer port
   * @param options.timeout Maximum time to wait for port creation in milliseconds (default: 30000)
   * @returns The port ID that can be used to communicate with the created port
   *
   * @example
   * ```typescript
   * // Create a file transfer port
   * const portId = await frame.createFileTransferPort();
   *
   * // Use the port ID with FileTransferPortController to manage transfers
   * const controller = new FileTransferPortController();
   * const port = controller.getPort(portId);
   * if (port) {
   *   await port.requestFile('#file-input');
   * }
   * ```
   */
  async createFileTransferPort(options?: { timeout?: number }): Promise<string> {
    if (!this._context) {
      throw new Error('Frame context not available');
    }

    const timeout = options?.timeout ?? 30000;

    return executeWithProgress(
      async () => {
        const portId = await this._context!.createFileTransferPort();
        if (!portId) {
          throw new Error('Failed to create file transfer port');
        }
        return portId;
      },
      { timeout },
    );
  }

  async maskSelectors(selectors: ParsedSelector[], color: string): Promise<void> {
    if (!this._context) {
      throw new Error('Frame context not available');
    }

    await this._context.executeScript(
      (parsedSelectors: unknown[], maskColor: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        if (injected && injected.maskSelectors) {
          injected.maskSelectors(parsedSelectors, maskColor);
        }
      },
      'ISOLATED',
      selectors as unknown[],
      color,
    );
  }

  /**
   * Network request management methods for tracking inflight requests
   * These methods provide interface compatibility with browser-use context expectations
   */

  /**
   * Add a network request to the inflight requests set
   * Used when a new request is initiated from this frame
   */
  _addInflightRequest(
    requestInfo: RequestInfo,
    documentId?: string,
  ): InstanceType<typeof Network.Request> {
    const request = new Network.Request(requestInfo, documentId);
    this._inflightRequests.add(request);
    return request;
  }

  /**
   * Remove a network request from the inflight requests set
   * Used when a request completes or fails
   */
  _removeInflightRequest(request: InstanceType<typeof Network.Request>): void {
    this._inflightRequests.delete(request);
  }

  /**
   * Find an inflight request by document ID
   * Used by frameManager to locate requests associated with document navigations
   */
  _findRequestByDocumentId(documentId: string): InstanceType<typeof Network.Request> | undefined {
    return Array.from(this._inflightRequests).find(request => request._documentId === documentId);
  }

  /**
   * Clear all inflight requests
   * Used during frame disposal or context reset
   */
  _clearInflightRequests(): void {
    this._inflightRequests.clear();
  }

  /**
   * Get the full HTML content of the frame including doctype and document element.
   * Chrome extension-compatible version of Playwright's frame.content()
   * @returns Promise resolving to the complete HTML content as a string
   */
  async content(): Promise<string> {
    try {
      return await this.evaluate(() => {
        let retVal = '';
        if (document.doctype) {
          retVal = new XMLSerializer().serializeToString(document.doctype);
        }
        if (document.documentElement) {
          retVal += document.documentElement.outerHTML;
        }
        return retVal;
      });
    } catch (e) {
      if (e instanceof Error && this.isNonRetriableError(e)) {
        throw e;
      }
      throw new Error(
        'Unable to retrieve content because the page is navigating and changing the content.',
      );
    }
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
        createFrameEnterSelector(this._frameSelector, selectorOrLocator),
        options,
      );
    if (selectorOrLocator._frame !== this._frame)
      throw new Error(`Locators must belong to the same frame.`);
    return new Locator(
      this._frame,
      createFrameEnterSelector(this._frameSelector, selectorOrLocator._selector),
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
    return new FrameLocator(this._frame, createFrameEnterSelector(this._frameSelector, selector));
  }

  first(): FrameLocator {
    return new FrameLocator(this._frame, createFrameNthSelector(this._frameSelector, 0));
  }

  last(): FrameLocator {
    return new FrameLocator(this._frame, createFrameNthSelector(this._frameSelector, -1));
  }

  nth(index: number): FrameLocator {
    return new FrameLocator(this._frame, createFrameNthSelector(this._frameSelector, index));
  }

  content() {}
}
