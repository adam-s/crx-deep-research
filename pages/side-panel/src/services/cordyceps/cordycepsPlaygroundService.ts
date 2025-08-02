import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { ICordycepsService } from './cordyceps.service';
import { ProgressController, Progress } from './progress';
import { BrowserWindow } from './browserWindow';
import { Page } from './page';
import { Severity, EventMessage } from '../../utils/types';
import { SimpleEventEmitter } from '../../utils/SimpleEventEmitter';

export const ICordycepsPlaygroundService = createDecorator<ICordycepsPlaygroundService>(
  'cordycepsPlaygroundService',
);

export interface ICordycepsPlaygroundService {
  readonly _serviceBrand: undefined;
  /** Event that fires when playground events occur. */
  readonly onEvent: Event<EventMessage>;
  /** Run all playground tests */
  runAllTests: () => Promise<void>;
  /** Run basic navigation test */
  runNavigationTest: () => Promise<void>;
  /** Run frame execution context test */
  runFrameExecutionTest: () => Promise<void>;
  /** Run DOM interaction test */
  runDOMInteractionTest: () => Promise<void>;
  /** Run performance test */
  runPerformanceTest: () => Promise<void>;
}

export class CordycepsPlaygroundService extends Disposable implements ICordycepsPlaygroundService {
  public readonly _serviceBrand: undefined;

  private readonly _events = this._register(new SimpleEventEmitter('CordycepsPlayground'));
  public readonly onEvent: Event<EventMessage> = this._events.event;

  constructor(@ICordycepsService private readonly _cordycepsService: ICordycepsService) {
    super();
    // Don't auto-run on construction, wait for manual trigger
  }

  public async runAllTests(): Promise<void> {
    const startTime = Date.now();
    this._events.emit(Severity.Info, 'Starting all playground tests');

    try {
      await this.runNavigationTest();
      await this.runFrameExecutionTest();
      await this.runDOMInteractionTest();
      await this.runPerformanceTest();

      const totalDuration = Date.now() - startTime;
      this._events.emit(Severity.Success, 'All playground tests completed successfully', {
        duration: totalDuration,
      });
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this._events.emit(Severity.Error, 'Playground tests failed', {
        error: error instanceof Error ? error : new Error(String(error)),
        duration: totalDuration,
      });
      throw error;
    }
  }

