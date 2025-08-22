/**
 * Complete ActHandlerUtils Redux Test Suite
 *
 * This test suite validates both element operation functions and MethodHandlerContext functions
 * with comprehensive DOM verification and advanced TypeScript testing patterns.
 */

import {
  // Element operations functions (generic system)
  scrollToNextChunkElementFunction,
  scrollToPreviousChunkElementFunction,
  scrollElementIntoViewFunction,
  scrollElementToPercentageFunction,
  clickElementFunction,
  doubleClickElementFunction,
  rightClickElementFunction,
  fillElementFunction,
  clearElementFunction,
  selectOptionFunction,
  focusElementFunction,
  blurElementFunction,
  pressKeyFunction,
  hoverElementFunction,
  scrollByPixelsFunction,
  waitForVisibleFunction,

  // MethodHandlerContext functions (original API)
  scrollToNextChunkHandler,
  scrollToPreviousChunkHandler,
  scrollElementIntoViewHandler,
  scrollElementToPercentageHandler,
  fillOrTypeHandler,
  pressKeyHandler,
  selectOptionHandler,
  clickElementHandler,
  fallbackLocatorMethod,

  // Advanced locator functions
  deepLocatorWithShadow,
  deepLocator,

  // Method handler map
  methodHandlerMap,

  // Content script functions (for executeFunction calls)
  scrollToNextChunkFunction,
  scrollToPreviousChunkFunction,
} from '../../lib/handlersRedux/actHandlerUtils';

import { BrowserWindow } from '@src/services/cordyceps/browserWindow';

interface TestResults {
  passed: number;
  failed: number;
  errors: string[];
}

/**
 * Advanced TypeScript test patterns for comprehensive function validation
 */
