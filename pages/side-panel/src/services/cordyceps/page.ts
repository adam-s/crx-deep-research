/* eslint-disable @typescript-eslint/ban-ts-comment */
import { Disposable } from 'vs/base/common/lifecycle';
import { FrameManager } from './frameManager';
import { Frame, FrameLocator } from './frame';
import { Progress, executeWithProgress } from './progress';
import { Session } from './session';
import { FrameExecutionContext } from './frameExecutionContext';
import { NavigationDelegate } from './navigationDelegate';
import type {
  NavigateOptionsWithProgress,
  Rect,
  ClickOptions,
  SelectOption,
  SelectOptionOptions,
  ExpectScreenshotOptions,
  ScreenshotOptions,
} from './types';
import { ByRoleOptions } from '@injected/isomorphic/locatorUtils';
import { LocatorOptions, Locator } from './locator';
import { ElementHandle } from './elementHandle';
import {
  getContentFrameId,
  createPageSnapshotForAI,
  isJavaScriptErrorInEvaluate,
  validateScreenshotFormat,
} from './pageUtils';
import { convertBrowserBufferToNodeBuffer } from './bufferUtils';
import type { FilePayload } from '@shared/utils/fileInputTypes';
import { Screenshotter, validateScreenshotOptions } from './screenshotter';
import { getNavigationTracker } from './navigationTracker';

export class Page extends Disposable {
  private _ownedContext?: object;
  readonly frameManager: FrameManager;
  readonly tabId: number;
  readonly session: Session;
  lastSnapshotFrameIds: number[] = [];
  readonly screenshotter: Screenshotter;
  readonly navTracker = getNavigationTracker();
  private readonly _navigationDelegate: NavigationDelegate;

  constructor(tabId: number, session: Session) {
    super();
    this.tabId = tabId;
    this.session = session;
    this.frameManager = this._register(new FrameManager(this));
    this.screenshotter = new Screenshotter(this);
    this._navigationDelegate = new NavigationDelegate(tabId);

    this._setupContentScriptListener();
    console.log(`✅ Page created for tab ${tabId}`);
  }

  dispose(): void {
    console.log(`🗑️ Disposing Page for tab ${this.tabId}`);
    console.log(`🗑️ Page disposing FrameManager with ${this.frameManager.frames().length} frames`);

    if (this._ownedContext) {
      console.log(`🗑️ Page disposing owned context for tab ${this.tabId}`);
    }

    super.dispose();
    console.log(`✅ Page for tab ${this.tabId} disposed successfully`);
  }

  private _setupContentScriptListener(): void {
    // Create a tab-specific event for content script loads
    const onContentScriptLoadedForTab = Session.forTabContentScript(
      this.session.onContentScriptLoaded,
      this.tabId,
    );

    this._register(
      onContentScriptLoadedForTab(sender => {
        const { frameId } = sender;
        if (frameId === undefined) {
          console.warn('Content script loaded without frameId:', sender);
          return;
        }

        const frame = this.frameManager.frame(frameId);
        if (!frame) {
          console.warn(`Frame ${frameId} not found when content script loaded.`);
          return;
        }

        this._createExecutionContext(frame);
      }),
    );
  }

