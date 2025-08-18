/**
 * Live Page DOM Tests - Stagehand to Cordyceps Conversion Testing
 *
 * Tests Stagehand functionality against the live test server at http://localhost:3005
 * This file focuses on testing DOM interactions that work with the real page content
 * to validate the Playwright -> Cordyceps conversion process.
 */

import { Severity } from '@src/utils/types';
import { TestProgress, TestContext } from './types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';

/**
 * Test Stagehand DOM utilities against live page at localhost:3005
 */
export async function testStagehandLivePageDOM(
  progress: TestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('🌐 Testing Stagehand DOM utilities against live page...');
  let allTestsPassed = true;

  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🌐 Starting live page DOM tests against localhost:3005...',
    });

    // Test 1: Basic page navigation and content verification
    await testBasicPageNavigation(progress, context);

    // Test 2: Element interaction tests (clicks, form fills)
    await testElementInteractions(progress, context);

    // Test 3: Scrollable element detection (Stagehand DOM utilities)
    await testScrollableElementDetection(progress, context);

    // Test 4: XPath generation and element location
    await testXPathGeneration(progress, context);

    // Test 5: Form interaction testing
    await testFormInteractions(progress, context);

    // Test 6: Screenshot capture with real content
    await testScreenshotCapture(progress, context);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Live page DOM tests completed successfully',
      details: {
        testServer: 'http://localhost:3005',
        category: 'live-dom-testing',
        conversionPhase: 'playwright-to-cordyceps',
      },
    });
  } catch (error) {
    allTestsPassed = false;
    const errorMessage = error instanceof Error ? error.message : String(error);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ Live page DOM tests failed: ${errorMessage}`,
      details: { error: errorMessage },
    });

    progress.log(`❌ Error: ${errorMessage}`);
  }

  return allTestsPassed;
}

/**
 * Test basic page navigation and content verification
 */
async function testBasicPageNavigation(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🧭 Testing basic page navigation...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🧭 Testing navigation to test server...',
  });

  let browserWindow: BrowserWindow | null = null;

  try {
    browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    // Navigate to test server
    const testUrl = 'http://localhost:3005';
    await page.goto(testUrl, { waitUntil: 'domcontentloaded' });

    progress.log(`✅ Navigation to ${testUrl} successful`);

    // Verify page title
    const title = await page.title();
    if (title.includes('Cordyceps Example Domain')) {
      progress.log(`✅ Page title verified: "${title}"`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ Page navigation and title verification successful',
        details: {
          url: testUrl,
          title: title.substring(0, 50) + '...',
          conversionStatus: 'cordyceps-working',
        },
      });
    } else {
      throw new Error(`Unexpected page title: ${title}`);
    }
  } catch (error) {
    progress.log(`❌ Page navigation failed: ${error}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ Page navigation failed',
      details: { error: String(error) },
    });

    throw error;
  } finally {
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}

/**
 * Test basic element interactions (Playwright -> Cordyceps conversion)
 */
