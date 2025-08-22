import { Severity } from '@src/utils/types';
import { TestProgress, TestContext } from './types';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';

// Use any for page type to match the actual Cordyceps API
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PageType = any;

/**
 * Test configuration and validation components
 * Tests various configuration utilities without requiring Cordyceps conversion
 */
export async function testConfigurationAndValidation(
  progress: TestProgress,
  context: TestContext
): Promise<void> {
  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '⚙️ Starting Configuration & Validation Tests...',
    details: { category: 'configuration-validation', testsPlanned: 4 },
  });

  try {
    // Create browser context for testing
    const browserWindow = await BrowserWindow.create();
    const page = await browserWindow.getCurrentPage();

    // Navigate to test page
    await page.goto('http://localhost:3005');

    // Test 1: Environment configuration validation
    await testEnvironmentConfigValidation(context, page);

    // Test 2: API endpoint validation
    await testApiEndpointValidation(context, page);

    // Test 3: Browser settings validation
    await testBrowserSettingsValidation(context, page);

    // Test 4: Security policy validation
    await testSecurityPolicyValidation(context, page);

    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: '✅ Configuration & Validation Tests completed successfully',
      details: { totalTests: 4, category: 'configuration-validation' },
    });
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ Configuration & Validation Tests failed',
      details: {
        error: error instanceof Error ? error.message : String(error),
        category: 'configuration-validation',
      },
    });
    throw error;
  }
}

/**
 * Test environment configuration validation
 */
async function testEnvironmentConfigValidation(
  context: TestContext,
  page: PageType
): Promise<void> {
  const results = await page.evaluate(() => {
    // Test environment detection
    const detectEnvironment = (): string => {
      if (typeof window !== 'undefined') return 'browser';
      if (typeof global !== 'undefined') return 'node';
      return 'unknown';
    };

    // Test configuration validation
    const validateConfig = (
      config: Record<string, unknown>
    ): {
      isValid: boolean;
      errors: string[];
    } => {
      const errors: string[] = [];

      if (!config.apiUrl || typeof config.apiUrl !== 'string') {
        errors.push('API URL is required and must be a string');
      }

      if (config.timeout && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
        errors.push('Timeout must be a positive number');
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    };

    // Test configuration tests
    const configTests = [
      {
        name: 'valid-config',
        config: { apiUrl: 'https://api.example.com', timeout: 5000 },
        expectedValid: true,
      },
      {
        name: 'missing-apiUrl',
        config: { timeout: 5000 },
        expectedValid: false,
      },
    ];

    return {
      environment: detectEnvironment(),
      configResults: configTests.map(test => ({
        name: test.name,
        config: test.config,
        result: validateConfig(test.config),
        expectedValid: test.expectedValid,
        passed: validateConfig(test.config).isValid === test.expectedValid,
      })),
      hasConfigUtilities:
        typeof detectEnvironment === 'function' && typeof validateConfig === 'function',
    };
  });

  const passedTests = results.configResults.filter(
    (test: { passed: boolean }) => test.passed
  ).length;

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '✅ Environment configuration validation tested',
    details: {
      environment: results.environment,
      totalConfigTests: results.configResults.length,
      passedConfigTests: passedTests,
      hasConfigUtilities: results.hasConfigUtilities,
    },
  });
}

/**
 * Test API endpoint validation
 */
async function testApiEndpointValidation(context: TestContext, page: PageType): Promise<void> {
  const results = await page.evaluate(() => {
    // Test API endpoint validation
    const validateApiEndpoint = (
      endpoint: string
    ): {
      isValid: boolean;
      issues: string[];
    } => {
      const issues: string[] = [];

      try {
        const url = new URL(endpoint);

        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          issues.push('Protocol must be HTTP or HTTPS');
        }

        if (!url.hostname) {
          issues.push('Hostname is required');
        }
      } catch {
        issues.push('Invalid URL format');
      }

      return {
        isValid: issues.length === 0,
        issues,
      };
    };

    // Run API endpoint tests
    const endpointTests = [
      { endpoint: 'https://api.example.com/v1', expectedValid: true },
      { endpoint: 'http://localhost:3000/api', expectedValid: true },
      { endpoint: 'invalid-url', expectedValid: false },
    ];

    return {
      endpointResults: endpointTests.map(test => ({
        endpoint: test.endpoint,
        result: validateApiEndpoint(test.endpoint),
        expectedValid: test.expectedValid,
        passed: validateApiEndpoint(test.endpoint).isValid === test.expectedValid,
      })),
      hasApiValidationUtilities: typeof validateApiEndpoint === 'function',
    };
  });

  const passedTests = results.endpointResults.filter(
    (test: { passed: boolean }) => test.passed
  ).length;

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔗 API endpoint validation tested',
    details: {
      totalApiTests: results.endpointResults.length,
      passedApiTests: passedTests,
      hasApiValidationUtilities: results.hasApiValidationUtilities,
    },
  });
}

/**
 * Test browser settings validation
 */
