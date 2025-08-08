/**
 * Test suite for Locator.dragTo() functionality
 * Tests various drag and drop scenarios and options
 */

import { Page } from '../../pages/side-panel/src/services/cordyceps/page';

export async function testDragToFunctionality(page: Page): Promise<void> {
  console.log('🧪 Starting Locator.dragTo() functionality tests...');

  try {
    // Navigate to the test page
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Wait for drag and drop elements to be initialized
    await page.waitForFunction(() => {
      const dragItem = document.querySelector('[data-testid="drag-item-1"]');
      const dropZone = document.querySelector('[data-testid="drop-zone-1"]');
      return dragItem && dropZone;
    });

    console.log('✅ Test page loaded and drag/drop elements found');

    // Test 1: Basic drag and drop
    await testBasicDragAndDrop(page);

    // Test 2: Drag with position options
    await testDragWithPositions(page);

    // Test 3: Drag between different container types
    await testDragBetweenContainers(page);

    // Test 4: Multiple drag operations
    await testMultipleDragOperations(page);

    // Test 5: Drag with options (force, trial, timeout)
    await testDragWithOptions(page);

    // Test 6: Error handling for invalid targets
    await testDragErrorHandling(page);

    console.log('🎉 All Locator.dragTo() tests completed successfully!');
  } catch (error) {
    console.error('❌ Locator.dragTo() tests failed:', error);
    throw error;
  }
}

async function testBasicDragAndDrop(page: Page): Promise<void> {
  console.log('🧪 Testing basic drag and drop...');

  const draggableItem = page.locator('[data-testid="drag-item-1"]');
  const dropZone = page.locator('[data-testid="drop-zone-1"]');

  // Verify elements exist
  const draggableExists = await draggableItem.isVisible();
  const dropZoneExists = await dropZone.isVisible();

  if (!draggableExists) {
    throw new Error('Draggable item not found or not visible');
  }

  if (!dropZoneExists) {
    throw new Error('Drop zone not found or not visible');
  }

  // Get initial drop zone content
  const initialContent = await dropZone.textContent();
  console.log(`📝 Initial drop zone content: "${initialContent}"`);

  // Perform drag and drop
  await draggableItem.dragTo(dropZone);

  // Wait for the operation to complete
  await page.waitForTimeout(200);

  // Verify the item was dropped
  const finalContent = await dropZone.textContent();
  console.log(`📝 Final drop zone content: "${finalContent}"`);

  if (!finalContent?.includes('Item 1')) {
    throw new Error('Drag and drop failed: Item 1 not found in drop zone');
  }

  console.log('✅ Basic drag and drop test passed');
}

async function testDragWithPositions(page: Page): Promise<void> {
  console.log('🧪 Testing drag with position options...');

  const draggableItem = page.locator('[data-testid="drag-item-2"]');
  const dropZone = page.locator('[data-testid="drop-zone-2"]');

  // Get drop zone dimensions for positioning
  const dropZoneBox = await dropZone.boundingBox();

  if (!dropZoneBox) {
    throw new Error('Could not get drop zone bounding box');
  }

  // Drag to a specific position within the drop zone
  await draggableItem.dragTo(dropZone, {
    sourcePosition: { x: 10, y: 10 },
    targetPosition: { x: dropZoneBox.width / 2, y: dropZoneBox.height / 2 },
  });

  await page.waitForTimeout(200);

  const content = await dropZone.textContent();
  if (!content?.includes('Item 2')) {
    throw new Error('Drag with positions failed: Item 2 not found in drop zone');
  }

  console.log('✅ Drag with positions test passed');
}

async function testDragBetweenContainers(page: Page): Promise<void> {
  console.log('🧪 Testing drag between different container types...');

  const sortableItem = page.locator('[data-testid="sort-item-d"]');
  const dropZone = page.locator('[data-testid="drop-zone-1"]');

  // Drag from sortable container to drop zone
  await sortableItem.dragTo(dropZone);
  await page.waitForTimeout(200);

  const content = await dropZone.textContent();
  if (!content?.includes('Delta')) {
    throw new Error('Drag between containers failed: Delta not found in drop zone');
  }

  console.log('✅ Drag between containers test passed');
}

