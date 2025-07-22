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
        this._createPage(tab.id, tab.url);
      }
    }

    // Register session event listeners
    this._register(
      this.session.onTabCreated(tab => {
        if (tab.windowId === this.windowId && tab.id) {
          this._createPage(tab.id, tab.url);
        }
      }),
    );

    this._register(
      this.session.onTabRemoved(({ tabId }) => {
        const page = this._pages.get(tabId);
        if (page) {
          page.dispose();
          this._pages.delete(tabId);
        }
      }),
    );
  }

  private _createPage(tabId: number, url?: string): Page {
    const page = this._register(new Page(tabId));
    this._pages.set(tabId, page);

    // Initialize the main frame with the tab URL
    if (url) {
      page.frameManager.frameAttached(0, null, url);
    }

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
