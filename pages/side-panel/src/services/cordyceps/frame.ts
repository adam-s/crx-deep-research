import { Disposable } from 'vs/base/common/lifecycle';
import { Progress } from './progress';

export class Frame extends Disposable {
  private _parentFrame: Frame | null;
  private _childFrames = new Set<Frame>();
  public frameId: number;
  private _url?: string;

  constructor(frameId: number, parentFrame: Frame | null, url?: string) {
    super();
    this._parentFrame = parentFrame;
    this.frameId = frameId;
    this._url = url;
  }

  parentFrame(): Frame | null {
    return this._parentFrame;
  }

  childFrames(): Frame[] {
    return Array.from(this._childFrames);
  }

  url(): string | undefined {
    return this._url;
  }

  setUrl(url: string): void {
    this._url = url;
  }

  async goto(
    url: string,
    options: { timeout?: number; progress?: Progress } = {},
  ): Promise<Response | null> {
    const progress = options.progress;

    if (!this._parentFrame) {
      // This is the main frame, navigate the tab
      progress?.log(`Frame ${this.frameId} navigating to "${url}"`);

      return (
        progress?.race(
          new Promise<Response | null>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Navigation timeout after ${options.timeout || 30000}ms`));
            }, options.timeout || 30000);

            const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
              if (details.frameId === this.frameId) {
                chrome.webNavigation.onCompleted.removeListener(listener);
                clearTimeout(timeoutId);
                progress?.log(`Frame ${this.frameId} navigation completed`);
                resolve(null); // Chrome extension doesn't have Response object
              }
            };

            const errorListener = (
              details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails,
            ) => {
              if (details.frameId === this.frameId) {
                chrome.webNavigation.onCompleted.removeListener(listener);
                chrome.webNavigation.onErrorOccurred.removeListener(errorListener);
                clearTimeout(timeoutId);
                // reject(new Error(`Navigation failed: ${details.error}`));
                // For now, resolve quietly
                resolve(null);
              }
            };

            // Register cleanup for abort
            progress?.cleanupOnAbort(() => {
              chrome.webNavigation.onCompleted.removeListener(listener);
              chrome.webNavigation.onErrorOccurred.removeListener(errorListener);
              clearTimeout(timeoutId);
            });

            chrome.webNavigation.onCompleted.addListener(listener);
            chrome.webNavigation.onErrorOccurred.addListener(errorListener);
            chrome.tabs.update({ url });
          }),
        ) ||
        new Promise<Response | null>((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Navigation timeout after ${options.timeout || 30000}ms`));
          }, options.timeout || 30000);

          const listener = (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => {
            if (details.frameId === this.frameId) {
              chrome.webNavigation.onCompleted.removeListener(listener);
              clearTimeout(timeoutId);
              resolve(null);
            }
          };

          chrome.webNavigation.onCompleted.addListener(listener);
          chrome.tabs.update({ url });
        })
      );
    } else {
      // Child frame navigation would require more complex logic
      throw new Error('Child frame navigation not yet implemented');
    }
  }
}
