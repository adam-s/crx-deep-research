import { Event, Emitter } from 'vs/base/common/event';
import { CRX_DEEP_RESEARCH_CONTENT_SCRIPT_LOADED } from '@shared/utils/message';
import { Disposable } from 'vs/base/common/lifecycle';

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

  readonly windowId: number;

  constructor(windowId: number) {
    super();
    this.windowId = windowId;
    this._setupMessageListener();
    this._setupTabListeners();
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
}
