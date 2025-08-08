import { Progress } from '../progress';
import { PlaygroundTest } from './api';
import { Page } from '../page';
import { Severity } from '../../../utils/types';
import {
  testApiConsistencyAcrossLayers,
  testCheckFunctionality,
  testClearFunctionality,
  testClickFunctionality,
  testDblclickFunctionality,
  testDispatchEventFunctionality,
  testEvaluateFunctionality,
  testFillFunctionality,
  testFrameMissingMethodsFunctionality,
  testHighlightFunctionality,
  testLocatorFunctionality,
  testMissingMethodsFunctionality,
  testPageMissingMethodsFunctionality,
} from './locator';

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

      // Test check() functionality
      progress.log('Testing check() method on checkboxes');
      await testCheckFunctionality(page, progress, this.context);

      // Test click() functionality
      progress.log('Testing click() method on various elements');
      await testClickFunctionality(page, progress, this.context);

      // Test dblclick() functionality
      progress.log('Testing dblclick() method on various elements');
      await testDblclickFunctionality(page, progress, this.context);

      // Test dispatchEvent() functionality
      progress.log('Testing dispatchEvent() method on various elements');
      await testDispatchEventFunctionality(page, progress, this.context);

      // Test fill() functionality
      progress.log('Testing fill() method on form inputs');
      await testFillFunctionality(page, progress, this.context);

      // Test clear() functionality
      progress.log('Testing clear() method on form inputs');
      await testClearFunctionality(page, progress, this.context);

      // Test highlight() functionality
      progress.log('Testing highlight() and hideHighlight() methods');
      await testHighlightFunctionality(page, progress, this.context);

      // Test locator functionality (chaining, getBy methods, etc.)
      progress.log('Testing advanced locator methods (chaining, getBy, first, last, etc.)');
      await testLocatorFunctionality(page, progress, this.context);

      // Test type-safe element operations functionality
      progress.log('Testing type-safe element operations methods');
      await testEvaluateFunctionality(page, progress, this.context);

      // Test missing methods functionality
      progress.log('Testing newly implemented missing methods');
      await testMissingMethodsFunctionality(page, progress, this.context);

      // Test Frame missing methods functionality
      progress.log('Testing Frame layer missing methods');
      await testFrameMissingMethodsFunctionality(page, progress, this.context);

      // Test Page missing methods functionality
      progress.log('Testing Page layer missing methods');
      await testPageMissingMethodsFunctionality(page, progress, this.context);

      // Test API consistency across all layers
      progress.log('Testing API consistency across ElementHandle, Locator, Frame, and Page layers');
      await testApiConsistencyAcrossLayers(page, progress, this.context);

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
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : 'No stack trace available';

      progress.log(`Locator test failed: ${errorMessage}`);
      progress.log(`Error stack trace: ${errorStack}`);

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: 'Locator test failed with detailed error information',
        details: {
          error: errorMessage,
          stack: errorStack,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        },
      });

      throw new Error(`Locator test failed: ${errorMessage}\nStack trace: ${errorStack}`);
    }
  }
}
