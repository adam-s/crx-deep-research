import { Disposable } from 'vs/base/common/lifecycle';
import type { Frame } from './frame';
import type { Session } from './session';

export class FrameExecutionContext extends Disposable {
  public readonly frame: Frame;
  public readonly session: Session;

  public constructor(frame: Frame) {
    super();
    console.log('Creating FrameExecutionContext for frame:', frame.frameId);
    this.frame = frame;
    this.session = frame.session;
  }

  public async evaluate<T>(
    script: string,
    world: chrome.scripting.ExecutionWorld = 'ISOLATED',
    args?: unknown[],
  ): Promise<T> {
    try {
      const results = await chrome.scripting.executeScript({
        target: {
          tabId: this.frame.tabId,
          frameIds: [this.frame.frameId],
        },
        world,
        func: new Function('...args', script) as (...args: unknown[]) => T,
        args: args || [],
      });

      return results[0]?.result as T;
    } catch (error) {
      throw new Error(`Script execution failed in ${world} world: ${error}`);
    }
  }

  public async evaluateInMainWorld<T>(script: string, args?: unknown[]): Promise<T> {
    return this.evaluate<T>(script, 'MAIN', args);
  }

  public async evaluateInIsolatedWorld<T>(script: string, args?: unknown[]): Promise<T> {
    return this.evaluate<T>(script, 'ISOLATED', args);
  }

  public toString(): string {
    return `FrameExecutionContext@${this.frame.frameId}`;
  }
}
