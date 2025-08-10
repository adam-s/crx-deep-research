/**
 * Navigation history tracker for MAIN world context.
 * Tracks same-document navigation events (pushState, replaceState, popstate, hashchange)
 * that chrome.webNavigation API doesn't catch.
 */

export {}; // Ensure this file is treated as a module

declare global {
  interface Window {
    __cordyceps_historyTracker?: HistoryTracker;
  }
}

interface NavigationEventDetail {
  type: 'pushState' | 'replaceState' | 'popstate' | 'hashchange';
  url: string;
  timestamp: number;
}

class HistoryTracker {
  private _isInstalled = false;

  constructor() {
    this.install();
  }

  install(): void {
    if (this._isInstalled) return;
    this._isInstalled = true;

    // Hook history.pushState
    const originalPushState = history.pushState;
    history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
      const result = originalPushState.call(this, state, title, url);
      const finalUrl = url ? String(url) : location.href;
      HistoryTracker.dispatchNavigationEvent('pushState', finalUrl);
      return result;
    };

    // Hook history.replaceState
    const originalReplaceState = history.replaceState;
    history.replaceState = function (state: unknown, title: string, url?: string | URL | null) {
      const result = originalReplaceState.call(this, state, title, url);
      const finalUrl = url ? String(url) : location.href;
      HistoryTracker.dispatchNavigationEvent('replaceState', finalUrl);
      return result;
    };

    // Listen for popstate events (back/forward button, history.back/forward calls)
    window.addEventListener(
      'popstate',
      () => {
        HistoryTracker.dispatchNavigationEvent('popstate', location.href);
      },
      { passive: true },
    );

    // Listen for hashchange events
    window.addEventListener(
      'hashchange',
      () => {
        HistoryTracker.dispatchNavigationEvent('hashchange', location.href);
      },
      { passive: true },
    );

    console.debug('🔗 Navigation history hooks installed in MAIN world');
  }

  private static dispatchNavigationEvent(type: string, url: string): void {
    // Dispatch on document so ISOLATED world can listen
    document.dispatchEvent(
      new CustomEvent('__cordyceps:navigation', {
        detail: {
          type,
          url,
          timestamp: performance.now(),
        } as NavigationEventDetail,
      }),
    );
  }

  get isInstalled(): boolean {
    return this._isInstalled;
  }
}

function bootstrapHistoryTracker(): HistoryTracker {
  if (window.__cordyceps_historyTracker) return window.__cordyceps_historyTracker;

  const tracker = new HistoryTracker();
  window.__cordyceps_historyTracker = tracker;
  return tracker;
}

const loader = (): void => {
  // Initialize history tracker following the bootstrap pattern
  const historyTracker = bootstrapHistoryTracker();

  console.log('🔧 Content cordyceps main loaded with HistoryTracker:', historyTracker);
};

try {
  loader();
} catch (error) {
  console.log(error);
}
