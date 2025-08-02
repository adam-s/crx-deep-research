import { Disposable } from 'vs/base/common/lifecycle';
import { FrameManager } from './frameManager';
import { Frame } from './frame';
import { Progress, executeWithProgress } from './progress';
import { Session } from './session';
import { FrameExecutionContext } from './frameExecutionContext';
import type { NavigateOptionsWithProgress } from './types';

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

  async snapshotForAI(options?: { progress?: Progress }): Promise<string> {
    return executeWithProgress(async p => {
      this.lastSnapshotFrameIds = [];
      const snapshot = await snapshotFrameForAI(p, this.mainFrame(), 0, this.lastSnapshotFrameIds);
      return snapshot.join('\n');
    }, options);
  }

  // #region Dom Interaction
  async click(selector: string, options?: NavigateOptionsWithProgress): Promise<void> {
    await this.frameManager.mainFrame().click(selector, options);
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
        if (!context) {
          throw new Error(`Frame ${frame.frameId} has no execution context`);
        }
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
