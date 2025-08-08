/**
 * Test suite for Locator.waitFor() functionality
 * Tests various states and timeout scenarios for waiting on elements
 */

import { Page } from '../../pages/side-panel/src/services/cordyceps/page';

export async function testWaitForFunctionality(page: Page): Promise<void> {
  console.log('🧪 Starting Locator.waitFor() functionality tests...');

  try {
    // Test 1: waitFor() with default 'visible' state
    console.log('Test 1: waitFor() with default visible state');
    const visibleButton = page.locator('button:visible');
    await visibleButton.waitFor(); // Should wait for visible state by default
    console.log('✅ Test 1 passed: waitFor() with default visible state');

    // Test 2: waitFor() with explicit 'attached' state
    console.log('Test 2: waitFor() with attached state');
    const attachedElement = page.locator('[data-testid="any-element"]');
    await attachedElement.waitFor({ state: 'attached' });
    console.log('✅ Test 2 passed: waitFor() with attached state');

    // Test 3: waitFor() with 'visible' state and custom timeout
    console.log('Test 3: waitFor() with visible state and custom timeout');
    const timedElement = page.locator('input[type="text"]');
    await timedElement.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Test 3 passed: waitFor() with custom timeout');

    // Test 4: waitFor() with 'hidden' state
    console.log('Test 4: waitFor() with hidden state');
    const hiddenElement = page.locator('[style*="display: none"]');
    await hiddenElement.waitFor({ state: 'hidden' });
    console.log('✅ Test 4 passed: waitFor() with hidden state');

    // Test 5: waitFor() combined with scrollIntoViewIfNeeded
    console.log('Test 5: waitFor() combined with scrollIntoViewIfNeeded');
    const scrollElement = page.locator('[data-testid="scroll-target"]');
    await scrollElement.waitFor({ state: 'attached' });
    await scrollElement.scrollIntoViewIfNeeded();
    console.log('✅ Test 5 passed: waitFor() combined with scrollIntoViewIfNeeded');

    // Test 6: waitFor() with Frame locator
    console.log('Test 6: waitFor() with Frame locator');
    const frameElement = page.mainFrame().locator('body');
    await frameElement.waitFor({ state: 'attached' });
    console.log('✅ Test 6 passed: waitFor() with Frame locator');

    // Test 7: waitFor() with chained locators
    console.log('Test 7: waitFor() with chained locators');
    const chainedElement = page.locator('form').locator('input').first();
    await chainedElement.waitFor({ state: 'visible' });
    console.log('✅ Test 7 passed: waitFor() with chained locators');

    // Test 8: waitFor() error handling for non-existent elements with short timeout
    console.log('Test 8: waitFor() error handling with timeout');
    try {
      const nonExistentElement = page.locator('[data-testid="non-existent-element"]');
      await nonExistentElement.waitFor({ state: 'visible', timeout: 1000 });
      console.log('❌ Test 8 failed: Should have thrown timeout error');
    } catch (error) {
      console.log('✅ Test 8 passed: waitFor() correctly timed out for non-existent element');
    }

    console.log('🎉 All Locator.waitFor() tests completed successfully!');
  } catch (error) {
    console.error('❌ waitFor() test failed:', error);
    throw error;
  }
}

/**
 * Visual feedback test for waitFor functionality
 * Creates visible indicators showing the waitFor operation in progress
 */
export async function testWaitForWithVisualFeedback(page: Page): Promise<void> {
  console.log('🎨 Starting waitFor() visual feedback test...');

  try {
    // Create a visual indicator for the test
    await page.evaluate(() => {
      const indicator = document.createElement('div');
      indicator.id = 'waitfor-test-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #e1f5fe;
        border: 2px solid #0277bd;
        padding: 15px;
        border-radius: 8px;
        z-index: 10000;
        font-family: monospace;
        font-size: 12px;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      indicator.innerHTML = `
        <div style="font-weight: bold; color: #0277bd; margin-bottom: 8px;">
          🧪 waitFor() Test Progress
        </div>
        <div id="waitfor-status">Initializing...</div>
      `;
      document.body.appendChild(indicator);
    });

    const updateStatus = async (message: string) => {
      await page.evaluate(msg => {
        const status = document.getElementById('waitfor-status');
        if (status) status.textContent = msg;
      }, message);
    };

    // Test waitFor with visual feedback
    await updateStatus('Step 1: Testing waitFor() with visible state...');
    const testButton = page.locator('button').first();
    await testButton.waitFor({ state: 'visible' });

    await updateStatus('Step 2: Testing waitFor() with attached state...');
    const bodyElement = page.locator('body');
    await bodyElement.waitFor({ state: 'attached' });

    await updateStatus('Step 3: Testing waitFor() with custom timeout...');
    const inputElement = page.locator('input').first();
    await inputElement.waitFor({ state: 'visible', timeout: 3000 });

    await updateStatus('All waitFor() tests completed! ✅');

    // Keep indicator visible for a moment
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Clean up
    await page.evaluate(() => {
      const indicator = document.getElementById('waitfor-test-indicator');
      if (indicator) indicator.remove();
    });

    console.log('✅ waitFor() visual feedback test completed successfully!');
  } catch (error) {
    console.error('❌ waitFor() visual feedback test failed:', error);

    // Clean up on error
    try {
      await page.evaluate(() => {
        const indicator = document.getElementById('waitfor-test-indicator');
        if (indicator) indicator.remove();
      });
    } catch (cleanupError) {
      console.error('Failed to clean up indicator:', cleanupError);
    }

    throw error;
  }
}