  private _createExecutionContext(frame: Frame): void {
    console.log(`🚀 Creating execution context for frame ${frame.frameId} in tab ${this.tabId}`);
    const context = new FrameExecutionContext(frame);
    frame._setContext(context);
    console.log(`✅ Execution context created for frame ${frame.frameId} in tab ${this.tabId}`);
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

  public async goto(url: string, options?: NavigateOptionsWithProgress): Promise<Response | null> {
    return executeWithProgress(async p => {
      p.log(`Page navigating to "${url}"`);
      return this.mainFrame().goto(url, { ...options, progress: p });
    }, options);
  }

  public async goBack(options?: NavigateOptionsWithProgress): Promise<Response | null> {
    return executeWithProgress(async p => {
      p.log('Page navigating back');

      // Start waiting for navigation before triggering the action
      const navigationPromise = this.navTracker.waitForNavigation(
        this.tabId,
        0, // main frame
        {
          waitUntil: options?.waitUntil ?? 'load',
          timeoutMs: options?.timeout ?? 30000,
        },
      );

      // Trigger the back navigation
      const success = await this._navigationDelegate.goBack();
      if (!success) {
        p.log('No history available for back navigation');
        return null;
      }

      // Wait for the navigation to complete
      await navigationPromise;
      p.log('Back navigation completed');

      // Return null for same-document navigation (following Playwright pattern)
      // TODO: Return actual Response for new-document navigation when network interception is available
      return null;
    }, options);
  }

  public async goForward(options?: NavigateOptionsWithProgress): Promise<Response | null> {
    return executeWithProgress(async p => {
      p.log('Page navigating forward');

      // Start waiting for navigation before triggering the action
      const navigationPromise = this.navTracker.waitForNavigation(
        this.tabId,
        0, // main frame
        {
          waitUntil: options?.waitUntil ?? 'load',
          timeoutMs: options?.timeout ?? 30000,
        },
      );

      // Trigger the forward navigation
      const success = await this._navigationDelegate.goForward();
      if (!success) {
        p.log('No forward history available');
        return null;
      }

      // Wait for the navigation to complete
      await navigationPromise;
      p.log('Forward navigation completed');

      // Return null for same-document navigation (following Playwright pattern)
      // TODO: Return actual Response for new-document navigation when network interception is available
      return null;
    }, options);
  }

  public async reload(options?: NavigateOptionsWithProgress): Promise<Response | null> {
    return executeWithProgress(async p => {
      p.log('Page reloading');

      // Start waiting for navigation before triggering the reload
      const navigationPromise = this.navTracker.waitForNavigation(
        this.tabId,
        0, // main frame
        {
          waitUntil: options?.waitUntil ?? 'load',
          timeoutMs: options?.timeout ?? 30000,
        },
      );

      // Trigger the page reload using chrome.tabs.reload
      try {
        await chrome.tabs.reload(this.tabId);
        p.log('Page reload initiated');
      } catch (error) {
        p.log(`Failed to reload tab: ${error}`);
        throw new Error(`Page reload failed: ${error}`);
      }

      // Wait for the navigation to complete
      await navigationPromise;
      p.log('Page reload completed');

      // Return null (following Playwright pattern)
      // TODO: Return actual Response for new-document navigation when network interception is available
      return null;
    }, options);
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return this.mainFrame().locator(selector, options);
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.mainFrame().getByTestId(testId);
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByAltText(text, options);
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByLabel(text, options);
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByPlaceholder(text, options);
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByText(text, options);
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.mainFrame().getByTitle(text, options);
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.mainFrame().getByRole(role, options);
  }

  frameLocator(selector: string): FrameLocator {
    return this.mainFrame().frameLocator(selector);
  }

  // Additional locator methods that delegate to main frame
  first(selector: string): Locator {
    return this.mainFrame().locator(selector).first();
  }

  last(selector: string): Locator {
    return this.mainFrame().locator(selector).last();
  }

  nth(selector: string, index: number): Locator {
    return this.mainFrame().locator(selector).nth(index);
  }

  async elementHandle(selector: string, options?: { timeout?: number }): Promise<ElementHandle> {
    return this.mainFrame().locator(selector).elementHandle(options);
  }

  async elementHandles(selector: string): Promise<ElementHandle[]> {
    return this.mainFrame().locator(selector).elementHandles();
  }

  async highlight(selector: string, options?: { timeout?: number }): Promise<void> {
    await this.mainFrame().locator(selector).highlight(options);
  }

  async hideHighlight(selector: string): Promise<void> {
    await this.mainFrame().locator(selector).hideHighlight();
  }

  async boundingBox(selector: string, options?: { timeout?: number }): Promise<Rect | null> {
    return this.mainFrame().locator(selector).boundingBox(options);
  }

  async count(selector: string): Promise<number> {
    return this.mainFrame().locator(selector).count();
  }

  async all(selector: string): Promise<Locator[]> {
    return this.mainFrame().locator(selector).all();
  }

  async allInnerTexts(selector: string): Promise<string[]> {
    return this.mainFrame().locator(selector).allInnerTexts();
  }

  async allTextContents(selector: string): Promise<string[]> {
    return this.mainFrame().locator(selector).allTextContents();
  }

  async queryCount(selector: string): Promise<number> {
    return this.mainFrame().queryCount(selector);
  }

  async queryAll(selector: string, scope?: ElementHandle): Promise<ElementHandle[]> {
    return this.mainFrame().queryAll(selector, scope);
  }

  async contentFrameIdForFrame(handle: ElementHandle): Promise<number | null> {
    return await getContentFrameId(handle, this.frameManager);
  }

  async getContentFrame(handle: ElementHandle): Promise<Frame | null> {
    const frameId = await this.contentFrameIdForFrame(handle);
    if (frameId === null) {
      return null;
    }
    return this.frameManager.frame(frameId);
  }

  async snapshotForAI(options?: { progress?: Progress }): Promise<string> {
    return executeWithProgress(async p => {
      this.lastSnapshotFrameIds = [];
      return await createPageSnapshotForAI(p, this.mainFrame(), this.lastSnapshotFrameIds);
    }, options);
  }

  async click(selector: string, options?: ClickOptions): Promise<void> {
    await this.frameManager.mainFrame().click(selector, options);
  }

  async dblclick(selector: string, options?: ClickOptions): Promise<void> {
    await this.frameManager.mainFrame().dblclick(selector, options);
  }

  async tap(selector: string, options?: ClickOptions): Promise<void> {
    await this.frameManager.mainFrame().tap(selector, options);
  }

  async check(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    await this.frameManager.mainFrame().check(selector, options);
  }

  async uncheck(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    await this.frameManager.mainFrame().uncheck(selector, options);
  }

  async setChecked(
    selector: string,
    checked: boolean,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    await this.frameManager.mainFrame().setChecked(selector, checked, options);
  }

  async fill(
    selector: string,
    value: string,
    options?: { timeout?: number; force?: boolean },
  ): Promise<void> {
    await this.frameManager.mainFrame().fill(selector, value, options);
  }

  async selectOption(
    selector: string,
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions,
  ): Promise<string[]> {
    return this.frameManager.mainFrame().selectOption(selector, values, options);
  }

  async clear(selector: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    await this.frameManager.mainFrame().clear(selector, options);
  }

  async dispatchEvent(
    selector: string,
    type: string,
    eventInit: Record<string, unknown> = {},
    options?: { timeout?: number },
  ): Promise<void> {
    await this.frameManager.mainFrame().dispatchEvent(selector, type, eventInit, options);
  }

  async getAttribute(
    selector: string,
    name: string,
    options?: { timeout?: number },
  ): Promise<string | null> {
    return await this.mainFrame().getAttribute(selector, name, options);
  }

  async hover(selector: string, options?: { timeout?: number }): Promise<void> {
    return await this.mainFrame().hover(selector, options);
  }

  async innerHTML(selector: string, options?: { timeout?: number }): Promise<string> {
    return await this.mainFrame().innerHTML(selector, options);
  }

  async innerText(selector: string, options?: { timeout?: number }): Promise<string> {
    return await this.mainFrame().innerText(selector, options);
  }

  async textContent(selector: string, options?: { timeout?: number }): Promise<string> {
    const result = await this.mainFrame().textContent(selector, options);
    return result;
  }

  async inputValue(selector: string, options?: { timeout?: number }): Promise<string> {
    return await this.mainFrame().inputValue(selector, options);
  }

  async isChecked(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isChecked(selector, options);
  }

  async isDisabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isDisabled(selector, options);
  }