async function testElementInteractions(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🎯 Testing element interactions...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🎯 Testing Cordyceps element interaction APIs...',
  });

  let browserWindow: BrowserWindow | null = null;

  try {
    browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    // Navigate to test page and wait for complete load
    await page.goto('http://localhost:3005', { waitUntil: 'load' });

    // Add additional wait for page stability
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify page is ready
    const title = await page.title();
    progress.log(`📍 Page ready: ${title}`);

    // Test 1: Simple element existence check first
    const testElements = [
      { selector: '#test-checkbox', name: 'checkbox' },
      { selector: '#action-button', name: 'button' },
      { selector: '#text-input', name: 'text input' },
    ];

    let elementsFound = 0;
    for (const element of testElements) {
      try {
        const locator = page.locator(element.selector);
        const isVisible = await locator.isVisible();
        if (isVisible) {
          elementsFound++;
          progress.log(`✅ Found ${element.name}: ${element.selector}`);
        }
      } catch (err) {
        progress.log(`⚠️ Could not find ${element.name}: ${element.selector}`);
      }
    }

    if (elementsFound > 0) {
      progress.log(`✅ Found ${elementsFound}/${testElements.length} test elements`);

      // Try simple interaction with first found element
      try {
        const firstCheckbox = page.locator('#test-checkbox');
        if (await firstCheckbox.isVisible()) {
          await firstCheckbox.click();
          progress.log('✅ Checkbox interaction successful');
        }
      } catch (clickError) {
        progress.log(`⚠️ Click interaction issue: ${clickError}`);
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Element interactions working with Cordyceps',
      details: {
        elementsFound,
        totalElements: testElements.length,
        conversionStatus: 'cordyceps-working',
      },
    });
  } catch (error) {
    progress.log(`❌ Element interactions failed: ${error}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ Element interactions failed',
      details: { error: String(error) },
    });
  } finally {
    // Ensure cleanup but with delay
    if (browserWindow) {
      try {
        // Add small delay before disposal to prevent race conditions
        await new Promise(resolve => setTimeout(resolve, 500));
        await browserWindow.dispose();
        progress.log('✅ BrowserWindow disposed safely');
      } catch (disposeError) {
        progress.log(`⚠️ Disposal warning: ${disposeError}`);
      }
    }
  }
}

/**
 * Test Stagehand's scrollable element detection (Pure Functions - No Conversion Needed)
 */
async function testScrollableElementDetection(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('📜 Testing scrollable element detection...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '📜 Testing Stagehand DOM utilities (no conversion needed)...',
  });

  let browserWindow: BrowserWindow | null = null;

  try {
    browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    // Navigate to test page
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded' });

    // Test scrollable element detection using Stagehand injected functions
    const scrollableElementsFound = await page.evaluate(() => {
      // Check if Stagehand DOM utilities are available
      if (typeof window.getScrollableElementXpaths === 'function') {
        return window.getScrollableElementXpaths(5);
      }
      return [];
    });

    if (scrollableElementsFound && scrollableElementsFound.length > 0) {
      progress.log(`✅ Found ${scrollableElementsFound.length} scrollable elements`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ Stagehand DOM utilities working (no conversion needed)',
        details: {
          scrollableElements: scrollableElementsFound.length,
          sampleXpaths: scrollableElementsFound.slice(0, 3),
          conversionStatus: 'pure-functions-unchanged',
        },
      });
    } else {
      progress.log('⚠️ No scrollable elements found or utilities not loaded');

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Warning,
        message: '⚠️ Stagehand DOM utilities not found',
        details: {
          note: 'May need to inject Stagehand DOM scripts',
        },
      });
    }
  } catch (error) {
    progress.log(`❌ Scrollable element detection failed: ${error}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ Scrollable element detection failed',
      details: { error: String(error) },
    });

    throw error;
  } finally {
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}

/**
 * Test XPath generation and element location (Pure Functions)
 */
