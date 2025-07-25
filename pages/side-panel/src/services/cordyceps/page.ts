import { Disposable } from 'vs/base/common/lifecycle';
import { FrameManager } from './frame-manager';
import { Frame } from './frame';
import { Progress, ProgressController } from './progress';
import { Session } from './session';
import { FrameExecutionContext } from './frame-execution-context';

export class Page extends Disposable {
  private _ownedContext?: object;
  readonly frameManager: FrameManager;
  readonly tabId: number;
  readonly session: Session;

  constructor(tabId: number, session: Session) {
    super();
    this.frameManager = this._register(new FrameManager(tabId, session));
    this.tabId = tabId;
    this.session = session;
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
