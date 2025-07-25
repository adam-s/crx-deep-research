import { Disposable } from 'vs/base/common/lifecycle';
import { Frame } from './frame';
import { assert } from '@injected/isomorphic/assert';
import { Progress } from './progress';
import { Session } from './session';

export class FrameManager extends Disposable {
  private _frames = new Map<number, Frame>();
  private _mainFrame?: Frame;
  private _mainFrameResolve!: (frame: Frame) => void;
  private _mainFramePromise: Promise<Frame>;

  constructor(
    private readonly _tabId: number,
    public readonly session: Session,
  ) {
    super();
    this._mainFramePromise = new Promise(resolve => (this._mainFrameResolve = resolve));
    console.log(`✅ FrameManager created for tab ${this._tabId}`);
  }

  /** Tab ID for this manager */
  public get tabId(): number {
    return this._tabId;
  }

  dispose(): void {
    console.log(`🗑️ Disposing FrameManager for tab ${this._tabId}`);
    console.log(
      `🗑️ FrameManager disposing ${this._frames.size} frames: [${Array.from(this._frames.keys()).join(', ')}]`,
    );

    super.dispose();
    console.log(`✅ FrameManager for tab ${this._tabId} disposed successfully`);
  }

  public mainFrame(): Frame {
    if (!this._mainFrame) {
      throw new Error('Main frame is not yet attached.');
    }
    return this._mainFrame;
  }

  public async waitForMainFrame(progress?: Progress): Promise<Frame> {
    progress?.log('Waiting for main frame attachment');
    const frame = await (progress?.race(this._mainFramePromise) || this._mainFramePromise);
    progress?.log('Main frame attached successfully');
    return frame;
  }

  public frames() {
    const frames: Frame[] = [];
    if (this._mainFrame) {
      collect(this._mainFrame);
    }
    return frames;

    function collect(frame: Frame) {
      frames.push(frame);
      for (const subframe of frame.childFrames()) collect(subframe);
    }
  }

  public clearFrames(): void {
    console.log(`🗑️ FrameManager clearing ${this._frames.size} frames for tab ${this._tabId}`);

    // Dispose all frames except main frame
    for (const frame of this._frames.values()) {
      if (frame !== this._mainFrame) {
        console.log(`🗑️ FrameManager disposing child frame ${frame.frameId}`);
        frame.dispose();
      }
    }
    this._frames.clear();

    // Reset main frame if it exists
    if (this._mainFrame) {
      console.log(
        `🗑️ FrameManager clearing child frames from main frame ${this._mainFrame.frameId}`,
      );
      // Clear all child frames from main frame
      this._mainFrame.clearChildFrames();
      this._frames.set(this._mainFrame.frameId, this._mainFrame);
    }

    console.log(`✅ FrameManager cleared all frames for tab ${this._tabId}`);
  }

  public frame(frameId: number): Frame | null {
    return this._frames.get(frameId) || null;
  }

  public frameAttached(
    frameId: number,
    parentFrameId: number | null | undefined,
    url?: string,
  ): Frame {
    // Check if frame already exists
    const existingFrame = this._frames.get(frameId);
    if (existingFrame) {
      // Update URL if provided
      if (url) {
        existingFrame.setUrl(url);
        console.log(`🔄 Frame ${frameId} updated URL: ${url}`);
      }
      return existingFrame;
    }

    const isMainFrame =
      parentFrameId === null || parentFrameId === undefined || parentFrameId === -1;
    if (isMainFrame) {
      console.log(`📍 Attaching main frame ${frameId} for tab ${this._tabId}`);
      return this._attachMainFrame(frameId, url);
    }
    console.log(
      `📍 Attaching child frame ${frameId} with parent ${parentFrameId} for tab ${this._tabId}`,
    );
    return this._attachChildFrame(frameId, parentFrameId, url);
  }

  private _attachMainFrame(frameId: number, url?: string): Frame {
    if (this._mainFrame) {
      this._frames.delete(this._mainFrame.frameId);
      this._mainFrame.frameId = frameId;
      if (url) {
        this._mainFrame.setUrl(url);
      }
    } else {
      assert(!this._frames.has(frameId));
      this._mainFrame = this._register(new Frame(frameId, this, null, url));
      this._mainFrameResolve(this._mainFrame);
    }
    this._frames.set(frameId, this._mainFrame);
    return this._mainFrame;
  }

  private _attachChildFrame(frameId: number, parentFrameId: number, url?: string): Frame {
    const parentFrame = this._frames.get(parentFrameId);
    assert(parentFrame !== undefined, `Parent frame with id ${parentFrameId} does not exist.`);

    // Double-check frame doesn't exist (should be caught by frameAttached, but defensive)
    if (this._frames.has(frameId)) {
      const existingFrame = this._frames.get(frameId)!;
      if (url) {
        existingFrame.setUrl(url);
      }
      return existingFrame;
    }

    const frame = this._register(new Frame(frameId, this, parentFrame, url));
    this._frames.set(frameId, frame);
    return frame;
  }
}
