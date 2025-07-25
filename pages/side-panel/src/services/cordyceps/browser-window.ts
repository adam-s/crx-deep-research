import { Disposable } from 'vs/base/common/lifecycle';
import { Page } from './page';
import { Progress, ProgressController } from './progress';
import { Session } from './session';

const windowId = () =>
  new Promise<number>(resolve => chrome.windows.getCurrent(window => resolve(window.id!)));

export class BrowserWindow extends Disposable {
  private _pages = new Map<number, Page>();
  readonly windowId: number;
  readonly session: Session;

  private constructor(windowId: number) {
    super();
    this.windowId = windowId;
    this.session = this._register(new Session(windowId));
    console.log(`✅ BrowserWindow created for window ${windowId}`);
  }

  dispose(): void {
    console.log(`🗑️ Disposing BrowserWindow for window ${this.windowId}`);
    console.log(
      `🗑️ BrowserWindow disposing ${this._pages.size} pages: [${Array.from(this._pages.keys()).join(', ')}]`,
    );

    super.dispose();
    console.log(`✅ BrowserWindow for window ${this.windowId} disposed successfully`);
  }

  static async create(): Promise<BrowserWindow> {
    const id = await windowId();
    const browserWindow = new BrowserWindow(id);
    await browserWindow._initialize();
    return browserWindow;
  }

  private async _initialize(): Promise<void> {
    const tabs = await chrome.tabs.query({ windowId: this.windowId });
    for (const tab of tabs) {
      if (tab.id) {
        const page = this._createPage(tab.id);
        // After creating the page, fetch all its frames.
        await this._fetchAllFramesForTab(page);
      }
    }

    // Register session event listeners
    this._register(
      this.session.onCommitted(details => {
        this._handleNavigationCommitted(details);
      }),
    );

    this._register(
      this.session.onTabRemoved(({ tabId }) => {
        console.log(`🗑️ Tab ${tabId} removed - starting cleanup`);
        const page = this._pages.get(tabId);
        if (page) {
          console.log(
            `🗑️ Found Page for tab ${tabId} with ${page.frameManager.frames().length} frames`,
          );
          page.dispose();
          this._pages.delete(tabId);
          console.log(`✅ Page for tab ${tabId} removed from BrowserWindow`);
        } else {
          console.log(`⚠️ No Page found for removed tab ${tabId}`);
        }
        console.log(`📊 BrowserWindow now has ${this._pages.size} pages remaining`);
      }),
    );

    // Listen for new tab creation
    this._register(
      this.session.onTabCreated(tab => {
        if (tab.windowId === this.windowId && tab.id) {
          this._createPage(tab.id);
          // New tabs start with just a main frame, let navigation events handle the rest
        }
      }),
    );
  }

  private async _handleNavigationCommitted(
    details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
  ): Promise<void> {
    try {
      // Check if the tab belongs to this window
      const tab = await chrome.tabs.get(details.tabId);
      if (tab.windowId !== this.windowId) {
        return;
      }

      if (details.frameId === 0) {
        // Main frame navigation - create or update page
        this._handleMainFrameNavigation(details.tabId);
      } else {
        // Subframe navigation - handle frame attachment for existing page
        await this._handleSubframeNavigation(details.tabId, details.frameId, details.url);
      }
    } catch (error) {
      // Tab may not exist anymore, ignore
      console.warn(`Failed to get tab ${details.tabId}:`, error);
    }
  }

  private async _fetchAllFramesForTab(page: Page): Promise<void> {
    try {
      const frames = await chrome.webNavigation.getAllFrames({ tabId: page.tabId });
      if (frames) {
        console.log(
          `Fetching ${frames.length} frames for tab ${page.tabId}:`,
          frames.map(f => ({ frameId: f.frameId, parentFrameId: f.parentFrameId, url: f.url })),
        );
        for (const frame of frames) {
          // The parentFrameId for the main frame is -1.
          const parentFrameId = frame.parentFrameId === -1 ? null : frame.parentFrameId;
          page.frameManager.frameAttached(frame.frameId, parentFrameId, frame.url);
        }
        console.log(`After attachment, page has ${page.frameManager.frames().length} frames`);
      }
    } catch (error) {
      console.warn(`Failed to get all frames for tab ${page.tabId}:`, error);
    }
  }

  private async _handleMainFrameNavigation(tabId: number): Promise<void> {
    const page = this._createPage(tabId);
    // Main frame navigation replaces all existing frames, so clear them.
    page.frameManager.clearFrames();
    // Re-fetch all frames for the tab.
    await this._fetchAllFramesForTab(page);
  }

  private async _handleSubframeNavigation(
    tabId: number,
    frameId: number,
    url: string,
  ): Promise<void> {
    const page = this._pages.get(tabId);
    if (!page) {
      // No page exists for this tab, which shouldn't happen for subframes
      console.warn(`No page found for tab ${tabId} when handling subframe ${frameId}`);
      return;
    }

    console.log(`Handling subframe navigation: tab ${tabId}, frame ${frameId}, url: ${url}`);
    console.log(`Before attachment, page has ${page.frameManager.frames().length} frames`);

    try {
      const frameDetails = await chrome.webNavigation.getFrame({ tabId, frameId });
      if (frameDetails) {
        const parentFrameId = frameDetails.parentFrameId === -1 ? null : frameDetails.parentFrameId;
        page.frameManager.frameAttached(frameId, parentFrameId, url);
        console.log(`After attachment, page has ${page.frameManager.frames().length} frames`);
      }
    } catch (error) {
      // Ignore common navigation errors that don't need logging
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('getFrame') && !errorMessage.includes('Frame not found')) {
        console.warn(`Failed to get frame details for tab ${tabId}, frame ${frameId}:`, error);
      }
    }
  }

  private _createPage(tabId: number): Page {
    const existingPage = this._pages.get(tabId);
    if (existingPage) {
      return existingPage;
    }

    const page = this._register(new Page(tabId, this.session));
    this._pages.set(tabId, page);

    // The main frame is attached via _fetchAllFramesForTab or navigation events.
    // No need to attach it here manually.

    return page;
  }

  pages(): Page[] {
    return Array.from(this._pages.values());
  }

  async newPage(options: { timeout?: number; progress?: Progress } = {}): Promise<Page> {
    const progressController = new ProgressController(options.timeout);

    return progressController.run(async p => {
      p.log('Creating new tab');
      const tab = await chrome.tabs.create({ windowId: this.windowId });

      if (!tab.id) {
        throw new Error('Failed to create tab: tab.id is undefined');
      }

      const page = this._createPage(tab.id);

      p.log(`Tab ${tab.id} created, waiting for main frame`);
      await page.waitForMainFrame(p);
      p.log(`Page ready with main frame attached`);

      return page;
    });
  }
}
