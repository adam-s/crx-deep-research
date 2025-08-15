/**
 * Browser-Use Context functionality tests
 *
 * This file contains comprehensive tests for the BrowserContext class and related functionality
 * from the browser-use service, designed to run within the Chrome extension side panel playground.
 */

import { BrowserContext, BrowserSession, BrowserContextState } from '../../browser/context';
import { Severity } from '@src/utils/types';
import type { BrowserUsePlaygroundService } from '../browserUsePlaygroundService';
import { runSnapshotForAITest, TestProgress as SnapshotTestProgress } from './snapshotForAITest';

/**
 * Simple progress tracker for testing
 */
class TestProgress {
  constructor(private name: string) {}

  log(message: string): void {
    console.log(`[${this.name}] ${message}`);
  }
}

/**
 * Interface for test context to maintain consistency with other playground tests
 */
interface BrowserUseTestContext {
  events: {
    emit: (event: {
      timestamp: number;
      severity: Severity;
      message: string;
      details?: unknown;
      error?: Error;
    }) => void;
  };
  browserUseService: BrowserUsePlaygroundService;
}

/**
 * Test the _enhancedCssSelectorForElement static method
 */
export async function testEnhancedCssSelectorForElement(
  progress: TestProgress,
  context: BrowserUseTestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting _enhancedCssSelectorForElement tests',
    });

    // Test 1: Basic element with tag name only
    progress.log('Test 1: Basic element with tag name only');
    const basicElement = {
      xpath: '/html/body/div',
      tag_name: 'div',
    };

    const basicSelector = BrowserContext._enhancedCssSelectorForElement(basicElement);
    progress.log(`Basic selector result: "${basicSelector}"`);

    if (basicSelector.includes('div')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Basic element selector generation',
        details: { selector: basicSelector },
      });
    } else {
      throw new Error(`Test 1 failed: Expected selector to contain 'div', got: ${basicSelector}`);
    }

    // Test 2: Element with ID attribute
    progress.log('Test 2: Element with ID attribute');
    const elementWithId = {
      xpath: '/html/body/div[@id="test-element"]',
      tag_name: 'div',
      attributes: {
        id: 'test-element',
      },
    };

    const idSelector = BrowserContext._enhancedCssSelectorForElement(elementWithId);
    progress.log(`ID selector result: "${idSelector}"`);

    if (idSelector.includes('[id="test-element"]') || idSelector.includes('#test-element')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Element with ID selector generation',
        details: { selector: idSelector },
      });
    } else {
      throw new Error(`Test 2 failed: Expected selector to include ID, got: ${idSelector}`);
    }

    // Test 3: Element with class attributes
    progress.log('Test 3: Element with class attributes');
    const elementWithClasses = {
      xpath: '/html/body/div[@class="container primary-section"]',
      tag_name: 'div',
      attributes: {
        class: 'container primary-section',
      },
    };

    const classSelector = BrowserContext._enhancedCssSelectorForElement(elementWithClasses);
    progress.log(`Class selector result: "${classSelector}"`);

    if (classSelector.includes('.container') && classSelector.includes('.primary-section')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Element with classes selector generation',
        details: { selector: classSelector },
      });
    } else {
      throw new Error(`Test 3 failed: Expected selector to include classes, got: ${classSelector}`);
    }

    // Test 4: Element with data attributes
    progress.log('Test 4: Element with data attributes');
    const elementWithDataAttrs = {
      xpath: '/html/body/button[@data-testid="submit-btn"]',
      tag_name: 'button',
      attributes: {
        'data-testid': 'submit-btn',
        'data-qa': 'form-submit',
      },
    };

    const dataSelector = BrowserContext._enhancedCssSelectorForElement(elementWithDataAttrs);
    progress.log(`Data attributes selector result: "${dataSelector}"`);

    if (
      dataSelector.includes('[data-testid="submit-btn"]') &&
      dataSelector.includes('[data-qa="form-submit"]')
    ) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Element with data attributes selector generation',
        details: { selector: dataSelector },
      });
    } else {
      throw new Error(
        `Test 4 failed: Expected selector to include data attributes, got: ${dataSelector}`
      );
    }

    // Test 5: Element with aria attributes
    progress.log('Test 5: Element with ARIA attributes');
    const elementWithAria = {
      xpath: '/html/body/input[@aria-label="Search query"]',
      tag_name: 'input',
      attributes: {
        'aria-label': 'Search query',
        'aria-labelledby': 'search-label',
        role: 'searchbox',
      },
    };

    const ariaSelector = BrowserContext._enhancedCssSelectorForElement(elementWithAria);
    progress.log(`ARIA attributes selector result: "${ariaSelector}"`);

    if (
      ariaSelector.includes('[aria-label="Search query"]') &&
      ariaSelector.includes('[role="searchbox"]')
    ) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: Element with ARIA attributes selector generation',
        details: { selector: ariaSelector },
      });
    } else {
      throw new Error(
        `Test 5 failed: Expected selector to include ARIA attributes, got: ${ariaSelector}`
      );
    }

    // Test 6: Element with special characters in attributes
    progress.log('Test 6: Element with special characters in attributes');
    const elementWithSpecialChars = {
      xpath: '/html/body/div[@title="Test with quotes and <brackets>"]',
      tag_name: 'div',
      attributes: {
        title: 'Test with "quotes" and <brackets>',
        placeholder: 'Enter text here...',
      },
    };

    const specialCharsSelector =
      BrowserContext._enhancedCssSelectorForElement(elementWithSpecialChars);
    progress.log(`Special characters selector result: "${specialCharsSelector}"`);

    if (
      specialCharsSelector.includes('[title*=') &&
      specialCharsSelector.includes('[placeholder="Enter text here..."]')
    ) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 6 passed: Element with special characters selector generation',
        details: { selector: specialCharsSelector },
      });
    } else {
      throw new Error(
        `Test 6 failed: Expected selector to handle special characters, got: ${specialCharsSelector}`
      );
    }

    // Test 7: Element with highlight_index fallback
    progress.log('Test 7: Element with highlight_index fallback');
    const elementWithHighlightIndex = {
      xpath: '/html/body/custom-element',
      tag_name: 'span',
      highlight_index: 42,
      attributes: {
        'invalid-attr!': 'bad-value',
      },
    };

    const fallbackSelector =
      BrowserContext._enhancedCssSelectorForElement(elementWithHighlightIndex);
    progress.log(`Fallback selector result: "${fallbackSelector}"`);

    // The method should handle the xpath conversion and use tag_name as fallback for element type
    // Even with an unusual xpath, it should still produce a valid CSS selector
    if (fallbackSelector.includes('custom-element') || fallbackSelector.includes('span')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 7 passed: Fallback selector generation works',
        details: { selector: fallbackSelector },
      });
    } else {
      throw new Error(
        `Test 7 failed: Expected selector to include custom-element or span, got: ${fallbackSelector}`
      );
    }

    // Test 8: Test with includeDynamicAttributes = false
    progress.log('Test 8: Element without dynamic attributes');
    const elementForNoDynamic = {
      xpath: '/html/body/div',
      tag_name: 'div',
      attributes: {
        id: 'static-element',
        'data-testid': 'should-be-excluded',
        class: 'static-class',
      },
    };

    const noDynamicSelector = BrowserContext._enhancedCssSelectorForElement(
      elementForNoDynamic,
      false
    );
    progress.log(`No dynamic attributes selector result: "${noDynamicSelector}"`);

    if (
      noDynamicSelector.includes('[id="static-element"]') &&
      !noDynamicSelector.includes('data-testid')
    ) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 8 passed: Dynamic attributes exclusion works',
        details: { selector: noDynamicSelector },
      });
    } else {
      throw new Error(
        `Test 8 failed: Expected to exclude dynamic attributes, got: ${noDynamicSelector}`
      );
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All _enhancedCssSelectorForElement tests completed successfully',
      details: {
        testsCompleted: 8,
        categories: [
          'Basic element',
          'ID attributes',
          'Class attributes',
          'Data attributes',
          'ARIA attributes',
          'Special characters',
          'Fallback handling',
          'Dynamic attributes exclusion',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`_enhancedCssSelectorForElement test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '_enhancedCssSelectorForElement tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Test the BrowserSession class functionality
 */
export async function testBrowserSession(
  progress: TestProgress,
  context: BrowserUseTestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting BrowserSession tests',
    });

    // Test 1: Create new session with default ID
    progress.log('Test 1: Creating new BrowserSession with default ID');
    const session1 = new BrowserSession();

    if (session1.id && session1.startTime && session1.state === BrowserContextState.CREATED) {
      progress.log(`Session created with ID: ${session1.id}, state: ${session1.state}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: BrowserSession creation with default ID',
        details: { sessionId: session1.id, state: session1.state },
      });
    } else {
      throw new Error('Test 1 failed: Session not properly initialized');
    }

    // Test 2: Create session with custom ID
    progress.log('Test 2: Creating new BrowserSession with custom ID');
    const customId = 'test-session-123';
    const session2 = new BrowserSession(customId);

    if (session2.id === customId && session2.state === BrowserContextState.CREATED) {
      progress.log(`Session created with custom ID: ${session2.id}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: BrowserSession creation with custom ID',
        details: { sessionId: session2.id },
      });
    } else {
      throw new Error(`Test 2 failed: Expected ID ${customId}, got ${session2.id}`);
    }

    // Test 3: End session functionality
    progress.log('Test 3: Testing session end functionality');
    const beforeEnd = session1.endTime;
    const beforeState: BrowserContextState = session1.state;
    session1.end();
    const afterEnd = session1.endTime;
    const afterState: BrowserContextState = session1.state;

    if (
      beforeEnd === null &&
      afterEnd !== null &&
      (beforeState as BrowserContextState) === BrowserContextState.CREATED &&
      (afterState as BrowserContextState) === BrowserContextState.CLOSED
    ) {
      progress.log(`Session ended successfully. End time: ${afterEnd}`);
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Session end functionality works',
        details: { endTime: afterEnd, state: afterState },
      });
    } else {
      throw new Error(
        `Test 3 failed: Session end not working properly. Before: ${beforeState}, After: ${afterState}`
      );
    }

    // Test 4: Session toDict functionality
    progress.log('Test 4: Testing session toDict functionality');
    const sessionDict = session1.toDict();

    if (
      sessionDict.id === session1.id &&
      sessionDict.startTime &&
      sessionDict.endTime &&
      sessionDict.state === BrowserContextState.CLOSED
    ) {
      progress.log('Session toDict() method works correctly');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Session toDict functionality works',
        details: { sessionDict },
      });
    } else {
      throw new Error('Test 4 failed: toDict() not working properly');
    }

    // Test 5: Test cached state functionality
    progress.log('Test 5: Testing cached state functionality');
    const session3 = new BrowserSession('cached-test');

    if (session3.cachedState === null) {
      progress.log('Initial cached state is null as expected');
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: Cached state initialization works',
        details: { cachedState: session3.cachedState },
      });
    } else {
      throw new Error('Test 5 failed: Initial cached state should be null');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All BrowserSession tests completed successfully',
      details: {
        testsCompleted: 5,
        categories: [
          'Default ID creation',
          'Custom ID creation',
          'Session end functionality',
          'toDict serialization',
          'Cached state initialization',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`BrowserSession test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'BrowserSession tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Test the XPath to CSS selector conversion functionality
 */
export async function testXPathToCssConversion(
  progress: TestProgress,
  context: BrowserUseTestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting XPath to CSS conversion tests',
    });

    // Note: The _convertSimpleXpathToCssSelector is private, so we test it indirectly
    // through _enhancedCssSelectorForElement

    // Test 1: Simple path conversion
    progress.log('Test 1: Simple XPath to CSS conversion');
    const simpleElement = {
      xpath: '/html/body/div/span',
      tag_name: 'span',
    };

    const simpleResult = BrowserContext._enhancedCssSelectorForElement(simpleElement);
    progress.log(`Simple XPath conversion result: "${simpleResult}"`);

    if (simpleResult.includes('span')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: Simple XPath conversion works',
        details: { selector: simpleResult },
      });
    } else {
      throw new Error(`Test 1 failed: Expected span in selector, got: ${simpleResult}`);
    }

    // Test 2: XPath with custom elements (containing colons)
    progress.log('Test 2: XPath with custom elements containing colons');
    const customElement = {
      xpath: '/html/body/custom:element/my:component',
      tag_name: 'my:component',
    };

    const customResult = BrowserContext._enhancedCssSelectorForElement(customElement);
    progress.log(`Custom element XPath conversion result: "${customResult}"`);

    // Should handle colon escaping
    if (customResult.includes('my') || customResult.includes('component')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Custom element XPath conversion works',
        details: { selector: customResult },
      });
    } else {
      throw new Error(`Test 2 failed: Expected custom element handling, got: ${customResult}`);
    }

    // Test 3: Empty or undefined XPath
    progress.log('Test 3: Empty or undefined XPath handling');
    const emptyXPathElement = {
      xpath: '',
      tag_name: 'div',
    };

    const emptyResult = BrowserContext._enhancedCssSelectorForElement(emptyXPathElement);
    progress.log(`Empty XPath conversion result: "${emptyResult}"`);

    if (emptyResult.includes('div')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Empty XPath handling works',
        details: { selector: emptyResult },
      });
    } else {
      throw new Error(`Test 3 failed: Expected div fallback, got: ${emptyResult}`);
    }

    // Test 4: XPath with indices
    progress.log('Test 4: XPath with index notation');
    const indexedElement = {
      xpath: '/html/body/div[1]/span[2]',
      tag_name: 'span',
    };

    const indexedResult = BrowserContext._enhancedCssSelectorForElement(indexedElement);
    progress.log(`Indexed XPath conversion result: "${indexedResult}"`);

    if (indexedResult.includes('span')) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Indexed XPath conversion works',
        details: { selector: indexedResult },
      });
    } else {
      throw new Error(`Test 4 failed: Expected span in indexed selector, got: ${indexedResult}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All XPath to CSS conversion tests completed successfully',
      details: {
        testsCompleted: 4,
        categories: [
          'Simple path conversion',
          'Custom elements with colons',
          'Empty XPath handling',
          'Index notation handling',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`XPath to CSS conversion test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'XPath to CSS conversion tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Test the BrowserContext lifecycle methods (enter, getCurrentPage, close)
 */
export async function testBrowserContextLifecycle(
  progress: TestProgress,
  context: BrowserUseTestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting BrowserContext lifecycle tests',
    });

    // Mock BrowserWindow for testing - we'll test the interface, not the actual browser integration
    const mockPage = { tabId: 1, url: () => 'https://example.com' };
    const mockBrowserWindow = {
      windowId: 123,
      pages: () => [mockPage],
      getCurrentPage: async () => mockPage,
    } as unknown as import('@src/services/cordyceps/browserWindow').BrowserWindow;

    // Test 1: BrowserContext construction
    progress.log('Test 1: BrowserContext construction');
    const browserContext = new BrowserContext(mockBrowserWindow);

    if (
      browserContext.browserWindow &&
      browserContext.pages.length === 0 &&
      browserContext.session.state === BrowserContextState.CREATED
    ) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: BrowserContext construction works',
        details: {
          sessionState: browserContext.session.state,
          pagesCount: browserContext.pages.length,
        },
      });
    } else {
      throw new Error('Test 1 failed: BrowserContext not properly constructed');
    }

    // Test 2: Session state management
    progress.log('Test 2: Session state transitions');
    const initialState = browserContext.session.state;

    if (initialState === BrowserContextState.CREATED) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 2 passed: Initial session state is CREATED',
        details: { initialState },
      });
    } else {
      throw new Error(`Test 2 failed: Expected CREATED state, got ${initialState}`);
    }

    // Test 3: Session ID generation
    progress.log('Test 3: Session ID generation');
    const sessionId = browserContext.session.id;

    if (sessionId && typeof sessionId === 'string' && sessionId.length > 0) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Session ID generated properly',
        details: { sessionId },
      });
    } else {
      throw new Error('Test 3 failed: Session ID not generated properly');
    }

    // Test 4: Session timestamps
    progress.log('Test 4: Session timestamp validation');
    const startTime = browserContext.session.startTime;
    const endTime = browserContext.session.endTime;

    if (startTime instanceof Date && endTime === null) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 4 passed: Session timestamps are correct',
        details: { startTime, endTime },
      });
    } else {
      throw new Error('Test 4 failed: Session timestamps not properly initialized');
    }

    // Test 5: Context and session references
    progress.log('Test 5: Context and session reference validation');
    if (browserContext.session.context === null && browserContext.session.cachedState === null) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 5 passed: Session references initialized correctly',
        details: {
          contextRef: browserContext.session.context,
          cachedState: browserContext.session.cachedState,
        },
      });
    } else {
      throw new Error('Test 5 failed: Session references not properly initialized');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All BrowserContext lifecycle tests completed successfully',
      details: {
        testsCompleted: 5,
        categories: [
          'BrowserContext construction',
          'Session state management',
          'Session ID generation',
          'Session timestamp validation',
          'Context and session references',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`BrowserContext lifecycle test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'BrowserContext lifecycle tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Test the BrowserContext state management
 */
export async function testBrowserContextState(
  progress: TestProgress,
  context: BrowserUseTestContext
): Promise<void> {
  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting BrowserContext state management tests',
    });

    // Test 1: BrowserContextState enum values
    progress.log('Test 1: BrowserContextState enum validation');
    const expectedStates = {
      CREATED: 'created',
      ACTIVE: 'active',
      CLOSED: 'closed',
    };

    let allStatesValid = true;
    for (const [key, expectedValue] of Object.entries(expectedStates)) {
      const actualValue = BrowserContextState[key as keyof typeof BrowserContextState];
      if (actualValue !== expectedValue) {
        allStatesValid = false;
        throw new Error(`State ${key} has value ${actualValue}, expected ${expectedValue}`);
      }
    }

    if (allStatesValid) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 1 passed: BrowserContextState enum values are correct',
        details: { states: expectedStates },
      });
    }

    // Test 2: Session state transitions
    progress.log('Test 2: Session state transitions');
    const session = new BrowserSession('state-test');

    // Check initial state
    if (session.state !== BrowserContextState.CREATED) {
      throw new Error(`Expected initial state CREATED, got ${session.state}`);
    }

    // Test end transition
    session.end();
    if ((session.state as BrowserContextState) !== BrowserContextState.CLOSED) {
      throw new Error(`Expected state CLOSED after end(), got ${session.state}`);
    }

    // Check end time is set
    if (!session.endTime || !(session.endTime instanceof Date)) {
      throw new Error('End time not properly set after end()');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Test 2 passed: Session state transitions work correctly',
      details: {
        finalState: session.state,
        endTime: session.endTime,
      },
    });

    // Test 3: Session serialization
    progress.log('Test 3: Session serialization validation');
    const sessionDict = session.toDict();

    const requiredFields = ['id', 'startTime', 'endTime', 'state', 'cachedState'];
    for (const field of requiredFields) {
      if (!(field in sessionDict)) {
        throw new Error(`Missing field ${field} in session dictionary`);
      }
    }

    if (
      sessionDict.state === BrowserContextState.CLOSED &&
      sessionDict.endTime !== null &&
      sessionDict.cachedState === null
    ) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: 'Test 3 passed: Session serialization works correctly',
        details: { sessionDict },
      });
    } else {
      throw new Error('Session serialization produced incorrect values');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All BrowserContext state management tests completed successfully',
      details: {
        testsCompleted: 3,
        categories: [
          'BrowserContextState enum validation',
          'Session state transitions',
          'Session serialization validation',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`BrowserContext state management test failed: ${errorMessage}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'BrowserContext state management tests failed',
      details: { error: errorMessage },
    });
    throw error;
  }
}

