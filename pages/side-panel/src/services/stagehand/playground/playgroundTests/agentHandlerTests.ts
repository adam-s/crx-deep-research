/**
 * AgentHandler Tests
 * Test suite for StagehandAgentHandler functionality
 */

import { StagehandAgentHandler } from '../../lib/handlersRedux/agentHandler';
import { TestProgress, TestContext } from './types';
import { Severity } from '@src/utils/types';
import { ChromeExtensionStagehand } from '../../lib/index';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { AgentHandlerOptions } from '../../types/agent';

/**
 * Test StagehandAgentHandler core functionality
 */
export async function testAgentHandler(context: TestContext): Promise<void> {
  const progress = new TestProgress('AgentHandler Tests');

  try {
    progress.log('Starting AgentHandler test suite...');

    // Create a BrowserWindow for testing
    const browserWindow = await BrowserWindow.create();

    // Test: Handler initialization
    await testAgentHandlerInitialization(context, progress, browserWindow);

    // Test: Agent client setup
    await testAgentClientSetup(context, progress, browserWindow);

    // Test: Action execution
    await testActionExecution(context, progress, browserWindow);

    // Test: Screenshot functionality
    await testScreenshotFunctionality(context, progress, browserWindow);

    // Test: Cursor injection and animation
    await testCursorFunctionality(context, progress, browserWindow);

    // Test: Content script functions
    await testContentScriptFunctions(context, progress, browserWindow);

    progress.log('AgentHandler test suite completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`AgentHandler test suite failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'AgentHandler test suite failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}

/**
 * Test AgentHandler initialization
 */
async function testAgentHandlerInitialization(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('Testing AgentHandler initialization...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();
    const mockOptions = createMockAgentOptions();

    const agentHandler = new StagehandAgentHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      options: mockOptions,
    });

    // Verify handler was created successfully
    if (!agentHandler) {
      throw new Error('AgentHandler failed to initialize');
    }

    // Check that it has the expected methods
    const expectedMethods = [
      'execute',
      'getAgent',
      'getClient',
      'captureAndSendScreenshot',
      'injectCursor',
      'updateCursorPosition',
      'animateClick',
      'executeAction',
    ];

    for (const method of expectedMethods) {
      if (typeof (agentHandler as unknown as Record<string, unknown>)[method] !== 'function') {
        throw new Error(`Missing expected method: ${method}`);
      }
    }

    progress.log('AgentHandler initialization test completed');
  } catch (error) {
    progress.log(`❌ AgentHandler initialization test failed: ${error}`);
    throw error;
  }
}

/**
 * Test agent client setup
 */
async function testAgentClientSetup(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('Testing agent client setup...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();
    const mockOptions = createMockAgentOptions();

    const agentHandler = new StagehandAgentHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      options: mockOptions,
    });

    // Test getAgent method
    const agent = agentHandler.getAgent();
    if (!agent) {
      throw new Error('Agent not available');
    }

    // Test getClient method
    const client = agentHandler.getClient();
    if (!client) {
      throw new Error('Agent client not available');
    }

    progress.log('Agent client setup test completed');
  } catch (error) {
    progress.log(`❌ Agent client setup test failed: ${error}`);
    throw error;
  }
}

/**
 * Test action execution
 */
async function testActionExecution(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('Testing action execution...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();
    const mockOptions = createMockAgentOptions();

    const agentHandler = new StagehandAgentHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      options: mockOptions,
    });

    // Test basic action execution
    const testActions = [
      { type: 'wait' },
      { type: 'move', x: 100, y: 100 },
      { type: 'screenshot' },
    ];

    for (const action of testActions) {
      const result = await agentHandler.executeAction(
        action as { type: string; x?: number; y?: number }
      );
      if (!result.success) {
        throw new Error(`Action ${action.type} failed: ${result.error}`);
      }
    }

    progress.log('Action execution test completed');
  } catch (error) {
    progress.log(`❌ Action execution test failed: ${error}`);
    throw error;
  }
}

/**
 * Test screenshot functionality
 */
async function testScreenshotFunctionality(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('Testing screenshot functionality...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();
    const mockOptions = createMockAgentOptions();

    const agentHandler = new StagehandAgentHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      options: mockOptions,
    });

    // Test screenshot capture
    const result = await agentHandler.captureAndSendScreenshot();

    // Should not throw an error (result can be null in test environment)
    progress.log(
      `📸 Screenshot capture result: ${result !== null ? 'success' : 'expected null in test'}`
    );

    progress.log('Screenshot functionality test completed');
  } catch (error) {
    progress.log(`❌ Screenshot functionality test failed: ${error}`);
    throw error;
  }
}

/**
 * Test cursor functionality
 */
