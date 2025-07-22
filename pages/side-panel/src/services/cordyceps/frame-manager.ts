import { Disposable } from 'vs/base/common/lifecycle';
import { Frame } from './frame';
import { assert } from '@injected/isomorphic/assert';
import { Progress } from './progress';

export class FrameManager extends Disposable {
  private _frames: Map<number, Frame> = new Map();
  private _mainFrame?: Frame;
  private readonly _mainFramePromise: Promise<Frame>;
  private _mainFrameResolve!: (frame: Frame) => void;

  constructor() {
    super();
    this._mainFramePromise = new Promise(resolve => {
      this._mainFrameResolve = resolve;
    });
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

  public frame(frameId: number): Frame | null {
    return this._frames.get(frameId) || null;
  }

  public frameAttached(
    frameId: number,
    parentFrameId: number | null | undefined,
    url?: string,
  ): Frame {
    const isMainFrame =
      parentFrameId === null || parentFrameId === undefined || parentFrameId === -1;
    if (isMainFrame) {
      return this._attachMainFrame(frameId, url);
    }
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
      this._mainFrame = this._register(new Frame(frameId, null, url));
      this._mainFrameResolve(this._mainFrame);
    }
    this._frames.set(frameId, this._mainFrame);
    return this._mainFrame;
  }

  private _attachChildFrame(frameId: number, parentFrameId: number, url?: string): Frame {
    const parentFrame = this._frames.get(parentFrameId);
    assert(parentFrame !== undefined, `Parent frame with id ${parentFrameId} does not exist.`);
    assert(!this._frames.has(frameId), `Frame with id ${frameId} already exists.`);
    const frame = this._register(new Frame(frameId, parentFrame, url));
    this._frames.set(frameId, frame);
    return frame;
  }
}