  async isEditable(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isEditable(selector, options);
  }

  async isEnabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isEnabled(selector, options);
  }

  async isHidden(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isHidden(selector, options);
  }

  async isVisible(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isVisible(selector, options);
  }

  async press(
    selector: string,
    key: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void> {
    return await this.mainFrame().press(selector, key, options);
  }

  async type(
    selector: string,
    text: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void> {
    return await this.mainFrame().type(selector, text, options);
  }

  async evaluate<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<R> {
    return await this.mainFrame().evaluate(pageFunction, arg, options);
  }

  async evaluateHandle<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<ElementHandle | null> {
    return await this.mainFrame().evaluateHandle(pageFunction, arg, options);
  }

  /**
   * Get bounding box for an element handle.
   * Similar to Playwright's Page._getBoundingBox method.
   */
  async _getBoundingBox(handle: ElementHandle): Promise<Rect | null> {
    return await handle.boundingBox();
  }

  /**
   * Set files on an input element.
   * Similar to Playwright's Page.setInputFiles method.
   *
   * @example
   * ```typescript
   * await page.setInputFiles('#file-input', [file1, file2]);
   *
   * await page.setInputFiles('#file-input', [
   *   { name: 'data.json', mimeType: 'application/json', buffer: jsonBuffer }
   * ]);
   * ```
   */
  async setInputFiles(
    selector: string,
    files: FilePayload[] | File[],
    options?: { force?: boolean; directoryUpload?: boolean; timeout?: number },
  ): Promise<void> {
    return await this.mainFrame().setInputFiles(selector, files, options);
  }

  async screenshot(progress: Progress, options: ScreenshotOptions): Promise<Buffer> {
    const bufferLike = await this.screenshotter.screenshotPage(progress, options);
    // Convert BrowserBuffer to Node.js Buffer for compatibility
    return convertBrowserBufferToNodeBuffer(bufferLike);
  }

  /**
   * Safely evaluate a function in all frames without throwing on JavaScript errors.
   * This is the Chrome extension equivalent of Playwright's safeNonStallingEvaluateInAllFrames.
   *
   * @param func Function to execute in each frame
   * @param world Execution world to run the function in
   * @param options Configuration options
   * @returns Promise that resolves when all frame evaluations complete
   */
  async safeNonStallingEvaluateInAllFrames<Args extends unknown[]>(
    func: (...args: Args) => unknown,
    world: chrome.scripting.ExecutionWorld,
    options: { throwOnJSErrors?: boolean } = {},
    ...args: Args
  ): Promise<void> {
    const frames = this.frameManager.frames();

    await Promise.all(
      frames.map(async frame => {
        try {
          // Use frame's execution context to safely evaluate the function
          await frame.context.executeScript(func, world, ...args);
        } catch (e) {
          // Only throw if it's a JavaScript error and throwOnJSErrors is true
          if (options.throwOnJSErrors && isJavaScriptErrorInEvaluate(e)) {
            throw e;
          }
          // Silently ignore other errors (connection issues, frame detached, etc.)
          console.debug(`Frame evaluation failed silently:`, e);
        }
      }),
    );
  }

  async expectScreenshot(
    progress: Progress,
    options: ExpectScreenshotOptions,
  ): Promise<{
    actual?: Buffer;
    previous?: Buffer;
    diff?: Buffer;
    errorMessage?: string;
    log?: string[];
    timedOut?: boolean;
  }> {
    const locator = options.locator;

    // Create screenshot function based on whether we have a locator or not
    const rafrafScreenshot = locator
      ? async (timeout: number) => {
          const bufferLike = await locator.frame.rafrafTimeoutScreenshotElementWithProgress(
            progress,
            locator.selector,
            timeout,
            options || {},
          );
          // Convert BrowserBuffer to Node.js Buffer for compatibility if needed
          return convertBrowserBufferToNodeBuffer(bufferLike);
        }
      : async (timeout: number) => {
          await executeWithProgress(
            async p => {
              await this.mainFrame().rafrafTimeout(p, timeout);
            },
            { timeout: 30000 },
          );
          const bufferLike = await this.screenshotter.screenshotPage(progress, options || {});
          // Convert BrowserBuffer to Node.js Buffer for compatibility
          return convertBrowserBufferToNodeBuffer(bufferLike);
        };

    // Validate screenshot options
    try {
      const format = validateScreenshotOptions(options || {});
      validateScreenshotFormat(format);
    } catch (error) {
      return { errorMessage: (error as Error).message };
    }

    // Simple comparison for now - just take one screenshot
    // This is a simplified version without the full Playwright comparison logic
    try {
      const actual = await rafrafScreenshot(100); // Small delay before screenshot
      if (!options.expected) {
        return { actual };
      }

      // For now, return the actual screenshot
      // TODO: Implement proper image comparison using compare utilities
      return { actual };
    } catch (error) {
      return {
        errorMessage: (error as Error).message,
        timedOut: false,
      };
    }
  }
}
