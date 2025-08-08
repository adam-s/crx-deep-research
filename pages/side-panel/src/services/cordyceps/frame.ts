import { Disposable } from 'vs/base/common/lifecycle';
import { Progress, executeWithProgress, isAbortError } from './progress';
import { helper } from './helper';
import type { FrameManager } from './frameManager';
import type { FrameExecutionContext } from './frameExecutionContext';
import type {
  NavigationEvent,
  LifecycleEvent,
  NavigateOptionsWithProgress,
  WaitForElementOptions,
  ClickOptions,
  SelectOption,
  SelectOptionOptions,
  FrameDragAndDropOptions,
} from './types';
import { Event } from 'vs/base/common/event';
import { FrameSelectors } from './frameSelectors';
import { isSessionClosedError } from './protocolError';
import {
  getByTestIdSelector,
  getByAltTextSelector,
  getByLabelSelector,
  getByPlaceholderSelector,
  getByTextSelector,
  getByTitleSelector,
  ByRoleOptions,
  getByRoleSelector,
} from '@injected/isomorphic/locatorUtils';
import { LocatorOptions, Locator } from './locator';
import { isString } from '@injected/isomorphic/stringUtils';
import { ElementHandle } from './elementHandle';
import {
  calculateCenterPosition,
  testIdAttributeName,
  createDragAndDropScript,
} from './frameUtils';
import { FileTransferPortController } from './fileTransferPortController';
// #region Helper Functions

/**
 * Frame class with enhanced navigation event handling to solve race conditions.
 *
 * This implementation uses two key strategies from Playwright's approach:
 *
 * 1. **Navigation Event Buffering**:
 *    - Captures navigation events in a buffer from the moment the Frame is created
 *    - When triggering navigation, checks the buffer first before waiting for future events
 *    - Prevents race conditions where events fire between "start listening" and "trigger navigation"
 *
 * 2. **Lifecycle Event Caching**:
 *    - Maintains a Set of already-fired lifecycle events ('load', 'commit', etc.)
 *    - Before waiting for a lifecycle event, checks if it's already been seen
 *    - Prevents hanging when trying to wait for events that already occurred
 *
 * This approach ensures that navigation and lifecycle waiting never misses events,
 * eliminating the common race condition where events fire before listeners are set up.
 */
export class Frame extends Disposable {
  private _parentFrame: Frame | null;
  private _childFrames = new Set<Frame>();
  public frameId: number;
  public readonly frameManager: FrameManager;
  public readonly tabId: number;
  private _url?: string;
  private _context?: FrameExecutionContext;
  readonly selectors: FrameSelectors;
  readonly fileTransferPortController: FileTransferPortController;

  // Buffering for navigation events to solve race conditions
  private _navigationBuffer: NavigationEvent[] = [];

  // Caching for lifecycle events to avoid waiting for already-fired events
  private _firedLifecycleEvents = new Set<LifecycleEvent>();

