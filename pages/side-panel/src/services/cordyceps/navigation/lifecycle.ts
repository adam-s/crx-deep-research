/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';

// PURE HELPERS — types → constants → pure fns
export type NavLifecycle =
  | 'commit' // onCommitted (document commit)
  | 'domcontentloaded' // onDOMContentLoaded
  | 'load' // onCompleted (matches window.load)
  | 'fragment' // onReferenceFragmentUpdated
  | 'history' // onHistoryStateUpdated (SPA)
  | 'error'; // onErrorOccurred / navigation failed

export interface NavEvent {
  tabId: number;
  frameId: number;
  parentFrameId?: number;
  url: string;
  time: number; // ms since epoch (Date.now())
  transitionType?: string;
  transitionQualifiers?: string[];
}

const DEBUG = typeof localStorage !== 'undefined' && localStorage.getItem('NAV_DEBUG') === '1';

const isForTab = (tabId: number) => (d: { tabId: number }) => d.tabId === tabId;

const toEvent = (details: {
  tabId: number;
  frameId: number;
  parentFrameId?: number;
  url: string;
  transitionType?: string;
  transitionQualifiers?: string[];
}): NavEvent => ({
  tabId: details.tabId,
  frameId: details.frameId,
  parentFrameId: details.parentFrameId,
  url: details.url,
  time: Date.now(),
  transitionType: details.transitionType,
  transitionQualifiers: details.transitionQualifiers,
});

const log = (...args: unknown[]) => {
  if (DEBUG) console.log('[nav]', ...args);
};

// NavigationLifecycle — one instance per tab
export class NavigationLifecycle extends Disposable {
  private readonly _localStore = this._register(new DisposableStore());
  private readonly _tabId: number;

  // Emitters (consistent naming & payload)
  private readonly _onCommitEmitter = new Emitter<NavEvent>();
  private readonly _onDomContentLoadedEmitter = new Emitter<NavEvent>();
  private readonly _onLoadEmitter = new Emitter<NavEvent>();
  private readonly _onFragmentEmitter = new Emitter<NavEvent>();
  private readonly _onHistoryEmitter = new Emitter<NavEvent>();
  private readonly _onErrorEmitter = new Emitter<NavEvent>();

  public readonly onCommit: Event<NavEvent> = this._onCommitEmitter.event;
  public readonly onDomContentLoaded: Event<NavEvent> = this._onDomContentLoadedEmitter.event;
  public readonly onLoad: Event<NavEvent> = this._onLoadEmitter.event;
  public readonly onFragment: Event<NavEvent> = this._onFragmentEmitter.event;
  public readonly onHistory: Event<NavEvent> = this._onHistoryEmitter.event;
  public readonly onError: Event<NavEvent> = this._onErrorEmitter.event;

  constructor(tabId: number) {
    super();
    this._tabId = tabId;
  }

  attach(): void {
    const inTab = isForTab(this._tabId);

    const onBeforeNavigate = (d: chrome.webNavigation.WebNavigationParentedCallbackDetails) => {
      if (!inTab(d)) return;
      log('beforeNavigate', d);
      // No emitted event; consumers typically wait for commit/lifecycle
    };

    const onCommitted = (d: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      if (!inTab(d)) return;
      log('committed', d);
      this._onCommitEmitter.fire(toEvent(d));
    };

    const onDOMContentLoaded = (d: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
      if (!inTab(d)) return;
      log('domcontentloaded', d);
      this._onDomContentLoadedEmitter.fire(toEvent(d));
    };

    const onCompleted = (d: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
      if (!inTab(d)) return;
      log('load', d);
      this._onLoadEmitter.fire(toEvent(d));
    };

    const onFragment = (d: chrome.webNavigation.WebNavigationTransitionCallbackDetails) => {
      if (!inTab(d)) return;
      log('fragment', d);
      this._onFragmentEmitter.fire(toEvent(d));
    };

    const onHistoryStateUpdated = (
      d: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
    ) => {
      if (!inTab(d)) return;
      log('history', d);
      this._onHistoryEmitter.fire(toEvent(d));
    };

    const onErrorOccurred = (d: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails) => {
      if (!inTab(d)) return;
      log('error', d);
      this._onErrorEmitter.fire(toEvent(d));
    };

    chrome.webNavigation.onBeforeNavigate.addListener(onBeforeNavigate);
    chrome.webNavigation.onCommitted.addListener(onCommitted);
    chrome.webNavigation.onDOMContentLoaded.addListener(onDOMContentLoaded);
    chrome.webNavigation.onCompleted.addListener(onCompleted);
    chrome.webNavigation.onReferenceFragmentUpdated.addListener(onFragment);
    chrome.webNavigation.onHistoryStateUpdated.addListener(onHistoryStateUpdated);
    chrome.webNavigation.onErrorOccurred.addListener(onErrorOccurred);

    this._localStore.add({
      dispose: () => chrome.webNavigation.onBeforeNavigate.removeListener(onBeforeNavigate),
    });
    this._localStore.add({
      dispose: () => chrome.webNavigation.onCommitted.removeListener(onCommitted),
    });
    this._localStore.add({
      dispose: () => chrome.webNavigation.onDOMContentLoaded.removeListener(onDOMContentLoaded),
    });
    this._localStore.add({
      dispose: () => chrome.webNavigation.onCompleted.removeListener(onCompleted),
    });
    this._localStore.add({
      dispose: () => chrome.webNavigation.onReferenceFragmentUpdated.removeListener(onFragment),
    });
    this._localStore.add({
      dispose: () =>
        chrome.webNavigation.onHistoryStateUpdated.removeListener(onHistoryStateUpdated),
    });
    this._localStore.add({
      dispose: () => chrome.webNavigation.onErrorOccurred.removeListener(onErrorOccurred),
    });
  }

  waitFor(
    which: NavLifecycle,
    predicate?: (e: NavEvent) => boolean,
    timeoutMs = 30_000,
  ): Promise<NavEvent> {
    const { event, name } = this._selectEvent(which);
    return new Promise<NavEvent>((resolve, reject) => {
      let done = false;
      const store = new DisposableStore();

      const timer = setTimeout(() => {
        if (done) return;
        done = true;
        store.dispose();
        reject(new Error(`Timeout ${timeoutMs}ms waiting for ${name}`));
      }, timeoutMs);

      const sub = event(e => {
        if (done) return;
        try {
          if (predicate && !predicate(e)) return;
          done = true;
          clearTimeout(timer);
          store.dispose();
          resolve(e);
        } catch (err) {
          done = true;
          clearTimeout(timer);
          store.dispose();
          reject(err);
        }
      });

      store.add({ dispose: () => sub.dispose() });
    });
  }

  private _selectEvent(which: NavLifecycle): { name: string; event: Event<NavEvent> } {
    switch (which) {
      case 'commit':
        return { name: 'commit', event: this.onCommit };
      case 'domcontentloaded':
        return { name: 'domcontentloaded', event: this.onDomContentLoaded };
      case 'load':
        return { name: 'load', event: this.onLoad };
      case 'fragment':
        return { name: 'fragment', event: this.onFragment };
      case 'history':
        return { name: 'history', event: this.onHistory };
      case 'error':
        return { name: 'error', event: this.onError };
      default: {
        const neverVal: never = which;
        throw new Error(`Unknown NavLifecycle: ${String(neverVal)}`);
      }
    }
  }

  override dispose(): void {
    super.dispose();
    this._localStore.dispose();
  }
}
