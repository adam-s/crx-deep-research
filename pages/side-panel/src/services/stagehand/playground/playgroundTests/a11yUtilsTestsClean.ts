/**
 * Comprehensive Test Coverage for A11y Utils - Pure Functions Focus
 *
 * This file provides extensive test coverage for the pure functions in utils.ts,
 * focusing on functions that don't require complex dependencies.
 */

import { Page } from '../../../cordyceps/page';
import { Frame } from '../../../cordyceps/frame';
import { TestContext } from './types';
import {
  cleanText,
  formatSimplifiedTree,
  getFrameRootXpath,
  getFrameRootXpathWithShadow,
  injectSubtrees,
} from '../../lib/a11y/utils';
import { AccessibilityNode, EncodedId } from '../../types/context';
import { Severity } from '@src/utils/types';

export interface A11yUtilsTestResult {
  testName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  performance?: {
    duration: number;
    elementsProcessed?: number;
  };
  apiCompliance?: {
    signatureMatch: boolean;
    returnTypeMatch: boolean;
    errorHandlingMatch: boolean;
    issues: string[];
  };
}

export interface A11yUtilsTestSuite {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  tests: A11yUtilsTestResult[];
  overallSuccess: boolean;
  totalDuration: number;
  coverage: {
    functionsTestedCount: number;
    totalFunctionsCount: number;
    edgeCasesCovered: number;
    errorScenariosChecked: number;
  };
}

/**
 * Main test runner for A11y utils pure functions testing
 */
export async function runA11yUtilsTests(
  _page: Page,
  context: TestContext
): Promise<A11yUtilsTestSuite> {
  const startTime = Date.now();
  const tests: A11yUtilsTestResult[] = [];

  console.log('🧪 Starting A11y utils pure functions tests...');

  // Helper function to run test with performance tracking
  const runTest = async (
    testName: string,
    testFunction: () => Promise<A11yUtilsTestResult>
  ): Promise<void> => {
    const testStartTime = Date.now();
    try {
      const result = await testFunction();
      result.performance = {
        ...result.performance,
        duration: Date.now() - testStartTime,
      };
      tests.push(result);

      context.events?.emit({
        timestamp: Date.now(),
        severity: result.success ? Severity.Success : Severity.Error,
        message: `${result.success ? '✅' : '❌'} ${testName}`,
        details: result.error ? { error: result.error } : undefined,
      });
    } catch (error) {
      tests.push({
        testName,
        success: false,
        error: String(error),
        performance: { duration: Date.now() - testStartTime },
        apiCompliance: {
          signatureMatch: false,
          returnTypeMatch: false,
          errorHandlingMatch: false,
          issues: [`Unexpected test execution error: ${error}`],
        },
      });
    }
  };

  // Test 1: cleanText function
  await runTest('cleanText - Basic functionality', () => testCleanTextBasic());
  await runTest('cleanText - Private-use characters', () => testCleanTextPUA());
  await runTest('cleanText - NBSP handling', () => testCleanTextNBSP());
  await runTest('cleanText - Edge cases', () => testCleanTextEdgeCases());

  // Test 2: formatSimplifiedTree function
  await runTest('formatSimplifiedTree - Simple tree', () => testFormatSimplifiedTreeBasic());
  await runTest('formatSimplifiedTree - Nested tree', () => testFormatSimplifiedTreeNested());
  await runTest('formatSimplifiedTree - Edge cases', () => testFormatSimplifiedTreeEdgeCases());

  // Test 3: Frame XPath functions
  await runTest('getFrameRootXpath - No frame', () => testGetFrameRootXpathNoFrame());
  await runTest('getFrameRootXpath - Valid frame', () => testGetFrameRootXpathValidFrame());
  await runTest('getFrameRootXpathWithShadow - Compatibility', () =>
    testGetFrameRootXpathWithShadowCompatibility()
  );

  // Test 4: Utility functions
  await runTest('injectSubtrees - Basic functionality', () => testInjectSubtreesBasic());

  // Test 5: Performance and stress tests
  await runTest('cleanText - Performance with large text', () => testCleanTextPerformance());
  await runTest('formatSimplifiedTree - Large tree performance', () =>
    testFormatSimplifiedTreePerformance()
  );

  const totalDuration = Date.now() - startTime;
  const passed = tests.filter(t => t.success).length;
  const failed = tests.length - passed;

  const coverage = {
    functionsTestedCount: 5, // Number of main functions tested (cleanText, formatSimplifiedTree, getFrameRootXpath, getFrameRootXpathWithShadow, injectSubtrees)
    totalFunctionsCount: 11, // Total functions in utils.ts
    edgeCasesCovered: tests.filter(
      t => t.testName.includes('Edge cases') || t.testName.includes('Error')
    ).length,
    errorScenariosChecked: tests.filter(t => t.testName.includes('Error')).length,
  };

  const suite: A11yUtilsTestSuite = {
    suiteName: 'A11y Utils Pure Functions Test Suite',
    totalTests: tests.length,
    passed,
    failed,
    tests,
    overallSuccess: failed === 0,
    totalDuration,
    coverage,
  };

  // Emit summary
  context.events?.emit({
    timestamp: Date.now(),
    severity: suite.overallSuccess ? Severity.Success : Severity.Error,
    message: `A11y Utils Tests Complete: ${passed}/${tests.length} passed`,
    details: {
      coverage: `${coverage.functionsTestedCount}/${coverage.totalFunctionsCount} functions tested`,
      edgeCases: `${coverage.edgeCasesCovered} edge cases covered`,
      performance: `Total duration: ${totalDuration}ms`,
    },
  });

  return suite;
}

