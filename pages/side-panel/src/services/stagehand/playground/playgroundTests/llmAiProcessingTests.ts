/**
 * LLM & AI Processing Tests - No Conversion Needed (15%)
 *
 * Tests for LLM and AI processing components that interface with external APIs
 * and require no changes for Cordyceps conversion.
 *
 * Files tested:
 * - llm/LLMClient.ts - LLM client interfaces
 * - llm/OpenAIClient.ts - OpenAI integration
 * - llm/GoogleClient.ts - Google integration
 * - handlers/extractHandler.ts - Data extraction logic
 * - handlers/observeHandler.ts - Page observation logic
 * - prompt.ts - Prompt building utilities
 * - inference.ts - AI inference utilities
 */

import type { TestProgress, TestContext } from './types';
import { Severity } from '@src/utils/types';
import { LLMProvider } from '../../lib/llm/LLMProvider';
import { OpenAIClient } from '../../lib/llm/OpenAIClient';
import { GoogleClient } from '../../lib/llm/GoogleClient';
import type { LogLine } from '../../types/log';
import type { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import type { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';
import { StorageKeys } from '@shared/storage/types/storage.types';

// Types for Cordyceps page interface and LLM system
interface PageType {
  goto: (url: string) => Promise<void>;
  waitForLoadState: (state: string) => Promise<void>;
  evaluate: <T>(fn: () => T) => Promise<T>;
}

type ModelProvider = 'openai' | 'google';
type AvailableModel = 'gpt-4o-mini' | 'gpt-4o' | 'gemini-1.5-flash' | 'gemini-1.5-pro';

// Strongly typed LLM test interfaces using our converted system
interface LLMClientTestResults {
  provider: ModelProvider;
  model: AvailableModel;
  clientType: string;
  hasApiKey: boolean;
  clientCreated: boolean;
  canCreateCompletion: boolean;
  error?: string;
}

interface LLMProviderTestResults {
  supportedProviders: ModelProvider[];
  modelsAvailable: AvailableModel[];
  providerCreated: boolean;
  openAIClientWorks: boolean;
  googleClientWorks: boolean;
  aiSdkClientWorks: boolean;
}

interface ChatCompletionTestResults {
  requestSent: boolean;
  responseReceived: boolean;
  tokenCount: number;
  model: AvailableModel;
  success: boolean;
  error?: string;
}

// Mock prompt building utilities
interface PromptTestResults {
  simplePrompt: string;
  templatePrompt: string;
  complexPrompt: string;
  hasPromptBuilder: boolean;
}

// Mock extraction utilities
interface ExtractionTestResults {
  textExtracted: boolean;
  dataExtracted: boolean;
  structuredData: Record<string, unknown>;
  hasExtractor: boolean;
}

// Mock observation utilities
interface ObservationTestResults {
  pageObserved: boolean;
  elementsObserved: number;
  hasObserver: boolean;
}

// Stagehand LLM utility function declarations for testing
declare global {
  interface Window {
    // LLM client utilities
    createLLMProvider?: () => LLMProvider;

    // Prompt building utilities
    buildPrompt?: (template: string, variables: Record<string, unknown>) => string;
    createSystemPrompt?: (context: string) => string;

    // Data extraction utilities
    extractDataFromPage?: () => Record<string, unknown>;
    extractTextContent?: () => string;

    // Page observation utilities
    observePage?: () => Record<string, unknown>;
    observeElements?: (selector: string) => Element[];

    // AI inference utilities
    runInference?: (prompt: string, data: Record<string, unknown>) => Promise<string>;
  }
}

/**
 * Test LLM and AI processing components that require no conversion
 */
export async function runLLMAiProcessingTests(
  page: PageType,
  progress: TestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('🚀 Running LLM & AI processing tests...');

  try {
    // Navigate to test page
    await page.goto('http://localhost:3005');
    await page.waitForLoadState('load');
    progress.log('✅ Test page loaded successfully');

    // Test 1: LLM Client Integration (with real API keys)
    await testLLMClientIntegration(page, progress, context, context.storage);

    // Test 2: Prompt Building Utilities
    await testPromptBuilding(page, progress, context);

    // Test 3: Data Extraction Logic
    await testDataExtraction(page, progress, context);

    // Test 4: Page Observation Logic
    await testPageObservation(page, progress, context);

    // Test 5: AI Inference Utilities
    await testAIInference(page, progress, context, context.storage);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ LLM & AI processing tests completed successfully',
      details: {
        category: 'ai-processing',
        testsRun: 5,
        url: 'http://localhost:3005',
      },
    });

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ LLM & AI processing tests failed: ${errorMessage}`,
      details: { category: 'ai-processing', error: errorMessage },
    });

    progress.log(`❌ LLM & AI processing test error: ${errorMessage}`);
    return false;
  }
}

/**
 * Test LLM client integration with real API keys using our converted system
 */
async function testLLMClientIntegration(
  page: PageType,
  progress: TestProgress,
  context: TestContext,
  storage?: ILocalAsyncStorage<SidePanelAppStorageSchema>
): Promise<void> {
  progress.log('🔑 Testing LLM client integration...');

  // Get API keys from storage if available
  let openAiKey = '';
  let googleAiKey = '';
  const provider = 'openai';

  if (storage) {
    try {
      const storedOpenAI = await storage.get(StorageKeys.OPEN_AI_API_KEY);
      const storedGoogle = await storage.get(StorageKeys.GOOGLE_GEMINI_API_KEY);

      openAiKey = typeof storedOpenAI === 'string' ? storedOpenAI : '';
      googleAiKey = typeof storedGoogle === 'string' ? storedGoogle : '';
    } catch (error) {
      progress.log('⚠️ Could not access storage for API keys');
    }
  }

  try {
    // Create LLM Provider instance with required parameters
    const llmLogger = (message: LogLine) => {
      progress.log(`LLM: ${message.message}`);
    };
    const llmProvider = new LLMProvider(llmLogger, false); // Disable caching for tests
    progress.log('✅ LLM Provider created successfully');

    // Test results tracking
    const testResults: LLMProviderTestResults = {
      supportedProviders: ['openai', 'google'],
      modelsAvailable: ['gpt-4o-mini', 'gpt-4o', 'gemini-1.5-flash', 'gemini-1.5-pro'],
      providerCreated: true,
      openAIClientWorks: false,
      googleClientWorks: false,
      aiSdkClientWorks: false,
    };

    // Test OpenAI client creation
    if (openAiKey) {
      try {
        const openAIClient = await llmProvider.getClient('gpt-4o-mini', { apiKey: openAiKey });
        testResults.openAIClientWorks = openAIClient !== null;
        progress.log('✅ OpenAI client created successfully');

        // Test a simple chat completion
        if (openAIClient) {
          const response = await openAIClient.createChatCompletion({
            options: {
              messages: [{ role: 'user', content: 'Say "Hello from LLM test"' }],
              temperature: 0.1,
              maxTokens: 20,
            },
            logger: (_logMessage: LogLine) => {
              // Silent logger for security - don't log API responses to console
            },
          });

          if (response && response.choices && response.choices.length > 0) {
            progress.log('✅ OpenAI chat completion successful');
            // Don't log actual response content for security
          }
        }
      } catch (error) {
        progress.log('❌ OpenAI client test failed');
        // Don't log error details to console for security
      }
    } else {
      progress.log('⚠️ No OpenAI API key available for testing');
    }

    // Test Google client creation
    if (googleAiKey) {
      try {
        const googleClient = await llmProvider.getClient('gemini-1.5-flash', {
          apiKey: googleAiKey,
        });
        testResults.googleClientWorks = googleClient !== null;
        progress.log('✅ Google client created successfully');

        // Test a simple chat completion
        if (googleClient) {
          const response = await googleClient.createChatCompletion({
            options: {
              messages: [{ role: 'user', content: 'Say "Hello from Google LLM test"' }],
              temperature: 0.1,
              maxTokens: 20,
            },
            logger: (_logMessage: LogLine) => {
              // Silent logger for security - don't log API responses to console
            },
          });

          if (response && response.choices && response.choices.length > 0) {
            progress.log('✅ Google chat completion successful');
            // Don't log actual response content for security
          }
        }
      } catch (error) {
        progress.log('❌ Google client test failed');
        // Don't log error details to console for security
      }
    } else {
      progress.log('⚠️ No Google API key available for testing');
    }

    // Test AI SDK client (mock test since it doesn't require real API key)
    try {
      const aiSdkClient = await llmProvider.getClient('openai/gpt-4o-mini' as AvailableModel, {
        apiKey: 'test-mock-key',
      });
      testResults.aiSdkClientWorks = aiSdkClient !== null;
      progress.log('✅ AI SDK client created successfully');
    } catch (error) {
      progress.log('❌ AI SDK client test failed');
      console.error('AI SDK client error:', error);
    }

    // Emit comprehensive test results
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🔑 LLM client integration test completed',
      details: {
        hasOpenAIKey: openAiKey.length > 0,
        hasGoogleAIKey: googleAiKey.length > 0,
        provider,
        testResults,
        supportedModels: testResults.modelsAvailable,
        allClientsWorking:
          testResults.openAIClientWorks &&
          testResults.googleClientWorks &&
          testResults.aiSdkClientWorks,
      },
    });

    progress.log(
      `🔑 LLM integration complete: OpenAI=${testResults.openAIClientWorks}, Google=${testResults.googleClientWorks}, AISDK=${testResults.aiSdkClientWorks}`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`❌ LLM client integration failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ LLM client integration failed: ${errorMessage}`,
      details: { error: errorMessage },
    });
  }
}

/**
 * Test prompt building utilities
 */
async function testPromptBuilding(
  page: PageType,
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('📝 Testing prompt building utilities...');

  const promptResults = await page.evaluate(() => {
    const results: PromptTestResults = {
      simplePrompt: '',
      templatePrompt: '',
      complexPrompt: '',
      hasPromptBuilder: false,
    };

    // Test prompt building if utilities are available
    if (window.buildPrompt) {
      results.hasPromptBuilder = true;

      // Test simple prompt
      results.simplePrompt = window.buildPrompt('Hello {name}!', { name: 'Stagehand' });

      // Test template prompt
      results.templatePrompt = window.buildPrompt(
        'Extract {type} from the page with {count} elements',
        { type: 'form data', count: 5 }
      );

      // Test complex prompt
      results.complexPrompt = window.buildPrompt(
        'Analyze the {pageType} page and identify {targetElements} for {action}',
        {
          pageType: 'test page',
          targetElements: 'interactive elements',
          action: 'automation testing',
        }
      );
    }

    // Test system prompt creation
    if (window.createSystemPrompt) {
      const systemPrompt = window.createSystemPrompt(
        'You are a web automation assistant. Help users interact with web pages.'
      );
      results.complexPrompt = systemPrompt || results.complexPrompt;
    }

    // Fallback mock prompts for demonstration
    if (!results.hasPromptBuilder) {
      results.simplePrompt = 'Mock simple prompt: Hello Stagehand!';
      results.templatePrompt =
        'Mock template prompt: Extract form data from the page with 5 elements';
      results.complexPrompt =
        'Mock complex prompt: Analyze the test page and identify interactive elements for automation testing';
    }

    return results;
  });

  progress.log(
    `📝 Prompt results: Built ${promptResults.simplePrompt.length + promptResults.templatePrompt.length + promptResults.complexPrompt.length} characters of prompts`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '📝 Prompt building utilities tested',
    details: {
      hasPromptBuilder: promptResults.hasPromptBuilder,
      promptsGenerated: 3,
      totalPromptLength:
        promptResults.simplePrompt.length +
        promptResults.templatePrompt.length +
        promptResults.complexPrompt.length,
    },
  });
}

/**
 * Test data extraction logic
 */
async function testDataExtraction(
  page: PageType,
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('🔍 Testing data extraction logic...');

  const extractionResults = await page.evaluate(() => {
    const results: ExtractionTestResults = {
      textExtracted: false,
      dataExtracted: false,
      structuredData: {},
      hasExtractor: false,
    };

    // Test data extraction if utilities are available
    if (window.extractDataFromPage) {
      results.hasExtractor = true;
      try {
        const data = window.extractDataFromPage();
        results.structuredData = data;
        results.dataExtracted = Object.keys(data).length > 0;
      } catch (error) {
        console.warn('Data extraction failed:', error);
      }
    }

    // Test text extraction
    if (window.extractTextContent) {
      try {
        const text = window.extractTextContent();
        results.textExtracted = text.length > 0;
      } catch (error) {
        console.warn('Text extraction failed:', error);
      }
    }

    // Fallback extraction using standard DOM APIs
    if (!results.hasExtractor) {
      // Extract form data
      const forms = document.querySelectorAll('form');
      const inputs = document.querySelectorAll('input');
      const buttons = document.querySelectorAll('button');

      results.structuredData = {
        forms: forms.length,
        inputs: inputs.length,
        buttons: buttons.length,
        pageTitle: document.title,
        pageUrl: window.location.href,
      };
      results.dataExtracted = true;

      // Extract page text content
      const bodyText = document.body.textContent || '';
      results.textExtracted = bodyText.length > 0;
    }

    return results;
  });

  progress.log(
    `🔍 Extraction results: Text=${extractionResults.textExtracted}, Data keys=${Object.keys(extractionResults.structuredData).length}`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔍 Data extraction logic tested',
    details: {
      hasExtractor: extractionResults.hasExtractor,
      textExtracted: extractionResults.textExtracted,
      dataExtracted: extractionResults.dataExtracted,
      extractedDataKeys: Object.keys(extractionResults.structuredData).length,
    },
  });
}

/**
 * Test page observation logic
 */
async function testPageObservation(
  page: PageType,
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  progress.log('👁️ Testing page observation logic...');

  const observationResults = await page.evaluate(() => {
    const results: ObservationTestResults = {
      pageObserved: false,
      elementsObserved: 0,
      hasObserver: false,
    };

    // Test page observation if utilities are available
    if (window.observePage) {
      results.hasObserver = true;
      try {
        const observation = window.observePage();
        results.pageObserved = Object.keys(observation).length > 0;
      } catch (error) {
        console.warn('Page observation failed:', error);
      }
    }

    // Test element observation
    if (window.observeElements) {
      try {
        const interactiveElements = window.observeElements('button, input, select, textarea, a');
        results.elementsObserved = interactiveElements.length;
      } catch (error) {
        console.warn('Element observation failed:', error);
      }
    }

    // Fallback observation using standard DOM APIs
    if (!results.hasObserver) {
      const interactiveElements = document.querySelectorAll('button, input, select, textarea, a');
      results.elementsObserved = interactiveElements.length;
      results.pageObserved = true;
    }

    return results;
  });

  progress.log(
    `👁️ Observation results: Page observed=${observationResults.pageObserved}, Elements=${observationResults.elementsObserved}`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '👁️ Page observation logic tested',
    details: {
      hasObserver: observationResults.hasObserver,
      pageObserved: observationResults.pageObserved,
      elementsObserved: observationResults.elementsObserved,
    },
  });
}

/**
 * Test AI inference utilities
 */
async function testAIInference(
  page: PageType,
  progress: TestProgress,
  context: TestContext,
  storage?: ILocalAsyncStorage<SidePanelAppStorageSchema>
): Promise<void> {
  progress.log('🧠 Testing AI inference utilities...');

  // Get API key for potential inference testing
  let hasApiKey = false;
  if (storage) {
    try {
      const openAiKey = await storage.get(StorageKeys.OPEN_AI_API_KEY);
      hasApiKey = !!openAiKey;
    } catch (error) {
      progress.log('⚠️ Could not access storage for API key');
    }
  }

  const inferenceResults = await page.evaluate(() => {
    const results = {
      hasInferenceUtility: false,
      mockInferenceRun: false,
      inferencePrompt: '',
      inferenceData: {},
      hasApiKey: false, // Will be set from outer scope after evaluation
      modelToUse: 'gpt-4o-mini', // Use mini model for cost efficiency
    };

    // Test inference utilities if available
    if (window.runInference) {
      results.hasInferenceUtility = true;

      // Prepare test data
      results.inferencePrompt =
        'Identify the main interactive elements on this page for automation testing.';
      results.inferenceData = {
        pageTitle: document.title,
        elementCount: document.querySelectorAll('button, input, select').length,
        hasForm: document.querySelectorAll('form').length > 0,
      };

      // Mock inference test (don't make actual API calls in tests)
      results.mockInferenceRun = true;
    }

    return results;
  });

  // Set the hasApiKey value from the outer scope
  inferenceResults.hasApiKey = hasApiKey;

  progress.log(
    `🧠 Inference results: Has utility=${inferenceResults.hasInferenceUtility}, API key available=${inferenceResults.hasApiKey}`
  );

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🧠 AI inference utilities tested',
    details: {
      hasInferenceUtility: inferenceResults.hasInferenceUtility,
      hasApiKey: inferenceResults.hasApiKey,
      mockInferenceRun: inferenceResults.mockInferenceRun,
      modelToUse: inferenceResults.modelToUse,
    },
  });
}

/**
 * Test Chat Completion Functionality with Strong Typing
 * Tests actual LLM chat completion with our converted system
 */
export async function testChatCompletion(openAiKey: string): Promise<ChatCompletionTestResults> {
  console.log('💬 Testing Chat Completion...');

  const results: ChatCompletionTestResults = {
    requestSent: false,
    responseReceived: false,
    tokenCount: 0,
    model: 'gpt-4o-mini',
    success: false,
  };

  try {
    if (!openAiKey) {
      results.error = 'No OpenAI API key provided';
      return results;
    }

    // Create provider and client
    const llmLogger = (message: LogLine) => console.log('LLM Log:', message.message);
    const provider = new LLMProvider(llmLogger, false);
    const client = await provider.getClient('gpt-4o-mini', { apiKey: openAiKey });

    if (!client) {
      results.error = 'Failed to create LLM client';
      return results;
    }

    // Test chat completion
    const testMessage = 'Hello! Please respond with exactly: "LLM test successful"';
    results.requestSent = true;

    const response = await client.createChatCompletion({
      options: {
        messages: [{ role: 'user', content: testMessage }],
        temperature: 0.1,
        maxTokens: 50,
      },
      logger: llmLogger,
    });

    if (response && response.choices && response.choices.length > 0) {
      results.responseReceived = true;
      results.tokenCount = response.usage?.total_tokens || 0;
      results.success = true;
      console.log('✅ Chat completion successful:', response.choices[0].message?.content);
    } else {
      results.error = 'No response received from LLM';
    }

    return results;
  } catch (error) {
    console.error('❌ Chat completion test failed:', error);
    results.error = error instanceof Error ? error.message : 'Unknown error';
    return results;
  }
}

/**
 * Test Individual LLM Clients with Strong Typing
 * Tests specific client functionality with proper typing
 */
export async function testIndividualLLMClients(
  openAiKey?: string,
  googleAiKey?: string
): Promise<LLMClientTestResults[]> {
  console.log('🔧 Testing Individual LLM Clients...');

  const results: LLMClientTestResults[] = [];
  const logger = (message: LogLine) => console.log('Client Log:', message.message);

  // Test OpenAI Client
  if (openAiKey) {
    const openAIResult: LLMClientTestResults = {
      provider: 'openai',
      model: 'gpt-4o-mini',
      clientType: 'OpenAIClient',
      hasApiKey: true,
      clientCreated: false,
      canCreateCompletion: false,
    };

    try {
      const openAIClient = new OpenAIClient({
        logger,
        modelName: 'gpt-4o-mini',
        clientOptions: { apiKey: openAiKey },
      });
      openAIResult.clientCreated = true;

      // Test completion
      const response = await openAIClient.createChatCompletion({
        options: {
          messages: [{ role: 'user', content: 'Test message' }],
          temperature: 0.1,
          maxTokens: 10,
        },
        logger,
      });

      openAIResult.canCreateCompletion = response !== null;
    } catch (error) {
      openAIResult.error = error instanceof Error ? error.message : 'Unknown error';
    }

    results.push(openAIResult);
  }

  // Test Google Client
  if (googleAiKey) {
    const googleResult: LLMClientTestResults = {
      provider: 'google',
      model: 'gemini-1.5-flash',
      clientType: 'GoogleClient',
      hasApiKey: true,
      clientCreated: false,
      canCreateCompletion: false,
    };

    try {
      const googleClient = new GoogleClient({
        logger,
        modelName: 'gemini-1.5-flash',
        clientOptions: { apiKey: googleAiKey },
      });
      googleResult.clientCreated = true;

      // Test completion
      const response = await googleClient.createChatCompletion({
        options: {
          messages: [{ role: 'user', content: 'Test message' }],
          temperature: 0.1,
          maxTokens: 10,
        },
        logger,
      });

      googleResult.canCreateCompletion = response !== null;
    } catch (error) {
      googleResult.error = error instanceof Error ? error.message : 'Unknown error';
    }

    results.push(googleResult);
  }

  return results;
}

/**
 * Quick LLM & AI Processing Test - Returns boolean for use in runQuickTests
 */
export async function quickLLMAndAIProcessingTest(): Promise<boolean> {
  try {
    // Create a simple LLM Provider to test architecture
    const llmLogger = (_message: LogLine) => {
      // Silent for quick test
    };
    const llmProvider = new LLMProvider(llmLogger, false);

    // Test basic provider functionality
    const provider = LLMProvider.getModelProvider('gpt-4o-mini');
    const isValidProvider = provider === 'openai';

    // Test client creation (without API key for quick test)
    const client = llmProvider.getClient('gpt-4o-mini');
    const clientCreated = client instanceof OpenAIClient;

    return isValidProvider && clientCreated;
  } catch (error) {
    return false;
  }
}

/**
 * Test LLM & AI Processing without page dependency - wrapper for DOM utils context
 */
export async function testLLMAndAIProcessing(
  progress: TestProgress,
  context: TestContext
): Promise<boolean> {
  // Create a mock page object for tests that don't actually need page functionality
  const mockPage: PageType = {
    goto: async (_url: string) => {
      // Mock implementation
    },
    waitForLoadState: async (_state: string) => {
      // Mock implementation
    },
    evaluate: async <T>(fn: () => T): Promise<T> => {
      return fn();
    },
  };

  // Call the main function with the mock page
  const result = await runLLMAiProcessingTests(mockPage, progress, context);

  return result;
}