  public async runNavigationTest(): Promise<void> {
    const startTime = Date.now();
    this._events.emit(Severity.Info, 'Starting navigation test');

    try {
      const progressController = new ProgressController(10_000);

      await progressController.run(async progress => {
        const browser = await this._stepGetBrowser(progress);
        const page = await this._stepNewPage(browser, progress);
        await this._stepNavigate(page, progress);
      });

      const duration = Date.now() - startTime;
      this._events.emit(Severity.Success, 'Navigation test completed', { duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      this._events.emit(Severity.Error, 'Navigation test failed', {
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      });
      throw error;
    }
  }

  public async runFrameExecutionTest(): Promise<void> {
    const startTime = Date.now();
    this._events.emit(Severity.Info, 'Starting frame execution test');

    try {
      const progressController = new ProgressController(15_000);

      await progressController.run(async progress => {
        const browser = await this._stepGetBrowser(progress);
        const page = await this._stepNewPage(browser, progress);
        await this._stepNavigate(page, progress);
        await this._stepTestFrameExecution(page, progress);
      });

      const duration = Date.now() - startTime;
      this._events.emit(Severity.Success, 'Frame execution test completed', { duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      this._events.emit(Severity.Error, 'Frame execution test failed', {
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      });
      throw error;
    }
  }

  public async runDOMInteractionTest(): Promise<void> {
    const startTime = Date.now();
    this._events.emit(Severity.Info, 'Starting DOM interaction test');

    try {
      const progressController = new ProgressController(20_000);

      await progressController.run(async progress => {
        const browser = await this._stepGetBrowser(progress);
        const page = await this._stepNewPage(browser, progress);
        await this._stepNavigate(page, progress);
        await this._stepTestDOMInteraction(page, progress);
      });

      const duration = Date.now() - startTime;
      this._events.emit(Severity.Success, 'DOM interaction test completed', { duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      this._events.emit(Severity.Error, 'DOM interaction test failed', {
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      });
      throw error;
    }
  }

  public async runPerformanceTest(): Promise<void> {
    const startTime = Date.now();
    this._events.emit(Severity.Info, 'Starting performance test');

    try {
      const progressController = new ProgressController(25_000);

      await progressController.run(async progress => {
        const browser = await this._stepGetBrowser(progress);
        const page = await this._stepNewPage(browser, progress);
        await this._stepNavigate(page, progress);
        await this._stepTestPerformance(page, progress);
      });

      const duration = Date.now() - startTime;
      this._events.emit(Severity.Success, 'Performance test completed', { duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      this._events.emit(Severity.Error, 'Performance test failed', {
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
      });
      throw error;
    }
  }

  private async run(): Promise<void> {
    const progressController = new ProgressController(10_000);
    const startTime = Date.now();

    this._events.emit(Severity.Info, 'Playground starting');

    await progressController.run(async progress => {
      const browser = await this._stepGetBrowser(progress);
      const page = await this._stepNewPage(browser, progress);
      await this._stepNavigate(page, progress);
      await this._stepTestFrameExecution(page, progress);
    });

    this._events.emit(Severity.Success, 'Playground complete', {
      duration: Date.now() - startTime,
    });
  }

  private async _stepGetBrowser(progress: Progress): Promise<BrowserWindow> {
    this._events.emit(Severity.Info, 'Obtaining browser instance');
    const browser = await this._cordycepsService.getBrowser();
    progress.log('Browser instance obtained');
    this._events.emit(Severity.Success, 'Browser instance ready');
    return browser;
  }

  private async _stepNewPage(browser: BrowserWindow, progress: Progress): Promise<Page> {
    this._events.emit(Severity.Info, 'Creating new page');
    const page = await browser.newPage({ progress });
    progress.log('New page created and main frame attached');
    this._events.emit(Severity.Success, 'Page created successfully');
    return page;
  }

  private async _stepNavigate(page: Page, progress: Progress): Promise<void> {
    const url = 'http://localhost:3005';
    this._events.emit(Severity.Info, `Navigating to ${url}`, {
      details: { url },
    });

    const navigationStart = Date.now();
    await page.goto(url, { progress, waitUntil: 'load' });
    const navigationDuration = Date.now() - navigationStart;

    progress.log('Navigation completed to local example server.');
    this._events.emit(Severity.Success, 'Navigation completed', {
      duration: navigationDuration,
      details: { url },
    });
  }

  private async _stepTestFrameExecution(page: Page, progress: Progress): Promise<void> {
    this._events.emit(Severity.Info, 'Starting FrameExecutionContext tests');

    const testStart = Date.now();
    await page.testFrameExecutionContext({ progress });
    const testDuration = Date.now() - testStart;

    progress.log('FrameExecutionContext tests completed successfully.');
    this._events.emit(Severity.Success, 'FrameExecutionContext tests completed', {
      duration: testDuration,
    });
  }

  private async _stepTestDOMInteraction(page: Page, progress: Progress): Promise<void> {
    this._events.emit(Severity.Info, 'Testing DOM interactions');

    const testStart = Date.now();

    try {
      // Test clicking elements (if any exist)
      progress.log('Testing element interactions');
      try {
        await page.click('body', { progress }); // Click on body as a safe target
        progress.log('Element click test completed');
      } catch (error) {
        progress.log('Element click test skipped (no suitable elements)');
      }

      // Test page snapshot functionality
      progress.log('Testing page snapshot');
      const snapshot = await page.snapshotForAI({ progress });
      if (snapshot && snapshot.length > 0) {
        progress.log('Page snapshot captured successfully');
      }

      // Test frame operations
      progress.log('Testing frame operations');
      const frame = await page.waitForMainFrame(progress);
      if (frame) {
        progress.log('Frame operations test completed');
      }

      const testDuration = Date.now() - testStart;
      progress.log('DOM interaction tests completed successfully.');
      this._events.emit(Severity.Success, 'DOM interactions tested', {
        duration: testDuration,
      });
    } catch (error) {
      throw new Error(
        `DOM interaction test failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async _stepTestPerformance(page: Page, progress: Progress): Promise<void> {
    this._events.emit(Severity.Info, 'Testing performance metrics');

    const testStart = Date.now();

    try {
      // Test page load performance
      progress.log('Measuring page load performance');
      const loadStart = Date.now();
      await page.goto('http://localhost:3005', { progress, waitUntil: 'load' });
      const loadTime = Date.now() - loadStart;

      // Test frame waiting performance
      progress.log('Testing frame operations');
      const frameStart = Date.now();
      await page.waitForMainFrame(progress);
      const frameTime = Date.now() - frameStart;

      // Test AI snapshot performance
      progress.log('Testing AI snapshot performance');
      const snapshotStart = Date.now();
      await page.snapshotForAI({ progress });
      const snapshotTime = Date.now() - snapshotStart;

      const testDuration = Date.now() - testStart;
      progress.log('Performance tests completed successfully.');
      this._events.emit(Severity.Success, 'Performance metrics collected', {
        duration: testDuration,
        details: {
          pageLoadTime: loadTime,
          frameWaitTime: frameTime,
          snapshotTime: snapshotTime,
        },
      });
    } catch (error) {
      throw new Error(
        `Performance test failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
