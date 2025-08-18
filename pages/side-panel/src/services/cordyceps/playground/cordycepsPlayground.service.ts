import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { TestContext } from './playgroundTests/api';
import { NavigationTest } from './playgroundTests/navigationTest';
import { DOMInteractionTest } from './playgroundTests/domInteractionTest';
import { LocatorTest } from './playgroundTests/locatorTest';
import { PerformanceTest } from './playgroundTests/performanceTest';
import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage, Severity } from '@src/utils/types';
import { ICordycepsService } from '../cordyceps.service';
import { Progress } from '../core/progress';
import { Page } from '../page';
import { BrowserWindow } from '../browserWindow';

export const ICordycepsPlaygroundService = createDecorator<ICordycepsPlaygroundService>(
  'cordycepsPlaygroundService'
);

export interface ICordycepsPlaygroundService {
  readonly _serviceBrand: undefined;
  /** Event that fires when playground events occur. */
  readonly onEvent: Event<EventMessage>;
  /** Run all playground tests */
  runAllTests: () => Promise<void>;
  /** Run basic navigation test */
  runNavigationTest: () => Promise<void>;
  /** Run DOM interaction test */
  runDOMInteractionTest: () => Promise<void>;
  /** Run performance test */
  runPerformanceTest: () => Promise<void>;
  /** Run locator test */
  runLocatorTest: () => Promise<void>;
}

export class CordycepsPlaygroundService
  extends Disposable
  implements ICordycepsPlaygroundService, TestContext
{
  public readonly _serviceBrand: undefined;

  readonly events = this._register(new SimpleEventEmitter<EventMessage>('CordycepsPlayground'));
  public readonly onEvent: Event<EventMessage> = this.events.event;

  private readonly _navigationTest = new NavigationTest(this);
  private readonly _domInteractionTest = new DOMInteractionTest(this);
  private readonly _locatorTest = new LocatorTest(this);
  private readonly _performanceTest = new PerformanceTest(this);

  constructor(@ICordycepsService public readonly cordycepsService: ICordycepsService) {
    super();
  }

  public async runAllTests(): Promise<void> {
    const startTime = Date.now();
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting all playground tests',
    });

    try {
      await this.runNavigationTest();
      await this.runDOMInteractionTest();
      await this.runLocatorTest();
      await this.runPerformanceTest();

      const totalDuration = Date.now() - startTime;
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'All playground tests completed successfully',
        details: {
          duration: totalDuration,
        },
      });
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Playground tests failed',
        error: error instanceof Error ? error : new Error(String(error)),
        details: {
          duration: totalDuration,
        },
      });
      throw error;
    }
  }

  public async runNavigationTest(): Promise<void> {
    await this._navigationTest.run(10_000, 'Navigation Test');
  }

  public async runDOMInteractionTest(): Promise<void> {
    await this._domInteractionTest.run(20_000, 'DOM Interaction Test');
  }

  public async runLocatorTest(): Promise<void> {
    await this._locatorTest.run(20_000, 'Locator Test');
  }

  public async runPerformanceTest(): Promise<void> {
    await this._performanceTest.run(25_000, 'Performance Test');
  }

  async getBrowser(progress: Progress): Promise<BrowserWindow> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Obtaining browser instance',
    });
    const browser = await this.cordycepsService.getBrowser();
    progress.log('Browser instance obtained');
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Browser instance ready',
    });
    return browser;
  }

  async newPage(browser: BrowserWindow, progress: Progress): Promise<Page> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Creating new page',
    });
    const page = await browser.newPage({ progress });
    progress.log('New page created and main frame attached');
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Page created successfully',
    });
    return page;
  }

  async navigate(page: Page, progress: Progress): Promise<void> {
    const url = 'http://localhost:3005';
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: `Navigating to ${url}`,
      details: { url },
    });

    const navigationStart = Date.now();
    await page.goto(url, { progress, waitUntil: 'load' });
    const navigationDuration = Date.now() - navigationStart;

    progress.log('Navigation completed to local example server.');
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Navigation completed',
      details: {
        duration: navigationDuration,
        url,
      },
    });
  }
}
