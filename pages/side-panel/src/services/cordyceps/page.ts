import { Disposable } from 'vs/base/common/lifecycle';
import { FrameManager } from './frameManager';
import { Frame, FrameLocator } from './frame';
import { Progress, executeWithProgress } from './progress';
import { Session } from './session';
import { FrameExecutionContext } from './frameExecutionContext';
import type {
  NavigateOptionsWithProgress,
  Rect,
  ClickOptions,
  SelectOption,
  SelectOptionOptions,
} from './types';
import { ByRoleOptions } from '@injected/isomorphic/locatorUtils';
import { LocatorOptions, Locator } from './locator';
import { ElementHandle } from './elementHandle';

export class Page extends Disposable {
  private _ownedContext?: object;
  readonly frameManager: FrameManager;
  readonly tabId: number;
  readonly session: Session;
  lastSnapshotFrameIds: number[] = [];

  constructor(tabId: number, session: Session) {
    super();
    this.tabId = tabId;
    this.session = session;
    this.frameManager = this._register(new FrameManager(this));

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
    const result = await handle.context.evaluate(
      (h: string) => {
        const injected = window.__cordyceps_handledInjectedScript;
        const element = injected.getElementByHandle(h);
        if (element && 'contentWindow' in element && (element as HTMLIFrameElement).contentWindow) {
          // Return the src of the iframe. We'll use this to find the frame.
          return (element as HTMLIFrameElement).src;
        }
        return null;
      },
      'ISOLATED',
      handle.remoteObject,
    );

    if (!result) {
      return null;
    }

    // Now, find the frame with this src. This is not foolproof.
    const frames = this.frameManager.frames();
    const frame = frames.find(f => f.url() === result);
    return frame ? frame.frameId : null;
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
      const snapshot = await snapshotFrameForAI(p, this.mainFrame(), 0, this.lastSnapshotFrameIds);
      return snapshot.join('\n');
    }, options);
  }

  async click(selector: string, options?: ClickOptions): Promise<void> {
    await this.frameManager.mainFrame().click(selector, options);
  }

  async dblclick(selector: string, options?: ClickOptions): Promise<void> {
    await this.frameManager.mainFrame().dblclick(selector, options);
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

  // Put locator methods here

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

  /**
   * Get an attribute of the first matching element
   */
  async getAttribute(
    selector: string,
    name: string,
    options?: { timeout?: number },
  ): Promise<string | null> {
    return await this.mainFrame().getAttribute(selector, name, options);
  }

  /**
   * Hover over the first matching element
   */
  async hover(selector: string, options?: { timeout?: number }): Promise<void> {
    return await this.mainFrame().hover(selector, options);
  }

  /**
   * Get the innerHTML of the first matching element
   */
  async innerHTML(selector: string, options?: { timeout?: number }): Promise<string> {
    return await this.mainFrame().innerHTML(selector, options);
  }

  /**
   * Get the innerText of the first matching element
   */
  async innerText(selector: string, options?: { timeout?: number }): Promise<string> {
    return await this.mainFrame().innerText(selector, options);
  }

  /**
   * Get the input value of the first matching element
   */
  async inputValue(selector: string, options?: { timeout?: number }): Promise<string> {
    return await this.mainFrame().inputValue(selector, options);
  }

  /**
   * Check if the first matching element is checked
   */
  async isChecked(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isChecked(selector, options);
  }

  /**
   * Check if the first matching element is disabled
   */
  async isDisabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isDisabled(selector, options);
  }

  /**
   * Check if the first matching element is editable
   */
  async isEditable(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isEditable(selector, options);
  }

  /**
   * Check if the first matching element is enabled
   */
  async isEnabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isEnabled(selector, options);
  }

  /**
   * Check if the first matching element is hidden
   */
  async isHidden(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isHidden(selector, options);
  }

  /**
   * Check if the first matching element is visible
   */
  async isVisible(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return await this.mainFrame().isVisible(selector, options);
  }

  /**
   * Press a key on the first matching element
   */
  async press(
    selector: string,
    key: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void> {
    return await this.mainFrame().press(selector, key, options);
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

  // #region TESTING
  async testFrameExecutionContext(options?: { progress?: Progress }): Promise<void> {
    return executeWithProgress(async p => {
      p.log('Starting FrameExecutionContext tests...');

      const frame = this.mainFrame();
      const context = await frame._retryWithProgressAndTimeouts<FrameExecutionContext>(
        p,
        undefined,
        async continuePolling => {
          if (frame.context) {
            return frame.context;
          }
          p.log('Waiting for execution context...');
          return continuePolling;
        },
      );

      p.log('Execution context found.');

      p.log('Test page loaded.');

      // 2. Test elementExists
      p.log('Testing elementExists...');
      const checkboxExists = await context.elementExists('#test-checkbox');
      console.assert(checkboxExists, 'Test Failed: #test-checkbox should exist');
      const nonExistentExists = await context.elementExists('#nonexistent');
      console.assert(!nonExistentExists, 'Test Failed: #nonexistent should not exist');
      p.log('elementExists tests passed.');

      // 3. Test querySelector
      p.log('Testing querySelector...');
      const containerHandle = await context.querySelector('.container');
      console.assert(
        containerHandle,
        'Test Failed: querySelector for .container should return a handle.',
      );
      const nonExistentHandle = await context.querySelector('#nonexistent');
      console.assert(
        !nonExistentHandle,
        'Test Failed: querySelector for #nonexistent should return null.',
      );
      const buttonInContainerHandle = await context.querySelector(
        '#action-button',
        containerHandle!,
      );
      console.assert(
        buttonInContainerHandle,
        'Test Failed: querySelector for #action-button within .container should return a handle.',
      );
      p.log('querySelector tests passed.');
      // 4. Test querySelectorAll
      p.log('Testing querySelectorAll...');
      // Test global querySelectorAll for button
      const buttonHandlesGlobal = await context.querySelectorAll('button');
      console.assert(
        buttonHandlesGlobal.length === 4,
        'Test Failed: querySelectorAll for button (global) should return 4 handles.',
      );
      // Get handle for .controls container
      const controlsHandle = await context.querySelector('.controls');
      console.assert(
        controlsHandle,
        'Test Failed: querySelector for .controls should return a handle.',
      );
      // Test scoped querySelectorAll for button within .controls
      const buttonHandlesInControls = await context.querySelectorAll('button', controlsHandle!);
      console.assert(
        buttonHandlesInControls.length === 3,
        'Test Failed: querySelectorAll for button within .controls should return 3 handles.',
      );
      const nonExistentHandles = await context.querySelectorAll('.nonexistent');
      console.assert(
        nonExistentHandles.length === 0,
        'Test Failed: querySelectorAll for .nonexistent should return an empty array.',
      );
      p.log('querySelectorAll tests passed.');

      // 5. Test clickSelector
      p.log('Testing clickSelector...');
      await context.clickSelector('#toggle-button');
      // This is a bit tricky to test without more complex state checking,
      // but we can at least ensure it doesn't throw.
      p.log('clickSelector test passed.');

      // 6. Test ariaSnapshot
      p.log('Testing ariaSnapshot...');
      const pageSnapshot = await context.ariaSnapshot(true, '');
      console.assert(
        typeof pageSnapshot === 'string' && pageSnapshot.includes('Cordyceps Example Domain'),
        'Test Failed: Page snapshot should be a string containing "Cordyceps Example Domain".',
      );
      const containerSnapshot = await context.ariaSnapshot(true, '', 'ISOLATED', containerHandle!);
      console.assert(
        typeof containerSnapshot === 'string' && containerSnapshot.includes('Interactive Controls'),
        'Test Failed: .container snapshot should contain "Interactive Controls".',
      );
      p.log('ariaSnapshot tests passed.');

      p.log('All FrameExecutionContext tests passed!');
    }, options);
  }
}

// We can return to this at a later time
async function snapshotFrameForAI(
  progress: Progress,
  frame: Frame,
  frameOrdinal: number,
  frameIds: number[],
): Promise<string[]> {
  // Only await the topmost navigations, inner frames will be empty when racing.
  const snapshot = await frame._retryWithProgressAndTimeouts<string>(
    progress,
    [1000, 2000, 4000, 8000],
    async continuePolling => {
      try {
        const context = frame.context;
        const refPrefix = frameOrdinal ? 'f' + frameOrdinal : '';
        const forAI = true;
        const snapshotOrRetry = await progress.race(
          context.ariaSnapshot(forAI, refPrefix, 'ISOLATED'),
        );
        if (typeof snapshotOrRetry === 'boolean') return continuePolling;
        return snapshotOrRetry;
      } catch (e) {
        if (e instanceof Error && frame.isNonRetriableError(e)) throw e;
        return continuePolling;
      }
    },
  );
  const lines = snapshot.split('\n');
  const result = [];
  for (const line of lines) {
    const match = line.match(/^(\s*)- iframe (?:\[active\] )?\[ref=(.*)\]/);
    if (!match) {
      result.push(line);
      continue;
    }

    const leadingSpace = match[1];
    const ref = match[2];
    const frameSelector = `aria-ref=${ref} >> internal:control=enter-frame`;
    const frameBodySelector = `${frameSelector} >> body`;
    const child = await progress.race(
      frame.selectors.resolveFrameForSelector(frameBodySelector, { strict: true }),
    );
    if (!child) {
      result.push(line);
      continue;
    }
    const frameOrdinal = frameIds.length + 1;
    frameIds.push(child.frame.frameId);
    try {
      const childSnapshot = await snapshotFrameForAI(progress, child.frame, frameOrdinal, frameIds);
      result.push(line + ':', ...childSnapshot.map(l => leadingSpace + '  ' + l));
    } catch {
      result.push(line);
    }
  }
  return result;
}