/**
 * Test cleanText basic functionality
 */
async function testCleanTextBasic(): Promise<A11yUtilsTestResult> {
  try {
    const input = 'Hello   world  ';
    const result = cleanText(input);
    const expected = 'Hello world';

    return {
      testName: 'cleanText - Basic functionality',
      success: result === expected,
      result: { input, output: result, expected },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: result === expected ? [] : [`Expected "${expected}", got "${result}"`],
      },
    };
  } catch (error) {
    return {
      testName: 'cleanText - Basic functionality',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test cleanText with private-use area characters
 */
async function testCleanTextPUA(): Promise<A11yUtilsTestResult> {
  try {
    // Test with PUA characters (0xe000-0xf8ff)
    const puaChar1 = String.fromCharCode(0xe000);
    const puaChar2 = String.fromCharCode(0xf8ff);
    const input = `Hello${puaChar1}world${puaChar2}test`;
    const result = cleanText(input);
    const expected = 'Helloworldtest';

    return {
      testName: 'cleanText - Private-use characters',
      success: result === expected,
      result: { input: 'Hello[PUA]world[PUA]test', output: result, expected },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: result === expected ? [] : [`PUA characters not properly removed`],
      },
    };
  } catch (error) {
    return {
      testName: 'cleanText - Private-use characters',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test cleanText with NBSP characters
 */
async function testCleanTextNBSP(): Promise<A11yUtilsTestResult> {
  try {
    // Test with NBSP characters (0x00a0, 0x202f, 0x2007, 0xfeff)
    const nbsp = String.fromCharCode(0x00a0);
    const nnbsp = String.fromCharCode(0x202f);
    const input = `Hello${nbsp}${nbsp}world${nnbsp}test`;
    const result = cleanText(input);
    const expected = 'Hello world test';

    return {
      testName: 'cleanText - NBSP handling',
      success: result === expected,
      result: { input: 'Hello[NBSP][NBSP]world[NNBSP]test', output: result, expected },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: result === expected ? [] : [`NBSP characters not properly handled`],
      },
    };
  } catch (error) {
    return {
      testName: 'cleanText - NBSP handling',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test cleanText edge cases
 */
async function testCleanTextEdgeCases(): Promise<A11yUtilsTestResult> {
  try {
    const testCases = [
      { input: '', expected: '' },
      { input: '   ', expected: '' },
      { input: 'a', expected: 'a' },
      { input: '\n\t\r\n', expected: '' },
      { input: 'a\n\tb\r\nc', expected: 'a b c' },
    ];

    const results = testCases.map(({ input, expected }) => ({
      input,
      expected,
      actual: cleanText(input),
      passed: cleanText(input) === expected,
    }));

    const allPassed = results.every(r => r.passed);

    return {
      testName: 'cleanText - Edge cases',
      success: allPassed,
      result: results,
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: true,
        errorHandlingMatch: true,
        issues: allPassed
          ? []
          : results
              .filter(r => !r.passed)
              .map(r => `Failed: "${r.input}" -> "${r.actual}" (expected "${r.expected}")`),
      },
    };
  } catch (error) {
    return {
      testName: 'cleanText - Edge cases',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test formatSimplifiedTree basic functionality
 */
async function testFormatSimplifiedTreeBasic(): Promise<A11yUtilsTestResult> {
  try {
    const node: AccessibilityNode & { encodedId?: EncodedId } = {
      nodeId: '1',
      role: 'button',
      name: 'Click me',
      encodedId: 'frame-1' as EncodedId,
    };

    const result = formatSimplifiedTree(node);
    const expectedPattern = /^\[frame-1\] button: Click me\n$/;

    return {
      testName: 'formatSimplifiedTree - Simple tree',
      success: expectedPattern.test(result),
      result: { input: node, output: result },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: expectedPattern.test(result)
          ? []
          : [`Output format doesn't match expected pattern`],
      },
    };
  } catch (error) {
    return {
      testName: 'formatSimplifiedTree - Simple tree',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test formatSimplifiedTree with nested structure
 */
async function testFormatSimplifiedTreeNested(): Promise<A11yUtilsTestResult> {
  try {
    const childNode: AccessibilityNode & { encodedId?: EncodedId } = {
      nodeId: '2',
      role: 'text',
      name: 'Button text',
    };

    const parentNode: AccessibilityNode & { encodedId?: EncodedId } = {
      nodeId: '1',
      role: 'button',
      name: 'Click me',
      children: [childNode],
    };

    const result = formatSimplifiedTree(parentNode);
    const lines = result.split('\n').filter(line => line.trim());

    // Should have parent and child lines with proper indentation
    const hasParent = lines.some(line => line.includes('[1] button: Click me'));
    const hasChild = lines.some(
      line => line.includes('[2] text: Button text') && line.startsWith('  ')
    );

    return {
      testName: 'formatSimplifiedTree - Nested tree',
      success: hasParent && hasChild,
      result: { output: result, lines },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: hasParent && hasChild ? [] : [`Nested structure not properly formatted`],
      },
    };
  } catch (error) {
    return {
      testName: 'formatSimplifiedTree - Nested tree',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test formatSimplifiedTree edge cases
 */
async function testFormatSimplifiedTreeEdgeCases(): Promise<A11yUtilsTestResult> {
  try {
    const testCases = [
      {
        name: 'No name',
        node: { nodeId: '1', role: 'div' },
        shouldContain: '[1] div',
        shouldNotContain: ': ',
      },
      {
        name: 'No encodedId',
        node: { nodeId: '2', role: 'span', name: 'test' },
        shouldContain: '[2] span: test',
        shouldNotContain: 'undefined',
      },
      {
        name: 'Empty children array',
        node: { nodeId: '3', role: 'button', children: [] },
        shouldContain: '[3] button',
        shouldNotContain: '  [', // No child indentation
      },
    ];

    const results = testCases.map(({ name, node, shouldContain, shouldNotContain }) => {
      const output = formatSimplifiedTree(node as AccessibilityNode & { encodedId?: EncodedId });
      const containsRequired = output.includes(shouldContain);
      const doesNotContainForbidden = !shouldNotContain || !output.includes(shouldNotContain);

      return {
        name,
        passed: containsRequired && doesNotContainForbidden,
        output,
        shouldContain,
        shouldNotContain,
        containsRequired,
        doesNotContainForbidden,
      };
    });

    const allPassed = results.every(r => r.passed);

    return {
      testName: 'formatSimplifiedTree - Edge cases',
      success: allPassed,
      result: results,
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: true,
        errorHandlingMatch: true,
        issues: allPassed
          ? []
          : results.filter(r => !r.passed).map(r => `Failed ${r.name}: ${r.output}`),
      },
    };
  } catch (error) {
    return {
      testName: 'formatSimplifiedTree - Edge cases',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test getFrameRootXpath with no frame
 */
async function testGetFrameRootXpathNoFrame(): Promise<A11yUtilsTestResult> {
  try {
    const result = await getFrameRootXpath(undefined);

    return {
      testName: 'getFrameRootXpath - No frame',
      success: result === '/',
      result: { output: result },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: result === '/' ? [] : [`Expected '/', got '${result}'`],
      },
    };
  } catch (error) {
    return {
      testName: 'getFrameRootXpath - No frame',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test getFrameRootXpath with valid frame
 */
async function testGetFrameRootXpathValidFrame(): Promise<A11yUtilsTestResult> {
  try {
    const mockFrame = {
      url: () => 'https://example.com/page.html',
    } as Frame;

    const result = await getFrameRootXpath(mockFrame);
    const expected = '//iframe[@src="https://example.com/page.html"]';

    return {
      testName: 'getFrameRootXpath - Valid frame',
      success: result === expected,
      result: { output: result, expected },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: result === expected ? [] : [`Expected '${expected}', got '${result}'`],
      },
    };
  } catch (error) {
    return {
      testName: 'getFrameRootXpath - Valid frame',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test getFrameRootXpathWithShadow compatibility
 */
async function testGetFrameRootXpathWithShadowCompatibility(): Promise<A11yUtilsTestResult> {
  try {
    const mockFrame = {
      url: () => 'https://example.com/page.html',
    } as Frame;

    const regularResult = await getFrameRootXpath(mockFrame);
    const shadowResult = await getFrameRootXpathWithShadow(mockFrame);

    // For now, they should be the same
    return {
      testName: 'getFrameRootXpathWithShadow - Compatibility',
      success: regularResult === shadowResult,
      result: { regularResult, shadowResult },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof shadowResult === 'string',
        errorHandlingMatch: true,
        issues: regularResult === shadowResult ? [] : [`Results don't match`],
      },
    };
  } catch (error) {
    return {
      testName: 'getFrameRootXpathWithShadow - Compatibility',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test injectSubtrees basic functionality
 */
async function testInjectSubtreesBasic(): Promise<A11yUtilsTestResult> {
  try {
    const tree = '[1] button: Test\n[2] text: Button text';
    const idToTree = new Map<EncodedId, string>();

    const result = injectSubtrees(tree, idToTree);

    // For now, it should return the tree unchanged (simplified implementation)
    return {
      testName: 'injectSubtrees - Basic functionality',
      success: result === tree,
      result: { input: tree, output: result },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: result === tree ? [] : [`Output doesn't match input for simplified implementation`],
      },
    };
  } catch (error) {
    return {
      testName: 'injectSubtrees - Basic functionality',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test cleanText performance with large text
 */
async function testCleanTextPerformance(): Promise<A11yUtilsTestResult> {
  try {
    // Create a large text with various characters
    const largeText = 'Hello world '.repeat(10000);
    const startTime = Date.now();
    const result = cleanText(largeText);
    const duration = Date.now() - startTime;

    // Should complete within reasonable time
    const isPerformant = duration < 1000; // 1 second max
    const isCorrect = result === 'Hello world'.repeat(10000);

    return {
      testName: 'cleanText - Performance with large text',
      success: isPerformant && isCorrect,
      result: {
        inputLength: largeText.length,
        outputLength: result.length,
        duration,
        isPerformant,
        isCorrect,
      },
      performance: {
        duration,
        elementsProcessed: largeText.length,
      },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: [
          ...(isCorrect ? [] : [`Output not correct`]),
          ...(isPerformant ? [] : [`Performance issue: took ${duration}ms`]),
        ],
      },
    };
  } catch (error) {
    return {
      testName: 'cleanText - Performance with large text',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Test formatSimplifiedTree performance with large tree
 */
async function testFormatSimplifiedTreePerformance(): Promise<A11yUtilsTestResult> {
  try {
    // Create a simple deep tree structure for performance testing
    const createDeepNode = (depth: number): AccessibilityNode & { encodedId?: EncodedId } => {
      const node: AccessibilityNode & { encodedId?: EncodedId } = {
        nodeId: depth.toString(),
        role: 'div',
        name: `Node ${depth}`,
      };

      if (depth > 1) {
        node.children = [createDeepNode(depth - 1)];
      }

      return node;
    };

    const rootNode = createDeepNode(100); // Create a 100-level deep tree

    const startTime = Date.now();
    const result = formatSimplifiedTree(rootNode);
    const duration = Date.now() - startTime;

    // Should complete within reasonable time
    const isPerformant = duration < 2000; // 2 seconds max
    const hasOutput = result.length > 0;
    const hasCorrectStructure =
      result.includes('[100] div: Node 100') && result.includes('[1] div: Node 1');

    return {
      testName: 'formatSimplifiedTree - Large tree performance',
      success: isPerformant && hasOutput && hasCorrectStructure,
      result: {
        outputLength: result.length,
        duration,
        isPerformant,
        hasOutput,
        hasCorrectStructure,
      },
      performance: {
        duration,
        elementsProcessed: 100,
      },
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: typeof result === 'string',
        errorHandlingMatch: true,
        issues: [
          ...(hasOutput ? [] : [`No output generated`]),
          ...(hasCorrectStructure ? [] : [`Structure not correct`]),
          ...(isPerformant ? [] : [`Performance issue: took ${duration}ms`]),
        ],
      },
    };
  } catch (error) {
    return {
      testName: 'formatSimplifiedTree - Large tree performance',
      success: false,
      error: String(error),
      apiCompliance: {
        signatureMatch: true,
        returnTypeMatch: false,
        errorHandlingMatch: false,
        issues: [`Function threw error: ${error}`],
      },
    };
  }
}

/**
 * Generate a comprehensive test report
 */
export function generateA11yUtilsTestReport(suite: A11yUtilsTestSuite): {
  summary: string;
  recommendations: string[];
  criticalIssues: string[];
  coverageReport: string;
} {
  const summary = `
A11y Utils Test Suite Results:
- Total Tests: ${suite.totalTests}
- Passed: ${suite.passed}
- Failed: ${suite.failed}
- Success Rate: ${((suite.passed / suite.totalTests) * 100).toFixed(1)}%
- Total Duration: ${suite.totalDuration}ms
- Functions Tested: ${suite.coverage.functionsTestedCount}/${suite.coverage.totalFunctionsCount}
- Edge Cases Covered: ${suite.coverage.edgeCasesCovered}
- Error Scenarios: ${suite.coverage.errorScenariosChecked}
`;

  const recommendations: string[] = [];
  const criticalIssues: string[] = [];

  // Analyze test results for recommendations
  suite.tests.forEach(test => {
    if (!test.success) {
      criticalIssues.push(`${test.testName}: ${test.error}`);
    }

    if (test.apiCompliance && test.apiCompliance.issues.length > 0) {
      test.apiCompliance.issues.forEach(issue => {
        if (issue.includes('error') || issue.includes('fail')) {
          criticalIssues.push(`${test.testName}: ${issue}`);
        } else {
          recommendations.push(`${test.testName}: ${issue}`);
        }
      });
    }

    if (test.performance && test.performance.duration > 1000) {
      recommendations.push(
        `${test.testName}: Consider performance optimization (${test.performance.duration}ms)`
      );
    }
  });

  // Add general recommendations
  if (suite.coverage.functionsTestedCount < suite.coverage.totalFunctionsCount) {
    recommendations.push('Increase function coverage to 100%');
  }

  if (suite.coverage.edgeCasesCovered < 5) {
    recommendations.push('Add more edge case testing');
  }

  const coverageReport = `
Function Coverage: ${suite.coverage.functionsTestedCount}/${suite.coverage.totalFunctionsCount} (${((suite.coverage.functionsTestedCount / suite.coverage.totalFunctionsCount) * 100).toFixed(1)}%)
Edge Cases Tested: ${suite.coverage.edgeCasesCovered}
Error Scenarios: ${suite.coverage.errorScenariosChecked}
`;

  return {
    summary: summary.trim(),
    recommendations,
    criticalIssues,
    coverageReport: coverageReport.trim(),
  };
}

/**
 * Quick test runner for integration with stagehandPlayground.service.ts
 */
export async function quickA11yUtilsTest(): Promise<boolean> {
  try {
    // For the quick test, just test the pure functions
    const cleanTextResult = cleanText('  hello   world  ');
    const cleanTextPassed = cleanTextResult === 'hello world';

    const mockNode: AccessibilityNode & { encodedId?: EncodedId } = {
      nodeId: '1',
      role: 'button',
      name: 'Test',
    };
    const formatResult = formatSimplifiedTree(mockNode);
    const formatPassed = formatResult.includes('[1] button: Test');

    return cleanTextPassed && formatPassed;
  } catch (error) {
    console.error('Quick A11y utils test failed:', error);
    return false;
  }
}