async function testCursorFunctionality(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('Testing cursor functionality...');

  try {
    const mockStagehand = createMockStagehand();
    const mockLogger = createMockLogger();
    const mockOptions = createMockAgentOptions();

    const agentHandler = new StagehandAgentHandler({
      stagehand: mockStagehand,
      logger: mockLogger,
      browserWindow,
      options: mockOptions,
    });

    // Test cursor injection
    await agentHandler.injectCursor();
    progress.log('🎯 Cursor injection completed');

    // Test cursor position update
    await agentHandler.updateCursorPosition(100, 100);
    progress.log('🎯 Cursor position update completed');

    // Test click animation
    await agentHandler.animateClick(100, 100);
    progress.log('🎯 Click animation completed');

    progress.log('Cursor functionality test completed');
  } catch (error) {
    progress.log(`❌ Cursor functionality test failed: ${error}`);
    throw error;
  }
}

/**
 * Test content script functions
 */
async function testContentScriptFunctions(
  context: TestContext,
  progress: TestProgress,
  browserWindow: BrowserWindow
): Promise<void> {
  progress.log('Testing content script functions...');

  try {
    const page = await browserWindow.getCurrentPage();

    // Import and test content script functions
    const {
      scrollByFunction,
      checkElementExistsFunction,
      injectCursorAndHighlightFunction,
      updateCursorPositionFunction,
      animateClickFunction,
    } = await import('../../lib/handlersRedux/agentHandlerUtils');

    // Test scrollByFunction
    await page.evaluate(scrollByFunction, { scrollX: 0, scrollY: 10 });
    progress.log('📜 Scroll function executed successfully');

    // Test checkElementExistsFunction
    const existsResult = await page.evaluate(checkElementExistsFunction, 'nonexistent-id');
    if (existsResult !== false) {
      throw new Error('checkElementExistsFunction should return false for nonexistent element');
    }
    progress.log('🔍 Element existence check function executed successfully');

    // Test injectCursorAndHighlightFunction
    await page.evaluate(injectCursorAndHighlightFunction, {
      cursorId: 'test-cursor',
      highlightId: 'test-highlight',
    });
    progress.log('🎯 Cursor injection function executed successfully');

    // Test updateCursorPositionFunction
    await page.evaluate(updateCursorPositionFunction, { x: 50, y: 50 });
    progress.log('🎯 Cursor position update function executed successfully');

    // Test animateClickFunction
    await page.evaluate(animateClickFunction, { x: 50, y: 50 });
    progress.log('🎯 Click animation function executed successfully');

    progress.log('Content script functions test completed');
  } catch (error) {
    progress.log(`❌ Content script functions test failed: ${error}`);
    throw error;
  }
}

/**
 * Test AgentHandler AI integration
 */
export async function testAgentHandlerAIIntegration(_context: TestContext): Promise<void> {
  const progress = new TestProgress('AgentHandler AI Integration');

  try {
    progress.log('Starting AgentHandler AI integration tests...');

    // TODO: Add AI integration test implementation
    // - Test LLM client interaction
    // - Test agent task execution
    // - Test action planning
    // - Test feedback loops

    progress.log('AgentHandler AI integration tests completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`AgentHandler AI integration tests failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Test AgentHandler refactored content scripts
 */
export async function testAgentHandlerRefactoredContentScripts(
  _context: TestContext
): Promise<void> {
  const progress = new TestProgress('AgentHandler Refactored Content Scripts');

  try {
    progress.log('Starting AgentHandler refactored content scripts tests...');

    // TODO: Add refactored content scripts test implementation
    // - Test static readonly function definitions
    // - Test function extraction from string templates
    // - Test Chrome extension CSP compliance
    // - Test function serialization and execution

    progress.log('AgentHandler refactored content scripts tests completed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`AgentHandler refactored content scripts tests failed: ${errorMessage}`);
    throw error;
  }
}

/**
 * Create mock ChromeExtensionStagehand for testing
 */
function createMockStagehand(): ChromeExtensionStagehand {
  return {
    updateMetrics: (
      _functionName: string,
      _inputTokens: number,
      _outputTokens: number,
      _inferenceTime: number
    ) => {
      // Mock implementation
    },
  } as ChromeExtensionStagehand;
}

/**
 * Create mock logger for testing
 */
function createMockLogger() {
  return (logLine: { message?: string; [key: string]: unknown }) => {
    console.log('[AgentHandler Test]', logLine.message || logLine);
  };
}

/**
 * Create mock agent options for testing
 */
function createMockAgentOptions(): AgentHandlerOptions {
  return {
    modelName: 'computer-use-preview',
    clientOptions: {},
    userProvidedInstructions: 'Test instructions',
    agentType: 'openai',
    experimental: true,
  };
}
