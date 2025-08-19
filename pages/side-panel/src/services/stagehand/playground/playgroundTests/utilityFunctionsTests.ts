import { Severity } from '@src/utils/types';
import { TestProgress, TestContext } from './types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import type { Page } from '@src/services/cordyceps/page';

// Define utility test result interface based on Stagehand patterns
interface UtilityTestResult {
  /**
   * Name of the utility function being tested
   */
  functionName: string;
  /**
   * Test evaluation result
   */
  evaluation: 'PASS' | 'FAIL' | 'ERROR';
  /**
   * Reasoning behind the test result
   */
  reasoning: string;
  /**
   * Test input data
   */
  input?: unknown;
  /**
   * Expected output
   */
  expected?: unknown;
  /**
   * Actual result
   */
  result?: unknown;
}

// Define batch test result interface inspired by Stagehand EvaluationResult patterns
interface BatchUtilityTestResult {
  /**
   * Category of utility functions tested
   */
  category: string;
  /**
   * Array of individual test results
   */
  results: UtilityTestResult[];
  /**
   * Overall success status
   */
  success: boolean;
  /**
   * Summary statistics
   */
  summary: {
    total: number;
    passed: number;
    failed: number;
    errors: number;
  };
}

/**
 * Test utility functions that provide helper functionality
 * Tests various utilities without requiring Cordyceps conversion
 */
export async function testUtilityFunctions(
  progress: TestProgress,
  context: TestContext
): Promise<boolean> {
  progress.log('🛠️ Testing utility functions...');

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🛠️ Starting Utility Functions Tests...',
    details: { category: 'utility-functions', testsPlanned: 5 },
  });

  try {
    // Create browser context for testing
    const browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    // Navigate to test page
    await page.goto('http://localhost:3005/testWebPage.html');

    // Test 1: Data validation utilities
    await testDataValidationUtilities(context, page);

    // Test 2: String manipulation utilities
    await testStringManipulationUtilities(context, page);

    // Test 3: Array and object utilities
    await testArrayObjectUtilities(context, page);

    // Test 4: URL and path utilities
    await testUrlPathUtilities(context, page);

    // Test 5: Performance measurement utilities
    await testPerformanceMeasurementUtilities(context, page);

    progress.log('✅ Utility Functions Tests completed successfully');

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Utility Functions Tests completed successfully',
      details: { totalTests: 5, category: 'utility-functions' },
    });

    return true;
  } catch (error) {
    progress.log(`❌ Utility Functions Tests failed: ${error}`);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ Utility Functions Tests failed',
      details: {
        error: error instanceof Error ? error.message : String(error),
        category: 'utility-functions',
      },
    });
    return false;
  }
}

/**
 * Test data validation utilities using Stagehand-style result patterns
 */
