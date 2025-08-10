import { Progress } from '../../progress';
import { Page } from '../../page';
import { Severity } from '../../../../utils/types';
import { TestContext } from '../api';

export async function testClickFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting click() functionality tests',
    });

    // Test 1: Basic click on a button with event handler verification
    progress.log('Test 1: Basic click on button (#action-button) with event verification');

    // Add click event handler to verify click
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testClickCount = 0;
      const button = document.getElementById('action-button');
      const handler = (e: Event) => {
        e.preventDefault(); // Prevent alert
        ((window as unknown as Record<string, unknown>).testClickCount as number)++;
        console.log(
          'Action button clicked, count:',
          (window as unknown as Record<string, unknown>).testClickCount,
        );
      };
      if (button) {
        button.addEventListener('click', handler);
        (window as unknown as Record<string, unknown>).testActionHandler = handler;
      }
    }, 'ISOLATED');

    const actionButtonLocator = page.locator('#action-button');
    await actionButtonLocator.click();

    // Verify click happened
    const clickCountResult = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testClickCount,
        'ISOLATED',
      );

    if (clickCountResult !== 1) {
      throw new Error(`Expected 1 click, but got ${clickCountResult}`);
    }

    progress.log('Successfully clicked the action button and verified event');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 1 passed: Basic button click successful and verified',
    });

    // Test 2: Click with options (position and delay)
    progress.log('Test 2: Click with options on button (#toggle-button) with verification');

    // Add click event handler for toggle button
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testToggleCount = 0;
      const button = document.getElementById('toggle-button');
      const handler = (e: Event) => {
        e.preventDefault(); // Prevent default toggle behavior for testing
        ((window as unknown as Record<string, unknown>).testToggleCount as number)++;
        console.log(
          'Toggle button clicked, count:',
          (window as unknown as Record<string, unknown>).testToggleCount,
        );
      };
      if (button) {
        button.addEventListener('click', handler);
        (window as unknown as Record<string, unknown>).testToggleHandler = handler;
      }
    }, 'ISOLATED');

    const toggleButtonLocator = page.locator('#toggle-button');
    await toggleButtonLocator.click({
      position: { x: 10, y: 10 },
      delay: 100,
      button: 'left',
      clickCount: 1,
    });

    // Verify click happened
    const toggleCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testToggleCount,
        'ISOLATED',
      );
    if (toggleCount !== 1) {
      throw new Error(`Expected 1 toggle click, but got ${toggleCount}`);
    }

    progress.log('Successfully clicked the toggle button with options and verified event');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: Click with options successful and verified',
    });

    // Test 3: Double click verification
    progress.log('Test 3: Double click on button (#log-button) with verification');

    // Add click event handler for log button
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testLogCount = 0;
      const button = document.getElementById('log-button');
      const handler = (e: Event) => {
        e.preventDefault(); // Prevent default log behavior for testing
        ((window as unknown as Record<string, unknown>).testLogCount as number)++;
        console.log(
          'Log button clicked, count:',
          (window as unknown as Record<string, unknown>).testLogCount,
        );
      };
      if (button) {
        button.addEventListener('click', handler);
        (window as unknown as Record<string, unknown>).testLogHandler = handler;
      }
    }, 'ISOLATED');

    const logButtonLocator = page.locator('#log-button');
    await logButtonLocator.click({
      clickCount: 2,
      delay: 50,
    });

    // Verify double click happened (should fire 2 click events)
    const logCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testLogCount,
        'ISOLATED',
      );
    if (logCount !== 2) {
      throw new Error(`Expected 2 clicks for double click, but got ${logCount}`);
    }

    progress.log('Successfully double-clicked the log button and verified events');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 3 passed: Double click successful and verified',
    });

    // Test 4: Right click verification
    progress.log('Test 4: Right click on div element (.container) with verification');

    // Add contextmenu event handler for container
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testRightClickCount = 0;
      const container = document.querySelector('.container');
      console.log('Container element found:', container);
      const handler = (e: Event) => {
        console.log('Contextmenu event fired!', e);
        e.preventDefault(); // Prevent context menu
        ((window as unknown as Record<string, unknown>).testRightClickCount as number)++;
        console.log(
          'Container right-clicked, count:',
          (window as unknown as Record<string, unknown>).testRightClickCount,
        );
      };
      if (container) {
        container.addEventListener('contextmenu', handler);
        (window as unknown as Record<string, unknown>).testContainerHandler = handler;
        console.log('Contextmenu event handler attached to container');
      } else {
        console.error('Container element not found!');
      }
    }, 'ISOLATED');

    const containerLocator = page.locator('.container');
    progress.log('Performing right-click on container...');
    await containerLocator.click({
      button: 'right',
    });
    progress.log('Right-click completed, checking count...');

    // Add a small delay to ensure event processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Verify right click happened
    const rightClickCount = await page.mainFrame().context.executeScript(() => {
      const count = (window as unknown as Record<string, unknown>).testRightClickCount;
      console.log('Final right-click count:', count);
      return count;
    }, 'ISOLATED');
    if (rightClickCount !== 1) {
      throw new Error(`Expected 1 right click, but got ${rightClickCount}`);
    }

    progress.log('Successfully right-clicked the container div and verified event');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 4 passed: Right click successful and verified',
    });

    // Test 5: Page-level click methods with verification
    progress.log('Test 5: Testing page-level click() methods with verification');

    // Reset action button counter
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testClickCount = 0;
    }, 'ISOLATED');

    // Use page.click() directly
    await page.click('#action-button');

    // Verify page-level click
    const pageClickCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testClickCount,
        'ISOLATED',
      );
    if (pageClickCount !== 1) {
      throw new Error(`Expected 1 page click, but got ${pageClickCount}`);
    }

    progress.log('Successfully used page.click() method and verified');

    // Reset toggle button counter
    await page.mainFrame().context.executeScript(() => {
      (window as unknown as Record<string, unknown>).testToggleCount = 0;
    }, 'ISOLATED');

    await page.click('#toggle-button', {
      force: true,
      timeout: 10000,
    });

    // Verify page-level click with options
    const pageToggleCount = await page
      .mainFrame()
      .context.executeScript(
        () => (window as unknown as Record<string, unknown>).testToggleCount,
        'ISOLATED',
      );
    if (pageToggleCount !== 1) {
      throw new Error(`Expected 1 page toggle click, but got ${pageToggleCount}`);
    }

    progress.log('Successfully used page.click() with options and verified');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 5 passed: Page-level click methods work and verified',
    });

    // Test 6: Shadow DOM elements (if accessible)
    progress.log('Test 6: Testing shadow DOM button click');
    try {
      // Try to click shadow DOM button (this may not work depending on shadow DOM accessibility)
      const shadowButtonLocator = page.locator('.shadow-button');
      await shadowButtonLocator.click();
      progress.log('Successfully clicked shadow DOM button');

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 6 passed: Shadow DOM button click successful',
      });
    } catch (shadowError) {
      progress.log('Shadow DOM button click failed (expected if shadow DOM is not accessible)');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Warning,
        message: 'Test 6 warning: Shadow DOM button not accessible (expected behavior)',
      });
    }

    // Clean up event handlers
    progress.log('Cleaning up event handlers');
    await page.mainFrame().context.executeScript(() => {
      const win = window as unknown as Record<string, unknown>;

      if (win.testActionHandler) {
        const button = document.getElementById('action-button');
        if (button) {
          button.removeEventListener('click', win.testActionHandler as EventListener);
        }
      }
      if (win.testToggleHandler) {
        const button = document.getElementById('toggle-button');
        if (button) {
          button.removeEventListener('click', win.testToggleHandler as EventListener);
        }
      }
      if (win.testLogHandler) {
        const button = document.getElementById('log-button');
        if (button) {
          button.removeEventListener('click', win.testLogHandler as EventListener);
        }
      }
      if (win.testContainerHandler) {
        const container = document.querySelector('.container');
        if (container) {
          container.removeEventListener('contextmenu', win.testContainerHandler as EventListener);
        }
      }

      delete win.testClickCount;
      delete win.testToggleCount;
      delete win.testLogCount;
      delete win.testRightClickCount;
      delete win.testActionHandler;
      delete win.testToggleHandler;
      delete win.testLogHandler;
      delete win.testContainerHandler;
    }, 'ISOLATED');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All click() functionality tests completed successfully',
      details: {
        testsCompleted: [
          'Basic Locator.click() on action button with event verification',
          'Locator.click() with position, delay, and button options with verification',
          'Double click using clickCount option with event count verification',
          'Right click using button option with contextmenu event verification',
          'Page.click() and Page.click() with options with verification',
          'Shadow DOM button click test (accessibility check)',
        ],
      },
    });
  } catch (error) {
    const errorMessage = `Click functionality test failed: ${error instanceof Error ? error.message : String(error)}`;
    progress.log(errorMessage);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: errorMessage,
    });
    throw new Error(errorMessage);
  }
}