  constructor(
    frameId: number,
    frameManager: FrameManager,
    parentFrame: Frame | null,
    url?: string,
  ) {
    super();
    this.frameId = frameId;
    this.frameManager = parentFrame ? parentFrame.frameManager : frameManager;
    this.tabId = this.frameManager.tabId;
    this._parentFrame = parentFrame;
    this._url = url;
    this.selectors = new FrameSelectors(this);
    this.fileTransferPortController = this._register(new FileTransferPortController());

    // Set up navigation event buffering - capture all navigation events for this frame
    this._register(
      this.frameManager.page.session.onCompleted(details => {
        if (details.frameId === this.frameId && details.tabId === this.tabId) {
          const navEvent: NavigationEvent = {
            frameId: details.frameId,
            url: details.url,
            lifecycleEvents: ['load'], // onCompleted typically means 'load' lifecycle
          };
          this._navigationBuffer.push(navEvent);
          this._firedLifecycleEvents.add('load');
        }
      }),
    );

    this._register(
      this.frameManager.page.session.onCommitted(details => {
        if (details.frameId === this.frameId && details.tabId === this.tabId) {
          const navEvent: NavigationEvent = {
            frameId: details.frameId,
            url: details.url,
            lifecycleEvents: ['commit'],
          };
          this._navigationBuffer.push(navEvent);
          this._firedLifecycleEvents.add('commit');
        }
      }),
    );

    this._register(
      this.frameManager.page.session.onErrorOccurred(details => {
        if (details.frameId === this.frameId && details.tabId === this.tabId) {
          const navEvent: NavigationEvent = {
            frameId: details.frameId,
            url: details.url,
            error: new Error(details.error || 'Navigation error'),
          };
          this._navigationBuffer.push(navEvent);
        }
      }),
    );

    // Add this frame to parent's children
    if (parentFrame) {
      parentFrame._childFrames.add(this);
      // Ensure this frame is removed from parent when disposed
      this._register({
        dispose: () => {
          if (parentFrame) {
            parentFrame._childFrames.delete(this);
            console.log(
              `🗑️ Frame ${this.frameId} removed from parent frame ${parentFrame.frameId} (tab ${this.tabId})`,
            );
          }
        },
      });
    }

    console.log(
      `✅ Frame ${frameId} created in tab ${this.tabId} with parent ${parentFrame?.frameId ?? 'none'} - URL: ${url ?? 'no url'}`,
    );
  }

  dispose(): void {
    console.log(`🗑️ Disposing Frame ${this.frameId} in tab ${this.tabId}`);

    // Log child frames that will be disposed
    if (this._childFrames.size > 0) {
      console.log(
        `🗑️ Frame ${this.frameId} disposing ${this._childFrames.size} child frames: [${Array.from(
          this._childFrames,
        )
          .map(f => f.frameId)
          .join(', ')}]`,
      );
    }

    // Dispose execution context if it exists
    if (this._context) {
      console.log(`🗑️ Frame ${this.frameId} disposing execution context`);
    }

    super.dispose();
    console.log(`✅ Frame ${this.frameId} disposed successfully`);
  }

  _setContext(context: FrameExecutionContext): void {
    this._context = context;
  }

  get context(): FrameExecutionContext {
    if (!this._context) {
      throw new Error(`Frame ${this.frameId} has no execution context`);
    }
    return this._context;
  }

  /**
   * Access the shared Session via its manager.
   */
  get session() {
    return this.frameManager.page.session;
  }

  get mainFrame() {
    return this.frameManager.mainFrame();
  }

  parentFrame(): Frame | null {
    return this._parentFrame;
  }

  childFrames(): Frame[] {
    return Array.from(this._childFrames);
  }

  clearChildFrames(): void {
    console.log(
      `🗑️ Frame ${this.frameId} clearing ${this._childFrames.size} child frames: [${Array.from(
        this._childFrames,
      )
        .map(f => f.frameId)
        .join(', ')}]`,
    );
    for (const childFrame of this._childFrames) {
      childFrame.dispose();
    }
    this._childFrames.clear();
    console.log(`✅ Frame ${this.frameId} cleared all child frames`);
  }

  url(): string | undefined {
    return this._url;
  }

  setUrl(url: string): void {
    this._url = url;
  }

  private static readonly kDefaultTimeouts = [0, 20, 50, 100, 100, 500];

