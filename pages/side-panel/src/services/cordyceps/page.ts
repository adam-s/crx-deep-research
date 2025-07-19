import { Disposable } from 'vs/base/common/lifecycle';
import { FrameManager } from './frame-manager';

export class Page extends Disposable {
  _ownedContext?: object;
  readonly frameManager: FrameManager;
  constructor() {
    super();
    this.frameManager = new FrameManager();
  }
}
