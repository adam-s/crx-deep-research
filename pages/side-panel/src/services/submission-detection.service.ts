import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import {
  IAlgoliaSearchResponse,
  IAlgoliaSearchService,
} from '@shared/services/algolia-search.service';
import { autorun, observableValue } from 'vs/base/common/observable';

export const ISubmissionDetectionService = createDecorator<ISubmissionDetectionService>(
  'submissionDetectionService',
);

export interface ISubmissionDetectionService {
  readonly _serviceBrand: undefined;
  search(query: string): Promise<IAlgoliaSearchResponse>;
  readonly searchResults$: ReturnType<typeof observableValue<IAlgoliaSearchResponse | undefined>>;
}

/**
 * Returns the main part of a URL (protocol, host, pathname), excluding query and hash.
 */
function getMainUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return '';
  }
}

/**
 * Checks if a tab is valid for processing (has a string URL and is in the current window).
 */
function isTabValid(tab: chrome.tabs.Tab, currentWindowId: number): boolean {
  return typeof tab.url === 'string' && tab.windowId === currentWindowId;
}

/**
 * Determines if the main URL for a tab has changed and should be updated.
 */
function shouldUpdateMainUrl(tabId: number, url: string, lastMainUrlByTabId: Record<number, string>): boolean {
  const mainUrl = getMainUrl(url);
  return lastMainUrlByTabId[tabId] !== mainUrl;
}

export class SubmissionDetectionService extends Disposable implements ISubmissionDetectionService {
  readonly _serviceBrand: undefined;
  private static readonly ALGOLIA_URL = 'https://hn.algolia.com/';
  private _lastMainUrlByTabId: Record<number, string> = {};
  private readonly _searchResultsObservable = observableValue<IAlgoliaSearchResponse | undefined>(
    this,
    undefined,
  );
  public readonly searchResults$ = this._searchResultsObservable;

  constructor(
    @IAlgoliaSearchService private readonly _algoliaSearchService: IAlgoliaSearchService,
  ) {
    super();
    this._initNavigationListener();
    autorun(reader => {
      const results = this.searchResults$.read(reader);
      console.log(results);
    });
    // Load the active tab on service instantiation
    this._loadActiveTabOnInit();
  }

  private async _loadActiveTabOnInit(): Promise<void> {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && typeof activeTab.url === 'string') {
        if (shouldUpdateMainUrl(activeTab.id as number, activeTab.url, this._lastMainUrlByTabId)) {
          const mainUrl = getMainUrl(activeTab.url);
          this._lastMainUrlByTabId[activeTab.id as number] = mainUrl;
          const results = await this.search(mainUrl);
          this._searchResultsObservable.set(results, undefined);
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  public async search(query: string): Promise<IAlgoliaSearchResponse> {
    await this._ensureAlgoliaTabOpen();
    return this._algoliaSearchService.search(query);
  }

  /**
   * Open or locate the Algolia HN tab in the background (not focused).
   * Returns the tab ID of the existing or newly created tab.
   */
  private async _ensureAlgoliaTabOpen(): Promise<number> {
    try {
      const tabs = await chrome.tabs.query({});
      const existing = tabs.find(
        t =>
          typeof t.url === 'string' &&
          t.url.startsWith(SubmissionDetectionService.ALGOLIA_URL) &&
          t.id,
      );
      if (existing?.id) {
        return existing.id;
      }
    } catch (err) {
      console.error('[SubmissionDetectionService] Failed to query existing tabs:', err);
    }

    const newTab = await chrome.tabs.create({
      url: SubmissionDetectionService.ALGOLIA_URL,
      active: false,
    });

    if (newTab.id !== undefined) {
      await this._waitForTabLoaded(newTab.id);
      return newTab.id;
    }

    throw new Error('Unable to open Algolia Hacker News tab');
  }

  /**
   * Wait until the specified tab has finished loading.
   */
  private async _waitForTabLoaded(tabId: number): Promise<void> {
    return new Promise(resolve => {
      const listener = (updatedTabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
      // Also handle the case it is already complete
      chrome.tabs.get(tabId, tab => {
        if (tab.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      });
    });
  }

  /**
   * Listen for navigations and tab‐switches in the current window,
   * and invoke `search(tab.url)` whenever a page load completes
   * or the user switches to a loaded tab.
   */
  private async _initNavigationListener(): Promise<void> {
    const { id: currentWindowId } = await chrome.windows.getCurrent();

    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (
        isTabValid(tab, currentWindowId ?? 0) &&
        (typeof changeInfo.url === 'string' || changeInfo.status === 'complete')
      ) {
        try {
          if (shouldUpdateMainUrl(tabId, tab.url as string, this._lastMainUrlByTabId)) {
            const mainUrl = getMainUrl(tab.url as string);
            this._lastMainUrlByTabId[tabId] = mainUrl;
            const results = await this.search(mainUrl);
            this._searchResultsObservable.set(results, undefined);
          }
        } catch (error) {
          // Invalid URL, ignore
        }
      }
    });

    chrome.tabs.onActivated.addListener(async activeInfo => {
      try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (isTabValid(tab, currentWindowId ?? 0)) {
          if (shouldUpdateMainUrl(activeInfo.tabId, tab.url as string, this._lastMainUrlByTabId)) {
            const mainUrl = getMainUrl(tab.url as string);
            this._lastMainUrlByTabId[activeInfo.tabId] = mainUrl;
            const results = await this.search(mainUrl);
            this._searchResultsObservable.set(results, undefined);
          }
        }
      } catch (error) {
        // Invalid tab or URL, ignore
      }
    });
  }
}
