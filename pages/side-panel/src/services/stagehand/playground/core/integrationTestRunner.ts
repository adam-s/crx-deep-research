/**
 * Integration Test Runner
 *
 * Handles live integration tests that use real AI/LLM services including:
 * - Example basic steps test (docs.stagehand.dev navigation)
 * - Elephant research test (multi-step AI research)
 * - Other live integration scenarios
 */

import { BaseTestRunner } from './baseTestRunner';
import { ILogService } from '@shared/services/log.service';
import { ILocalAsyncStorage } from '@shared/storage/localAsyncStorage/localAsyncStorage.service';
import { SidePanelAppStorageSchema } from '@shared/storage/types/storage.types';
import { EventMessage } from '@src/utils/types';

// Import test functions
import { testExampleBasicSteps } from '../exampleTests/exampleBasicTests';
import { testElephantResearchSteps } from '../exampleTests/exampleElephantResearch';

export class IntegrationTestRunner extends BaseTestRunner {
  public readonly name = 'Integration Tests';

  constructor(
    events: { emit: (event: EventMessage) => void },
    logService: ILogService,
    storage: ILocalAsyncStorage<SidePanelAppStorageSchema>
  ) {
    super(events, logService, storage);
  }

  public async run(): Promise<void> {
    await this.executeTest('Complete Integration Test Suite', async () => {
      // Get API key once for all tests
      const apiKey = await this.getApiKey();

      // Run example basic steps test
      await this.runExampleBasicStepsTest(apiKey);

      // Run elephant research test
      await this.runElephantResearchTest(apiKey);
    });
  }

  /**
   * Run the example basic steps test (docs.stagehand.dev navigation)
   */
  public async runExampleBasicStepsTest(apiKey?: string): Promise<void> {
    await this.executeTest('Example Basic Steps Test', async () => {
      this.emitInfo('🚀 Starting Example Basic Steps Test (example.ts)...', {
        testType: 'Live Integration Test',
        example: 'example.ts',
        description: 'Navigate to docs.stagehand.dev and click quickstart button using AI',
      });

      // Get API key if not provided
      const resolvedApiKey = apiKey || (await this.getApiKey());

      // Create test context
      const context = this.createTestContext(resolvedApiKey);

      // Run the test
      await testExampleBasicSteps(context);

      this.emitSuccess('✅ Example basic steps test completed successfully', {
        category: 'live-integration-test',
        example: 'example.ts',
        completedSteps: ['Navigate to https://docs.stagehand.dev', 'AI click on quickstart button'],
        integration: 'OpenAI GPT-4o-mini with Cordyceps',
      });
    });
  }

  /**
   * Run the elephant research test (multi-step AI research)
   */
  public async runElephantResearchTest(apiKey?: string): Promise<void> {
    await this.executeTest('Elephant Research Test', async () => {
      this.emitInfo('🐘 Starting Elephant Research Test (Multi-Step AI Research)...', {
        testType: 'Live Integration Test',
        task: 'Multi-step elephant behavior research',
        description:
          'Navigate to Google, search for Wikipedia elephants, extract behavior information, and generate comprehensive report',
        llm: 'OpenAI GPT-4o',
      });

      // Get API key if not provided
      const resolvedApiKey = apiKey || (await this.getApiKey());

      // Create test context
      const context = this.createTestContext(resolvedApiKey);

      // Run the test
      await testElephantResearchSteps(context);

      this.emitSuccess('✅ Elephant research test completed successfully', {
        category: 'multi-step-research-test',
        task: 'elephant-behavior-research',
        completedSteps: [
          'Navigate to Google',
          'Search for "wikipedia elephants"',
          'Click Wikipedia link',
          'Extract elephant behavior information',
          'Generate comprehensive report',
        ],
        integration: 'OpenAI GPT-4o with Cordyceps',
      });
    });
  }
}
