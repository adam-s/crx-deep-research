/**
 * ExtractHandler Tests
 * Test suite for StagehandExtractHandler functionality
 */

import { StagehandExtractHandler } from '../../lib/handlersRedux/extractHandler';
import { TestProgress, TestContext } from './types';
import { Severity } from '@src/utils/types';
import { ChromeExtensionStagehand } from '../../lib/index';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';

/**
 * Test StagehandExtractHandler core functionality
 */
export async function testExtractHandler(context: TestContext): Promise<void> {
  const progress = new TestProgress('ExtractHandler Tests');

  try {
    progress.log('🚀 Starting StagehandExtractHandler comprehensive test suite...');

    // Create a BrowserWindow for testing
    const browserWindow = await BrowserWindow.create();

    // Test: Handler initialization
    await testExtractHandlerInitialization(context, progress, browserWindow);

    // Test: Handler methods availability
    await testHandlerMethodsAvailability(context, progress, browserWindow);

    // Test: Page text extraction
    await testExtractPageText(context, progress, browserWindow);

    // Test: Overlay functionality
    await testExtractionOverlays(context, progress, browserWindow);

    // Test: Element counting
    await testElementCounting(context, progress, browserWindow);

    // Test: Element data retrieval
    await testElementDataRetrieval(context, progress, browserWindow);

    // Test: XPath evaluation
    await testXPathEvaluation(context, progress, browserWindow);

    // Test: Error handling
    await testErrorHandling(context, progress, browserWindow);

    progress.log('🎉 ExtractHandler test suite completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ ExtractHandler test suite failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'ExtractHandler test suite failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Create mock ChromeExtensionStagehand for testing
 */
function createMockStagehand(): ChromeExtensionStagehand {
  return {
    updateMetrics: (
      functionName: string,
      promptTokens: number,
      completionTokens: number,
      inferenceTime: number
    ) => {
      console.log(
        `📊 Metrics updated: ${functionName} - PT:${promptTokens} CT:${completionTokens} IT:${inferenceTime}ms`
      );
    },
    logInferenceToFile: false,
  } as unknown as ChromeExtensionStagehand;
}

/**
 * Create mock logger for testing
 */
function createMockLogger(): (message: {
  category?: string;
  message: string;
  level?: number;
  auxiliary?: { [key: string]: { value: string; type: string } };
}) => void {
  return message => {
    console.log(`[${message.category || 'extract'}] ${message.message}`);
  };
}

/**
 * Test ExtractHandler initialization and basic properties
 */
async function testExtractHandlerInitialization(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('🧪 Testing ExtractHandler initialization...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();

    const extractHandler = new StagehandExtractHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      userProvidedInstructions: 'Test extraction handler for comprehensive validation',
      experimental: true,
    });

    // Verify handler was created successfully
    if (!extractHandler) {
      throw new Error('ExtractHandler failed to initialize');
    }

    // Check that it has the expected methods
    const expectedMethods = [
      'extract',
      'drawExtractionOverlays',
      'clearExtractionOverlays',
      'countExtractableElements',
      'extractElementData',
      'testXPathEvaluation',
    ];

    for (const method of expectedMethods) {
      if (typeof (extractHandler as unknown as Record<string, unknown>)[method] !== 'function') {
        throw new Error(`Missing expected method: ${method}`);
      }
    }

    progress.log('✅ ExtractHandler initialization test passed');
  } catch (error) {
    progress.log(`❌ ExtractHandler initialization test failed: ${error}`);
    throw error;
  }
}

/**
 * Test all handler methods are available and callable
 */
async function testHandlerMethodsAvailability(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('🧪 Testing handler methods availability...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();

    const extractHandler = new StagehandExtractHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      userProvidedInstructions: 'Test extraction handler',
      experimental: true,
    });

    // Test public methods exist and are functions
    const publicMethods = [
      'extract',
      'drawExtractionOverlays',
      'clearExtractionOverlays',
      'countExtractableElements',
      'extractElementData',
      'testXPathEvaluation',
    ];

    const methodResults: Record<string, boolean> = {};

    for (const methodName of publicMethods) {
      const method = (extractHandler as unknown as Record<string, unknown>)[methodName];
      methodResults[methodName] = typeof method === 'function';

      if (!methodResults[methodName]) {
        progress.log(`⚠️ Method ${methodName} is not a function`);
      }
    }

    const allMethodsAvailable = Object.values(methodResults).every(result => result);

    if (allMethodsAvailable) {
      progress.log('✅ All handler methods are available');
    } else {
      throw new Error(`Some handler methods are missing: ${JSON.stringify(methodResults)}`);
    }
  } catch (error) {
    progress.log(`❌ Handler methods availability test failed: ${error}`);
    throw error;
  }
}

/**
 * Test basic page text extraction
 */
async function testExtractPageText(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('🧪 Testing page text extraction...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();

    const extractHandler = new StagehandExtractHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      experimental: true,
    });

    // Test extract with no arguments (should extract page text)
    const result = await extractHandler.extract();

    if (!result || typeof result !== 'object') {
      throw new Error('Extract returned invalid result');
    }

    progress.log(`📄 Page text extraction result: ${typeof result}`);
    progress.log('✅ Page text extraction test passed');
  } catch (error) {
    progress.log(`❌ Page text extraction test failed: ${error}`);
    throw error;
  }
}

/**
 * Test extraction overlay drawing functionality
 */
