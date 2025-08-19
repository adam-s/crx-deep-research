import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage, Severity } from '@src/utils/types';
import { IStagehandService } from '../stagehand.service';
import { ILogService } from '@shared/services/log.service';
import { quickStagehandDOMUtilsTest } from './playgroundTests/domUtilsTests';
import {
  testStagehandCordycepsConversion,
  quickStagehandCordycepsConversionTest,
} from './playgroundTests/cordycepsConversionTests';
import {
  testStagehandLivePageDOM,
  quickStagehandLivePageTest,
} from './playgroundTests/livePageDomTests';
import {
  runLivePageDomMainTests,
  TestProgress as MainWorldTestProgress,
} from './playgroundTests/livePageDomMainTests';
import { testDOMUtilities, quickDOMUtilitiesTest } from './playgroundTests/domUtilitiesTests';
import {
  testLLMAndAIProcessing,
  quickLLMAndAIProcessingTest,
} from './playgroundTests/llmAiProcessingTests';
import {
  testUtilityFunctions,
  quickUtilityFunctionsTest,
} from './playgroundTests/utilityFunctionsTests';
import {
  testConfigurationAndValidation,
  quickConfigurationAndValidationTest,
} from './playgroundTests/configValidationTests';
import { TestProgress } from './playgroundTests/types';

export const IStagehandPlaygroundService = createDecorator<IStagehandPlaygroundService>(
  'stagehandPlaygroundService'
);

export interface IStagehandPlaygroundService {
  readonly _serviceBrand: undefined;
  /** Event that fires when stagehand playground events occur. */
  readonly onEvent: Event<EventMessage>;
  /** Run all stagehand tests */
  runAllTests: () => Promise<void>;
  /** Run DOM utilities tests (no conversion needed) */
  runDOMUtilsTests: () => Promise<void>;
  /** Run Cordyceps conversion tests */
  runCordycepsConversionTests: () => Promise<void>;
  /** Run live page DOM tests */
  runLivePageDOMTests: () => Promise<void>;
  /** Run quick validation tests */
  runQuickTests: () => Promise<boolean>;
}

export class StagehandPlaygroundService extends Disposable implements IStagehandPlaygroundService {
  public readonly _serviceBrand: undefined;

  readonly events = this._register(new SimpleEventEmitter<EventMessage>('StagehandPlayground'));
  public readonly onEvent: Event<EventMessage> = this.events.event;

  constructor(
    @IStagehandService private readonly _stagehandService: IStagehandService,
    @ILogService private readonly _logService: ILogService
  ) {
    super();
    this._logService.info('StagehandPlaygroundService: constructed');
  }

  public async runAllTests(): Promise<void> {
    const startTime = Date.now();

    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🚀 Starting Stagehand -> Cordyceps conversion tests',
      details: {
        conversionPhase: 'playwright-to-cordyceps',
        testServer: 'http://localhost:3005',
      },
    });

    try {
      // Initialize Stagehand service
      await this._stagehandService.initialize();

      // Phase 1: Test pure functions (15% - no conversion needed)
      await this.runDOMUtilsTests();

      // Phase 2: Test direct Cordyceps conversions (60%)
      await this.runCordycepsConversionTests();

      // Phase 3: Test with live page content
      await this.runLivePageDOMTests();

      const endTime = Date.now();
      const duration = endTime - startTime;

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ All Stagehand conversion tests completed successfully',
        details: {
          duration: `${duration}ms`,
          conversionStatus: 'tests-passing',
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: `❌ Stagehand conversion tests failed: ${errorMessage}`,
        details: { error: errorMessage },
      });

      throw error;
    }
  }

  public async runDOMUtilsTests(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message:
        '🔧 Testing Stagehand DOM utilities and pure functions (15% - no conversion needed)...',
    });

    try {
      const testContext = { events: this.events };
      const progress = new TestProgress('DOM-Utils');

      // Run the comprehensive DOM utilities tests
      await testDOMUtilities(progress, testContext);

      // Run LLM & AI Processing tests
      const llmProgress = new TestProgress('LLM-AI');
      await testLLMAndAIProcessing(llmProgress, testContext);

      // Run Utility Functions tests
      const utilityProgress = new TestProgress('Utilities');
      await testUtilityFunctions(utilityProgress, testContext);

      // Run Configuration & Validation tests
      const configProgress = new TestProgress('Config-Validation');
      await testConfigurationAndValidation(configProgress, testContext);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ All DOM utilities and pure function tests completed',
        details: {
          category: 'pure-functions',
          completedCategories: [
            'DOM Utilities',
            'LLM & AI Processing',
            'Utility Functions',
            'Configuration & Validation',
          ],
        },
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '❌ DOM utilities and pure function tests failed',
        details: { error: String(error) },
      });
      throw error;
    }
  }

  public async runCordycepsConversionTests(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🔄 Testing Stagehand -> Cordyceps API conversions (60%)...',
    });

    try {
      const testContext = { events: this.events };
      const progress = new TestProgress('Conversion');

      await testStagehandCordycepsConversion(progress, testContext);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ Cordyceps conversion tests completed',
        details: { category: 'api-conversion' },
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '❌ Cordyceps conversion tests failed',
        details: { error: String(error) },
      });
      throw error;
    }
  }

  public async runLivePageDOMTests(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🌐 Testing with live page at http://localhost:3005...',
    });

    try {
      const testContext = { events: this.events };
      const progress = new TestProgress('Live-Page');

      await testStagehandLivePageDOM(progress, testContext);

      // Additional MAIN world specific Stagehand utility tests
      const mainWorldProgress = new MainWorldTestProgress('Live-Page-MainWorld');
      await runLivePageDomMainTests(mainWorldProgress, testContext);

      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Success,
        message: '✅ Live page DOM tests completed',
        details: { category: 'live-testing' },
      });
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '❌ Live page DOM tests failed',
        details: { error: String(error) },
      });
      throw error;
    }
  }

  public async runQuickTests(): Promise<boolean> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '⚡ Running quick validation tests...',
    });

    try {
      // Original quick tests
      const domUtilsOk = await quickStagehandDOMUtilsTest();
      const cordycepsOk = await quickStagehandCordycepsConversionTest();
      const livePageOk = await quickStagehandLivePageTest();

      // New comprehensive quick tests (these return boolean)
      const domUtilitiesOk = await quickDOMUtilitiesTest();
      const llmAiOk = await quickLLMAndAIProcessingTest();

      // These quick tests use TestContext and don't return boolean
      const testContext = { events: this.events };
      await quickUtilityFunctionsTest(testContext);
      await quickConfigurationAndValidationTest(testContext);

      const allPassed = domUtilsOk && cordycepsOk && livePageOk && domUtilitiesOk && llmAiOk;

      this.events.emit({
        timestamp: Date.now(),
        severity: allPassed ? Severity.Success : Severity.Warning,
        message: allPassed ? '✅ All quick tests passed' : '⚠️ Some quick tests failed',
        details: {
          domUtils: domUtilsOk,
          cordycepsConversion: cordycepsOk,
          livePage: livePageOk,
          domUtilities: domUtilitiesOk,
          llmAiProcessing: llmAiOk,
          comprehensiveTestsRun: [
            'DOM Utilities Quick Test',
            'LLM & AI Processing Quick Test',
            'Utility Functions Quick Test',
            'Configuration & Validation Quick Test',
          ],
        },
      });

      return allPassed;
    } catch (error) {
      this.events.emit({
        timestamp: Date.now(),
        severity: Severity.Error,
        message: '❌ Quick tests failed',
        details: { error: String(error) },
      });
      return false;
    }
  }
}
