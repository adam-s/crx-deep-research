import { BrowserWindow } from './browser-window';
import { Page } from './page';

export interface BrowserWindowContextOptions {}

// use to manage tab groups and cookie session groups
export class BrowserWindowContext {
  readonly _browser: BrowserWindow;
  readonly _windowContextId: number;
  _ownerPage?: Page;

  constructor(
    browser: BrowserWindow,
    windowContextId: number,
    options: BrowserWindowContextOptions = {},
  ) {
    this._browser = browser;
    this._windowContextId = windowContextId;
    options;
  }

  newPage(): Page {
    const page = new Page();
    page._ownedContext = this;
    return page;
  }
}
