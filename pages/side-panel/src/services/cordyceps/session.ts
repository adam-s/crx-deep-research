import { Event, Emitter } from 'vs/base/common/event';
import { CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED } from '@shared/utils/message';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { NavigationLifecycle } from './navigation/lifecycle';

export class Session extends Disposable {
  /**
   * Session is the adapter for Chrome APIs related to:
   * - content script handshake (runtime messages)
   * - tab lifecycle (tabs.onCreated/onRemoved)
   * - navigation lifecycle (webNavigation.*)
   *
   * Network observation (chrome.webRequest.*) is intentionally NOT handled here.
   * Use NetworkListenerManager for all request/response tracking to avoid double listeners
   * and to keep concerns separated.
   */
  private readonly _onContentScriptLoaded = this._register(
    new Emitter<chrome.runtime.MessageSender>(),
  );
  readonly onContentScriptLoaded: Event<chrome.runtime.MessageSender> =
    this._onContentScriptLoaded.event;

  private readonly _onTabCreated = this._register(new Emitter<chrome.tabs.Tab>());
  readonly onTabCreated: Event<chrome.tabs.Tab> = this._onTabCreated.event;

  private readonly _onTabRemoved = this._register(
    new Emitter<{
      tabId: number;
      removeInfo: chrome.tabs.TabRemoveInfo;
    }>(),
  );
  readonly onTabRemoved: Event<{ tabId: number; removeInfo: chrome.tabs.TabRemoveInfo }> =
    this._onTabRemoved.event;

  private readonly _onBeforeNavigate = this._register(
    new Emitter<chrome.webNavigation.WebNavigationParentedCallbackDetails>(),
  );
  readonly onBeforeNavigate: Event<chrome.webNavigation.WebNavigationParentedCallbackDetails> =
    this._onBeforeNavigate.event;

  private readonly _onCommitted = this._register(
    new Emitter<chrome.webNavigation.WebNavigationTransitionCallbackDetails>(),
  );
  readonly onCommitted: Event<chrome.webNavigation.WebNavigationTransitionCallbackDetails> =
    this._onCommitted.event;

  private readonly _onCompleted = this._register(
    new Emitter<chrome.webNavigation.WebNavigationFramedCallbackDetails>(),
  );
  readonly onCompleted: Event<chrome.webNavigation.WebNavigationFramedCallbackDetails> =
    this._onCompleted.event;

  private readonly _onDOMContentLoaded = this._register(
    new Emitter<chrome.webNavigation.WebNavigationFramedCallbackDetails>(),
  );
  readonly onDOMContentLoaded: Event<chrome.webNavigation.WebNavigationFramedCallbackDetails> =
    this._onDOMContentLoaded.event;

  // Same-document navigations
  private readonly _onHistoryStateUpdated = this._register(
    new Emitter<chrome.webNavigation.WebNavigationTransitionCallbackDetails>(),
  );
  readonly onHistoryStateUpdated: Event<chrome.webNavigation.WebNavigationTransitionCallbackDetails> =
    this._onHistoryStateUpdated.event;

  private readonly _onReferenceFragmentUpdated = this._register(
    new Emitter<chrome.webNavigation.WebNavigationTransitionCallbackDetails>(),
  );
  readonly onReferenceFragmentUpdated: Event<chrome.webNavigation.WebNavigationTransitionCallbackDetails> =
    this._onReferenceFragmentUpdated.event;

  private readonly _onErrorOccurred = this._register(
    new Emitter<chrome.webNavigation.WebNavigationFramedErrorCallbackDetails>(),
  );
  readonly onErrorOccurred: Event<chrome.webNavigation.WebNavigationFramedErrorCallbackDetails> =
    this._onErrorOccurred.event;

  readonly windowId: number;
  // Centralized navigation lifecycles per-tab for consistent wiring
  private readonly _navByTab = new Map<number, NavigationLifecycle>();

