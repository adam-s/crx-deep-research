/**
 * Prompt building utilities tests for Chrome extension compatible Stagehand
 */

import {
  buildUserInstructionsString,
  buildExtractSystemPrompt,
  buildExtractUserPrompt,
  buildMetadataSystemPrompt,
  buildMetadataPrompt,
  buildObserveSystemPrompt,
  buildObserveUserMessage,
  buildActObservePrompt,
  buildOperatorSystemPrompt,
} from '../../lib/prompt';
import { ChatMessageImageContent, ChatMessageTextContent } from '../../lib/llm/LLMClient';
import { Severity } from '@src/utils/types';
import { TestProgress, TestContext } from './types';

/**
 * Test prompt building utilities comprehensively
 */
export async function testPromptBuildingUtilities(
  progress: TestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('🧪 Testing prompt building utilities...');
  let allTestsPassed = true;

  try {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🔍 Testing prompt building functions...',
    });

    const testResults = {
      userInstructionsTests: await testUserInstructionsBuilding(),
      extractPromptTests: await testExtractPromptBuilding(),
      metadataPromptTests: await testMetadataPromptBuilding(),
      observePromptTests: await testObservePromptBuilding(),
      actObservePromptTests: await testActObservePromptBuilding(),
      operatorPromptTests: await testOperatorPromptBuilding(),
    };

    allTestsPassed = Object.values(testResults).every(result => result.success);

    if (allTestsPassed) {
      context.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ Prompt building utilities tests completed successfully',
        details: {
          hasPromptBuilders: true,
          testsRun: 6,
          category: 'prompt-building',
          results: testResults,
        },
      });
    } else {
      throw new Error('Some prompt building tests failed');
    }
  } catch (error) {
    allTestsPassed = false;
    const errorMessage = error instanceof Error ? error.message : String(error);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ Prompt building tests failed: ${errorMessage}`,
      details: { error: errorMessage },
    });

    progress.log(`❌ Error: ${errorMessage}`);
  }

  return allTestsPassed;
}

/**
 * Helper function to safely check content includes
 */
function contentIncludes(
  content: string | (ChatMessageImageContent | ChatMessageTextContent)[],
  searchText: string
): boolean {
  if (typeof content === 'string') {
    return content.includes(searchText);
  }
  // For array content, check text content in each item
  return content.some(item => {
    if ('text' in item) {
      return item.text?.includes(searchText) || false;
    }
    return false;
  });
}

/**
 * Test user instructions string building
 */
async function testUserInstructionsBuilding(): Promise<{ success: boolean; details: string }> {
  try {
    // Test with no instructions
    const emptyResult = buildUserInstructionsString();
    if (emptyResult !== '') {
      throw new Error('Expected empty string for no instructions');
    }

    // Test with undefined instructions
    const undefinedResult = buildUserInstructionsString(undefined);
    if (undefinedResult !== '') {
      throw new Error('Expected empty string for undefined instructions');
    }

    // Test with actual instructions
    const testInstructions = 'Click the submit button carefully';
    const result = buildUserInstructionsString(testInstructions);

    if (!result.includes('Custom Instructions Provided by the User')) {
      throw new Error('Missing header in user instructions');
    }

    if (!result.includes(testInstructions)) {
      throw new Error('Instructions not included in output');
    }

    return {
      success: true,
      details: 'User instructions building works correctly',
    };
  } catch (error) {
    return {
      success: false,
      details: `User instructions test failed: ${error}`,
    };
  }
}

/**
 * Test extract prompt building
 */
async function testExtractPromptBuilding(): Promise<{ success: boolean; details: string }> {
  try {
    // Test system prompt without tool
    const systemPrompt = buildExtractSystemPrompt(false, 'Be careful with data');

    if (systemPrompt.role !== 'system') {
      throw new Error('System prompt should have role "system"');
    }

    if (!contentIncludes(systemPrompt.content, 'extracting content')) {
      throw new Error('System prompt missing extraction context');
    }

    // Test system prompt with tool
    const systemPromptWithTool = buildExtractSystemPrompt(true);

    if (!contentIncludes(systemPromptWithTool.content, 'print_extracted_data tool')) {
      throw new Error('System prompt missing tool instructions');
    }

    // Test user prompt without tool
    const userPrompt = buildExtractUserPrompt(
      'Extract all product names',
      '<div>Product 1</div><div>Product 2</div>',
      false
    );

    if (userPrompt.role !== 'user') {
      throw new Error('User prompt should have role "user"');
    }

    if (!contentIncludes(userPrompt.content, 'Extract all product names')) {
      throw new Error('User prompt missing instruction');
    }

    if (!contentIncludes(userPrompt.content, '<div>Product 1</div>')) {
      throw new Error('User prompt missing DOM elements');
    }

    // Test user prompt with tool
    const userPromptWithTool = buildExtractUserPrompt('Extract data', '<span>Test</span>', true);

    if (!contentIncludes(userPromptWithTool.content, 'print_extracted_data tool')) {
      throw new Error('User prompt missing tool instructions');
    }

    return {
      success: true,
      details: 'Extract prompt building works correctly',
    };
  } catch (error) {
    return {
      success: false,
      details: `Extract prompt test failed: ${error}`,
    };
  }
}

/**
 * Test metadata prompt building
 */
async function testMetadataPromptBuilding(): Promise<{ success: boolean; details: string }> {
  try {
    // Test metadata system prompt
    const systemPrompt = buildMetadataSystemPrompt();

    if (systemPrompt.role !== 'system') {
      throw new Error('Metadata system prompt should have role "system"');
    }

    if (!contentIncludes(systemPrompt.content, 'extraction task')) {
      throw new Error('Metadata system prompt missing task description');
    }

    if (!contentIncludes(systemPrompt.content, 'completion status')) {
      throw new Error('Metadata system prompt missing completion criteria');
    }

    // Test metadata user prompt
    const testData = { products: ['Item 1', 'Item 2'] };
    const userPrompt = buildMetadataPrompt('Find all products', testData, 2, 5);

    if (userPrompt.role !== 'user') {
      throw new Error('Metadata user prompt should have role "user"');
    }

    if (!contentIncludes(userPrompt.content, 'Find all products')) {
      throw new Error('Metadata prompt missing instruction');
    }

    if (!contentIncludes(userPrompt.content, 'chunksSeen: 2')) {
      throw new Error('Metadata prompt missing chunks seen');
    }

    if (!contentIncludes(userPrompt.content, 'chunksTotal: 5')) {
      throw new Error('Metadata prompt missing chunks total');
    }

    if (!contentIncludes(userPrompt.content, '"products"')) {
      throw new Error('Metadata prompt missing extracted content');
    }

    return {
      success: true,
      details: 'Metadata prompt building works correctly',
    };
  } catch (error) {
    return {
      success: false,
      details: `Metadata prompt test failed: ${error}`,
    };
  }
}

/**
 * Test observe prompt building
 */
async function testObservePromptBuilding(): Promise<{ success: boolean; details: string }> {
  try {
    // Test observe system prompt without user instructions
    const systemPrompt = buildObserveSystemPrompt();

    if (systemPrompt.role !== 'system') {
      throw new Error('Observe system prompt should have role "system"');
    }

    if (!contentIncludes(systemPrompt.content, 'automate the browser')) {
      throw new Error('Observe system prompt missing browser automation context');
    }

    if (!contentIncludes(systemPrompt.content, 'accessibility tree')) {
      throw new Error('Observe system prompt missing accessibility tree reference');
    }

    // Test observe system prompt with user instructions
    const systemPromptWithInstructions = buildObserveSystemPrompt('Be extra careful');

    if (!contentIncludes(systemPromptWithInstructions.content, 'Be extra careful')) {
      throw new Error('Observe system prompt missing user instructions');
    }

    // Test observe user message
    const userMessage = buildObserveUserMessage(
      'Find all buttons',
      'button[id="submit"] Submit\nbutton[id="cancel"] Cancel'
    );

    if (userMessage.role !== 'user') {
      throw new Error('Observe user message should have role "user"');
    }

    if (!contentIncludes(userMessage.content, 'Find all buttons')) {
      throw new Error('Observe user message missing instruction');
    }

    if (!contentIncludes(userMessage.content, 'Accessibility Tree:')) {
      throw new Error('Observe user message missing accessibility tree label');
    }

    if (!contentIncludes(userMessage.content, 'button[id="submit"]')) {
      throw new Error('Observe user message missing DOM elements');
    }

    return {
      success: true,
      details: 'Observe prompt building works correctly',
    };
  } catch (error) {
    return {
      success: false,
      details: `Observe prompt test failed: ${error}`,
    };
  }
}

/**
 * Test act observe prompt building
 */
async function testActObservePromptBuilding(): Promise<{ success: boolean; details: string }> {
  try {
    // Test basic act observe prompt
    const basicPrompt = buildActObservePrompt('click the submit button', [
      'click',
      'fill',
      'press',
    ]);

    if (!basicPrompt.includes('click the submit button')) {
      throw new Error('Act observe prompt missing action');
    }

    if (!basicPrompt.includes('click, fill, press')) {
      throw new Error('Act observe prompt missing supported actions');
    }

    if (!basicPrompt.includes('most relevant element')) {
      throw new Error('Act observe prompt missing relevance instruction');
    }

    // Test act observe prompt with variables
    const promptWithVariables = buildActObservePrompt(
      'fill the username field',
      ['click', 'fill'],
      { username: 'testuser', password: 'testpass' }
    );

    if (!promptWithVariables.includes('%username%')) {
      throw new Error('Act observe prompt missing username variable');
    }

    if (!promptWithVariables.includes('%password%')) {
      throw new Error('Act observe prompt missing password variable');
    }

    if (!promptWithVariables.includes('variables are available')) {
      throw new Error('Act observe prompt missing variable instructions');
    }

    // Test edge cases
    const emptyVariablesPrompt = buildActObservePrompt('scroll down', ['scroll'], {});

    if (emptyVariablesPrompt.includes('variables are available')) {
      throw new Error('Should not include variable instructions for empty variables');
    }

    return {
      success: true,
      details: 'Act observe prompt building works correctly',
    };
  } catch (error) {
    return {
      success: false,
      details: `Act observe prompt test failed: ${error}`,
    };
  }
}

/**
 * Test operator prompt building
 */
async function testOperatorPromptBuilding(): Promise<{ success: boolean; details: string }> {
  try {
    // Test operator system prompt
    const operatorPrompt = buildOperatorSystemPrompt('Complete the checkout process');

    if (operatorPrompt.role !== 'system') {
      throw new Error('Operator prompt should have role "system"');
    }

    if (!contentIncludes(operatorPrompt.content, 'general-purpose agent')) {
      throw new Error('Operator prompt missing agent description');
    }

    if (!contentIncludes(operatorPrompt.content, 'Complete the checkout process')) {
      throw new Error('Operator prompt missing goal');
    }

    if (!contentIncludes(operatorPrompt.content, 'atomic steps')) {
      throw new Error('Operator prompt missing atomic steps instruction');
    }

    if (!contentIncludes(operatorPrompt.content, 'Single click')) {
      throw new Error('Operator prompt missing action examples');
    }

    if (!contentIncludes(operatorPrompt.content, 'separate steps')) {
      throw new Error('Operator prompt missing separation guidance');
    }

    return {
      success: true,
      details: 'Operator prompt building works correctly',
    };
  } catch (error) {
    return {
      success: false,
      details: `Operator prompt test failed: ${error}`,
    };
  }
}

/**
 * Quick prompt building test for validation
 */
export async function quickPromptBuildingTest(): Promise<boolean> {
  try {
    // Quick validation of core functionality
    const userInstr = buildUserInstructionsString('test');
    const extractSys = buildExtractSystemPrompt();
    const extractUser = buildExtractUserPrompt('test', '<div>test</div>');
    const metadataSys = buildMetadataSystemPrompt();
    const metadataUser = buildMetadataPrompt('test', {}, 1, 2);
    const observeSys = buildObserveSystemPrompt();
    const observeUser = buildObserveUserMessage('test', 'tree');
    const actObserve = buildActObservePrompt('test', ['click']);
    const operator = buildOperatorSystemPrompt('test goal');

    // Basic validation
    if (!userInstr.includes('test')) return false;
    if (extractSys.role !== 'system') return false;
    if (extractUser.role !== 'user') return false;
    if (metadataSys.role !== 'system') return false;
    if (metadataUser.role !== 'user') return false;
    if (observeSys.role !== 'system') return false;
    if (observeUser.role !== 'user') return false;
    if (!actObserve.includes('test')) return false;
    if (operator.role !== 'system') return false;

    return true;
  } catch (error) {
    console.error('Quick prompt building test failed:', error);
    return false;
  }
}