  public async _retryWithProgressAndTimeouts<R>(
    progress: Progress,
    timeouts: number[] = Frame.kDefaultTimeouts,
    action: (continuePolling: symbol) => Promise<R | symbol>,
  ): Promise<R> {
    const continuePolling = Symbol('continuePolling');
    // Prepend zero to ensure immediate first attempt
    const delays = [0, ...timeouts];
    let idx = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const delay = delays[Math.min(idx++, delays.length - 1)];
      if (delay) {
        // race a simple timeout against any page/frame abort signals
        await progress.race(new Promise(f => setTimeout(f, delay)));
      }
      try {
        const result = await action(continuePolling);
        if (result !== continuePolling) {
          return result as R;
        }
        // else loop and retry
      } catch (e) {
        // If it's a "hard" error, bubble up; otherwise retry
        if ((e as Error).message.includes('not connected')) {
          continue;
        }
        throw e;
      }
    }
  }

  /**
   * Navigate with buffering to avoid race conditions.
   * First checks if navigation event is already in buffer, otherwise waits for it.
   */
  private async _navigateWithBuffer(
    url: string,
    options: { timeout?: number; progress?: Progress } = {},
  ): Promise<NavigationEvent> {
    const { progress } = options;

    return new Promise((resolve, reject) => {
      // Clear old navigation buffer
      this._navigationBuffer.length = 0;

      // Set up cleanup for progress
      const cleanup = () => {
        // Cleanup is handled by the registered listeners
      };

      if (progress) {
        progress.cleanupWhenAborted(cleanup);
      }

      // Trigger the navigation
      chrome.tabs.update(this.tabId, { url });
      progress?.log(`Frame ${this.frameId} navigating to "${url}"`);

      // Check buffer after a short delay to catch immediate events
      setTimeout(() => {
        // Check if event is already in buffer (fired synchronously)
        const match = this._navigationBuffer.find(
          event => event.frameId === this.frameId && event.url === url,
        );

        if (match) {
          progress?.log(`Frame ${this.frameId} navigation found in buffer`);
          resolve(match);
          return;
        }

        // Otherwise wait for the next matching navigation event
        const { promise, dispose } = helper.waitForEvent(
          progress!,
          this.frameManager.page.session.onCompleted,
          details => details.frameId === this.frameId && details.tabId === this.tabId,
        );

        promise
          .then(() => {
            // Find the matching event in our buffer
            const bufferMatch = this._navigationBuffer.find(
              event => event.frameId === this.frameId,
            );
            if (bufferMatch) {
              progress?.log(`Frame ${this.frameId} navigation completed`);
              resolve(bufferMatch);
            } else {
              // Fallback - create event from completed details
              const fallbackEvent: NavigationEvent = {
                frameId: this.frameId,
                url,
                lifecycleEvents: ['load'],
              };
              resolve(fallbackEvent);
            }
          })
          .catch(reject)
          .finally(() => dispose());
      }, 10); // Small delay to catch synchronous events
    });
  }

  /**
   * Wait for a lifecycle event, but only if we haven't already seen it.
   */
  private async _waitForLifecycle(
    state: LifecycleEvent,
    options: { timeout?: number; progress?: Progress } = {},
  ): Promise<void> {
    const { progress } = options;

    // If we've already seen this lifecycle event, return immediately
    if (this._firedLifecycleEvents.has(state)) {
      progress?.log(`Frame ${this.frameId} already fired lifecycle event: ${state}`);
      return;
    }

    // Otherwise wait for it
    await executeWithProgress<void>(async p => {
      let event: Event<chrome.webNavigation.WebNavigationFramedCallbackDetails>;
      let predicate: (details: chrome.webNavigation.WebNavigationFramedCallbackDetails) => boolean;

      switch (state) {
        case 'load':
          event = this.frameManager.page.session.onCompleted;
          predicate = details => details.tabId === this.tabId && details.frameId === this.frameId;
          break;
        case 'commit':
          // Use onCompleted for commit as well, but could use onCommitted if needed
          event = this.frameManager.page.session.onCompleted;
          predicate = details => details.tabId === this.tabId && details.frameId === this.frameId;
          break;
        case 'domcontentloaded':
          // For now, treat as load - could be enhanced with DOM content loaded detection
          event = this.frameManager.page.session.onCompleted;
          predicate = details => details.tabId === this.tabId && details.frameId === this.frameId;
          break;
        case 'networkidle':
          // For now, treat as load - could be enhanced with network idle detection
          event = this.frameManager.page.session.onCompleted;
          predicate = details => details.tabId === this.tabId && details.frameId === this.frameId;
          break;
        default:
          throw new Error(`Unsupported lifecycle event: ${state}`);
      }

      const { promise, dispose } = helper.waitForEvent(p, event, predicate);

      try {
        await promise;
        this._firedLifecycleEvents.add(state);
        p.log(`Frame ${this.frameId} finished waiting for lifecycle event: ${state}`);
      } finally {
        dispose();
      }
    }, options);
  }

  /**
   * Navigate this frame using the session's abstracted events with buffering.
   */
  async goto(url: string, options?: NavigateOptionsWithProgress): Promise<Response | null> {
    if (this._parentFrame) throw new Error('Child frame navigation not yet implemented');

    return executeWithProgress(async p => {
      // 1) Trigger navigation and wait for it to complete
      await this._navigateWithBuffer(url, { ...options, progress: p });

      // 2) If waitUntil is set (default "load"), wait for that lifecycle event
      const waitUntil = options?.waitUntil ?? 'load';
      await this._waitForLifecycle(waitUntil, { ...options, progress: p });

      // 3) Update our URL
      this.setUrl(url);

      // 4) Return null for now (could return Response in the future)
      return null;
    }, options);
  }

  async waitForSelector(
    progress: Progress,
    selector: string,
    performActionPreChecksAndLog: boolean,
    options: WaitForElementOptions,
    scope?: ElementHandle,
  ): Promise<ElementHandle | null> {
    // Validate options
    const { state = 'visible' } = options;
    if (!['attached', 'detached', 'visible', 'hidden'].includes(state)) {
      throw new Error(`state: expected one of (attached|detached|visible|hidden)`);
    }

    // Log once if requested
    if (performActionPreChecksAndLog) {
      progress.log(
        `waiting for selector "${selector}"${state === 'attached' ? '' : ' to be ' + state}`,
      );
    }

    // Main retry loop
    return this._retryWithProgressAndTimeouts(
      progress,
      Frame.kDefaultTimeouts,
      async continuePolling => {
        // Step 1: Resolve selector metadata
        const resolved = await progress.race(
          this.selectors.resolveInjectedForSelector(selector, options, scope),
        );

        if (!resolved) {
          // For hidden/detached states, null means success
          if (state === 'hidden' || state === 'detached') return null;
          return continuePolling;
        }

        // Step 2: Execute selector evaluation via content script
        const result = await progress.race(
          resolved.frame.context.waitForSelectorEvaluation(
            resolved.info.parsed,
            resolved.info.strict,
            resolved.frame === this && scope ? scope.remoteObject : null,
            selector,
            resolved.info.world,
          ),
        );

        if (!result) {
          // For hidden/detached states, null means success
          if (state === 'hidden' || state === 'detached') return null;
          return continuePolling;
        }

        // Step 3: Process result
        const { log, elementHandle, visible, attached, error } = result;

        // Handle errors from content script
        if (error) {
          throw new Error(`Selector evaluation failed: ${error}`);
        }

        // Log any messages from content script
        if (log) {
          progress.log(log);
        }

        // Step 4: Check if current state matches desired state
        const stateMatches = {
          attached,
          detached: !attached,
          visible,
          hidden: !visible,
        }[state];

        if (!stateMatches) {
          return continuePolling; // Keep retrying
        }

        // Step 5: Handle return value based on options and state
        if (options.omitReturnValue) {
          return null; // User doesn't need the element
        }

        if (state === 'detached' || state === 'hidden') {
          return null; // Element shouldn't be used in these states
        }

        // Step 6: Return ElementHandle for attached/visible states
        if (elementHandle) {
          return new ElementHandle(resolved.frame.context, elementHandle);
        }

        return null;
      },
    );
  }

  isNonRetriableError(e: Error) {
    if (isAbortError(e)) return true;
    if (isSessionClosedError(e)) return true;
    return false;
  }

  // #region Dom Interaction

  /**
   * Helper method to execute an action with an ElementHandle, handling the lifecycle of
   * getting the handle, executing the action, and disposing of the handle.
   */
  private async _executeWithElementHandle<T>(
    selector: string,
    timeout: number,
    action: (handle: ElementHandle, progress: Progress) => Promise<T>,
  ): Promise<T> {
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, { strict: true });

        if (!handle) {
          const error = `Element not found for selector: ${selector}`;
          throw new Error(error);
        }

        try {
          const result = await action(handle, progress);
          return result;
        } finally {
          handle.dispose();
        }
      },
      { timeout },
    );
  }

  /**
   * Click a selector, but only after the frame has loaded.
   */
  async click(selector: string, options?: ClickOptions): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.clickWithProgress(progress, options),
    );
  }

  async dblclick(selector: string, options?: ClickOptions): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.dblclickWithProgress(progress, options),
    );
  }

  async tap(selector: string, options?: ClickOptions): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.tapWithProgress(progress, options),
    );
  }

  async dispatchEvent(
    selector: string,
    type: string,
    eventInit: Record<string, unknown> = {},
    options?: { timeout?: number },
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.dispatchEventWithProgress(progress, type, eventInit),
    );
  }

  /**
   * Perform a drag and drop operation from source selector to target selector.
   *
   * @param source The CSS selector of the source element to drag from
   * @param target The CSS selector of the target element to drop to
   * @param options Optional drag and drop configuration
   * @returns Promise that resolves when drag and drop is complete
   *
   * @example
   * ```typescript
   * // Basic drag and drop
   * await frame.dragAndDrop('#source-element', '#target-element');
   *
   * // With custom positions
   * await frame.dragAndDrop('#source', '#target', {
   *   sourcePosition: { x: 10, y: 10 },
   *   targetPosition: { x: 50, y: 50 }
   * });
   * ```
   */
  async dragAndDrop(
    source: string,
    target: string,
    options: FrameDragAndDropOptions & { timeout?: number } = {},
  ): Promise<void> {
    const timeout = options.timeout || 30000;

    return await executeWithProgress(
      async progress => {
        progress.log(`Starting drag and drop from "${source}" to "${target}"`);

        // Get both source and target elements first to ensure they exist
        const sourceHandle = await this.waitForSelector(progress, source, false, { strict: true });
        if (!sourceHandle) {
          const error = `Source element not found for selector: ${source}`;
          throw new Error(error);
        }

        const targetHandle = await this.waitForSelector(progress, target, false, { strict: true });
        if (!targetHandle) {
          const error = `Target element not found for selector: ${target}`;
          sourceHandle.dispose();
          throw new Error(error);
        }

        try {
          // Get bounding boxes for position calculations
          const sourceBox = await sourceHandle.boundingBox();
          const targetBox = await targetHandle.boundingBox();

          if (!sourceBox) {
            throw new Error(`Source element "${source}" has no bounding box`);
          }
          if (!targetBox) {
            throw new Error(`Target element "${target}" has no bounding box`);
          }

          const sourcePosition = options.sourcePosition || calculateCenterPosition(sourceBox);
          const targetPosition = options.targetPosition || calculateCenterPosition(targetBox);

          // Use the improved drag and drop simulation with DataTransfer

          await this.context.executeScript(
            createDragAndDropScript(),
            'ISOLATED',
            source,
            target,
            sourcePosition,
            targetPosition,
          );

          progress.log(`Drag and drop from "${source}" to "${target}" completed successfully`);
        } finally {
          // Always dispose of handles
          sourceHandle.dispose();
          targetHandle.dispose();
        }
      },
      { timeout },
    );
  }

  /**
   * Direct click using chrome.scripting.executeScript - simpler alternative to click()
   * This bypasses the retry-with-progress pattern for cases where you want direct control
   */
  async clickSelector(
    selector: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
  ): Promise<void> {
    if (!this._context) {
      throw new Error(`Frame ${this.frameId} has no execution context`);
    }
    await this._context.clickSelector(selector, undefined, world);
  }

  locator(selector: string, options?: LocatorOptions): Locator {
    return new Locator(this, selector, options);
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(testIdAttributeName(), testId));
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTitleSelector(text, options));
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.locator(getByRoleSelector(role, options));
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(this, selector);
  }

  async check(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, { strict: true });
        if (!handle) {
          throw new Error(`Element not found for selector: ${selector}`);
        }
        try {
          return await handle.checkWithProgress(progress);
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async uncheck(
    selector: string,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, { strict: true });
        if (!handle) {
          throw new Error(`Element not found for selector: ${selector}`);
        }
        try {
          return await handle.uncheckWithProgress(progress);
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async setChecked(
    selector: string,
    checked: boolean,
    options?: { force?: boolean; position?: { x: number; y: number }; timeout?: number },
  ): Promise<void> {
    if (checked) {
      await this.check(selector, options);
    } else {
      await this.uncheck(selector, options);
    }
  }

  async fill(
    selector: string,
    value: string,
    options?: { timeout?: number; force?: boolean },
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.fillWithProgress(progress, value, options),
    );
  }

  async selectOption(
    selector: string,
    values: SelectOption | SelectOption[],
    options?: SelectOptionOptions,
  ): Promise<string[]> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.selectOptionWithProgress(progress, values, options),
    );
  }

  async clear(selector: string, options?: { timeout?: number; force?: boolean }): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, (handle, progress) =>
      handle.clearWithProgress(progress, options),
    );
  }

  /**
   * Sets files on an input element following Playwright patterns.
   * This method provides a high-level interface for setting files with proper validation.
   *
   * @param selector CSS selector for the input element
   * @param files Array of file payloads or File objects to set
   * @param options Options for the operation including timeout and force
   * @returns Promise that resolves when files are set
   *
   * @example
   * ```typescript
   * // Set files from File objects
   * await frame.setInputFiles('#file-input', [file1, file2]);
   *
   * // Set files from data with custom options
   * await frame.setInputFiles('#file-input', [
   *   { name: 'test.txt', mimeType: 'text/plain', buffer: textBuffer }
   * ], { force: true, timeout: 60000 });
   * ```
   */
  async setInputFiles(
    selector: string,
    files: { name: string; mimeType: string; buffer: ArrayBuffer }[] | File[],
    options?: { force?: boolean; directoryUpload?: boolean; timeout?: number },
  ): Promise<void> {
    // For hidden elements with force option, wait for attached state instead of visible
    const waitState = options?.force ? 'attached' : 'visible';

    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, {
          strict: true,
          state: waitState,
        });

        if (!handle) {
          const error = `Element not found for selector: ${selector}`;
          throw new Error(error);
        }

        try {
          const result = await handle.setInputFilesWithProgress(progress, files, options);
          return result;
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async highlight(selector: string, options?: { timeout?: number }): Promise<void> {
    return await executeWithProgress(
      async () => {
        await this.context.highlight(selector);
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async hideHighlight(): Promise<void> {
    return await executeWithProgress(
      async () => {
        await this.context.hideHighlight();
      },
      { timeout: 30000 },
    );
  }

  async evaluate<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<R> {
    return await executeWithProgress(
      async () => {
        // Pass function directly, args as rest parameters
        if (arg !== undefined) {
          const result = await this.context.executeScript(pageFunction, 'ISOLATED', arg);
          return result as R;
        } else {
          // Cast to no-arg function when no argument provided
          const noArgFunction = pageFunction as () => R;
          const result = await this.context.executeScript(noArgFunction, 'ISOLATED');
          return result as R;
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async evaluateHandle<R, Arg>(
    pageFunction: (...args: [Arg]) => R,
    arg?: Arg,
    options?: { timeout?: number },
  ): Promise<ElementHandle | null> {
    return await executeWithProgress(
      async () => {
        // Pass function directly, args as rest parameters
        if (arg !== undefined) {
          return await this.context.evaluateHandle(pageFunction, 'ISOLATED', arg);
        } else {
          // Cast to no-arg function when no argument provided
          const noArgFunction = pageFunction as () => R;
          return await this.context.evaluateHandle(noArgFunction, 'ISOLATED');
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async queryCount(selector: string): Promise<number> {
    return await this.selectors.queryCount(selector);
  }

  async queryAll(selector: string, scope?: ElementHandle): Promise<ElementHandle[]> {
    return await this.selectors.queryAll(selector, scope);
  }

  async getAttribute(
    selector: string,
    name: string,
    options?: { timeout?: number },
  ): Promise<string | null> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.getAttribute(name),
    );
  }

  async hover(selector: string, options?: { timeout?: number }): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.hover(),
    );
  }

  async innerHTML(selector: string, options?: { timeout?: number }): Promise<string> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.innerHTML(),
    );
  }

  async innerText(selector: string, options?: { timeout?: number }): Promise<string> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.innerText(),
    );
  }

  async textContent(selector: string, options?: { timeout?: number }): Promise<string> {
    const result = await this._executeWithElementHandle(
      selector,
      options?.timeout || 30000,
      handle => handle.textContent(),
    );
    return result;
  }

  async inputValue(selector: string, options?: { timeout?: number }): Promise<string> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.inputValue(),
    );
  }

  async isChecked(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isChecked(),
    );
  }

  async isDisabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isDisabled(),
    );
  }

  async isEditable(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isEditable(),
    );
  }

  async isEnabled(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isEnabled(),
    );
  }

  async isHidden(selector: string, options?: { timeout?: number }): Promise<boolean> {
    // For isHidden, we need to find the element whether it's visible or hidden
    // So we use state: 'attached' instead of the default 'visible'
    return await executeWithProgress(
      async progress => {
        const handle = await this.waitForSelector(progress, selector, false, {
          strict: true,
          state: 'attached',
        });

        if (!handle) {
          throw new Error(`Element not found for selector: ${selector}`);
        }

        try {
          return await handle.isHidden();
        } finally {
          handle.dispose();
        }
      },
      { timeout: options?.timeout || 30000 },
    );
  }

  async isVisible(selector: string, options?: { timeout?: number }): Promise<boolean> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.isVisible(),
    );
  }

  async press(
    selector: string,
    key: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.press(key, { delay: options?.delay }),
    );
  }

  async type(
    selector: string,
    text: string,
    options?: { delay?: number; timeout?: number },
  ): Promise<void> {
    return this._executeWithElementHandle(selector, options?.timeout || 30000, handle =>
      handle.type(text, { delay: options?.delay }),
    );
  }

  /**
   * Generate an ARIA snapshot for the frame or a specific element within it.
   *
   * @param options Configuration options for the ARIA snapshot
   * @param options.forAI Whether to optimize the snapshot for AI consumption (default: true)
   * @param options.refPrefix Prefix to use for element references in the snapshot (default: '')
   * @param options.selector Optional CSS selector to target a specific element (default: entire frame)
   * @param options.timeout Maximum time to wait for the operation in milliseconds (default: 30000)
   * @returns A string representation of the ARIA accessibility tree
   *
   * @example
   * ```typescript
   * // Get ARIA snapshot of entire frame
   * const fullSnapshot = await frame.ariaSnapshot({ forAI: true });
   *
   * // Get ARIA snapshot of specific element
   * const formSnapshot = await frame.ariaSnapshot({
   *   forAI: true,
   *   selector: '#main-form',
   *   refPrefix: 'form'
   * });
   * ```
   */
  async ariaSnapshot(options?: {
    forAI?: boolean;
    refPrefix?: string;
    selector?: string;
    timeout?: number;
  }): Promise<string> {
    if (!this._context) {
      throw new Error('Frame context not available');
    }

    const forAI = options?.forAI ?? true;
    const refPrefix = options?.refPrefix ?? '';
    const timeout = options?.timeout ?? 30000;

    if (options?.selector) {
      // Get snapshot for specific element
      return this._executeWithElementHandle(options.selector, timeout, async handle => {
        if (!this._context) {
          throw new Error('Frame context not available');
        }
        const result = await this._context.ariaSnapshot(forAI, refPrefix, 'ISOLATED', handle);
        return typeof result === 'string' ? result : '';
      });
    } else {
      // Get snapshot for entire frame
      const result = await this._context.ariaSnapshot(forAI, refPrefix, 'ISOLATED');
      return typeof result === 'string' ? result : '';
    }
  }

  /**
   * Creates a file transfer port in the content script for transferring files and buffers.
   * This creates a temporary communication channel between the content script and side panel
   * specifically for file and buffer transfers.
   *
   * @param options Configuration options for the file transfer port
   * @param options.timeout Maximum time to wait for port creation in milliseconds (default: 30000)
   * @returns The port ID that can be used to communicate with the created port
   *
   * @example
   * ```typescript
   * // Create a file transfer port
   * const portId = await frame.createFileTransferPort();
   *
   * // Use the port ID with FileTransferPortController to manage transfers
   * const controller = new FileTransferPortController();
   * const port = controller.getPort(portId);
   * if (port) {
   *   await port.requestFile('#file-input');
   * }
   * ```
   */
  async createFileTransferPort(options?: { timeout?: number }): Promise<string> {
    if (!this._context) {
      throw new Error('Frame context not available');
    }

    const timeout = options?.timeout ?? 30000;

    return executeWithProgress(
      async () => {
        const portId = await this._context!.createFileTransferPort();
        if (!portId) {
          throw new Error('Failed to create file transfer port');
        }
        return portId;
      },
      { timeout },
    );
  }
}