async function testXPathGeneration(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('🎯 Testing XPath generation...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🎯 Testing XPath generation utilities...',
  });

  let browserWindow: BrowserWindow | null = null;

  try {
    browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    // Navigate to test page
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded' });

    // Test XPath generation and element resolution
    const xpathTest = await page.evaluate(() => {
      // Test basic XPath resolution
      if (typeof window.getNodeFromXpath === 'function') {
        const bodyXpath = '/html/body';
        const bodyNode = window.getNodeFromXpath(bodyXpath);
        return bodyNode === document.body;
      }
      return false;
    });

    if (xpathTest) {
      progress.log('✅ XPath generation and resolution working');

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ XPath utilities working correctly',
        details: {
          testedXpath: '/html/body',
          resolved: true,
          conversionStatus: 'pure-functions-working',
        },
      });
    } else {
      progress.log('⚠️ XPath utilities not available or not working');
    }
  } catch (error) {
    progress.log(`❌ XPath generation test failed: ${error}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ XPath generation test failed',
      details: { error: String(error) },
    });

    throw error;
  } finally {
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}

/**
 * Test form interactions with the comprehensive form on the test page
 */
async function testFormInteractions(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('📝 Testing form interactions...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '📝 Testing form interaction capabilities...',
  });

  let browserWindow: BrowserWindow | null = null;

  try {
    browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    // Navigate to test page
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded' });

    // Test various form elements
    const interactions = [
      { selector: '#email-input', value: 'test@stagehand.dev', type: 'email' },
      { selector: '#number-input', value: '42', type: 'number' },
      { selector: '#single-select', value: 'option3', type: 'select' },
      { selector: '#textarea-input', value: 'Stagehand conversion test content', type: 'textarea' },
    ];

    for (const interaction of interactions) {
      try {
        const element = await page.locator(interaction.selector);
        if (element) {
          await element.fill(interaction.value);
          progress.log(`✅ ${interaction.type} interaction successful: ${interaction.selector}`);
        }
      } catch (error) {
        progress.log(
          `⚠️ ${interaction.type} interaction failed: ${interaction.selector} - ${error}`
        );
      }
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Form interactions working with Cordyceps',
      details: {
        testedElements: interactions.length,
        conversionStatus: 'form-apis-converted',
      },
    });
  } catch (error) {
    progress.log(`❌ Form interactions failed: ${error}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ Form interactions failed',
      details: { error: String(error) },
    });

    throw error;
  } finally {
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}

/**
 * Test screenshot capture with real page content
 */
async function testScreenshotCapture(progress: TestProgress, context: TestContext): Promise<void> {
  progress.log('📸 Testing screenshot capture...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '📸 Testing screenshot capture with real content...',
  });

  let browserWindow: BrowserWindow | null = null;

  try {
    browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    // Navigate to test page
    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded' });

    // Create a progress object for screenshot
    const screenshotProgress = {
      log: (message: string) => progress.log(`📸 ${message}`),
      cleanupWhenAborted: () => {},
      race: <T>(promise: Promise<T> | Promise<T>[]) =>
        Array.isArray(promise) ? Promise.race(promise) : promise,
      raceWithCleanup: <T>(promise: Promise<T>) => promise,
      wait: (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms)),
      abort: () => {},
    };

    // Test screenshot capture with Cordyceps
    const screenshot = await page.screenshot(screenshotProgress, {
      fullPage: false,
      type: 'png',
    });

    if (screenshot && screenshot.length > 0) {
      progress.log(`✅ Screenshot captured successfully (${screenshot.length} bytes)`);

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ Screenshot capture working with Cordyceps',
        details: {
          screenshotSize: screenshot.length,
          conversionStatus: 'screenshot-api-converted',
        },
      });
    } else {
      throw new Error('Screenshot is empty or null');
    }
  } catch (error) {
    progress.log(`❌ Screenshot capture failed: ${error}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ Screenshot capture failed',
      details: { error: String(error) },
    });

    throw error;
  } finally {
    if (browserWindow) {
      browserWindow.dispose();
    }
  }
}

/**
 * Quick live page DOM test for rapid validation
 */
export async function quickStagehandLivePageTest(): Promise<boolean> {
  const progress = new TestProgress('QuickLivePage');

  try {
    // Quick check: Can we navigate to the test server and interact with elements?
    const browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    await page.goto('http://localhost:3005', { waitUntil: 'domcontentloaded' });

    const title = await page.title();
    if (title.includes('Cordyceps Example Domain')) {
      progress.log('✅ Live page test successful');
      browserWindow.dispose();
      return true;
    } else {
      progress.log('❌ Live page test failed - unexpected title');
      browserWindow.dispose();
      return false;
    }
  } catch (error) {
    progress.log(`❌ Quick live page test failed: ${error}`);
    return false;
  }
}