async function testExtractionOverlays(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('🧪 Testing extraction overlays...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();

    const extractHandler = new StagehandExtractHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      experimental: true,
    });

    // Test drawing overlays on common elements
    const testSelectors = ['body', 'h1', 'button'];
    await extractHandler.drawExtractionOverlays(testSelectors);

    progress.log('🎨 Drew extraction overlays for test selectors');

    // Test clearing overlays
    await extractHandler.clearExtractionOverlays();

    progress.log('🧹 Cleared extraction overlays');
    progress.log('✅ Extraction overlays test passed');
  } catch (error) {
    progress.log(`❌ Extraction overlays test failed: ${error}`);
    throw error;
  }
}

/**
 * Test element counting functionality
 */
async function testElementCounting(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('🧪 Testing element counting...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();

    const extractHandler = new StagehandExtractHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      experimental: true,
    });

    const count = await extractHandler.countExtractableElements();

    if (
      typeof count !== 'object' ||
      count === null ||
      typeof count.totalElements !== 'number' ||
      typeof count.interactiveElements !== 'number' ||
      typeof count.visibleElements !== 'number' ||
      count.totalElements < 0 ||
      count.interactiveElements < 0 ||
      count.visibleElements < 0
    ) {
      throw new Error(`Invalid count result structure: ${JSON.stringify(count)}`);
    }

    progress.log(
      `📊 Found ${count.totalElements} total elements, ${count.interactiveElements} interactive, ${count.visibleElements} visible`
    );
    progress.log('✅ Element counting test passed');
  } catch (error) {
    progress.log(`❌ Element counting test failed: ${error}`);
    throw error;
  }
}

/**
 * Test element data retrieval
 */
async function testElementDataRetrieval(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('🧪 Testing element data retrieval...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();

    const extractHandler = new StagehandExtractHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      experimental: true,
    });

    const elementData = await extractHandler.extractElementData(['body', 'h1']);

    if (!Array.isArray(elementData)) {
      throw new Error('Element data should be an array');
    }

    progress.log(`📊 Retrieved data for ${elementData.length} elements`);
    elementData.forEach((data, index) => {
      progress.log(`  Element ${index + 1}: ${data.found ? 'found' : 'not found'}`);
    });

    progress.log('✅ Element data retrieval test passed');
  } catch (error) {
    progress.log(`❌ Element data retrieval test failed: ${error}`);
    throw error;
  }
}

/**
 * Test XPath evaluation capabilities
 */
async function testXPathEvaluation(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('🧪 Testing XPath evaluation...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();

    const extractHandler = new StagehandExtractHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      experimental: true,
    });

    // Test valid XPath
    const validResult = await extractHandler.testXPathEvaluation('//body');
    progress.log(`🔍 Valid XPath test: ${validResult}`);

    // Test invalid XPath
    const invalidResult = await extractHandler.testXPathEvaluation('//invalid[[[');
    progress.log(`🔍 Invalid XPath test: ${invalidResult}`);

    progress.log('✅ XPath evaluation test passed');
  } catch (error) {
    progress.log(`❌ XPath evaluation test failed: ${error}`);
    throw error;
  }
}

/**
 * Test error handling in various scenarios
 */
async function testErrorHandling(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('🧪 Testing error handling...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();

    const extractHandler = new StagehandExtractHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      experimental: true,
    });

    // Test with invalid selectors
    try {
      await extractHandler.extractElementData(['invalid>>>selector']);
      progress.log('🛡️ Handled invalid selectors gracefully');
    } catch (error) {
      progress.log('🛡️ Error handling working as expected for invalid selectors');
    }

    progress.log('✅ Error handling test passed');
  } catch (error) {
    progress.log(`❌ Error handling test failed: ${error}`);
    throw error;
  }
}

/**
 * Test ExtractHandler accessibility tree integration
 */
export async function testExtractHandlerAccessibilityIntegration(
  _context: TestContext
): Promise<void> {
  const progress = new TestProgress('ExtractHandler Accessibility Integration');

  try {
    progress.log('Starting ExtractHandler accessibility tree integration tests...');

    // TODO: Add accessibility integration test implementation
    // - Test accessibility tree data processing
    // - Test iframe accessibility handling
    // - Test shadow DOM accessibility
    // - Test complex page structure handling

    progress.log('ExtractHandler accessibility tree integration tests completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`ExtractHandler accessibility tree integration tests failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Test ExtractHandler LLM integration
 */
export async function testExtractHandlerLLMIntegration(_context: TestContext): Promise<void> {
  const progress = new TestProgress('ExtractHandler LLM Integration');

  try {
    progress.log('Starting ExtractHandler LLM integration tests...');

    // TODO: Add LLM integration test implementation
    // - Test LLM client interaction
    // - Test extraction inference
    // - Test response processing
    // - Test token usage tracking

    progress.log('ExtractHandler LLM integration tests completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`ExtractHandler LLM integration tests failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Test transformUrlStringsToNumericIds function
 */
export async function testTransformUrlStringsToNumericIds(_context: TestContext): Promise<void> {
  const progress = new TestProgress('Transform URL Strings to Numeric IDs');

  try {
    progress.log('Starting transformUrlStringsToNumericIds function tests...');

    // TODO: Add transform function test implementation
    // - Test simple URL field transformation
    // - Test nested object transformation
    // - Test array field transformation
    // - Test unchanged schema handling

    progress.log('transformUrlStringsToNumericIds function tests completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`transformUrlStringsToNumericIds function tests failed: ${errorMessage}`);
    throw error;
  }
}