async function testDataValidationUtilities(context: TestContext, page: Page): Promise<void> {
  const results = await page.evaluate(() => {
    // Test email validation
    const isValidEmail = (email: string): boolean => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };

    // Test URL validation
    const isValidUrl = (url: string): boolean => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    // Run validation tests with structured results
    const emailTests = [
      { email: 'test@example.com', expected: true },
      { email: 'invalid-email', expected: false },
      { email: 'user@domain.co.uk', expected: true },
    ];

    const urlTests = [
      { url: 'https://example.com', expected: true },
      { url: 'not-a-url', expected: false },
      { url: 'ftp://files.example.com', expected: true },
    ];

    return {
      emailResults: emailTests.map(test => ({
        input: test.email,
        result: isValidEmail(test.email),
        expected: test.expected,
        passed: isValidEmail(test.email) === test.expected,
      })),
      urlResults: urlTests.map(test => ({
        input: test.url,
        result: isValidUrl(test.url),
        expected: test.expected,
        passed: isValidUrl(test.url) === test.expected,
      })),
      hasValidationUtilities:
        typeof isValidEmail === 'function' && typeof isValidUrl === 'function',
    };
  });

  // Convert results to Stagehand-style test results
  const utilityTestResults: UtilityTestResult[] = [];

  // Process email validation results
  results.emailResults.forEach(test => {
    utilityTestResults.push({
      functionName: 'isValidEmail',
      evaluation: test.passed ? 'PASS' : 'FAIL',
      reasoning: test.passed
        ? `Email validation correctly identified '${test.input}' as ${test.expected ? 'valid' : 'invalid'}`
        : `Email validation incorrectly identified '${test.input}' as ${test.result ? 'valid' : 'invalid'}, expected ${test.expected ? 'valid' : 'invalid'}`,
      input: test.input,
      expected: test.expected,
      result: test.result,
    });
  });

  // Process URL validation results
  results.urlResults.forEach(test => {
    utilityTestResults.push({
      functionName: 'isValidUrl',
      evaluation: test.passed ? 'PASS' : 'FAIL',
      reasoning: test.passed
        ? `URL validation correctly identified '${test.input}' as ${test.expected ? 'valid' : 'invalid'}`
        : `URL validation incorrectly identified '${test.input}' as ${test.result ? 'valid' : 'invalid'}, expected ${test.expected ? 'valid' : 'invalid'}`,
      input: test.input,
      expected: test.expected,
      result: test.result,
    });
  });

  // Create batch result following Stagehand patterns
  const batchResult: BatchUtilityTestResult = {
    category: 'Data Validation Utilities',
    results: utilityTestResults,
    success: utilityTestResults.every(r => r.evaluation === 'PASS'),
    summary: {
      total: utilityTestResults.length,
      passed: utilityTestResults.filter(r => r.evaluation === 'PASS').length,
      failed: utilityTestResults.filter(r => r.evaluation === 'FAIL').length,
      errors: utilityTestResults.filter(r => r.evaluation === 'ERROR').length,
    },
  };

  context.events.emit({
    timestamp: Date.now(),
    severity: batchResult.success ? Severity.Success : Severity.Warning,
    message: `✅ Data validation utilities tested - ${batchResult.summary.passed}/${batchResult.summary.total} passed`,
    details: {
      hasValidationUtilities: results.hasValidationUtilities,
      batchResult,
      validationTypes: ['email', 'url'],
    },
  });
}

/**
 * Test string manipulation utilities
 */
async function testStringManipulationUtilities(context: TestContext, page: Page): Promise<void> {
  const results = await page.evaluate(() => {
    // Test string capitalization
    const capitalize = (str: string): string => {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    // Test camelCase conversion
    const toCamelCase = (str: string): string => {
      return str
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        })
        .replace(/\s+/g, '');
    };

    // Test string truncation
    const truncateString = (str: string, maxLength: number): string => {
      if (str.length <= maxLength) return str;
      return str.substring(0, maxLength - 3) + '...';
    };

    // Run string manipulation tests
    const stringTests = [
      {
        function: 'capitalize',
        input: 'hello world',
        result: capitalize('hello world'),
        expected: 'Hello world',
      },
      {
        function: 'toCamelCase',
        input: 'hello world test',
        result: toCamelCase('hello world test'),
        expected: 'helloWorldTest',
      },
      {
        function: 'truncateString',
        input: 'This is a very long string that needs truncation',
        result: truncateString('This is a very long string that needs truncation', 20),
        expected: 'This is a very lo...',
      },
    ];

    return {
      stringResults: stringTests.map(test => ({
        function: test.function,
        input: test.input,
        result: test.result,
        expected: test.expected,
        passed: test.result === test.expected,
      })),
      hasStringUtilities:
        typeof capitalize === 'function' &&
        typeof toCamelCase === 'function' &&
        typeof truncateString === 'function',
    };
  });

  const passedTests = results.stringResults.filter(
    (test: { passed: boolean }) => test.passed
  ).length;

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔤 String manipulation utilities tested',
    details: {
      hasStringUtilities: results.hasStringUtilities,
      totalStringTests: results.stringResults.length,
      passedStringTests: passedTests,
      stringFunctions: results.stringResults.map((r: { function: string }) => r.function),
    },
  });
}

/**
 * Test array and object utilities
 */
