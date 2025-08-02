import { expect, test } from '../fixtures/extensionTest';

test.describe('Side panel tests', () => {
  test('open side panel in a tab', async ({ context, extensionId }) => {
    // Open the side panel directly as a tab
    const sidePanelPage = await context.newPage();
    await sidePanelPage.goto(`chrome-extension://${extensionId}/side-panel/index.html`);

    // Wait for the page to load and verify content
    await sidePanelPage.waitForLoadState();
    await expect(sidePanelPage.locator('text=Stuff should go here')).toBeVisible();

    // Keep the tab open for 15 seconds
    await sidePanelPage.waitForTimeout(15000);
  });
});
