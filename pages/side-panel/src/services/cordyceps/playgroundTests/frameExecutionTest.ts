import { Progress } from '../progress';
import { PlaygroundTest } from './api';
import { Page } from '../page';
import { Severity } from '../../../utils/types';

export class FrameExecutionTest extends PlaygroundTest {
  protected async _run(progress: Progress): Promise<void> {
    const browser = await this.context.getBrowser(progress);
    const page = await this.context.newPage(browser, progress);
    await this.context.navigate(page, progress);
    await this._stepTestFrameExecution(page, progress);
  }

  private async _stepTestFrameExecution(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting FrameExecutionContext tests',
    });

    const testStart = Date.now();
    await page.testFrameExecutionContext({ progress });
    const testDuration = Date.now() - testStart;

    progress.log('FrameExecutionContext tests completed successfully.');
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'FrameExecutionContext tests completed',
      details: {
        duration: testDuration,
      },
    });
  }
}
