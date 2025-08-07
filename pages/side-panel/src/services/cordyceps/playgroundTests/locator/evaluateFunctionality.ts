import type { Page } from '../../page';
import type { Progress } from '../../progress';
import type { TestContext } from '../api';
import { Severity } from '../../../../utils/types';

/**
 * Test evaluate() and evaluateHandle() functionality across Page, Frame, Locator, and ElementHandle
 * Note: Due to Chrome extension limitations, we use simple inline functions for testing
 */
export async function testEvaluateFunctionality(
  page: Page,
  progress: Progress,
  context: TestContext,
): Promise<void> {
  // Define functions that can be serialized by Chrome extension
  function getDocumentTitle() {
    return document.title;
  }

  function getLocationHref() {
    return window.location.href;
  }

  function getElementTagName(element: Element) {
    return element.tagName;
  }

  function getDocument() {
    return document;
  }

  progress.log('Testing evaluate() and evaluateHandle() methods');

  try {
    // Test Page.evaluate() - minimal sanity check with inline function
    progress.log('Testing Page.evaluate()');

    const pageTitle = await page.evaluate(getDocumentTitle);
    progress.log(`Page title: ${pageTitle}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Page.evaluate() test passed',
      details: { pageTitle },
    });

    // Test Frame.evaluate() - minimal sanity check
    progress.log('Testing Frame.evaluate()');

    const frameUrl = await page.mainFrame().evaluate(getLocationHref);
    progress.log(`Frame URL: ${frameUrl}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Frame.evaluate() test passed',
      details: { frameUrl },
    });

    // Test Locator.evaluate() - get body element info
    progress.log('Testing Locator.evaluate()');
    const bodyLocator = page.locator('body');

    const bodyTagName = await bodyLocator.evaluate(getElementTagName);
    progress.log(`Body tag name: ${bodyTagName}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Locator.evaluate() test passed',
      details: { bodyTagName },
    });

    // Test ElementHandle.evaluate() is covered by Locator.evaluate() which uses _withElement
    progress.log('ElementHandle.evaluate() is tested via Locator.evaluate()');

    // Test Page.evaluateHandle() - get document reference
    progress.log('Testing Page.evaluateHandle()');

    const documentHandle = await page.evaluateHandle(getDocument);
    if (documentHandle) {
      progress.log('Page.evaluateHandle() returned document handle');

      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Page.evaluateHandle() test passed',
      });
    }

    progress.log('All evaluate functionality tests completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Evaluate functionality test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Evaluate functionality test failed',
      details: { error: errorMessage },
    });

    throw error;
  }
}
