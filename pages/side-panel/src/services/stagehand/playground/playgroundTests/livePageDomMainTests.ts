/**
 * Live Page DOM Main World Stagehand Utilities Test Suite
 *
 * This suite validates the availability and basic correctness of the Stagehand
 * DOM helper utilities injected into the MAIN world (content page) at
 * http://localhost:3005. It exercises the globally exposed functions:
 *  - window.getScrollableElementXpaths
 *  - window.getNodeFromXpath
 *  - window.waitForElementScrollEnd
 *  - window.generateXPathsForElement
 *  - window.getScrollableElements
 *  - window.canElementScroll
 *  - window.__stagehand__ shadow DOM helpers (best-effort)
 *
 * Pattern follows other playground tests (see browser-use getSelectorMapTest).
 * No dynamic code execution (eval/new Function) to remain CSP compliant.
 */

import { Severity } from '@src/utils/types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
// Use existing ambient types from stagehand global.d.ts; no re-declare to avoid conflicts

// ---------------------------------------------------------------------------
// Progress helper (mirrors existing playground pattern)
// ---------------------------------------------------------------------------
export class TestProgress {
  private readonly name: string;
  constructor(name: string) {
    this.name = name;
  }
  log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Test context interface
// ---------------------------------------------------------------------------
interface TestContext {
  events: {
    emit: (event: {
      timestamp: number;
      severity: Severity;
      message: string;
      details?: Record<string, unknown>;
    }) => void;
  };
}

// ---------------------------------------------------------------------------
// Internal types (serializable shapes returned from page.evaluate)
// ---------------------------------------------------------------------------
interface StagehandPresenceResult {
  injected: boolean;
  hasGenerate: boolean;
  hasScrollableXpaths: boolean;
  hasGetNodeFromXpath: boolean;
  hasWaitForScrollEnd: boolean;
  hasGetScrollableElements: boolean;
  hasCanElementScroll: boolean;
  shadowBackdoor: boolean;
}

interface XPathTestResult {
  targetId: string;
  xpathCount: number;
  primaryXPath: string | null;
  nodeLookupTag?: string;
  nodeLookupId?: string;
}

interface ScrollableElementsResult {
  totalReturned: number;
  elements: Array<{
    index: number;
    tag: string;
    id: string | null;
    scrollHeight: number;
    clientHeight: number;
    canScroll: boolean;
    xpath?: string;
  }>;
}

interface ScrollWaitResult {
  scrolled: boolean;
  finalScrollTop: number;
  durationMs: number;
}

interface ShadowBackdoorResult {
  attempted: boolean;
  hostFound: boolean;
  closedRootSupported: boolean;
}

// ---------------------------------------------------------------------------
// Main test function
// ---------------------------------------------------------------------------
export async function testLivePageDomMain(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🧪 Starting Stagehand MAIN world DOM utilities tests...');

  let browserWindow: BrowserWindow | undefined;
  try {
    browserWindow = await BrowserWindow.create();
    progress.log(`📍 BrowserWindow created (id=${browserWindow.windowId})`);
  } catch (error) {
    progress.log('⚠️ Unable to create BrowserWindow; skipping Stagehand tests');
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Stagehand tests skipped - cannot create BrowserWindow',
      details: { error: error instanceof Error ? error.message : String(error) },
    });
    return;
  }

  const page = await browserWindow.getCurrentPage();
  await page.goto('http://localhost:3005');
  await page.waitForLoadState();
  progress.log('🌐 Navigated to http://localhost:3005');

  const testResults: string[] = [];
  const warnings: string[] = [];
  const details: Record<string, unknown> = {};

  try {
    // Test 1: Presence detection
    progress.log('Test 1: Detect Stagehand global utilities');

    // Wait for page evaluation to be ready using backoff strategy
    try {
      await page.waitForEvaluationReady();
    } catch (error) {
      throw new Error(`Page evaluation context not ready: ${error}`);
    }

    // Wait for Stagehand utilities to be injected with retry logic
    let presence: StagehandPresenceResult;
    let attempt = 0;
    const maxAttempts = 10;
    const retryDelay = 100; // ms

    do {
      attempt++;

      try {
        presence = await page.evaluate((attemptNum): StagehandPresenceResult => {
          const w = window as Window;
          const genFns = w as unknown as {
            generateXPathsForElement?: (el: Node) => Promise<string[]>;
            getScrollableElements?: (n?: number) => HTMLElement[];
            canElementScroll?: (e: HTMLElement) => boolean;
          };

          console.log(
            `[testLivePageDomMain] attempt ${attemptNum} presence check: injected=${!!w.__stagehandInjected} ######`
          );

          return {
            injected: !!w.__stagehandInjected,
            hasGenerate: typeof genFns.generateXPathsForElement === 'function',
            hasScrollableXpaths: typeof w.getScrollableElementXpaths === 'function',
            hasGetNodeFromXpath: typeof w.getNodeFromXpath === 'function',
            hasWaitForScrollEnd: typeof w.waitForElementScrollEnd === 'function',
            hasGetScrollableElements: typeof genFns.getScrollableElements === 'function',
            hasCanElementScroll: typeof genFns.canElementScroll === 'function',
            shadowBackdoor: !!w.__stagehand__,
          };
        }, attempt);
      } catch (error) {
        console.log(
          `[testLivePageDomMain] presence check failed on attempt ${attempt}: ${error} ######`
        );
        // Set default failure state
        presence = {
          injected: false,
          hasGenerate: false,
          hasScrollableXpaths: false,
          hasGetNodeFromXpath: false,
          hasWaitForScrollEnd: false,
          hasGetScrollableElements: false,
          hasCanElementScroll: false,
          shadowBackdoor: false,
        };
      }

      if (presence.injected) {
        console.log(
          `[testLivePageDomMain] Stagehand utilities detected on attempt ${attempt} ######`
        );
        break;
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    } while (attempt < maxAttempts);

    details.presence = presence;

    if (!presence.injected) throw new Error('Stagehand utilities not injected after retries');
    testResults.push('Presence detection');
    progress.log('✅ Stagehand utilities detected');

    // Test 2: XPath generation & node lookup
    progress.log('Test 2: Generate XPaths for #action-button and resolve via getNodeFromXpath');

    // Ensure page evaluation is ready before complex operations
    try {
      await page.waitForEvaluationReady();
    } catch (error) {
      progress.log('⚠️ Page evaluation context not fully ready, continuing...');
    }

    const xpathResult = await page.evaluate((): XPathTestResult => {
      const target = document.querySelector('#action-button');
      if (!target) {
        return { targetId: 'action-button', xpathCount: 0, primaryXPath: null };
      }
      return { targetId: 'action-button', xpathCount: 0, primaryXPath: null };
    });

    // If generate function exists, run a second async evaluate to actually await results
    let enrichedXPathResult: XPathTestResult = xpathResult;
    if (details.presence && (details.presence as StagehandPresenceResult).hasGenerate) {
      enrichedXPathResult = await page.evaluate(async (): Promise<XPathTestResult> => {
        const w = window as Window;
        const target = document.querySelector('#action-button');
        const genFns = w as unknown as {
          generateXPathsForElement?: (el: Node) => Promise<string[]>;
        };
        const gen = genFns.generateXPathsForElement;
        if (!target || !gen) {
          return { targetId: 'action-button', xpathCount: 0, primaryXPath: null };
        }
        const xpaths: string[] = await gen(target);
        const primary = xpaths[0] || null;
        let lookupTag: string | undefined;
        let lookupId: string | undefined;
        if (primary && w.getNodeFromXpath) {
          const node = w.getNodeFromXpath(primary);
          if (node && node instanceof Element) {
            lookupTag = node.tagName.toLowerCase();
            lookupId = node.getAttribute('id') || undefined;
          }
        }
        return {
          targetId: 'action-button',
          xpathCount: xpaths.length,
          primaryXPath: primary,
          nodeLookupTag: lookupTag,
          nodeLookupId: lookupId,
        };
      });
    }
    details.xpathResult = enrichedXPathResult;
    if (enrichedXPathResult.xpathCount === 0)
      warnings.push('No XPaths generated for #action-button');
    else testResults.push('XPath generation & lookup');

    // Test 3: Scrollable elements & XPath list
    progress.log('Test 3: Retrieve scrollable elements and their XPaths');

    // Ensure page evaluation is ready before scrollable elements test
    try {
      await page.waitForEvaluationReady();
    } catch (error) {
      progress.log(
        '⚠️ Page evaluation context not ready for scrollable elements test, continuing...'
      );
    }

    const scrollable = await page.evaluate((): ScrollableElementsResult => {
      const w = window as Window;
      const results: ScrollableElementsResult = { totalReturned: 0, elements: [] };
      const genFns = w as unknown as {
        getScrollableElements?: (n?: number) => HTMLElement[];
        canElementScroll?: (e: HTMLElement) => boolean;
      };
      const getElems = genFns.getScrollableElements;
      const canScrollFn = genFns.canElementScroll;
      if (!getElems) return results;
      const elems = getElems(10) || [];
      results.totalReturned = elems.length;
      for (let i = 0; i < elems.length; i++) {
        const el = elems[i];
        const canScroll = !!canScrollFn && !!canScrollFn(el);
        results.elements.push({
          index: i,
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          scrollHeight: el.scrollHeight || 0,
          clientHeight: el.clientHeight || 0,
          canScroll,
        });
      }
      return results;
    });
    details.scrollable = scrollable;
    testResults.push('Scrollable elements listing');

    // Optionally attempt XPath listing if function present
    if ((details.presence as StagehandPresenceResult).hasScrollableXpaths) {
      const scrollableXpaths = await page.evaluate(async (): Promise<string[]> => {
        const w = window as Window;
        return w.getScrollableElementXpaths(5);
      });
      details.scrollableXpaths = scrollableXpaths;
      if (scrollableXpaths.length > 0) testResults.push('Scrollable element XPaths');
    }

    // Test 4: waitForElementScrollEnd behavior (use window scrolling element)
    progress.log('Test 4: Trigger scroll and wait for scroll end');
    let scrollWait: ScrollWaitResult | null = null;
    if ((details.presence as StagehandPresenceResult).hasWaitForScrollEnd) {
      // Ensure page evaluation is ready before scroll wait test
      try {
        await page.waitForEvaluationReady();
      } catch (error) {
        progress.log('⚠️ Page evaluation context not ready for scroll wait test, continuing...');
      }

      scrollWait = await page.evaluate(async (): Promise<ScrollWaitResult | null> => {
        const w = window as Window;
        const el = document.scrollingElement as HTMLElement | null;
        if (!el) return null;
        const startTop = el.scrollTop;
        const start = performance.now();
        el.scrollTo({ top: 200, behavior: 'auto' });
        await w.waitForElementScrollEnd(el);
        const end = performance.now();
        return {
          scrolled: el.scrollTop !== startTop,
          finalScrollTop: el.scrollTop,
          durationMs: end - start,
        };
      });
      details.scrollWait = scrollWait;
      if (scrollWait && scrollWait.scrolled) testResults.push('waitForElementScrollEnd');
      else warnings.push('Scroll wait test did not register a scroll');
    }

    // Test 5: Shadow DOM backdoor (best-effort)
    progress.log('Test 5: Shadow DOM backdoor inspection');

    // Ensure page evaluation is ready before shadow DOM test
    try {
      await page.waitForEvaluationReady();
    } catch (error) {
      progress.log('⚠️ Page evaluation context not ready for shadow DOM test, continuing...');
    }

    const shadowInfo = await page.evaluate((): ShadowBackdoorResult => {
      const w = window as Window;
      const result: ShadowBackdoorResult = {
        attempted: false,
        hostFound: false,
        closedRootSupported: false,
      };
      const host = document.querySelector('#shadow-host');
      if (!host) return result;
      result.attempted = true;
      if (
        w.__stagehand__ &&
        typeof (w.__stagehand__ as { getClosedRoot?: unknown }).getClosedRoot === 'function'
      ) {
        result.closedRootSupported = true;
      }
      result.hostFound = true;
      return result;
    });
    details.shadowInfo = shadowInfo;
    testResults.push('Shadow DOM backdoor probe');

    // Summarize
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Stagehand MAIN world DOM utilities tests completed',
      details: {
        testsRun: testResults.length,
        testResults,
        warnings,
        presence,
        xpath: details.xpathResult,
        scrollable: details.scrollable,
        scrollableXpaths: details.scrollableXpaths,
        scrollWait,
        shadowInfo,
      },
    });
    progress.log('🎉 Stagehand MAIN world DOM utilities tests completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ Stagehand DOM utilities test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Stagehand MAIN world DOM utilities test failed',
      details: { error: errorMessage },
    });
    throw error;
  } finally {
    // Always dispose the browser window to prevent frame leakage
    if (browserWindow) {
      try {
        browserWindow.dispose();
        progress.log('🧹 Browser window disposed for cleanup');

        // Add a small delay to allow Chrome extension lifecycle to fully clean up
        // This prevents frame ID conflicts when tests run multiple times
        await new Promise(resolve => setTimeout(resolve, 200));
        progress.log('✅ Cleanup delay completed');
      } catch (disposeError) {
        progress.log(`⚠️ Error disposing browser window: ${disposeError}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience runners
// ---------------------------------------------------------------------------
export async function runLivePageDomMainTests(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  await testLivePageDomMain(progress, context);
}

// Quick smoke test returning boolean for integration checks
export async function quickStagehandPresenceTest(): Promise<boolean> {
  let browserWindow: BrowserWindow | undefined;
  try {
    browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();
    await page.goto('http://localhost:3005');
    await page.waitForLoadState();

    // Ensure page evaluation is ready before presence test
    try {
      await page.waitForEvaluationReady();
    } catch (error) {
      return false;
    }

    // Wait for Stagehand utilities with retry logic
    let presence: StagehandPresenceResult;
    let attempt = 0;
    const maxAttempts = 5; // Fewer attempts for quick test
    const retryDelay = 100; // ms

    do {
      attempt++;

      try {
        presence = await page.evaluate((attemptNum): StagehandPresenceResult => {
          const w = window as Window;
          const genFns = w as unknown as {
            generateXPathsForElement?: (el: Node) => Promise<string[]>;
            getScrollableElements?: (n?: number) => HTMLElement[];
            canElementScroll?: (e: HTMLElement) => boolean;
          };

          console.log(
            `[quickStagehandPresenceTest] attempt ${attemptNum}: injected=${!!w.__stagehandInjected} ######`
          );

          return {
            injected: !!w.__stagehandInjected,
            hasGenerate: typeof genFns.generateXPathsForElement === 'function',
            hasScrollableXpaths: typeof w.getScrollableElementXpaths === 'function',
            hasGetNodeFromXpath: typeof w.getNodeFromXpath === 'function',
            hasWaitForScrollEnd: typeof w.waitForElementScrollEnd === 'function',
            hasGetScrollableElements: typeof genFns.getScrollableElements === 'function',
            hasCanElementScroll: typeof genFns.canElementScroll === 'function',
            shadowBackdoor: !!w.__stagehand__,
          };
        }, attempt);
      } catch (error) {
        console.log(
          `[quickStagehandPresenceTest] presence check failed on attempt ${attempt}: ${error} ######`
        );
        // Set default failure state
        presence = {
          injected: false,
          hasGenerate: false,
          hasScrollableXpaths: false,
          hasGetNodeFromXpath: false,
          hasWaitForScrollEnd: false,
          hasGetScrollableElements: false,
          hasCanElementScroll: false,
          shadowBackdoor: false,
        };
      }

      if (presence.injected) {
        break;
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    } while (attempt < maxAttempts);

    return presence.injected && presence.hasGenerate;
  } catch (error) {
    console.warn('quickStagehandPresenceTest error:', error);
    return false;
  } finally {
    // Always dispose the browser window to prevent frame leakage
    if (browserWindow) {
      try {
        browserWindow.dispose();

        // Add a small delay to allow Chrome extension lifecycle to fully clean up
        // This prevents frame ID conflicts when tests run multiple times
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (disposeError) {
        console.warn('Error disposing browser window in quickStagehandPresenceTest:', disposeError);
      }
    }
  }
}