/**
 * Comprehensive test runner for all browser-use context functionality
 */
export async function runBrowserUseContextTests(
  _service?: BrowserUsePlaygroundService
): Promise<void> {
  const progress = new TestProgress('Browser-Use Context Tests');
  const context: BrowserUseTestContext = {
    events: {
      emit: event => {
        console.log(
          `[${new Date(event.timestamp).toISOString()}] ${event.severity}: ${event.message}`
        );
        if (event.details) {
          console.log('Details:', event.details);
        }
        if (event.error) {
          console.error('Error:', event.error);
        }
      },
    },
    browserUseService: _service as BrowserUsePlaygroundService,
  };

  try {
    progress.log('🚀 Starting comprehensive browser-use context tests...');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Starting browser-use context test suite',
    });

    // Run all test suites
    await testEnhancedCssSelectorForElement(progress, context);
    await testBrowserSession(progress, context);
    await testXPathToCssConversion(progress, context);
    await testBrowserContextLifecycle(progress, context);
    await testBrowserContextState(progress, context);

    // Run snapshotForAI tests
    progress.log('🔍 Running snapshotForAI tests...');
    const snapshotProgress = new SnapshotTestProgress('snapshotForAI Test');
    await runSnapshotForAITest(snapshotProgress, context.browserUseService);
    progress.log('✅ snapshotForAI tests completed');

    progress.log('✅ All browser-use context tests completed successfully!');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'All browser-use context tests completed successfully',
      details: {
        totalTestSuites: 6,
        testSuites: [
          'Enhanced CSS Selector Generation',
          'Browser Session Management',
          'XPath to CSS Conversion',
          'Browser Context Lifecycle',
          'Browser Context State Management',
          'SnapshotForAI Method',
        ],
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ Browser-use context tests failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Browser-use context tests failed',
      error: error instanceof Error ? error : new Error(String(error)),
    });

    throw error;
  }
}

/**
 * Quick test runner for UI integration
 */
export async function quickBrowserUseContextTest(): Promise<boolean> {
  try {
    console.log('⚡ Quick browser-use context test...');

    // Test just the CSS selector functionality as a smoke test
    const testElement = {
      xpath: '/html/body/div',
      tag_name: 'div',
      attributes: {
        id: 'quick-test',
        class: 'test-element',
      },
    };

    const selector = BrowserContext._enhancedCssSelectorForElement(testElement);

    if (selector.includes('div') && selector.includes('quick-test')) {
      console.log(`✅ Quick test passed - Generated selector: ${selector}`);
      return true;
    } else {
      console.error(`❌ Quick test failed - Unexpected selector: ${selector}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Quick test failed:', error);
    return false;
  }
}
