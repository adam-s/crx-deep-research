import { expect, test } from '../fixtures/extensionTest';

test.describe('Side panel tests', () => {
  test('open side panel in a tab', async ({ context, extensionId }) => {
    // Increase test timeout to 2 minutes
    test.setTimeout(120000);

    // Open the side panel directly as a tab
    const sidePanelPage = await context.newPage();
    await sidePanelPage.goto(`chrome-extension://${extensionId}/side-panel/index.html`);

    // Wait for the page to load and verify content
    await sidePanelPage.waitForLoadState();
    await expect(sidePanelPage.locator('text=Cordyceps Test Runner')).toBeVisible();

    //   const sheetsPage = await context.newPage();
    //   await sheetsPage.goto(
    //     'https://docs.google.com/spreadsheets/d/1jPuJkhQRQadtGfrpJzvOIWlYjXKY8sGJBJ48JVcT7FI/edit?usp=sharing',
    //   );

    //   await sheetsPage.waitForLoadState();

    //   await sheetsPage.bringToFront();

    //   // Set viewport dimensions
    //   await sheetsPage.setViewportSize({ width: 1512, height: 336 });

    //   // Navigate to the specific sheet URL
    //   await sheetsPage.goto(
    //     'https://docs.google.com/spreadsheets/d/1jPuJkhQRQadtGfrpJzvOIWlYjXKY8sGJBJ48JVcT7FI/edit?gid=1642431487#gid=1642431487',
    //   );
    //   await sheetsPage.bringToFront();
    //   // Wait for the navigation to complete
    //   await sheetsPage.waitForLoadState();

    //   // Click on the grid container
    //   await sheetsPage.click('#\\31 642431487-grid-container', { position: { x: 799, y: 12 } });

    //   // Click on the fixed area
    //   await sheetsPage.click('#\\31 642431487-fixed > div:nth-of-type(1)', {
    //     position: { x: 23, y: 6 },
    //   });

    //   // Right click on body
    //   await sheetsPage.click('body', { position: { x: 23, y: 148 }, button: 'right' });

    //   // Click on body
    //   await sheetsPage.click('body', { position: { x: 73, y: 134 } });

    //   // Double click on grid container element
    //   await sheetsPage.dblclick('#\\31 642431487-grid-container > div:nth-of-type(15)', {
    //     position: { x: 200, y: 121 },
    //     force: true,
    //   });

    //   // Double click on scrollable element to open/select the cell
    //   await sheetsPage.dblclick('#\\31 642431487-scrollable > div:nth-of-type(2)', {
    //     position: { x: 200, y: 113 },
    //     force: true,
    //   });

    //   // Wait a moment for the cell to be ready for input
    //   await sheetsPage.waitForTimeout(500);

    //   // Perform Cmd+V (paste) to insert clipboard content into the cell
    //   await sheetsPage.keyboard.press('Meta+v');

    //   // Press Enter to confirm the input
    //   await sheetsPage.keyboard.press('Enter');

    //   // Grant clipboard permissions to the page
    //   await sheetsPage.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    //   // Read clipboard content from the page
    //   const clipboardContent = await sheetsPage.evaluate(() => navigator.clipboard.readText());
    //   console.log('Clipboard contents:', clipboardContent);
  });
});
