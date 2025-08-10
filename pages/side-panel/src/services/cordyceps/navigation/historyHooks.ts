/**
 * History hooks for tracking same-document navigation events.
 * This script should be injected into the MAIN world to intercept
 * pushState, replaceState, popstate, and hashchange events.
 */

interface ExtendedWindow extends Window {
  __extHistoryHooked?: boolean;
}

// Prevent multiple injection
if (!(window as ExtendedWindow).__extHistoryHooked) {
  (window as ExtendedWindow).__extHistoryHooked = true;

  /**
   * Dispatch a custom navigation event that can be caught by content scripts
   */
  const dispatchNavigationEvent = (type: string, url: string): void => {
    window.dispatchEvent(
      new CustomEvent('__ext:navigation', {
        detail: {
          type,
          url,
          timestamp: performance.now(),
        },
      }),
    );
  };

  // Hook history.pushState
  const originalPushState = history.pushState;
  history.pushState = function (state: unknown, title: string, url?: string | URL | null) {
    const result = originalPushState.call(this, state, title, url);
    const finalUrl = url ? String(url) : location.href;
    dispatchNavigationEvent('pushState', finalUrl);
    return result;
  };

  // Hook history.replaceState
  const originalReplaceState = history.replaceState;
  history.replaceState = function (state: unknown, title: string, url?: string | URL | null) {
    const result = originalReplaceState.call(this, state, title, url);
    const finalUrl = url ? String(url) : location.href;
    dispatchNavigationEvent('replaceState', finalUrl);
    return result;
  };

  // Listen for popstate events (back/forward button, history.back/forward calls)
  window.addEventListener(
    'popstate',
    () => {
      dispatchNavigationEvent('popstate', location.href);
    },
    { passive: true },
  );

  // Listen for hashchange events
  window.addEventListener(
    'hashchange',
    () => {
      dispatchNavigationEvent('hashchange', location.href);
    },
    { passive: true },
  );

  console.debug('🔗 Navigation history hooks installed');
}
