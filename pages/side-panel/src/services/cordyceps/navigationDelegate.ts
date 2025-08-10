/**
 * Handles back/forward navigation actions for Chrome extension context.
 * Prefers chrome.tabs API when available, falls back to history API.
 * Uses proper function execution following frameExecutionContext patterns.
 */
export class NavigationDelegate {
  constructor(private readonly _tabId: number) {}

  /**
   * Navigate back in history, mimicking Playwright's goBack behavior.
   * @returns true if navigation was attempted, false if no history available
   */
  async goBack(): Promise<boolean> {
    try {
      // Use chrome.tabs.goBack API
      await chrome.tabs.goBack(this._tabId);
      return true;
    } catch (error) {
      // Chrome tabs API might fail if no browser-level history available
      // This is expected behavior - fallback to history.back() for document-level history
      console.debug('chrome.tabs.goBack not available, using history.back() fallback:', error);

      // Fallback to history.back() via script injection
      return this._executeHistoryBack();
    }
  }

  /**
   * Navigate forward in history, mimicking Playwright's goForward behavior.
   * @returns true if navigation was attempted, false if no forward history available
   */
  async goForward(): Promise<boolean> {
    try {
      // Use chrome.tabs.goForward API
      await chrome.tabs.goForward(this._tabId);
      return true;
    } catch (error) {
      // Chrome tabs API might fail if no browser-level forward history available
      // This is expected behavior - fallback to history.forward() for document-level history
      console.debug(
        'chrome.tabs.goForward not available, using history.forward() fallback:',
        error,
      );

      // Fallback to history.forward() via script injection
      return this._executeHistoryForward();
    }
  }

  /**
   * Execute history.back() in the main world context.
   * @returns true if navigation was attempted
   */
  private async _executeHistoryBack(): Promise<boolean> {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId, allFrames: false },
        world: 'MAIN',
        func: () => {
          if (history.length > 1) {
            history.back();
            return true;
          }
          return false;
        },
      });
      return result?.result ?? false;
    } catch (error) {
      console.error('Failed to execute history.back():', error);
      return false;
    }
  }

  /**
   * Execute history.forward() in the main world context.
   * @returns true if navigation was attempted
   */
  private async _executeHistoryForward(): Promise<boolean> {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId, allFrames: false },
        world: 'MAIN',
        func: () => {
          history.forward();
          return true;
        },
      });
      return result?.result ?? false;
    } catch (error) {
      console.error('Failed to execute history.forward():', error);
      return false;
    }
  }

  /**
   * Check if the tab can go back (has history entries).
   */
  async canGoBack(): Promise<boolean> {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId, allFrames: false },
        world: 'MAIN',
        func: () => history.length > 1,
      });
      return result?.result ?? false;
    } catch (error) {
      console.error('Failed to check if can go back:', error);
      return false;
    }
  }

  /**
   * Check if the tab can go forward.
   * Note: This is limited as there's no standard way to check forward history.
   */
  async canGoForward(): Promise<boolean> {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: this._tabId, allFrames: false },
        world: 'MAIN',
        func: () => true, // Assume it might be possible
      });
      return result?.result ?? false;
    } catch (error) {
      console.error('Failed to check if can go forward:', error);
      return false;
    }
  }
}