  constructor(windowId: number) {
    super();
    this.windowId = windowId;
    this._setupMessageListener();
    this._setupTabListeners();
    this._setupWebNavigationListeners();
    console.log(`✅ Session created for window ${windowId}`);
  }

  dispose(): void {
    console.log(`🗑️ Disposing Session for window ${this.windowId}`);
    console.log(`🗑️ Session removing Chrome API listeners`);

    super.dispose();
    console.log(`✅ Session for window ${this.windowId} disposed successfully`);
  }

  private _setupMessageListener(): void {
    const messageListener = (message: { type: string }, sender: chrome.runtime.MessageSender) => {
      if (message.type === CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED) {
        this._onContentScriptLoaded.fire(sender);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);
    this._register({
      dispose: () => chrome.runtime.onMessage.removeListener(messageListener),
    });
  }

  private _setupWebNavigationListeners(): void {
    const onBeforeNavigate = (details: chrome.webNavigation.WebNavigationParentedCallbackDetails) =>
      this._onBeforeNavigate.fire(details);
    const onCommitted = (details: chrome.webNavigation.WebNavigationTransitionCallbackDetails) =>
      this._onCommitted.fire(details);
    const onCompleted = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) =>
      this._onCompleted.fire(details);
    const onDOMContentLoaded = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) =>
      this._onDOMContentLoaded.fire(details);
    const onHistoryStateUpdated = (
      details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
    ) => this._onHistoryStateUpdated.fire(details);
    const onReferenceFragmentUpdated = (
      details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
    ) => this._onReferenceFragmentUpdated.fire(details);
    const onErrorOccurred = (
      details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails,
    ) => this._onErrorOccurred.fire(details);

    chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    chrome.webNavigation.onCommitted.addListener(onCommitted);
    chrome.webNavigation.onCompleted.addListener(onCompleted);
    chrome.webNavigation.onDOMContentLoaded.addListener(onDOMContentLoaded);
    chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated);
    chrome.webNavigation.onReferenceFragmentUpdated.addListener(onReferenceFragmentUpdated);
    chrome.webNavigation.onErrorOccurred.addListener(onErrorOccurred);

    this._register({
      dispose: () => {
        chrome.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
        chrome.webNavigation.onCommitted.removeListener(onCommitted);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        chrome.webNavigation.onDOMContentLoaded.removeListener(onDOMContentLoaded);
        chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated);
        chrome.webNavigation.onReferenceFragmentUpdated.removeListener(onReferenceFragmentUpdated);
        chrome.webNavigation.onErrorOccurred.removeListener(onErrorOccurred);
      },
    });
  }

  private _setupTabListeners(): void {
    const tabCreatedListener = (tab: chrome.tabs.Tab) => {
      this._onTabCreated.fire(tab);
      if (tab.windowId !== this.windowId) return;
      if (typeof tab.id === 'number') {
        // Lazily create a lifecycle instance so consumers can subscribe immediately
        this._ensureNavLifecycle(tab.id);
      }
    };

    const tabRemovedListener = (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
      this._onTabRemoved.fire({ tabId, removeInfo });
      const nav = this._navByTab.get(tabId);
      if (nav) {
        nav.dispose();
        this._navByTab.delete(tabId);
      }
    };

    chrome.tabs.onCreated.addListener(tabCreatedListener);
    chrome.tabs.onRemoved.addListener(tabRemovedListener);

    this._register({
      dispose: () => {
        chrome.tabs.onCreated.removeListener(tabCreatedListener);
        chrome.tabs.onRemoved.removeListener(tabRemovedListener);
      },
    });
  }

  /**
   * Setup declarativeNetRequest rules for a specific tab.
   * MV3-compatible alternative to webRequestBlocking.
   */
  async setupDeclarativeRulesForTab(
    tabId: number,
    extraHeaders?: Readonly<Record<string, string>>,
  ): Promise<void> {
    try {
      const baseRuleId = tabId * 1000; // Unique rule ID base per tab

      // Build request headers array in a single rule to simplify cleanup.
      const requestHeaders: chrome.declarativeNetRequest.ModifyHeaderInfo[] = [
        {
          header: 'X-Cordyceps-Tab',
          operation: chrome.declarativeNetRequest.HeaderOperation.SET,
          value: tabId.toString(),
        },
      ];

      if (extraHeaders) {
        for (const [name, value] of Object.entries(extraHeaders)) {
          // Skip invalid header names or undefined values
          if (!name || typeof value !== 'string') continue;
          requestHeaders.push({
            header: name,
            operation: chrome.declarativeNetRequest.HeaderOperation.SET,
            value,
          });
        }
      }

      const rules: chrome.declarativeNetRequest.Rule[] = [
        // Add/override headers for requests within this tab
        {
          id: baseRuleId + 1,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders,
          },
          condition: {
            tabIds: [tabId],
            // Apply to common resource types. This can be extended if needed.
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.SCRIPT,
              chrome.declarativeNetRequest.ResourceType.STYLESHEET,
              chrome.declarativeNetRequest.ResourceType.IMAGE,
              chrome.declarativeNetRequest.ResourceType.FONT,
              chrome.declarativeNetRequest.ResourceType.PING,
              chrome.declarativeNetRequest.ResourceType.MEDIA,
              chrome.declarativeNetRequest.ResourceType.WEBSOCKET,
              chrome.declarativeNetRequest.ResourceType.OTHER,
            ],
          },
        },
      ];

      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules,
        removeRuleIds: [baseRuleId + 1], // Replace existing rule for this tab
      });

      console.log(`🔧 Declarative rules setup completed for tab ${tabId}`);
    } catch (error) {
      console.warn(`Failed to setup declarative rules for tab ${tabId}:`, error);
    }
  }

  /**
   * Clean up declarativeNetRequest rules for a specific tab.
   */
  async cleanupDeclarativeRulesForTab(tabId: number): Promise<void> {
    try {
      const baseRuleId = tabId * 1000;
      const ruleIds = [baseRuleId + 1, baseRuleId + 2]; // Add more rule IDs as needed

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: ruleIds,
      });

      console.log(`🧹 Declarative rules cleaned up for tab ${tabId}`);
    } catch (error) {
      console.warn(`Failed to cleanup declarative rules for tab ${tabId}:`, error);
    }
  }

  /**
   * Creates a new event that only fires for events that have a specific tabId.
   */
  public static forTab<T extends { tabId: number }>(
    event: Event<T>,
    tabId: number,
    disposables?: DisposableStore,
  ): Event<T> {
    return Event.filter(event, (e: T) => e.tabId === tabId, disposables);
  }

  /**
   * Creates a new event that only fires for content script loads in a specific tab.
   */
  public static forTabContentScript(
    event: Event<chrome.runtime.MessageSender>,
    tabId: number,
    disposables?: DisposableStore,
  ): Event<chrome.runtime.MessageSender> {
    return Event.filter(
      event,
      (sender: chrome.runtime.MessageSender) => sender.tab?.id === tabId,
      disposables,
    );
  }

  /**
   * Creates a new event that only fires for events that have a specific frameId.
   */
  public static forFrame<T extends { frameId: number }>(
    event: Event<T>,
    frameId: number,
    disposables?: DisposableStore,
  ): Event<T> {
    return Event.filter(event, (e: T) => e.frameId === frameId, disposables);
  }

  /**
   * Get or create NavigationLifecycle for a tab. Callers can subscribe to
   * nav events without duplicating chrome.webNavigation listeners.
   */
  public getNavigationLifecycle(tabId: number): NavigationLifecycle {
    return this._ensureNavLifecycle(tabId);
  }

  private _ensureNavLifecycle(tabId: number): NavigationLifecycle {
    const existing = this._navByTab.get(tabId);
    if (existing) return existing;
    const nav = this._register(new NavigationLifecycle(tabId));
    nav.attach();
    this._navByTab.set(tabId, nav);
    return nav;
  }
}
