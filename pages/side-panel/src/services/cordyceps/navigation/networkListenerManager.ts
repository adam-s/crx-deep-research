import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, IDisposable, DisposableStore } from 'vs/base/common/lifecycle';
import { Progress } from '../core/progress';

// Network event interfaces for chrome.webRequest integration
export interface RequestInfo {
  id: string;
  url: string;
  method: string;
  resourceType: string;
  headers: Record<string, string>;
  timestamp: number;
  tabId: number;
  frameId: number;
}

export interface ResponseInfo {
  id: string;
  url: string;
  status: number;
  headers: Record<string, string>;
  timestamp: number;
  request: RequestInfo;
  tabId: number;
  frameId: number;
}

export interface TabNetworkEvents {
  onRequest: Event<RequestInfo>;
  // For backward-compatibility, onResponse fires on request completion.
  onResponse: Event<ResponseInfo>;
  // New granular events:
  onCompleted: Event<ResponseInfo>;
  onError: Event<{ id: string; tabId: number; frameId: number; url: string; error: string }>;
}

/**
 * Centralized network listener manager that uses a single set of chrome.webRequest listeners
 * and distributes events to tab-specific emitters. This prevents memory leaks from multiple
 * global listeners and ensures proper cleanup.
 */
export class NetworkListenerManager extends Disposable {
  private static _instance: NetworkListenerManager | undefined;

  private readonly _tabEmitters = new Map<
    number,
    {
      requestEmitter: Emitter<RequestInfo>;
      responseEmitter: Emitter<ResponseInfo>;
      completedEmitter: Emitter<ResponseInfo>;
      errorEmitter: Emitter<{
        id: string;
        tabId: number;
        frameId: number;
        url: string;
        error: string;
      }>;
      pendingRequests: Map<string, RequestInfo>;
      // Temporary debug tracking for a single-run investigation
      debug: {
        requestListeners: number;
        responseListeners: number;
        requestEmits: number;
        responseEmits: number;
        emitterId: string;
      };
      // Wrapped events that track listener counts
      requestEvent: Event<RequestInfo>;
      responseEvent: Event<ResponseInfo>;
      completedEvent: Event<ResponseInfo>;
      errorEvent: Event<{ id: string; tabId: number; frameId: number; url: string; error: string }>;
      refCount: number; // Track active registrations to prevent emitter disposal
    }
  >();

  private _globalListenersRegistered = false;
  private _sweeper: ReturnType<typeof setInterval> | undefined;

  // Configuration
  private static readonly MAX_PENDING_REQUESTS_PER_TAB = 5000;
  private static readonly STALE_REQUEST_AGE_MS = 30000;
  private static readonly SWEEP_INTERVAL_MS = 10000;

  private constructor() {
    super();
    this._setupGlobalListeners();
  }

  public static getInstance(): NetworkListenerManager {
    // Pin to globalThis to ensure true cross-context singleton
    const g = globalThis as Record<string, unknown>;
    if (g.__NLM_INSTANCE__) {
      return g.__NLM_INSTANCE__ as NetworkListenerManager;
    }

    if (!NetworkListenerManager._instance) {
      NetworkListenerManager._instance = new NetworkListenerManager();
    }

    // Pin to globalThis for cross-context access
    g.__NLM_INSTANCE__ = NetworkListenerManager._instance;

    return NetworkListenerManager._instance;
  }

