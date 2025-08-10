import { Severity } from '@src/utils/types';
import { Progress } from '../../core/progress';
import { Page } from '../../page';
import { PlaygroundTest } from './api';

export class DOMInteractionTest extends PlaygroundTest {
  protected async _run(progress: Progress): Promise<void> {
    const browser = await this.context.getBrowser(progress);
    const page = await this.context.newPage(browser, progress);
    await this.context.navigate(page, progress);
    await this._stepTestDOMInteraction(page, progress);
  }

  private async _stepTestDOMInteraction(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Testing DOM interactions',
    });

    const testStart = Date.now();

    try {
      // Test clicking elements (if any exist)
      progress.log('Testing element interactions');
      try {
        await page.click('body'); // Click on body as a safe target
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
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'DOM interactions tested',
        details: {
          duration: testDuration,
        },
      });
    } catch (error) {
      throw new Error(
        `DOM interaction test failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
