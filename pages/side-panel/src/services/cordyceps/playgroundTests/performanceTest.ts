import { Progress } from '../progress';
import { PlaygroundTest } from './api';
import { Page } from '../page';
import { Severity } from '../../../utils/types';

export class PerformanceTest extends PlaygroundTest {
  protected async _run(progress: Progress): Promise<void> {
    const browser = await this.context.getBrowser(progress);
    const page = await this.context.newPage(browser, progress);
    await this.context.navigate(page, progress);
    await this._stepTestPerformance(page, progress);
  }

  private async _stepTestPerformance(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Testing performance metrics',
    });

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
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Performance metrics collected',
        details: {
          duration: testDuration,
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