  /**
   * Create new TabData with all required properties
   */
  private _createTabData(tabId: number): {
    requestEmitter: Emitter<RequestInfo>;
    responseEmitter: Emitter<ResponseInfo>;
    completedEmitter: Emitter<ResponseInfo>;
    errorEmitter: Emitter<{
      id: string;
      tabId: number;
      frameId: number;
      url: string;
      error: string;
    }>;
    pendingRequests: Map<string, RequestInfo>;
    debug: {
      requestListeners: number;
      responseListeners: number;
      requestEmits: number;
      responseEmits: number;
      emitterId: string;
    };
    requestEvent: Event<RequestInfo>;
    responseEvent: Event<ResponseInfo>;
    completedEvent: Event<ResponseInfo>;
    errorEvent: Event<{ id: string; tabId: number; frameId: number; url: string; error: string }>;
    refCount: number;
  } {
    const requestEmitter = this._register(new Emitter<RequestInfo>());
    const responseEmitter = this._register(new Emitter<ResponseInfo>());
    const completedEmitter = this._register(new Emitter<ResponseInfo>());
    const errorEmitter = this._register(
      new Emitter<{ id: string; tabId: number; frameId: number; url: string; error: string }>(),
    );
    const pendingRequests = new Map<string, RequestInfo>();

    const emitterId = `tab-${tabId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const debug = {
      requestListeners: 0,
      responseListeners: 0,
      requestEmits: 0,
      responseEmits: 0,
      emitterId,
    };

    const requestEvent = this._wrapEventWithDebug(tabId, 'request', requestEmitter.event);
    const responseEvent = this._wrapEventWithDebug(tabId, 'response', responseEmitter.event);
    const completedEvent = completedEmitter.event;
    const errorEvent = errorEmitter.event;

    return {
      requestEmitter,
      responseEmitter,
      completedEmitter,
      errorEmitter,
      pendingRequests,
      debug,
      requestEvent,
      responseEvent,
      completedEvent,
      errorEvent,
      refCount: 0,
    };
  }

  /**
   * Register a tab for network monitoring with ref counting
   * Returns disposable event handlers for the tab
   */
  public registerTab(tabId: number): TabNetworkEvents & Disposable {
    // Get or create tab data (idempotent - don't destroy existing emitters)
    let tabData = this._tabEmitters.get(tabId);
    if (!tabData) {
      tabData = this._createTabData(tabId);
      this._tabEmitters.set(tabId, tabData);
      console.log(`[NetworkListenerManager.registerTab] Created new tab data for ${tabId}`);
    } else {
      console.log(`[NetworkListenerManager.registerTab] Reusing existing tab data for ${tabId}`);
    }

    // Increment ref count
    tabData.refCount++;

    // Create a concrete disposable class that implements TabNetworkEvents
    class TabNetworkEventHandler extends Disposable implements TabNetworkEvents {
      readonly onRequest: Event<RequestInfo>;
      readonly onResponse: Event<ResponseInfo>;
      readonly onCompleted: Event<ResponseInfo>;
      readonly onError: Event<{
        id: string;
        tabId: number;
        frameId: number;
        url: string;
        error: string;
      }>;

      constructor(
        private readonly manager: NetworkListenerManager,
        private readonly tabId: number,
      ) {
        super();

        // Initialize events after manager is assigned
        const tabData = this.manager._tabEmitters.get(this.tabId)!;
        this.onRequest = tabData.requestEvent;
        this.onResponse = tabData.responseEvent;
        this.onCompleted = tabData.completedEvent;
        this.onError = tabData.errorEvent;

        this._register({
          dispose: () => {
            // Decrement ref count and only unregister if count reaches 0
            const tabData = this.manager._tabEmitters.get(this.tabId);
            if (tabData) {
              tabData.refCount = Math.max(0, tabData.refCount - 1);
              if (tabData.refCount === 0) {
                this.manager._unregisterTab(this.tabId);
              }
            }
          },
        });
      }
    }

    const handler = new TabNetworkEventHandler(this, tabId);
    return handler;
  }

  /**
   * Subscribe to an existing tab's network events without re-registering the tab.
   * If the tab is not yet registered, it will be initialized. Disposing the
   * returned object will NOT unregister the tab; dispose individual event
   * subscriptions returned from `onRequest`/`onResponse` instead.
   */
  public subscribeTab(tabId: number): TabNetworkEvents & Disposable {
    // Ensure global listeners are active
    this._setupGlobalListeners();

    // Ensure tab emitters exist (reuse if already present)
    let tabData = this._tabEmitters.get(tabId);
    if (!tabData) {
      tabData = this._createTabData(tabId);
      this._tabEmitters.set(tabId, tabData);
    }

    // Lightweight handler that does NOT unregister the tab on dispose
    class TabNetworkEventSubscriber extends Disposable implements TabNetworkEvents {
      readonly onRequest = tabData!.requestEvent;
      readonly onResponse = tabData!.responseEvent;
      readonly onCompleted = tabData!.completedEvent;
      readonly onError = tabData!.errorEvent;
    }

    return new TabNetworkEventSubscriber();
  }

  private _unregisterTab(tabId: number): void {
    const tabData = this._tabEmitters.get(tabId);
    if (tabData) {
      if (tabData.refCount > 1) {
        tabData.refCount--;
        return;
      }

      tabData.requestEmitter.dispose();
      tabData.responseEmitter.dispose();
      tabData.pendingRequests.clear();
      this._tabEmitters.delete(tabId);
    }
  }

  private _setupGlobalListeners(): void {
    // Guard: only install webRequest listeners if available
    if (typeof chrome === 'undefined' || !chrome.webRequest) {
      return;
    }

    if (this._globalListenersRegistered) {
      return;
    }
    const onBeforeRequest = (details: chrome.webRequest.WebRequestDetails) => {
      // Filter out invalid/unwanted requests early
      if (details.tabId < 0) {
        return; // Service requests, downloads, etc.
      }

      // Filter out own extension requests to reduce noise
      if (details.url.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
        return;
      }

      const tabData = this._tabEmitters.get(details.tabId);
      if (!tabData) {
        return;
      }

      // Enforce pending request limits to prevent memory leaks
      if (tabData.pendingRequests.size >= NetworkListenerManager.MAX_PENDING_REQUESTS_PER_TAB) {
        tabData.pendingRequests.clear();
      }

      const requestInfo: RequestInfo = {
        id: details.requestId,
        url: details.url,
        method: details.method || 'GET',
        resourceType: NetworkListenerManager.getResourceType(details.url, details.type),
        headers: {},
        timestamp: details.timeStamp,
        tabId: details.tabId,
        frameId: (details as chrome.webRequest.WebRequestBodyDetails).frameId ?? 0,
      };

      tabData.pendingRequests.set(details.requestId, requestInfo);

      // Debug: count emitted request events
      tabData.debug.requestEmits += 1;
      tabData.requestEmitter.fire(requestInfo);
    };

    const onBeforeSendHeaders = (details: chrome.webRequest.WebRequestHeadersDetails) => {
      // Filter out invalid/unwanted requests early
      if (details.tabId < 0) {
        return;
      }

      // Filter out own extension requests to reduce noise
      if (details.url.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
        return;
      }

      const tabData = this._tabEmitters.get(details.tabId);
      if (!tabData) {
        return;
      }

      const requestInfo = tabData.pendingRequests.get(details.requestId);
      if (requestInfo && details.requestHeaders) {
        // Convert chrome headers array to object
        const headers: Record<string, string> = {};
        for (const header of details.requestHeaders) {
          if (header.name && header.value) {
            headers[header.name.toLowerCase()] = header.value;
          }
        }
        requestInfo.headers = headers;
      }
    };

    const onCompleted = (details: chrome.webRequest.WebResponseDetails) => {
      // Apply same filtering as onBeforeRequest
      if (details.tabId < 0 || details.url.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
        return;
      }

      const tabData = this._tabEmitters.get(details.tabId);
      if (!tabData) {
        return;
      }

      const requestInfo = tabData.pendingRequests.get(details.requestId);
      if (!requestInfo) {
        return;
      }

      const responseInfo: ResponseInfo = {
        id: details.requestId,
        url: details.url,
        status: details.statusCode || 0,
        headers:
          (requestInfo as RequestInfo & { _responseHeaders?: Record<string, string> })
            ._responseHeaders || {},
        timestamp: details.timeStamp,
        request: requestInfo,
        tabId: details.tabId,
        frameId:
          (details as chrome.webRequest.WebResponseCacheDetails).frameId ?? requestInfo.frameId,
      };

      tabData.pendingRequests.delete(details.requestId);

      // Debug: count emitted response events
      tabData.debug.responseEmits += 1;
      // Backward-compatibility: treat onResponse as completion
      tabData.responseEmitter.fire(responseInfo);
      // New: emit dedicated completed event
      tabData.completedEmitter.fire(responseInfo);
    };

    const onHeadersReceived = (details: chrome.webRequest.WebResponseHeadersDetails) => {
      // Filter out invalid/unwanted requests early
      if (details.tabId < 0) {
        return;
      }

      // Filter out own extension requests to reduce noise
      if (details.url.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
        return;
      }

      const tabData = this._tabEmitters.get(details.tabId);
      if (!tabData) {
        return;
      }

      const requestInfo = tabData.pendingRequests.get(details.requestId);
      if (requestInfo && details.responseHeaders) {
        // Store response headers for later use in onCompleted
        // Convert chrome headers array to object
        const headers: Record<string, string> = {};
        for (const header of details.responseHeaders) {
          if (header.name && header.value) {
            headers[header.name.toLowerCase()] = header.value;
          }
        }
        // Store response headers on the request for pickup in onCompleted
        (
          requestInfo as RequestInfo & { _responseHeaders?: Record<string, string> }
        )._responseHeaders = headers;
      }
    };

    const onErrorOccurred = (details: chrome.webRequest.WebRequestDetails) => {
      // Apply same filtering as onBeforeRequest
      if (details.tabId < 0 || details.url.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
        return;
      }
      const tabData = this._tabEmitters.get(details.tabId);
      if (tabData) {
        tabData.pendingRequests.delete(details.requestId);
        // Emit error event with minimal info
        const frameId = (details as chrome.webRequest.WebRequestBodyDetails).frameId ?? 0;
        const error = (details as chrome.webRequest.WebResponseErrorDetails).error || 'unknown';
        tabData.errorEmitter.fire({
          id: details.requestId,
          tabId: details.tabId,
          frameId,
          url: details.url,
          error,
        });
      }
    };

    try {
      chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, { urls: ['<all_urls>'] });
    } catch (error) {
      return; // Exit if we can't add the primary listener
    }

    try {
      chrome.webRequest.onBeforeSendHeaders.addListener(
        onBeforeSendHeaders,
        { urls: ['<all_urls>'] },
        ['requestHeaders'],
      );
    } catch (error) {
      console.log(
        `[NetworkListenerManager._setupGlobalListeners] Failed to add onBeforeSendHeaders listener:`,
        error,
      );
    }

    try {
      chrome.webRequest.onHeadersReceived.addListener(onHeadersReceived, { urls: ['<all_urls>'] }, [
        'responseHeaders',
      ]);
    } catch (error) {
      console.log(
        `[NetworkListenerManager._setupGlobalListeners] Failed to add onHeadersReceived listener:`,
        error,
      );
    }

    try {
      chrome.webRequest.onCompleted.addListener(onCompleted, { urls: ['<all_urls>'] });
    } catch (error) {
      console.log(
        `[NetworkListenerManager._setupGlobalListeners] Failed to add onCompleted listener:`,
        error,
      );
    }

    try {
      chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, { urls: ['<all_urls>'] });
    } catch (error) {
      console.log(
        `[NetworkListenerManager._setupGlobalListeners] Failed to add onErrorOccurred listener:`,
        error,
      );
    }

    // Register cleanup for global listeners and tab lifecycle
    this._register({
      dispose: () => {
        console.log(`[NetworkListenerManager.dispose] Removing chrome.webRequest listeners`);
        chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
        chrome.webRequest.onBeforeSendHeaders.removeListener(onBeforeSendHeaders);
        chrome.webRequest.onHeadersReceived.removeListener(onHeadersReceived);
        chrome.webRequest.onCompleted.removeListener(onCompleted);
        chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
        this._globalListenersRegistered = false;
        console.log('🗑️ NetworkListenerManager: Global webRequest listeners removed');
      },
    });

    // Add tab lifecycle cleanup - critical for preventing leaks
    const onTabRemoved = (tabId: number) => {
      const hadTab = this._tabEmitters.has(tabId);
      if (hadTab) {
        this._unregisterTab(tabId);
      }
    };

    chrome.tabs.onRemoved.addListener(onTabRemoved);
    this._register({
      dispose: () => {
        chrome.tabs.onRemoved.removeListener(onTabRemoved);
      },
    });

    // Add navigation cleanup to prevent stale pending requests
    const onBeforeNavigate = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
      const { tabId, frameId } = details;
      const tabData = this._tabEmitters.get(tabId);
      if (tabData && frameId === 0) {
        // Clear pending requests on main frame navigation
        const pendingCount = tabData.pendingRequests.size;
        if (pendingCount > 0) {
          tabData.pendingRequests.clear();
        }
      }
    };

    chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    this._register({
      dispose: () => {
        chrome.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
      },
    });

    this._globalListenersRegistered = true;

    // Start automatic cleanup sweeper
    this._startSweeper();
  }

  /**
   * Clean up all tab registrations and dispose of the singleton
   */
  dispose(): void {
    // Unregister all tabs
    const tabIds = Array.from(this._tabEmitters.keys());

    for (const tabId of tabIds) {
      this._unregisterTab(tabId);
    }

    super.dispose();
    NetworkListenerManager._instance = undefined;
  }

  /**
   * Get comprehensive statistics about current network monitoring
   * Useful for performance monitoring and leak detection
   */
  public getStats(): {
    registeredTabs: number;
    totalPendingRequests: number;
    totalListeners: number;
    totalEmits: number;
    tabDetails: Array<{
      tabId: number;
      pendingRequests: number;
      listeners: number;
      emits: number;
      refCount: number;
    }>;
  } {
    let totalListeners = 0;
    let totalEmits = 0;

    const tabDetails = Array.from(this._tabEmitters.entries()).map(([tabId, data]) => {
      const listeners = data.debug.requestListeners + data.debug.responseListeners;
      const emits = data.debug.requestEmits + data.debug.responseEmits;
      totalListeners += listeners;
      totalEmits += emits;

      return {
        tabId,
        pendingRequests: data.pendingRequests.size,
        listeners,
        emits,
        refCount: data.refCount,
      };
    });

    const stats = {
      registeredTabs: this._tabEmitters.size,
      totalPendingRequests: tabDetails.reduce((sum, tab) => sum + tab.pendingRequests, 0),
      totalListeners,
      totalEmits,
      tabDetails,
    };

    return stats;
  }

  /**
   * Force cleanup of stale pending requests for a tab
   * Call this periodically or when memory pressure is detected
   */
  public cleanupStaleRequests(tabId: number, maxAge: number = 30000): number {
    const tabData = this._tabEmitters.get(tabId);
    if (!tabData) {
      return 0;
    }

    const now = Date.now();
    let cleaned = 0;

    for (const [requestId, requestInfo] of tabData.pendingRequests) {
      const age = now - requestInfo.timestamp;
      if (age > maxAge) {
        tabData.pendingRequests.delete(requestId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`🧹 NetworkListenerManager: Cleaned ${cleaned} stale requests for tab ${tabId}`);
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup sweeper for stale requests
   */
  private _startSweeper(): void {
    if (this._sweeper) {
      return; // Already running
    }

    this._sweeper = setInterval(() => {
      for (const [tabId] of this._tabEmitters) {
        this.cleanupStaleRequests(tabId, NetworkListenerManager.STALE_REQUEST_AGE_MS);
      }
    }, NetworkListenerManager.SWEEP_INTERVAL_MS);

    this._register({
      dispose: () => {
        if (this._sweeper) {
          clearInterval(this._sweeper);
          this._sweeper = undefined;
        }
      },
    });
  }

  /**
   * Optimized resource type detection using webRequest hints first
   * @param url URL to analyze
   * @param hinted Resource type hint from chrome.webRequest
   * @returns Resource type string
   */
  public static getResourceType(url: string, hinted?: chrome.webRequest.ResourceType): string {
    // Use webRequest hint if available and not generic "other"
    if (hinted && hinted !== 'other') {
      return hinted; // main_frame, stylesheet, image, script, etc.
    }

    // Fallback to URL suffix analysis only when needed
    try {
      const pathname = new URL(url).pathname.toLowerCase();

      if (pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/)) {
        return 'image';
      }
      if (pathname.match(/\.(mp4|webm|ogg|mp3|wav|flac)$/)) {
        return 'media';
      }
      if (pathname.match(/\.(woff2?|ttf|eot|otf)$/)) {
        return 'font';
      }
      if (pathname.match(/\.css$/)) {
        return 'stylesheet';
      }
      if (pathname.match(/\.(m?js)$/)) {
        return 'script';
      }

      return 'document';
    } catch {
      // If URL parsing fails, assume it's a document
      return 'document';
    }
  }

  /**
   * Wait for network stability with race condition handling.
   * This method can be used by browser-use context for network stability detection.
   *
   * @param tabNetworkEvents Tab-specific network events to monitor
   * @param progress Progress controller for abort handling
   * @param options Network stability options
   * @returns Promise that resolves when network is stable
   */
  public static async waitForNetworkStability(
    tabNetworkEvents: TabNetworkEvents,
    progress: Progress,
    options: {
      idleTime?: number;
      timeout?: number;
      ignoredResourceTypes?: string[];
    } = {},
  ): Promise<void> {
    const {
      idleTime = 500,
      timeout = 30000,
      ignoredResourceTypes = ['image', 'media', 'font'],
    } = options;

    progress.log(`Waiting for network stability (idle: ${idleTime}ms, timeout: ${timeout}ms)`);

    let lastRequestTime = Date.now();
    let pendingRequests = 0;
    let stabilityCheckId: NodeJS.Timeout | undefined;

    // Promise that resolves when network is stable
    const stabilityPromise = new Promise<void>((resolve, reject) => {
      const checkStability = () => {
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;

        if (pendingRequests === 0 && timeSinceLastRequest >= idleTime) {
          progress.log(
            `Network stability achieved (${pendingRequests} pending, ${timeSinceLastRequest}ms idle)`,
          );
          resolve();
          return;
        }

        // Schedule next check
        stabilityCheckId = setTimeout(checkStability, Math.min(100, idleTime / 5));
      };

      // Listen for network events
      const requestDisposable = tabNetworkEvents.onRequest(request => {
        // Filter out ignored resource types using optimized detection
        const resourceType = NetworkListenerManager.getResourceType(
          request.url,
          request.resourceType as chrome.webRequest.ResourceType,
        );
        if (!ignoredResourceTypes.includes(resourceType)) {
          lastRequestTime = Date.now();
          pendingRequests++;
          progress.log(
            `Network activity: ${request.method} ${request.url} (pending: ${pendingRequests})`,
          );
        }
      });

      const responseDisposable = tabNetworkEvents.onResponse(response => {
        // Filter out ignored resource types using optimized detection
        const resourceType = NetworkListenerManager.getResourceType(
          response.url,
          response.request.resourceType as chrome.webRequest.ResourceType,
        );
        if (!ignoredResourceTypes.includes(resourceType)) {
          pendingRequests = Math.max(0, pendingRequests - 1);
          progress.log(
            `Network response: ${response.status} ${response.url} (pending: ${pendingRequests})`,
          );
        }
      });

      // Set up cleanup
      progress.cleanupWhenAborted(() => {
        if (stabilityCheckId) {
          clearTimeout(stabilityCheckId);
        }
        requestDisposable.dispose();
        responseDisposable.dispose();
      });

      // Start stability checking
      stabilityCheckId = setTimeout(checkStability, idleTime);

      // Set up timeout
      const timeoutId = setTimeout(() => {
        if (stabilityCheckId) {
          clearTimeout(stabilityCheckId);
        }
        requestDisposable.dispose();
        responseDisposable.dispose();
        reject(
          new Error(
            `Network stability timeout after ${timeout}ms (${pendingRequests} pending requests)`,
          ),
        );
      }, timeout);

      // Clean up timeout when resolved
      const originalResolve = resolve;
      resolve = () => {
        clearTimeout(timeoutId);
        requestDisposable.dispose();
        responseDisposable.dispose();
        originalResolve();
      };
    });

    // Race against progress abort signal
    return progress.race(stabilityPromise);
  }

  // Wrap an event to track listener subscribe/unsubscribe counts per tab and channel
  private _wrapEventWithDebug<T>(
    tabId: number,
    channel: 'request' | 'response',
    event: Event<T>,
  ): Event<T> {
    return (
      listener: (e: T) => void,
      thisArgs?: unknown,
      disposables?: IDisposable[] | DisposableStore,
    ) => {
      const tabData = this._tabEmitters.get(tabId);
      if (!tabData) {
        // Should not happen for registered/subscribed tabs, but return a no-op disposable just in case
        return { dispose: () => undefined } as IDisposable;
      }

      if (channel === 'request') {
        tabData.debug.requestListeners += 1;
      } else {
        tabData.debug.responseListeners += 1;
      }

      // Subscribe to the underlying event WITHOUT passing disposables (we'll handle that ourselves)
      const subscription = event(listener, thisArgs);
      const combined: IDisposable = {
        dispose: () => {
          subscription.dispose();
          const data = this._tabEmitters.get(tabId);
          if (!data) return;
          if (channel === 'request') {
            data.debug.requestListeners = Math.max(0, data.debug.requestListeners - 1);
          } else {
            data.debug.responseListeners = Math.max(0, data.debug.responseListeners - 1);
          }
        },
      };

      // Add our combined disposable to the provided disposables array/store
      if (Array.isArray(disposables)) {
        disposables.push(combined);
      } else if (disposables instanceof DisposableStore) {
        disposables.add(combined);
      }
      return combined;
    };
  }

  /**
   * Temporary: Return per-tab emitter debug snapshot for diagnostics.
   */
  public getTabEmitterDebug(tabId: number): {
    requestListeners: number;
    responseListeners: number;
    requestEmits: number;
    responseEmits: number;
    emitterId: string;
  } | null {
    const tabData = this._tabEmitters.get(tabId);
    if (!tabData) return null;
    const { debug } = tabData;
    return {
      requestListeners: debug.requestListeners,
      responseListeners: debug.responseListeners,
      requestEmits: debug.requestEmits,
      responseEmits: debug.responseEmits,
      emitterId: debug.emitterId,
    };
  }

  /**
   * Check for potential memory leaks and report issues
   */
  public checkForLeaks(): {
    hasLeaks: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    const stats = this.getStats();

    // Check for excessive pending requests
    if (stats.totalPendingRequests > 1000) {
      issues.push(`High pending requests: ${stats.totalPendingRequests} total`);
      recommendations.push('Consider reducing network activity or increasing cleanup frequency');
    }

    // Check for tabs with high listener counts
    for (const tab of stats.tabDetails) {
      if (tab.listeners > 10) {
        issues.push(`Tab ${tab.tabId} has ${tab.listeners} listeners (high)`);
        recommendations.push(`Check for listener leaks in tab ${tab.tabId}`);
      }
      if (tab.pendingRequests > 100) {
        issues.push(`Tab ${tab.tabId} has ${tab.pendingRequests} pending requests (high)`);
        recommendations.push(`Consider clearing stale requests for tab ${tab.tabId}`);
      }
      if (tab.refCount > 5) {
        issues.push(`Tab ${tab.tabId} has ${tab.refCount} references (unusual)`);
        recommendations.push(`Check for multiple Page instances for tab ${tab.tabId}`);
      }
    }

    // Check for many registered tabs
    if (stats.registeredTabs > 20) {
      issues.push(`Many registered tabs: ${stats.registeredTabs}`);
      recommendations.push('Consider implementing tab cleanup based on activity');
    }

    return {
      hasLeaks: issues.length > 0,
      issues,
      recommendations,
    };
  }
}
