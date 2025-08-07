import { Progress } from '../progress';
import { PlaygroundTest } from './api';
import { Page } from '../page';
import { Severity } from '../../../utils/types';

export class LocatorTest extends PlaygroundTest {
  protected async _run(progress: Progress): Promise<void> {
    const browser = await this.context.getBrowser(progress);
    const page = await this.context.newPage(browser, progress);
    await this.context.navigate(page, progress);
    await this._stepTestLocator(page, progress);
  }

  private async _stepTestLocator(page: Page, progress: Progress): Promise<void> {
    this.context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Testing Locator functionality',
    });
    const testStart = Date.now();

    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      // If we don't wait, some of the iframes will not have been loaded
      // we need to have wait methods added later.
      // Get the ariaSnapshotForAI first   // Get the ariaSnapshotForAI first
      const snapshot = await page.snapshotForAI();
      progress.log('Snapshot for AI created successfully.');

      console.log('############### Aria snapshot for AI \n', snapshot);
      progress.log('Creating and testing a basic locator');
      // Create a locator for the body element
      const bodyLocator = page.locator('body');
      progress.log(`Locator created successfully: ${bodyLocator._selector}`);

      // Test boundingBox functionality
      progress.log('Testing boundingBox method');
      const boundingBox = await bodyLocator.boundingBox();

      if (boundingBox) {
        progress.log(
          `BoundingBox retrieved: x=${boundingBox.x}, y=${boundingBox.y}, width=${boundingBox.width}, height=${boundingBox.height}`,
        );
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'BoundingBox test passed.',
          details: {
            boundingBox,
          },
        });
      } else {
        progress.log('BoundingBox returned null (element may not be visible)');
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'BoundingBox test returned null.',
        });
      }

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Basic locator test passed.',
      });

      const testDuration = Date.now() - testStart;
      progress.log('Locator tests completed successfully.');
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Locator functionality tested',
        details: {
          duration: testDuration,
        },
      });
    } catch (error) {
      throw new Error(
        `Locator test failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