async function testMultipleDragOperations(page: Page): Promise<void> {
  console.log('🧪 Testing multiple drag operations...');

  const item1 = page.locator('[data-testid="drag-item-1"]');
  const item2 = page.locator('[data-testid="drag-item-2"]');
  const item3 = page.locator('[data-testid="drag-item-3"]');

  const targetA = page.locator('[data-testid="target-a"]');
  const targetB = page.locator('[data-testid="target-b"]');
  const targetC = page.locator('[data-testid="target-c"]');

  // Perform multiple drags in sequence
  await item1.dragTo(targetA);
  await page.waitForTimeout(100);

  await item2.dragTo(targetB);
  await page.waitForTimeout(100);

  await item3.dragTo(targetC);
  await page.waitForTimeout(100);

  // Verify all drops
  const contentA = await targetA.textContent();
  const contentB = await targetB.textContent();
  const contentC = await targetC.textContent();

  if (!contentA?.includes('Item 1')) {
    throw new Error('Multiple drag test failed: Item 1 not in target A');
  }
  if (!contentB?.includes('Item 2')) {
    throw new Error('Multiple drag test failed: Item 2 not in target B');
  }
  if (!contentC?.includes('Item 3')) {
    throw new Error('Multiple drag test failed: Item 3 not in target C');
  }

  console.log('✅ Multiple drag operations test passed');
}

async function testDragWithOptions(page: Page): Promise<void> {
  console.log('🧪 Testing drag with various options...');

  // Test with force option
  const draggableItem = page.locator('[data-testid="sort-item-b"]');
  const target = page.locator('[data-testid="target-a"]');

  await draggableItem.dragTo(target, { force: true });
  await page.waitForTimeout(200);

  const content = await target.textContent();
  if (!content?.includes('Beta')) {
    throw new Error('Drag with force option failed');
  }

  // Test with trial mode (should validate but not perform action)
  const trialItem = page.locator('[data-testid="sort-item-c"]');
  const trialTarget = page.locator('[data-testid="target-b"]');

  const initialTrialContent = await trialTarget.textContent();
  await trialItem.dragTo(trialTarget, { trial: true });
  await page.waitForTimeout(100);

  const finalTrialContent = await trialTarget.textContent();
  if (finalTrialContent?.includes('Gamma') && finalTrialContent !== initialTrialContent) {
    throw new Error('Trial mode should not perform the actual drag action');
  }

  // Test with custom timeout
  const timeoutItem = page.locator('[data-testid="sort-item-a"]');
  const timeoutTarget = page.locator('[data-testid="target-c"]');

  await timeoutItem.dragTo(timeoutTarget, { timeout: 10000 });
  await page.waitForTimeout(200);

  const timeoutContent = await timeoutTarget.textContent();
  if (!timeoutContent?.includes('Alpha')) {
    throw new Error('Drag with timeout option failed');
  }

  console.log('✅ Drag with options test passed');
}

async function testDragErrorHandling(page: Page): Promise<void> {
  console.log('🧪 Testing drag error handling...');

  const draggableItem = page.locator('[data-testid="drag-item-1"]');
  const nonExistentTarget = page.locator('[data-testid="non-existent-target"]');

  try {
    await draggableItem.dragTo(nonExistentTarget, { timeout: 1000 });
    throw new Error('Expected error when dragging to non-existent element');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Expected error')) {
      throw error;
    }
    // Expected error occurred
    console.log('✅ Error handling test passed - properly caught non-existent target error');
  }
}

// Helper function to wait for drag and drop completion
async function waitForDragAndDropCompletion(
  page: Page,
  targetSelector: string,
  expectedText: string,
): Promise<void> {
  await page.waitForFunction(
    (selector, text) => {
      const element = document.querySelector(selector);
      return element && element.textContent?.includes(text);
    },
    targetSelector,
    expectedText,
    { timeout: 5000 },
  );
}

// Utility function to reset drag and drop state between tests
async function resetDragAndDropState(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Clear all drop zones
    const dropZones = document.querySelectorAll('.drop-zone');
    dropZones.forEach(zone => {
      // Remove any dynamically added items
      const addedItems = zone.querySelectorAll('.draggable-item');
      addedItems.forEach(item => item.remove());
      zone.classList.remove('has-items');
    });
  });
}
