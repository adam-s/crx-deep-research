import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { ICordycepsService } from './cordyceps.service';
import { ProgressController } from './progress';

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
    (async () => {
      const progressController = new ProgressController(1000000); // 10 second timeout

      await progressController.run(async progress => {
        progress.log('Starting Cordyceps playground with enhanced navigation');
        const browser = await this._cordycepsService.getBrowser();
        progress.log('Browser instance obtained');

        // create a new page (in Chrome extension this is a tab)
        const page = await browser.newPage({ progress });
        progress.log('New page created and main frame attached');

        // Navigate to the local test page
        await page.goto('http://localhost:3005', { progress, waitUntil: 'load' });
        progress.log('Navigation completed to local example server.');

        // Run the FrameExecutionContext tests
        await page.testFrameExecutionContext({ progress });
        progress.log('FrameExecutionContext tests completed successfully.');
      });
    })().catch(error => {
      console.error('Cordyceps playground failed:', error);
    });
  }
}
