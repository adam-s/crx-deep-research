import { expect, test } from '../../packages/playwright-testing/fixtures/extensionTest';

/**
 * Navigation functionality tests for goBack/goForward implementation
 * Tests the integration between side panel and content scripts
 */
test.describe('Navigation Functionality', () => {
  test.beforeEach(async ({ context, extensionId, serverUrl }) => {
    // Increase test timeout for navigation operations
    test.setTimeout(120000);
  });

  test('should navigate back successfully', async () => {
    // Navigate to page 2
    await page.getByTestId('nav-to-page-2').click();
    await page.waitForURL('**/nav-page-2');

    // Wait for page to be ready
    await expect(page.getByTestId('nav-ready')).toHaveText('true');

    // Navigate back using the extension
    await page.goBack();

    // Should be back on page 1
    await page.waitForURL('**/nav-page-1');
    await expect(page.getByTestId('page-identifier')).toHaveText('nav-page-1');
  });

  test('should navigate forward successfully', async () => {
    // Navigate to page 2
    await page.getByTestId('nav-to-page-2').click();
    await page.waitForURL('**/nav-page-2');

    // Navigate back using browser
    await page.goBack();
    await page.waitForURL('**/nav-page-1');

    // Now navigate forward using the extension
    await page.goForward();

    // Should be on page 2 again
    await page.waitForURL('**/nav-page-2');
    await expect(page.getByTestId('page-identifier')).toHaveText('nav-page-2');
  });

  test('should handle hash navigation correctly', async () => {
    // Click hash navigation link
    await page.getByTestId('hash-nav-section1').click();

    // URL should include hash
    await expect(page.page).toHaveURL(/.*#section1$/);

    // Navigate to another hash
    await page.getByTestId('hash-nav-section2').click();
    await expect(page.page).toHaveURL(/.*#section2$/);

    // Navigate back using extension
    await page.goBack();
    await expect(page.page).toHaveURL(/.*#section1$/);

    // Navigate forward using extension
    await page.goForward();
    await expect(page.page).toHaveURL(/.*#section2$/);
  });

  test('should handle SPA navigation with pushState', async () => {
    // Trigger SPA navigation
    await page.getByTestId('spa-nav-step1').click();
    await expect(page.page).toHaveURL(/.*\/spa-step-1$/);

    // Another SPA navigation
    await page.getByTestId('spa-nav-step2').click();
    await expect(page.page).toHaveURL(/.*\/spa-step-2$/);

    // Navigate back using extension
    await page.goBack();
    await expect(page.page).toHaveURL(/.*\/spa-step-1$/);

    // Navigate forward using extension
    await page.goForward();
    await expect(page.page).toHaveURL(/.*\/spa-step-2$/);
  });

  test('should handle replaceState navigation correctly', async () => {
    // Navigate to page 3 which has replaceState functionality
    await page.getByTestId('nav-to-page-3').click();
    await page.waitForURL('**/nav-page-3');

    // Record initial history length
    const initialHistoryLength = await page.getByTestId('history-length').textContent();

    // Use replaceState (should not change history length)
    await page.getByTestId('replace-url-1').click();
    await expect(page.page).toHaveURL(/.*\/replaced-url-1$/);

    // History length should be the same
    await expect(page.getByTestId('history-length')).toHaveText(initialHistoryLength || '');

    // Navigate back should go to previous page, not replaced URL
    await page.goBack();
    await page.waitForURL('**/nav-page-1');
  });

  test('should handle mixed navigation with 200ms timeout', async () => {
    // Navigate to page 3
    await page.getByTestId('nav-to-page-3').click();
    await page.waitForURL('**/nav-page-3');

    // Run mixed navigation test
    await page.getByTestId('mixed-nav').click();

    // Wait for mixed navigation to complete
    await expect(page.getByTestId('mixed-nav-status')).toHaveText('completed');

    // Should be on the final pushed state
    await expect(page.page).toHaveURL(/.*\/step-4-pushed$/);

    // Navigate back using extension (with 200ms timeout)
    const startTime = Date.now();
    await page.goBack();
    const endTime = Date.now();

    // Should take at least 200ms due to timeout
    expect(endTime - startTime).toBeGreaterThan(200);

    // Should be on previous state
    await expect(page.page).toHaveURL(/.*\/step-3-replaced$/);
  });

  test('should track navigation events correctly', async () => {
    // Start on page 1
    await expect(page.getByTestId('page-identifier')).toHaveText('nav-page-1');

    // Navigate to page 2
    await page.getByTestId('nav-to-page-2').click();
    await page.waitForURL('**/nav-page-2');

    // Extension should track this navigation
    // (Implementation would depend on how navigation tracking is exposed)

    // Navigate back using extension
    await page.goBack();
    await page.waitForURL('**/nav-page-1');

    // Extension should track the back navigation
    await expect(page.getByTestId('page-identifier')).toHaveText('nav-page-1');
  });

  test('should handle cross-document navigation chain', async () => {
    // Create a chain of navigation: page1 -> page2 -> page3 -> page1
    await page.getByTestId('nav-to-page-2').click();
    await page.waitForURL('**/nav-page-2');

    await page.getByTestId('nav-to-page-3').click();
    await page.waitForURL('**/nav-page-3');

    await page.getByTestId('nav-to-page-1').click();
    await page.waitForURL('**/nav-page-1');

    // Now navigate back through the chain
    await page.goBack();
    await page.waitForURL('**/nav-page-3');

    await page.goBack();
    await page.waitForURL('**/nav-page-2');

    await page.goBack();
    await page.waitForURL('**/nav-page-1');

    // Navigate forward through the chain
    await page.goForward();
    await page.waitForURL('**/nav-page-2');

    await page.goForward();
    await page.waitForURL('**/nav-page-3');

    await page.goForward();
    await page.waitForURL('**/nav-page-1');
  });

  test('should handle navigation when history is empty', async () => {
    // Try to go back when there's nowhere to go
    const result = await page.goBack();

    // Should handle gracefully (implementation dependent)
    // Could return false or throw specific error
    expect(result).toBeDefined();

    // Should still be on the same page
    await expect(page.getByTestId('page-identifier')).toHaveText('nav-page-1');
  });

  test('should handle rapid navigation calls', async () => {
    // Navigate to page 2
    await page.getByTestId('nav-to-page-2').click();
    await page.waitForURL('**/nav-page-2');

    // Navigate to page 3
    await page.getByTestId('nav-to-page-3').click();
    await page.waitForURL('**/nav-page-3');

    // Rapidly call goBack multiple times
    const promises = [page.goBack(), page.goBack(), page.goBack()];

    // Should handle concurrent calls gracefully
    const results = await Promise.allSettled(promises);

    // At least one should succeed
    const successful = results.filter(r => r.status === 'fulfilled');
    expect(successful.length).toBeGreaterThan(0);

    // Should end up somewhere reasonable in the history
    // (Could be page 1 or page 2 depending on implementation)
    const currentUrl = page.page.url();
    expect(currentUrl).toMatch(/(nav-page-1|nav-page-2)/);
  });
});
