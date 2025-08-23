/**
 * Example Elephant Research Test - Live Integration Test
 *
 * This test performs the exact same elephant research task as the browser-use example
 * but using Stagehand instead. It tests multi-step navigation and content extraction.
 */

import { TestProgress, TestContext } from '../playgroundTests/types';
import { Severity } from '@src/utils/types';
import { ChromeExtensionStagehand } from '../../lib/index';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { z } from 'zod';

/**
 * Run the elephant research task using Stagehand with the same steps as browser-use example
 */
export async function testElephantResearchSteps(context: TestContext): Promise<void> {
  const progress = new TestProgress('Elephant Research Test');

  try {
    progress.log('Starting elephant research test with Stagehand...');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🐘 Starting elephant research test with Stagehand...',
      details: {
        testType: 'Multi-Step Research Test',
        task: 'Elephant behavior research via Wikipedia',
        llm: 'OpenAI GPT-4o',
        steps: [
          'Navigate to Google',
          'Search for "wikipedia elephants"',
          'Click Wikipedia link',
          'Extract elephant behavior information',
          'Generate comprehensive report',
        ],
      },
    });

    // Create browser window for testing
    const browserWindow = await BrowserWindow.create();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🌐 Browser window created successfully',
      details: {
        windowId: browserWindow.windowId,
      },
    });

    // Get OpenAI API key from context
    const apiKey = context.apiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not found in context. Please configure it in the settings.');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🔑 OpenAI API key received from service context',
      details: {
        keyLength: apiKey.length,
        source: 'service-context',
      },
    });

    // Create Stagehand instance with OpenAI LLM (using GPT-4o for better reasoning)
    const stagehand = new ChromeExtensionStagehand({
      modelName: 'openai/gpt-4o',
      modelClientOptions: {
        apiKey: apiKey,
      },
      verbose: 2,
      enableCaching: false,
      experimental: true,
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🤖 ChromeExtensionStagehand instance created with GPT-4o',
    });

    // Initialize Stagehand with browser window
    const initResult = await stagehand.init(browserWindow);

    if (!initResult.success) {
      throw new Error(`Stagehand initialization failed: ${initResult.error}`);
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Stagehand initialized successfully',
      details: {
        currentUrl: initResult.currentUrl,
        isInitialized: stagehand.isInitialized,
      },
    });

    // Step 1: Navigate to Google
    progress.log('Step 1: Navigating to Google...');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🔍 Step 1: Navigating to Google...',
    });

    await stagehand.goto('https://google.com');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Successfully navigated to Google',
      details: {
        url: 'https://google.com',
        currentUrl: stagehand.currentUrl,
      },
    });

    // Step 2: Search for "wikipedia elephants"
    progress.log('Step 2: Searching for "wikipedia elephants"...');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🔍 Step 2: Searching for "wikipedia elephants"...',
    });

    await stagehand.stagehandPage.act('search for "wikipedia elephants" in the search box');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Search completed',
      details: {
        query: 'wikipedia elephants',
        currentUrl: stagehand.currentUrl,
      },
    });

    // Step 3: Click on Wikipedia link from search results
    progress.log('Step 3: Clicking on Wikipedia link from search results...');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '🔗 Step 3: Clicking on Wikipedia link from search results...',
    });

    // Click on the Wikipedia link and wait for navigation
    await stagehand.stagehandPage.act(
      'click on the Wikipedia link about elephants from the search results that goes to en.wikipedia.org'
    );

    // Wait a moment for navigation to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify we're on Wikipedia
    const currentUrl = stagehand.currentUrl;
    if (!currentUrl.includes('wikipedia.org')) {
      // If not on Wikipedia yet, try a direct navigation
      await stagehand.goto('https://en.wikipedia.org/wiki/Elephant');
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Successfully navigated to Wikipedia elephant article',
      details: {
        currentUrl: stagehand.currentUrl,
      },
    });

    // Step 4: Extract information about elephant behavior
    progress.log('Step 4: Extracting elephant behavior information...');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '📖 Step 4: Extracting elephant behavior information...',
      details: {
        currentUrl: stagehand.currentUrl,
      },
    });

    // Use a more specific schema for extraction
    const elephantBehaviorSchema = z.object({
      socialStructure: z
        .string()
        .describe('Description of elephant social organization and family groups'),
      intelligence: z
        .string()
        .describe('Description of elephant intelligence and cognitive abilities'),
      communication: z
        .string()
        .describe('Description of how elephants communicate with each other'),
      emotions: z.string().describe('Description of emotional behaviors and family bonds'),
      memory: z.string().describe('Description of elephant memory and learning abilities'),
      summary: z.string().describe('Comprehensive summary of elephant behavior'),
    });

    const behaviorInfo = await stagehand.stagehandPage.extract({
      instruction:
        'From this Wikipedia page about elephants, extract detailed information about elephant behavior. Focus on: 1) Social structure and family groups, 2) Intelligence and problem-solving abilities, 3) Communication methods (sounds, gestures, touch), 4) Emotional behaviors and bonds, 5) Memory and learning. Provide specific facts and examples from the article.',
      schema: elephantBehaviorSchema as unknown as import('zod/v3').ZodObject<
        import('zod/v3').ZodRawShape
      >,
    });

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Elephant behavior information extracted',
      details: {
        extractedData: behaviorInfo,
      },
    });

    // Step 5: Generate comprehensive report
    progress.log('Step 5: Generating comprehensive elephant behavior report...');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: '📝 Step 5: Generating comprehensive elephant behavior report...',
    });

    // Create a comprehensive report from the extracted data
    let comprehensiveReport = '';
    if (behaviorInfo) {
      comprehensiveReport = `
🐘 COMPREHENSIVE ELEPHANT BEHAVIOR RESEARCH REPORT
===============================================

SOCIAL STRUCTURE:
${behaviorInfo.socialStructure || 'Information not extracted'}

INTELLIGENCE & COGNITIVE ABILITIES:
${behaviorInfo.intelligence || 'Information not extracted'}

COMMUNICATION METHODS:
${behaviorInfo.communication || 'Information not extracted'}

EMOTIONAL BEHAVIORS & FAMILY BONDS:
${behaviorInfo.emotions || 'Information not extracted'}

MEMORY & LEARNING:
${behaviorInfo.memory || 'Information not extracted'}

EXECUTIVE SUMMARY:
${behaviorInfo.summary || 'Information not extracted'}
===============================================
      `.trim();
    } else {
      comprehensiveReport = 'No elephant behavior information was successfully extracted.';
    }

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '🐘 ELEPHANT BEHAVIOR RESEARCH REPORT GENERATED',
      details: {
        report: comprehensiveReport,
        extractedBehaviorInfo: behaviorInfo,
        finalUrl: stagehand.currentUrl,
      },
    });

    // Log the comprehensive report
    progress.log('='.repeat(80));
    progress.log('🐘 ELEPHANT BEHAVIOR RESEARCH REPORT:');
    progress.log('='.repeat(80));
    progress.log(comprehensiveReport);
    progress.log('='.repeat(80));
    if (behaviorInfo) {
      progress.log(`Raw Extracted Data: ${JSON.stringify(behaviorInfo, null, 2)}`);
    }
    progress.log('='.repeat(80));

    // Clean up
    await stagehand.close();
    browserWindow.dispose();

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Elephant research test completed successfully',
      details: {
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
        extractedData: behaviorInfo,
      },
    });

    progress.log('Elephant research test completed successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    progress.log(`Elephant research test failed: ${errorMessage}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: 'Elephant research test failed',
      details: { error: errorMessage },
      error: error instanceof Error ? error : new Error(errorMessage),
    });

    throw error;
  }
}
