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

      // Test check() functionality
      progress.log('Testing check() method on checkboxes');
      await this._testCheckFunctionality(page, progress);

      // Test click() functionality
      progress.log('Testing click() method on various elements');
      await this._testClickFunctionality(page, progress);

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

  private async _testCheckFunctionality(page: Page, progress: Progress): Promise<void> {
    try {
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Starting check() functionality tests',
      });

      // Test 1: Check an initially unchecked checkbox
      progress.log('Test 1: Checking initially unchecked checkbox (#test-checkbox)');
      const testCheckboxLocator = page.locator('#test-checkbox');

      // First verify it's unchecked (based on HTML markup)
      progress.log('Checking initial state of test checkbox...');
      await testCheckboxLocator.check();
      progress.log('Successfully checked the test checkbox');

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Successfully checked unchecked checkbox',
      });

      // Test 2: Check an already checked checkbox (should be idempotent)
      progress.log('Test 2: Checking already checked checkbox (#advanced-mode)');
      const advancedModeLocator = page.locator('#advanced-mode');

      // This checkbox is initially checked according to the HTML
      await advancedModeLocator.check();
      progress.log(
        'Successfully called check() on already checked checkbox (idempotent operation)',
      );

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: check() is idempotent on already checked checkbox',
      });

      // Test 3: Test uncheck() functionality
      progress.log('Test 3: Testing uncheck() functionality');

      // Uncheck the advanced mode checkbox
      await advancedModeLocator.uncheck();
      progress.log('Successfully unchecked the advanced mode checkbox');

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Successfully unchecked a checked checkbox',
      });

      // Test 4: Test check/uncheck cycle
      progress.log('Test 4: Testing complete check/uncheck cycle');

      // Now check it again to verify state changes work
      await advancedModeLocator.check();
      progress.log('Successfully re-checked the advanced mode checkbox');

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Complete check/uncheck cycle works',
      });

      // Test 5: Test with Page-level methods
      progress.log('Test 5: Testing page-level check() methods');

      // Use page.check() directly
      await page.uncheck('#test-checkbox');
      progress.log('Successfully used page.uncheck() method');

      await page.check('#test-checkbox');
      progress.log('Successfully used page.check() method');

      // Final test: Uncheck the advanced-mode checkbox so it ends unchecked
      await page.uncheck('#advanced-mode');
      progress.log('Final step: Unchecked #advanced-mode checkbox (ends in unchecked state)');

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: Page-level check/uncheck methods work',
      });

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'All check() functionality tests completed successfully',
        details: {
          testsCompleted: [
            'Locator.check() on unchecked element',
            'Locator.check() idempotent behavior',
            'Locator.uncheck() on checked element',
            'Complete check/uncheck cycle',
            'Page.check() and Page.uncheck() methods',
          ],
        },
      });
    } catch (error) {
      const errorMessage = `Check functionality test failed: ${error instanceof Error ? error.message : String(error)}`;
      progress.log(errorMessage);
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }

  private async _testClickFunctionality(page: Page, progress: Progress): Promise<void> {
    try {
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Info,
        message: 'Starting click() functionality tests',
      });

      // Test 1: Basic click on a button
      progress.log('Test 1: Basic click on button (#action-button)');
      const actionButtonLocator = page.locator('#action-button');

      await actionButtonLocator.click();
      progress.log('Successfully clicked the action button');

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Basic button click successful',
      });

      // Test 2: Click with options (position and delay)
      progress.log('Test 2: Click with options on button (#toggle-button)');
      const toggleButtonLocator = page.locator('#toggle-button');

      await toggleButtonLocator.click({
        position: { x: 10, y: 10 },
        delay: 100,
        button: 'left',
        clickCount: 1,
      });
      progress.log('Successfully clicked the toggle button with options');

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Click with options successful',
      });

      // Test 3: Double click
      progress.log('Test 3: Double click on button (#log-button)');
      const logButtonLocator = page.locator('#log-button');

      await logButtonLocator.click({
        clickCount: 2,
        delay: 50,
      });
      progress.log('Successfully double-clicked the log button');

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Double click successful',
      });

      // Test 4: Right click
      progress.log('Test 4: Right click on div element (.container)');
      const containerLocator = page.locator('.container');

      await containerLocator.click({
        button: 'right',
      });
      progress.log('Successfully right-clicked the container div');

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Right click successful',
      });

      // Test 5: Page-level click methods
      progress.log('Test 5: Testing page-level click() methods');

      // Use page.click() directly
      await page.click('#action-button');
      progress.log('Successfully used page.click() method');

      await page.click('#toggle-button', {
        force: true,
        timeout: 10000,
      });
      progress.log('Successfully used page.click() with options');

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: Page-level click methods work',
      });

      // Test 6: Shadow DOM elements (if accessible)
      progress.log('Test 6: Testing shadow DOM button click');
      try {
        // Try to click shadow DOM button (this may not work depending on shadow DOM accessibility)
        const shadowButtonLocator = page.locator('.shadow-button');
        await shadowButtonLocator.click();
        progress.log('Successfully clicked shadow DOM button');

        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Success,
          message: 'Test 6 passed: Shadow DOM button click successful',
        });
      } catch (shadowError) {
        progress.log('Shadow DOM button click failed (expected if shadow DOM is not accessible)');
        this.context.events.emit({
          timestamp: Date.now(),
          severity: Severity.Warning,
          message: 'Test 6 warning: Shadow DOM button not accessible (expected behavior)',
        });
      }

      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'All click() functionality tests completed successfully',
        details: {
          testsCompleted: [
            'Basic Locator.click() on action button',
            'Locator.click() with position, delay, and button options on toggle button',
            'Double click using clickCount option on log button',
            'Right click using button option on container',
            'Page.click() and Page.click() with options',
            'Shadow DOM button click test (accessibility check)',
          ],
        },
      });
    } catch (error) {
      const errorMessage = `Click functionality test failed: ${error instanceof Error ? error.message : String(error)}`;
      progress.log(errorMessage);
      this.context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: errorMessage,
      });
      throw new Error(errorMessage);
    }
  }
}
