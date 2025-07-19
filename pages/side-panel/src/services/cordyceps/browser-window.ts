import { Page } from './page';
import { BrowserWindowContext, BrowserWindowContextOptions } from './browser-window-context';

const windowId = () =>
  new Promise<number>(resolve =>
    // We aren't using `chrome.sessions` here. However, chrome.sessions allows
    // accessing closed tabs and windows, which is something to keep in mind
    // if we want to get information and then access it later without loading the
    // page again in order to hide from the user.
    chrome.windows.getCurrent(window => resolve(window.id!)),
  );

// This is fundamentally like the Browser instance in Playwright.
export class BrowserWindow {
  // The session is the delegate which sends commands to the browser.
  _pages = new Map<string, Page>();
  _contexts = new Map<number, BrowserWindowContext>();
  constructor() {}

  async newPage(options: BrowserWindowContextOptions = {}): Promise<Page> {
    const context = await this.newContext(options);
    const page = context.newPage();
    page._ownedContext = context;
    context._ownerPage = page;
    return page;
  }

  async newContext(options: BrowserWindowContextOptions = {}): Promise<BrowserWindowContext> {
    const windowContextId = await windowId();
    const windowContext = new BrowserWindowContext(this, windowContextId, options);
    this._contexts.set(windowContextId, windowContext);
    return windowContext;
  }
}