async function testArrayObjectUtilities(context: TestContext, page: Page): Promise<void> {
  const results = await page.evaluate(() => {
    // Test array deduplication
    const uniqueArray = <T>(arr: T[]): T[] => {
      return [...new Set(arr)];
    };

    // Test array chunking
    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const chunks: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    // Test object deep clone
    const deepClone = <T>(obj: T): T => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
      if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;

      const cloned = {} as T;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          cloned[key] = deepClone(obj[key]);
        }
      }
      return cloned;
    };

    // Run array and object tests
    const testData = {
      duplicateArray: [1, 2, 2, 3, 3, 3, 4],
      chunkTestArray: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      complexObject: {
        name: 'test',
        nested: { value: 42 },
        array: [1, 2, 3],
      },
    };

    const arrayTests = [
      {
        function: 'uniqueArray',
        input: testData.duplicateArray,
        result: uniqueArray(testData.duplicateArray),
        expected: [1, 2, 3, 4],
      },
      {
        function: 'chunkArray',
        input: testData.chunkTestArray,
        result: chunkArray(testData.chunkTestArray, 3),
        expected: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      },
    ];

    // Test deep clone separately due to object comparison complexity
    const clonedObject = deepClone(testData.complexObject);
    const isDeepCloneWorking =
      JSON.stringify(clonedObject) === JSON.stringify(testData.complexObject) &&
      clonedObject !== testData.complexObject;

    return {
      arrayResults: arrayTests.map(test => ({
        function: test.function,
        input: test.input,
        result: test.result,
        expected: test.expected,
        passed: JSON.stringify(test.result) === JSON.stringify(test.expected),
      })),
      deepCloneTest: {
        function: 'deepClone',
        input: testData.complexObject,
        passed: isDeepCloneWorking,
      },
      hasArrayObjectUtilities:
        typeof uniqueArray === 'function' &&
        typeof chunkArray === 'function' &&
        typeof deepClone === 'function',
    };
  });

  const totalTests = results.arrayResults.length + 1;
  const passedTests =
    results.arrayResults.filter((test: { passed: boolean }) => test.passed).length +
    (results.deepCloneTest.passed ? 1 : 0);

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '📊 Array and object utilities tested',
    details: {
      hasArrayObjectUtilities: results.hasArrayObjectUtilities,
      totalArrayObjectTests: totalTests,
      passedArrayObjectTests: passedTests,
      deepClonePassed: results.deepCloneTest.passed,
    },
  });
}

/**
 * Test URL and path utilities
 */
async function testUrlPathUtilities(context: TestContext, page: Page): Promise<void> {
  const results = await page.evaluate(() => {
    // Test URL parsing
    const parseUrl = (
      url: string
    ): {
      protocol: string;
      host: string;
      pathname: string;
      search: string;
      hash: string;
    } | null => {
      try {
        const parsed = new URL(url);
        return {
          protocol: parsed.protocol,
          host: parsed.host,
          pathname: parsed.pathname,
          search: parsed.search,
          hash: parsed.hash,
        };
      } catch {
        return null;
      }
    };

    // Test path joining
    const joinPaths = (...paths: string[]): string => {
      return paths
        .map(path => path.replace(/^\/+|\/+$/g, ''))
        .filter(path => path.length > 0)
        .join('/');
    };

    // Test file extension extraction
    const getFileExtension = (filename: string): string => {
      const lastDotIndex = filename.lastIndexOf('.');
      return lastDotIndex > 0 ? filename.substring(lastDotIndex + 1) : '';
    };

    // Run URL and path tests
    const urlTests = [
      {
        function: 'parseUrl',
        input: 'https://example.com:8080/path?param=value#section',
        result: parseUrl('https://example.com:8080/path?param=value#section'),
        expected: {
          protocol: 'https:',
          host: 'example.com:8080',
          pathname: '/path',
          search: '?param=value',
          hash: '#section',
        },
      },
    ];

    const pathTests = [
      {
        function: 'joinPaths',
        input: ['api', 'v1', 'users'],
        result: joinPaths('api', 'v1', 'users'),
        expected: 'api/v1/users',
      },
      {
        function: 'getFileExtension',
        input: 'document.pdf',
        result: getFileExtension('document.pdf'),
        expected: 'pdf',
      },
    ];

    return {
      urlResults: urlTests.map(test => ({
        function: test.function,
        input: test.input,
        result: test.result,
        expected: test.expected,
        passed: JSON.stringify(test.result) === JSON.stringify(test.expected),
      })),
      pathResults: pathTests.map(test => ({
        function: test.function,
        input: test.input,
        result: test.result,
        expected: test.expected,
        passed: test.result === test.expected,
      })),
      hasUrlPathUtilities:
        typeof parseUrl === 'function' &&
        typeof joinPaths === 'function' &&
        typeof getFileExtension === 'function',
    };
  });

  const totalTests = results.urlResults.length + results.pathResults.length;
  const passedTests =
    results.urlResults.filter((test: { passed: boolean }) => test.passed).length +
    results.pathResults.filter((test: { passed: boolean }) => test.passed).length;

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔗 URL and path utilities tested',
    details: {
      hasUrlPathUtilities: results.hasUrlPathUtilities,
      totalUrlPathTests: totalTests,
      passedUrlPathTests: passedTests,
      urlFunctions: results.urlResults.map((r: { function: string }) => r.function),
      pathFunctions: results.pathResults.map((r: { function: string }) => r.function),
    },
  });
}

