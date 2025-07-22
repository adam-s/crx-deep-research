import { Disposable } from 'vs/base/common/lifecycle';
import { FrameManager } from './frame-manager';
import { Frame } from './frame';
import { Progress, ProgressController } from './progress';

export class Page extends Disposable {
  private _ownedContext?: object;
  readonly frameManager: FrameManager;
  readonly tabId?: number;

  constructor(tabId?: number) {
    super();
    this.frameManager = this._register(new FrameManager());
    this.tabId = tabId;

    if (this.tabId) {
      this._setupWebNavigationListeners();
    }
  }

  private _setupWebNavigationListeners(): void {
    const frameStartedListener = (
      details: chrome.webNavigation.WebNavigationParentedCallbackDetails,
    ) => {
      if (details.tabId !== this.tabId) {
        return;
      }
      this.frameManager.frameAttached(details.frameId, details.parentFrameId);
    };

    const frameCommittedListener = (
      details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
    ) => {
      if (details.tabId !== this.tabId) {
        return;
      }
      const parentFrameId = details.frameId === 0 ? null : 0;
      this.frameManager.frameAttached(details.frameId, parentFrameId);
    };

    const frameCompletedListener = (
      details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
    ) => {
      if (details.tabId !== this.tabId) {
        return;
      }
      const parentFrameId = details.frameId === 0 ? null : 0;
      this.frameManager.frameAttached(details.frameId, parentFrameId);
    };

    const frameErrorListener = (
      details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails,
    ) => {
      if (details.tabId !== this.tabId) {
        return;
      }
      const parentFrameId = details.frameId === 0 ? null : 0;
      this.frameManager.frameAttached(details.frameId, parentFrameId);
    };

    const tabReplacedListener = () => {
      // This is where we would want to do something with the page.
    };

    chrome.webNavigation.onBeforeNavigate.addListener(frameStartedListener);
    chrome.webNavigation.onCommitted.addListener(frameCommittedListener);
    chrome.webNavigation.onCompleted.addListener(frameCompletedListener);
    chrome.webNavigation.onErrorOccurred.addListener(frameErrorListener);
    chrome.webNavigation.onTabReplaced.addListener(tabReplacedListener);

    this._register({
      dispose: () => {
        chrome.webNavigation.onBeforeNavigate.removeListener(frameStartedListener);
        chrome.webNavigation.onCommitted.removeListener(frameCommittedListener);
        chrome.webNavigation.onCompleted.removeListener(frameCompletedListener);
        chrome.webNavigation.onErrorOccurred.removeListener(frameErrorListener);
        chrome.webNavigation.onTabReplaced.removeListener(tabReplacedListener);
      },
    });
  }

  async waitForMainFrame(progress?: Progress): Promise<Frame> {
    if (progress) {
      progress.log('Waiting for main frame to be attached');
    }
    return this.frameManager.waitForMainFrame();
  }

  mainFrame(): Frame {
    return this.frameManager.mainFrame();
  }

  frames(): Frame[] {
    return this.frameManager.frames();
  }

  public async goto(
    url: string,
    options: { timeout?: number; progress?: Progress } = {},
  ): Promise<Response | null> {
    const progressController = new ProgressController(options.timeout);

    return progressController.run(async p => {
      p.log(`Page navigating to "${url}"`);
      return this.mainFrame().goto(url, { timeout: options.timeout, progress: p });
    });
  }
}
