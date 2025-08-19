import { TestProgress } from './types';
import { EventMessage, Severity } from '@src/utils/types';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';
import { equals as deepEqual } from 'vs/base/common/objects';

export interface CacheTestContext {
  events: { emit: (message: EventMessage) => void };
  storage: ILocalAsyncStorage<SidePanelAppStorageSchema>;
}

/**
 * Test cache system integration with Chrome extension storage
 */
export async function testCacheSystemIntegration(
  progress: TestProgress,
  context: CacheTestContext
): Promise<void> {
  progress.log('Starting cache system tests');

  try {
    // Import cache classes
    const { BaseCache } = await import('../../lib/cache/BaseCache');
    const { ActionCache } = await import('../../lib/cache/ActionCache');
    const { LLMCache } = await import('../../lib/cache/LLMCache');

    // Create logger function
    const logger = (message: { category?: string; message: string; level?: number }) => {
      context.events.emit({
        timestamp: Date.now(),
        severity: message.level === 2 ? Severity.Error : Severity.Info,
        message: `Cache [${message.category}]: ${message.message}`,
      });
    };

    // Test 1: BaseCache functionality
    progress.log('Testing BaseCache operations');

    const baseCache = new BaseCache(logger, context.storage, 'playground_test_base');
    const testData = {
      test: 'cache-data',
      timestamp: Date.now(),
      complex: { nested: { value: 'test' }, array: [1, 2, 3] },
    };
    const requestId = 'test-' + Date.now();

    // Test set operation
    await baseCache.set({ key: 'test-key', params: { a: 1, b: 2 } }, testData, requestId);

    // Test get operation
    const retrieved = await baseCache.get({ key: 'test-key', params: { a: 1, b: 2 } }, requestId);

    // Debug logging
    console.log('🔍 Cache Debug Info:');
    console.log('Original data:', JSON.stringify(testData));
    console.log('Retrieved data:', JSON.stringify(retrieved));
    console.log('Data types - Original:', typeof testData, 'Retrieved:', typeof retrieved);

    const retrievedData = retrieved as typeof testData;
    console.log(
      'Timestamp comparison - Original:',
      testData.timestamp,
      'Retrieved:',
      retrievedData?.timestamp
    );

    if (!retrieved || !deepEqual(retrieved, testData)) {
      console.error('❌ Cache mismatch details:');
      console.error('- Retrieved is null/undefined:', !retrieved);
      console.error(
        '- JSON strings match:',
        JSON.stringify(retrieved) === JSON.stringify(testData)
      );
      console.error('- Original JSON:', JSON.stringify(testData));
      console.error('- Retrieved JSON:', JSON.stringify(retrieved));
      throw new Error('BaseCache set/get test failed - data mismatch');
    }

    progress.log('✅ BaseCache operations passed - Set/get operations working correctly');

    // Test 2: ActionCache functionality
    progress.log('Testing ActionCache operations');

    const actionCache = new ActionCache(logger, context.storage, 'playground_test_action');

    await actionCache.addActionStep({
      url: 'https://example.com/test',
      action: 'click submit button',
      previousSelectors: ['#form input[type="text"]', '#submit-btn'],
      playwrightCommand: { method: 'click', args: ['#submit-btn'] },
      componentString: '<button id="submit-btn" type="submit">Submit</button>',
      requestId: requestId,
      xpaths: ['//button[@id="submit-btn"]'],
      newStepString: 'Clicked submit button successfully',
      completed: true,
    });

    const actionResult = await actionCache.getActionStep({
      url: 'https://example.com/test',
      action: 'click submit button',
      previousSelectors: ['#form input[type="text"]', '#submit-btn'],
      requestId: requestId,
    });

    if (!actionResult || actionResult.action !== 'click submit button' || !actionResult.completed) {
      throw new Error('ActionCache test failed - action data mismatch');
    }

    progress.log(
      '✅ ActionCache operations passed - Action caching and retrieval working correctly'
    );

    // Test 3: LLMCache functionality
    progress.log('Testing LLMCache operations');

    const llmCache = new LLMCache(logger, context.storage, 'playground_test_llm');

    const llmOptions = {
      model: 'gpt-4',
      prompt: 'Analyze this webpage for interactive elements',
      temperature: 0.7,
      maxTokens: 500,
    };
    const llmResponse = {
      choices: [
        {
          message: {
            content: 'Found 3 buttons, 2 forms, and 1 navigation menu',
          },
        },
      ],
      usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
    };

    await llmCache.set(llmOptions, llmResponse, requestId);
    const llmResult = await llmCache.get(llmOptions, requestId);

    if (!llmResult || !deepEqual(llmResult, llmResponse)) {
      console.error('❌ LLMCache mismatch details:');
      console.error('- LLM result is null/undefined:', !llmResult);
      console.error('- Original response:', JSON.stringify(llmResponse));
      console.error('- Retrieved result:', JSON.stringify(llmResult));
      throw new Error('LLMCache test failed - response data mismatch');
    }

    progress.log('✅ LLMCache operations passed - LLM response caching working correctly');

    // Test 4: Cache cleanup and management
    progress.log('Testing cache cleanup');

    // Test cleanup operations
    await baseCache.cleanupStaleEntries();
    await actionCache.clearAction(requestId);

    // Verify action was cleared
    const clearedAction = await actionCache.getActionStep({
      url: 'https://example.com/test',
      action: 'click submit button',
      previousSelectors: ['#form input[type="text"]', '#submit-btn'],
      requestId: requestId,
    });

    if (clearedAction !== null) {
      throw new Error('ActionCache clear test failed - action not removed');
    }

    progress.log('✅ Cache cleanup passed - Cleanup operations working correctly');

    // Test 5: Hash collision and complex keys
    progress.log('Testing complex cache keys');

    const complexKey1 = { url: 'test.com', selectors: ['a', 'b'], metadata: { type: 'form' } };
    const complexKey2 = { url: 'test.com', selectors: ['a', 'b'], metadata: { type: 'button' } };

    await baseCache.set(complexKey1, { data: 'form-data' }, requestId);
    await baseCache.set(complexKey2, { data: 'button-data' }, requestId);

    const result1 = await baseCache.get(complexKey1, requestId);
    const result2 = await baseCache.get(complexKey2, requestId);

    if (
      !result1 ||
      !result2 ||
      (result1 as { data: string }).data !== 'form-data' ||
      (result2 as { data: string }).data !== 'button-data'
    ) {
      throw new Error('Complex key test failed - hash collision or key mismatch');
    }

    progress.log('✅ Complex cache keys passed - Complex key hashing working correctly');
    progress.log('✅ All cache tests completed - Chrome extension storage integration successful');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Cache system integration tests completed successfully',
      details: {
        testsCompleted: 5,
        components: ['BaseCache', 'ActionCache', 'LLMCache'],
        features: [
          'Set/Get operations',
          'Action tracking',
          'LLM caching',
          'Cleanup',
          'Complex keys',
        ],
      },
    });
  } catch (error) {
    progress.log(`❌ Cache tests failed: ${String(error)}`);
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: `❌ Cache system tests failed: ${error}`,
    });
    throw error;
  }
}

/**
 * Quick cache system validation test
 */
export async function quickCacheSystemTest(context: CacheTestContext): Promise<boolean> {
  try {
    const { BaseCache } = await import('../../lib/cache/BaseCache');

    const logger = () => {}; // Silent logger for quick test
    const cache = new BaseCache(logger, context.storage, 'quick_test');

    const testKey = { quick: 'test' };
    const testValue = { result: 'success' };
    const requestId = 'quick-test';

    await cache.set(testKey, testValue, requestId);
    const result = await cache.get(testKey, requestId);

    return result !== null && deepEqual(result, testValue);
  } catch {
    return false;
  }
}
