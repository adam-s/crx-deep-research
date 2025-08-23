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

// Import test functions (DISABLED: OpenAI quota preservation)
// import { testExampleBasicSteps } from '../exampleTests/exampleBasicTests';
// import { testElephantResearchSteps } from '../exampleTests/exampleElephantResearch';

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
      this.emitInfo(
        '⚠️ Integration tests are currently disabled to avoid OpenAI quota consumption',
        {
          reason: 'OpenAI quota preservation',
          disabledTests: ['Example Basic Steps Test', 'Elephant Research Test'],
          note: 'These tests can be re-enabled when quota is available',
        }
      );

      // DISABLED: OpenAI quota preservation
      // Get API key once for all tests
      // const apiKey = await this.getApiKey();

      // DISABLED: Run example basic steps test
      // await this.runExampleBasicStepsTest(apiKey);

      // DISABLED: Run elephant research test
      // await this.runElephantResearchTest(apiKey);
    });
  }

  /**
   * Run the example basic steps test (docs.stagehand.dev navigation)
   */
  public async runExampleBasicStepsTest(_apiKey?: string): Promise<void> {
    await this.executeTest('Example Basic Steps Test', async () => {
      this.emitInfo('🚀 Starting Example Basic Steps Test (example.ts)...', {
        testType: 'Live Integration Test',
        example: 'example.ts',
        description: 'Navigate to docs.stagehand.dev and click quickstart button using AI',
      });

      // DISABLED: Get API key if not provided (OpenAI quota preservation)
      // const resolvedApiKey = apiKey || (await this.getApiKey());

      // DISABLED: Create test context (OpenAI quota preservation)
      // const context = this.createTestContext(resolvedApiKey);

      // DISABLED: Run the test (OpenAI quota preservation)
      // await testExampleBasicSteps(context);

      this.emitInfo('⚠️ Example basic steps test disabled to preserve OpenAI quota', {
        category: 'live-integration-test',
        example: 'example.ts',
        status: 'disabled',
        reason: 'OpenAI quota preservation',
      });
    });
  }

  /**
   * Run the elephant research test (multi-step AI research)
   */
  public async runElephantResearchTest(_apiKey?: string): Promise<void> {
    await this.executeTest('Elephant Research Test', async () => {
      this.emitInfo('🐘 Starting Elephant Research Test (Multi-Step AI Research)...', {
        testType: 'Live Integration Test',
        task: 'Multi-step elephant behavior research',
        description:
          'Navigate to Google, search for Wikipedia elephants, extract behavior information, and generate comprehensive report',
        llm: 'OpenAI GPT-4o',
      });

      // DISABLED: Get API key if not provided (OpenAI quota preservation)
      // const resolvedApiKey = apiKey || (await this.getApiKey());

      // DISABLED: Create test context (OpenAI quota preservation)
      // const context = this.createTestContext(resolvedApiKey);

      // DISABLED: Run the test (OpenAI quota preservation)
      // await testElephantResearchSteps(context);

      this.emitInfo('⚠️ Elephant research test disabled to preserve OpenAI quota', {
        category: 'multi-step-research-test',
        task: 'elephant-behavior-research',
        status: 'disabled',
        reason: 'OpenAI quota preservation',
      });
    });
  }
}
