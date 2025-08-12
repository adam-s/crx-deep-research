import { Event, Emitter } from 'vs/base/common/event';
import { CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED } from '@shared/utils/message';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';

export class Session extends Disposable {
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

  private readonly _onErrorOccurred = this._register(
    new Emitter<chrome.webNavigation.WebNavigationFramedErrorCallbackDetails>(),
  );
  readonly onErrorOccurred: Event<chrome.webNavigation.WebNavigationFramedErrorCallbackDetails> =
    this._onErrorOccurred.event;

  // MV3-compatible request events
  private readonly _onBeforeRequest = this._register(
    new Emitter<chrome.webRequest.WebRequestDetails>(),
  );
  readonly onBeforeRequest: Event<chrome.webRequest.WebRequestDetails> =
    this._onBeforeRequest.event;

  private readonly _onResponseStarted = this._register(
    new Emitter<chrome.webRequest.WebResponseHeadersDetails>(),
  );
  readonly onResponseStarted: Event<chrome.webRequest.WebResponseHeadersDetails> =
    this._onResponseStarted.event;

  readonly windowId: number;

  constructor(windowId: number) {
    super();
    this.windowId = windowId;
    this._setupMessageListener();
    this._setupTabListeners();
    this._setupWebNavigationListeners();
    this._setupRequestObservation();
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
    const onErrorOccurred = (
      details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails,
    ) => this._onErrorOccurred.fire(details);

    chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    chrome.webNavigation.onCommitted.addListener(onCommitted);
    chrome.webNavigation.onCompleted.addListener(onCompleted);
    chrome.webNavigation.onErrorOccurred.addListener(onErrorOccurred);

    this._register({
      dispose: () => {
        chrome.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate);
        chrome.webNavigation.onCommitted.removeListener(onCommitted);
        chrome.webNavigation.onCompleted.removeListener(onCompleted);
        chrome.webNavigation.onErrorOccurred.removeListener(onErrorOccurred);
      },
    });
  }

  private _setupTabListeners(): void {
    const tabCreatedListener = (tab: chrome.tabs.Tab) => {
      this._onTabCreated.fire(tab);
    };

    const tabRemovedListener = (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => {
      this._onTabRemoved.fire({ tabId, removeInfo });
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
   * Setup MV3-compatible request observation.
   * Uses webRequest API for observation only (no blocking).
   */
  private _setupRequestObservation(): void {
    const onBeforeRequest = (details: chrome.webRequest.WebRequestDetails) => {
      this._onBeforeRequest.fire(details);
    };

    const onResponseStarted = (details: chrome.webRequest.WebResponseHeadersDetails) => {
      this._onResponseStarted.fire(details);
    };

    // MV3: webRequest for observation only (no "blocking" permission)
    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, { urls: ['<all_urls>'] });

    chrome.webRequest.onResponseStarted.addListener(onResponseStarted, { urls: ['<all_urls>'] }, [
      'responseHeaders',
    ]);

    this._register({
      dispose: () => {
        chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
        chrome.webRequest.onResponseStarted.removeListener(onResponseStarted);
      },
    });

    console.log(`🔧 Request observation setup completed for window ${this.windowId}`);
  }

  /**
   * Setup declarativeNetRequest rules for a specific tab.
   * MV3-compatible alternative to webRequestBlocking.
   */
  async setupDeclarativeRulesForTab(tabId: number): Promise<void> {
    try {
      const baseRuleId = tabId * 1000; // Unique rule ID base per tab

      const rules: chrome.declarativeNetRequest.Rule[] = [
        // Add custom header to identify Cordyceps requests
        {
          id: baseRuleId + 1,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: 'X-Cordyceps-Tab',
                operation: chrome.declarativeNetRequest.HeaderOperation.SET,
                value: tabId.toString(),
              },
            ],
          },
          condition: {
            tabIds: [tabId],
            resourceTypes: [chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
          },
        },
      ];

      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: rules,
        removeRuleIds: [baseRuleId + 1], // Remove existing rule first
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
}