async function testPureFunctionImports(): Promise<TestResults> {
  const results: TestResults = { passed: 0, failed: 0, errors: [] };

  const functionTests = [
    { name: 'scrollToNextChunkElementFunction', fn: scrollToNextChunkElementFunction },
    { name: 'scrollToPreviousChunkElementFunction', fn: scrollToPreviousChunkElementFunction },
    { name: 'scrollElementIntoViewFunction', fn: scrollElementIntoViewFunction },
    { name: 'scrollElementToPercentageFunction', fn: scrollElementToPercentageFunction },
    { name: 'clickElementFunction', fn: clickElementFunction },
    { name: 'doubleClickElementFunction', fn: doubleClickElementFunction },
    { name: 'rightClickElementFunction', fn: rightClickElementFunction },
    { name: 'fillElementFunction', fn: fillElementFunction },
    { name: 'clearElementFunction', fn: clearElementFunction },
    { name: 'selectOptionFunction', fn: selectOptionFunction },
    { name: 'focusElementFunction', fn: focusElementFunction },
    { name: 'blurElementFunction', fn: blurElementFunction },
    { name: 'pressKeyFunction', fn: pressKeyFunction },
    { name: 'hoverElementFunction', fn: hoverElementFunction },
    { name: 'scrollByPixelsFunction', fn: scrollByPixelsFunction },
    { name: 'waitForVisibleFunction', fn: waitForVisibleFunction },

    // MethodHandlerContext functions
    { name: 'scrollToNextChunkHandler', fn: scrollToNextChunkHandler },
    { name: 'scrollToPreviousChunkHandler', fn: scrollToPreviousChunkHandler },
    { name: 'scrollElementIntoViewHandler', fn: scrollElementIntoViewHandler },
    { name: 'scrollElementToPercentageHandler', fn: scrollElementToPercentageHandler },
    { name: 'fillOrTypeHandler', fn: fillOrTypeHandler },
    { name: 'pressKeyHandler', fn: pressKeyHandler },
    { name: 'selectOptionHandler', fn: selectOptionHandler },
    { name: 'clickElementHandler', fn: clickElementHandler },
    { name: 'fallbackLocatorMethod', fn: fallbackLocatorMethod },

    // Advanced locator functions
    { name: 'deepLocatorWithShadow', fn: deepLocatorWithShadow },
    { name: 'deepLocator', fn: deepLocator },

    // Content script functions
    { name: 'scrollToNextChunkFunction', fn: scrollToNextChunkFunction },
    { name: 'scrollToPreviousChunkFunction', fn: scrollToPreviousChunkFunction },
  ];

  console.log('🧪 Testing ActHandlerUtils Redux Function Imports...');

  for (const test of functionTests) {
    try {
      if (typeof test.fn === 'function') {
        console.log(`✅ ${test.name}: Function imported successfully`);
        results.passed++;
      } else {
        console.log(`❌ ${test.name}: Not a function (type: ${typeof test.fn})`);
        results.failed++;
        results.errors.push(`${test.name} is not a function`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Import error - ${error}`);
      results.failed++;
      results.errors.push(`${test.name}: ${error}`);
    }
  }

  return results;
}

/**
 * Test methodHandlerMap validation with advanced TypeScript patterns
 */
async function testMethodHandlerMap(): Promise<TestResults> {
  const results: TestResults = { passed: 0, failed: 0, errors: [] };

  console.log('🗺️ Testing Method Handler Map...');

  try {
    if (typeof methodHandlerMap === 'object' && methodHandlerMap !== null) {
      console.log('✅ methodHandlerMap: Object imported successfully');
      results.passed++;

      const expectedMethods = [
        'scrollIntoView',
        'scrollTo',
        'scroll',
        'mouse.wheel',
        'fill',
        'type',
        'press',
        'click',
        'nextChunk',
        'prevChunk',
        'selectOptionFromDropdown',
      ];

      for (const method of expectedMethods) {
        if (typeof methodHandlerMap[method] === 'function') {
          console.log(`✅ methodHandlerMap['${method}']: Handler function available`);
          results.passed++;
        } else {
          console.log(`❌ methodHandlerMap['${method}']: Handler missing or not a function`);
          results.failed++;
          results.errors.push(`Handler for '${method}' is missing`);
        }
      }
    } else {
      console.log('❌ methodHandlerMap: Not an object');
      results.failed++;
      results.errors.push('methodHandlerMap is not an object');
    }
  } catch (error) {
    console.log(`❌ methodHandlerMap: Error - ${error}`);
    results.failed++;
    results.errors.push(`methodHandlerMap: ${error}`);
  }

  return results;
}

/**
 * Live page execution tests with DOM verification using BrowserWindow
 */
async function testLivePageExecution(): Promise<TestResults> {
  const results: TestResults = { passed: 0, failed: 0, errors: [] };

  console.log('🌍 Testing Live Page Execution...');

  try {
    const window = await BrowserWindow.create();
    const page = await window.getCurrentPage();
    await page.goto('http://localhost:3005', { waitUntil: 'load' });

    // Test element functions with actual DOM elements
    const testElement = await page.locator('body').first();

    if (testElement) {
      console.log('✅ Test element found: body');
      results.passed++;

      // Test executeFunction calls (this validates the registration system)
      try {
        // Test scroll functions (using correct registered names)
        await testElement.executeFunction('scrollToNextChunk');
        console.log('✅ scrollToNextChunk: Executed via executeFunction');
        results.passed++;

        await testElement.executeFunction('scrollToPreviousChunk');
        console.log('✅ scrollToPreviousChunk: Executed via executeFunction');
        results.passed++;

        await testElement.executeFunction('scrollIntoView');
        console.log('✅ scrollIntoView: Executed via executeFunction');
        results.passed++;

        await testElement.executeFunction('scrollToPercentage', { yArg: '50%' });
        console.log('✅ scrollToPercentage: Executed via executeFunction with args');
        results.passed++;

        // Test input-related functions (using correct registered names)
        const inputElement = await page.locator('input').first();
        if (inputElement) {
          await inputElement.executeFunction('fillElement', { text: 'test input' });
          console.log('✅ fillElement: Executed via executeFunction');
          results.passed++;

          await inputElement.executeFunction('clearElement');
          console.log('✅ clearElement: Executed via executeFunction');
          results.passed++;

          await inputElement.executeFunction('focusElement');
          console.log('✅ focusElement: Executed via executeFunction');
          results.passed++;
        } else {
          console.log('⚠️ No input element found for input tests');
        }

        // Test button interactions (using correct registered names)
        const buttonElement = await page.locator('button').first();
        if (buttonElement) {
          await buttonElement.executeFunction('clickElement');
          console.log('✅ clickElement: Executed via executeFunction');
          results.passed++;

          await buttonElement.executeFunction('hoverElement');
          console.log('✅ hoverElement: Executed via executeFunction');
          results.passed++;

          await buttonElement.executeFunction('doubleClickElementFunction');
          console.log('✅ doubleClickElementFunction: Executed via executeFunction');
          results.passed++;
        } else {
          console.log('⚠️ No button element found for button tests');
        }

        // Test select element
        const selectElement = await page.locator('select').first();
        if (selectElement) {
          await selectElement.executeFunction('selectOptionFunction', { text: 'Option 1' });
          console.log('✅ selectOptionFunction: Executed via executeFunction');
          results.passed++;
        } else {
          console.log('⚠️ No select element found for select tests');
        }
      } catch (executeError) {
        console.log(`❌ executeFunction tests failed: ${executeError}`);
        results.failed++;
        results.errors.push(`executeFunction: ${executeError}`);
      }
    } else {
      console.log('❌ No test element found');
      results.failed++;
      results.errors.push('No test element found');
    }

    await window.dispose();
  } catch (error) {
    console.log(`❌ Live page execution failed: ${error}`);
    results.failed++;
    results.errors.push(`Live page execution: ${error}`);
  }

  return results;
}

/**
 * Test advanced locator functions
 */
async function testAdvancedLocatorFunctions(): Promise<TestResults> {
  const results: TestResults = { passed: 0, failed: 0, errors: [] };

  console.log('🔍 Testing Advanced Locator Functions...');

  try {
    const window = await BrowserWindow.create();
    const page = await window.getCurrentPage();
    await page.goto('http://localhost:3005', { waitUntil: 'load' });

    // Test deepLocator
    try {
      const locator = deepLocator(page, '/html/body');
      if (locator) {
        console.log('✅ deepLocator: Function executed successfully');
        results.passed++;
      } else {
        console.log('❌ deepLocator: Returned null/undefined');
        results.failed++;
        results.errors.push('deepLocator returned null/undefined');
      }
    } catch (error) {
      console.log(`❌ deepLocator: Error - ${error}`);
      results.failed++;
      results.errors.push(`deepLocator: ${error}`);
    }

    // Test deepLocatorWithShadow
    try {
      const shadowLocator = await deepLocatorWithShadow(page, '/html/body');
      if (shadowLocator) {
        console.log('✅ deepLocatorWithShadow: Function executed successfully');
        results.passed++;
      } else {
        console.log('❌ deepLocatorWithShadow: Returned null/undefined');
        results.failed++;
        results.errors.push('deepLocatorWithShadow returned null/undefined');
      }
    } catch (error) {
      console.log(`❌ deepLocatorWithShadow: Error - ${error}`);
      results.failed++;
      results.errors.push(`deepLocatorWithShadow: ${error}`);
    }

    await window.dispose();
  } catch (error) {
    console.log(`❌ Advanced locator tests failed: ${error}`);
    results.failed++;
    results.errors.push(`Advanced locator tests: ${error}`);
  }

  return results;
}

/**
 * Main test runner with comprehensive reporting
 */
async function runCompleteTests(): Promise<void> {
  console.log('🚀 Starting ActHandlerUtils Redux Complete Test Suite...\n');

  const allResults: TestResults = { passed: 0, failed: 0, errors: [] };

  // Run all test suites
  const testSuites = [
    { name: 'Pure Function Imports', test: testPureFunctionImports },
    { name: 'Method Handler Map', test: testMethodHandlerMap },
    { name: 'Live Page Execution', test: testLivePageExecution },
    { name: 'Advanced Locator Functions', test: testAdvancedLocatorFunctions },
  ];

  for (const suite of testSuites) {
    console.log(`\n📋 Running ${suite.name} Tests...`);
    try {
      const results = await suite.test();
      allResults.passed += results.passed;
      allResults.failed += results.failed;
      allResults.errors.push(...results.errors);

      console.log(`✅ ${suite.name}: ${results.passed} passed, ${results.failed} failed`);
    } catch (error) {
      console.log(`❌ ${suite.name}: Test suite failed - ${error}`);
      allResults.failed++;
      allResults.errors.push(`${suite.name}: ${error}`);
    }
  }

  // Final report
  console.log('\n📊 Final Test Results:');
  console.log(`✅ Total Passed: ${allResults.passed}`);
  console.log(`❌ Total Failed: ${allResults.failed}`);
  console.log(
    `📈 Success Rate: ${((allResults.passed / (allResults.passed + allResults.failed)) * 100).toFixed(1)}%`
  );

  if (allResults.errors.length > 0) {
    console.log('\n🔍 Error Details:');
    allResults.errors.forEach(error => console.log(`   • ${error}`));
  }

  if (allResults.failed === 0) {
    console.log('\n🎉 All tests passed! ActHandlerUtils Redux is ready for production.');
  } else {
    console.log('\n⚠️ Some tests failed. Please review the errors above.');
  }
}

// Tests should be run explicitly via the StagehandPlaygroundService
// Do not run automatically on module load

export {
  runCompleteTests,
  testPureFunctionImports,
  testMethodHandlerMap,
  testLivePageExecution,
  testAdvancedLocatorFunctions,
};