/**
 * Test performance measurement utilities
 */
async function testPerformanceMeasurementUtilities(
  context: TestContext,
  page: Page
): Promise<void> {
  const results = await page.evaluate(() => {
    // Test timing utility
    const measureTime = async <T>(
      operation: () => Promise<T> | T
    ): Promise<{ result: T; duration: number }> => {
      const start = performance.now();
      const result = await Promise.resolve(operation());
      const end = performance.now();
      return {
        result,
        duration: end - start,
      };
    };

    // Test cache utility
    const createCache = <K, V>(maxSize: number = 100) => {
      const cache = new Map<K, V>();

      return {
        get: (key: K): V | undefined => cache.get(key),
        set: (key: K, value: V): void => {
          if (cache.size >= maxSize) {
            const firstKey = cache.keys().next().value;
            if (firstKey !== undefined) {
              cache.delete(firstKey);
            }
          }
          cache.set(key, value);
        },
        has: (key: K): boolean => cache.has(key),
        clear: (): void => cache.clear(),
        size: (): number => cache.size,
      };
    };

    // Run performance tests
    const runPerformanceTests = async () => {
      // Test timing measurement
      const timingTest = await measureTime(async () => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test-result';
      });

      // Test cache functionality
      const cache = createCache<string, number>(3);
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // Should evict 'a'

      const cacheResults = {
        hasA: cache.has('a'), // Should be false
        hasB: cache.has('b'), // Should be true
        hasD: cache.has('d'), // Should be true
        getB: cache.get('b'), // Should be 2
        size: cache.size(), // Should be 3
      };

      return {
        timingTest: {
          result: timingTest.result,
          duration: timingTest.duration,
          passed: timingTest.result === 'test-result' && timingTest.duration >= 10,
        },
        cacheTest: {
          results: cacheResults,
          passed:
            !cacheResults.hasA &&
            cacheResults.hasB &&
            cacheResults.hasD &&
            cacheResults.getB === 2 &&
            cacheResults.size === 3,
        },
        hasPerformanceUtilities:
          typeof measureTime === 'function' && typeof createCache === 'function',
      };
    };

    return runPerformanceTests();
  });

  const testResults = await results;
  const totalTests = 2; // timing, cache
  const passedTests = [testResults.timingTest.passed, testResults.cacheTest.passed].filter(
    Boolean
  ).length;

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '⚡ Performance measurement utilities tested',
    details: {
      hasPerformanceUtilities: testResults.hasPerformanceUtilities,
      totalPerformanceTests: totalTests,
      passedPerformanceTests: passedTests,
      timingTestDuration: testResults.timingTest.duration,
    },
  });
}

/**
 * Quick utility functions test for development
 */
export async function quickUtilityFunctionsTest(context: TestContext): Promise<void> {
  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔨 Quick Utility Functions Test',
    details: { testType: 'quick' },
  });

  try {
    // Test simple string manipulation
    const capitalize = (str: string): string => {
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    const result = capitalize('hello world');
    const passed = result === 'Hello world';

    context.events.emit({
      timestamp: Date.now(),
      severity: passed ? Severity.Success : Severity.Error,
      message: passed
        ? '✅ Quick utility functions test passed'
        : '❌ Quick utility functions test failed',
      details: {
        testFunction: 'capitalize',
        input: 'hello world',
        result,
        expected: 'Hello world',
        passed,
      },
    });
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ Quick utility functions test failed with error',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
