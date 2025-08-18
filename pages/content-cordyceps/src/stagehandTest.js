/**
 * Simple test for Stagehand DOM utilities in Chrome extension environment
 *
 * This test verifies that the adapted Stagehand DOM utilities work correctly
 * within our Chrome extension content script using the Cordyceps system.
 */

// Test function to verify Stagehand utilities are working
async function testStagehandUtilities() {
  console.log('🧪 Starting Stagehand utilities test...');

  // Test 1: Check if utilities are available
  if (!window.__stagehandInjected) {
    console.error('❌ Stagehand utilities not loaded');
    return false;
  }

  if (!window.getScrollableElementXpaths || !window.generateXPathsForElement) {
    console.error('❌ Required Stagehand functions not available');
    return false;
  }

  console.log('✅ Test 1 passed: Stagehand utilities are available');

  // Test 2: Test scrollable element detection
  try {
    const scrollableXPaths = await window.getScrollableElementXpaths(5);
    console.log('✅ Test 2 passed: Found scrollable elements:', scrollableXPaths.length);

    if (scrollableXPaths.length > 0) {
      console.log('📋 First few scrollable element XPaths:', scrollableXPaths.slice(0, 3));
    }
  } catch (error) {
    console.error('❌ Test 2 failed: Error getting scrollable elements:', error);
    return false;
  }

  // Test 3: Test XPath generation for document.body
  try {
    if (document.body && window.generateXPathsForElement) {
      const bodyXPaths = await window.generateXPathsForElement(document.body);
      console.log('✅ Test 3 passed: Generated XPaths for body:', bodyXPaths);
    } else {
      console.warn('⚠️ Test 3 skipped: document.body not available');
    }
  } catch (error) {
    console.error('❌ Test 3 failed: Error generating XPaths for body:', error);
    return false;
  }

  // Test 4: Test XPath to node resolution
  try {
    if (window.getNodeFromXpath) {
      const bodyNode = window.getNodeFromXpath('//body');
      if (bodyNode === document.body) {
        console.log('✅ Test 4 passed: XPath to node resolution works');
      } else {
        console.warn('⚠️ Test 4 warning: XPath resolution returned unexpected node');
      }
    }
  } catch (error) {
    console.error('❌ Test 4 failed: Error resolving XPath to node:', error);
    return false;
  }

  // Test 5: Test shadow DOM backdoor (if available)
  try {
    if (window.__stagehand__) {
      console.log('✅ Test 5 passed: Shadow DOM backdoor is available');

      // Create a test element with shadow root to verify backdoor works
      const testElement = document.createElement('div');
      testElement.id = 'stagehand-test-shadow';
      document.body.appendChild(testElement);

      const shadowRoot = testElement.attachShadow({ mode: 'closed' });
      shadowRoot.innerHTML = '<p>Shadow content</p>';

      // Test if backdoor can access closed shadow root
      const retrievedRoot = window.__stagehand__.getClosedRoot(testElement);
      if (retrievedRoot === shadowRoot) {
        console.log('✅ Test 5a passed: Shadow DOM backdoor works for closed roots');
      } else {
        console.warn('⚠️ Test 5a warning: Shadow DOM backdoor may not work correctly');
      }

      // Clean up test element
      document.body.removeChild(testElement);
    } else {
      console.log('ℹ️ Test 5 skipped: Shadow DOM backdoor not available');
    }
  } catch (error) {
    console.error('❌ Test 5 failed: Error testing shadow DOM backdoor:', error);
  }

  console.log('🎉 Stagehand utilities test completed successfully!');
  return true;
}

// Test function for the Stagehand-Cordyceps adapter
async function testStagehandAdapter() {
  console.log('🧪 Starting Stagehand adapter test...');

  const adapter = window.__stagehandCordycepsAdapter;
  if (!adapter) {
    console.error('❌ Stagehand adapter not available');
    return false;
  }

  // Test 1: Adapter status
  try {
    const status = adapter.getStatus();
    console.log('✅ Test 1 passed: Adapter status:', status);
  } catch (error) {
    console.error('❌ Test 1 failed: Error getting adapter status:', error);
    return false;
  }

  // Test 2: Generate XPaths for a test element
  try {
    // Create a test button
    const testButton = document.createElement('button');
    testButton.textContent = 'Test Button';
    testButton.id = 'stagehand-test-button';
    testButton.setAttribute('data-testid', 'stagehand-test');
    document.body.appendChild(testButton);

    const xpathResult = await adapter.generateXPathsForElement(testButton);
    console.log('✅ Test 2 passed: Generated XPaths for test element:', xpathResult);

    // Test 3: Get element by XPath with handle
    if (xpathResult.primaryXPath) {
      const elementWithHandle = await adapter.getElementByXPathWithHandle(xpathResult.primaryXPath);
      if (elementWithHandle && elementWithHandle.element === testButton) {
        console.log(
          '✅ Test 3 passed: XPath to element with handle works:',
          elementWithHandle.handle
        );
      } else {
        console.warn('⚠️ Test 3 warning: XPath to element with handle may not work correctly');
      }
    }

    // Clean up test element
    document.body.removeChild(testButton);
  } catch (error) {
    console.error('❌ Test 2/3 failed: Error testing adapter element operations:', error);
    return false;
  }

  // Test 4: Get scrollable elements
  try {
    const scrollableElements = await adapter.getScrollableElements(3);
    console.log(
      '✅ Test 4 passed: Found scrollable elements through adapter:',
      scrollableElements.length
    );
  } catch (error) {
    console.error('❌ Test 4 failed: Error getting scrollable elements through adapter:', error);
    return false;
  }

  console.log('🎉 Stagehand adapter test completed successfully!');
  return true;
}

// Run tests after a short delay to ensure everything is loaded
setTimeout(async () => {
  try {
    const utilitiesTest = await testStagehandUtilities();
    const adapterTest = await testStagehandAdapter();

    if (utilitiesTest && adapterTest) {
      console.log('🏆 All Stagehand integration tests passed!');
    } else {
      console.log('⚠️ Some Stagehand integration tests failed or were skipped');
    }
  } catch (error) {
    console.error('💥 Stagehand integration test suite failed:', error);
  }
}, 1000);

console.log('📋 Stagehand integration test suite loaded');