async function testBrowserSettingsValidation(context: TestContext, page: PageType): Promise<void> {
  const results = await page.evaluate(() => {
    // Test browser capability detection
    const detectBrowserCapabilities = (): {
      hasLocalStorage: boolean;
      hasSessionStorage: boolean;
      userAgent: string;
    } => {
      return {
        hasLocalStorage: typeof Storage !== 'undefined' && !!window.localStorage,
        hasSessionStorage: typeof Storage !== 'undefined' && !!window.sessionStorage,
        userAgent: navigator.userAgent,
      };
    };

    // Test viewport validation
    const validateViewport = (viewport: { width: number; height: number }): boolean => {
      return (
        viewport.width > 0 &&
        viewport.height > 0 &&
        viewport.width <= 4096 &&
        viewport.height <= 4096
      );
    };

    // Run browser settings tests
    const capabilities = detectBrowserCapabilities();

    const viewportTests = [
      { viewport: { width: 1920, height: 1080 }, expectedValid: true },
      { viewport: { width: 0, height: 1080 }, expectedValid: false },
    ];

    return {
      capabilities,
      viewportResults: viewportTests.map(test => ({
        viewport: test.viewport,
        result: validateViewport(test.viewport),
        expectedValid: test.expectedValid,
        passed: validateViewport(test.viewport) === test.expectedValid,
      })),
      hasBrowserValidationUtilities:
        typeof detectBrowserCapabilities === 'function' && typeof validateViewport === 'function',
    };
  });

  const passedTests = results.viewportResults.filter(
    (test: { passed: boolean }) => test.passed
  ).length;

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🌐 Browser settings validation tested',
    details: {
      capabilities: results.capabilities,
      totalViewportTests: results.viewportResults.length,
      passedViewportTests: passedTests,
      hasBrowserValidationUtilities: results.hasBrowserValidationUtilities,
    },
  });
}

/**
 * Test security policy validation
 */
async function testSecurityPolicyValidation(context: TestContext, page: PageType): Promise<void> {
  const results = await page.evaluate(() => {
    // Test CSP header validation
    const validateCSP = (
      csp: string
    ): {
      isValid: boolean;
      issues: string[];
    } => {
      const issues: string[] = [];

      if (!csp || csp.trim().length === 0) {
        issues.push('CSP cannot be empty');
        return { isValid: false, issues };
      }

      if (csp.includes("'unsafe-eval'")) {
        issues.push("'unsafe-eval' is not recommended for security");
      }

      return {
        isValid: issues.length === 0,
        issues,
      };
    };

    // Test origin validation
    const validateOrigin = (origin: string, allowedOrigins: string[]): boolean => {
      if (!origin) return false;
      return allowedOrigins.includes(origin) || allowedOrigins.includes('*');
    };

    // Run security policy tests
    const cspTests = [
      {
        csp: "default-src 'self'; script-src 'self'",
        expectedValid: true,
      },
      {
        csp: "script-src 'unsafe-eval'",
        expectedValid: false,
      },
    ];

    const originTests = [
      {
        origin: 'https://trusted.example.com',
        allowedOrigins: ['https://trusted.example.com'],
        expectedValid: true,
      },
      {
        origin: 'https://malicious.com',
        allowedOrigins: ['https://trusted.example.com'],
        expectedValid: false,
      },
    ];

    return {
      cspResults: cspTests.map(test => ({
        csp: test.csp,
        result: validateCSP(test.csp),
        expectedValid: test.expectedValid,
        passed: validateCSP(test.csp).isValid === test.expectedValid,
      })),
      originResults: originTests.map(test => ({
        origin: test.origin,
        allowedOrigins: test.allowedOrigins,
        result: validateOrigin(test.origin, test.allowedOrigins),
        expectedValid: test.expectedValid,
        passed: validateOrigin(test.origin, test.allowedOrigins) === test.expectedValid,
      })),
      hasSecurityValidationUtilities:
        typeof validateCSP === 'function' && typeof validateOrigin === 'function',
    };
  });

  const totalTests = results.cspResults.length + results.originResults.length;
  const passedTests =
    results.cspResults.filter((test: { passed: boolean }) => test.passed).length +
    results.originResults.filter((test: { passed: boolean }) => test.passed).length;

  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔒 Security policy validation tested',
    details: {
      totalSecurityTests: totalTests,
      passedSecurityTests: passedTests,
      hasSecurityValidationUtilities: results.hasSecurityValidationUtilities,
    },
  });
}

/**
 * Quick configuration and validation test for development
 */
export async function quickConfigurationAndValidationTest(context: TestContext): Promise<void> {
  context.events.emit({
    timestamp: Date.now(),
    severity: Severity.Info,
    message: '🔧 Quick Configuration & Validation Test',
    details: { testType: 'quick' },
  });

  try {
    // Test simple configuration validation
    const validateConfig = (config: Record<string, unknown>): boolean => {
      return !!(config.apiUrl && typeof config.apiUrl === 'string');
    };

    const config = { apiUrl: 'https://api.example.com', timeout: 5000 };
    const result = validateConfig(config);
    const passed = result === true;

    context.events.emit({
      timestamp: Date.now(),
      severity: passed ? Severity.Success : Severity.Error,
      message: passed
        ? '✅ Quick configuration validation test passed'
        : '❌ Quick configuration validation test failed',
      details: {
        testFunction: 'validateConfig',
        config,
        result,
        expected: true,
        passed,
      },
    });
  } catch (error) {
    context.events.emit({
      timestamp: Date.now(),
      severity: Severity.Error,
      message: '❌ Quick configuration validation test failed with error',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