// #region FrameLocator
export class FrameLocator {
  private _frame: Frame;
  private _frameSelector: string;

  constructor(frame: Frame, selector: string) {
    this._frame = frame;
    this._frameSelector = selector;
  }

  locator(selectorOrLocator: string | Locator, options?: LocatorOptions): Locator {
    if (isString(selectorOrLocator))
      return new Locator(
        this._frame,
        this._frameSelector + ' >> internal:control=enter-frame >> ' + selectorOrLocator,
        options,
      );
    if (selectorOrLocator._frame !== this._frame)
      throw new Error(`Locators must belong to the same frame.`);
    return new Locator(
      this._frame,
      this._frameSelector + ' >> internal:control=enter-frame >> ' + selectorOrLocator._selector,
      options,
    );
  }

  getByTestId(testId: string | RegExp): Locator {
    return this.locator(getByTestIdSelector(testIdAttributeName(), testId));
  }

  getByAltText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByAltTextSelector(text, options));
  }

  getByLabel(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByLabelSelector(text, options));
  }

  getByPlaceholder(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByPlaceholderSelector(text, options));
  }

  getByText(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTextSelector(text, options));
  }

  getByTitle(text: string | RegExp, options?: { exact?: boolean }): Locator {
    return this.locator(getByTitleSelector(text, options));
  }

  getByRole(role: string, options: ByRoleOptions = {}): Locator {
    return this.locator(getByRoleSelector(role, options));
  }

  owner() {
    return new Locator(this._frame, this._frameSelector);
  }

  frameLocator(selector: string): FrameLocator {
    return new FrameLocator(
      this._frame,
      this._frameSelector + ' >> internal:control=enter-frame >> ' + selector,
    );
  }

  first(): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ' >> nth=0');
  }

  last(): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ` >> nth=-1`);
  }

  nth(index: number): FrameLocator {
    return new FrameLocator(this._frame, this._frameSelector + ` >> nth=${index}`);
  }
}
