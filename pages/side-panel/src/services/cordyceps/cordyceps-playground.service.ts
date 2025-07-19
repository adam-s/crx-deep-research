import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { ICordycepsService } from './cordyceps.service';

export const ICordycepsPlaygroundService = createDecorator<ICordycepsPlaygroundService>(
  'cordycepsPlaygroundService',
);

export interface ICordycepsPlaygroundService {
  readonly _serviceBrand: undefined;
  /** Returns the Window instance. */
}

export class CordycepsPlaygroundService extends Disposable implements ICordycepsPlaygroundService {
  public readonly _serviceBrand: undefined;

  constructor(@ICordycepsService private readonly _cordycepsService: ICordycepsService) {
    super();

    const { browser } = this._cordycepsService;
    console.log('#######################', browser);

    (async () => {
      // create a new page (in Chrome extension this is a tab)
      const page = await browser.newPage();
      console.log('CordycepsPlaygroundService: New page created', page);
    })();
  }
}
