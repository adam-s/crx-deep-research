/**
 * TypeScript implementation of browser-use browser
 */

import * as playwright from 'playwright';
import { BrowserContext, BrowserContextConfig } from './context';
import { isValidUrl } from '../utils';

/**
 * Configuration for the browser
 */
export class BrowserConfig {
  browserType: 'chromium' | 'firefox' | 'webkit';
  headless: boolean;
  slowMo: number;
  disableSecurity: boolean;
  cdpUrl: string | null;
  chromeInstancePath: string | null;
  downloadsPath: string | null;
  tracesDir: string | null;
  executablePath: string | null;
  args: string[];

  constructor(config: Partial<BrowserConfig> = {}) {
    this.browserType = config.browserType || 'chromium';
    this.headless = config.headless !== false;
    this.slowMo = config.slowMo || 0;
    this.disableSecurity = config.disableSecurity || false;
    this.cdpUrl = config.cdpUrl || null;
    this.chromeInstancePath = config.chromeInstancePath || null;
    this.downloadsPath = config.downloadsPath || null;
    this.tracesDir = config.tracesDir || null;
    this.executablePath = config.executablePath || null;
    this.args = config.args || [];
  }

  toPlaywrightLaunchOptions(): Record<string, any> {
    const options: Record<string, any> = {
      headless: this.headless,
      slowMo: this.slowMo,
    };

    // Only add non-null properties
    if (this.executablePath) options['executablePath'] = this.executablePath;
    if (this.args.length > 0) options['args'] = this.args;
    if (this.downloadsPath) options['downloadsPath'] = this.downloadsPath;
    if (this.tracesDir) options['tracesDir'] = this.tracesDir;

    return options;
  }
}

/**
 * Main browser class
 */
export class Browser {
  config: BrowserConfig;
  playwrightBrowser: playwright.Browser | null;
  private contexts: BrowserContext[];

  constructor(config: BrowserConfig = new BrowserConfig()) {
    this.config = config;
    this.playwrightBrowser = null;
    this.contexts = [];
  }

  /**
   * Initialize the browser
   */
  async initialize(): Promise<void> {
    if (this.playwrightBrowser) {
      return;
    }

    try {
      if (this.config.cdpUrl) {
        // Connect to existing browser instance
        this.playwrightBrowser = await playwright.chromium.connect(this.config.cdpUrl);
      } else if (this.config.chromeInstancePath) {
        // Connect to existing Chrome instance
        this.playwrightBrowser = await playwright.chromium.connectOverCDP({
          endpointURL: `file://${this.config.chromeInstancePath}`,
        });
      } else {
        // Launch new browser instance
        const browserType = this.getBrowserType();
        this.playwrightBrowser = await browserType.launch(this.config.toPlaywrightLaunchOptions());
      }
    } catch (error) {
      console.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Get the browser type
   */
  private getBrowserType(): playwright.BrowserType {
    switch (this.config.browserType) {
      case 'firefox':
        return playwright.firefox;
      case 'webkit':
        return playwright.webkit;
      case 'chromium':
      default:
        return playwright.chromium;
    }
  }

  /**
   * Create a new browser context
   */
  async newContext(
    config: BrowserContextConfig = new BrowserContextConfig(),
  ): Promise<BrowserContext> {
    if (!this.playwrightBrowser) {
      await this.initialize();
    }

    const context = new BrowserContext(this, config);
    this.contexts.push(context);
    return context;
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    // Close all contexts
    for (const context of this.contexts) {
      await context.close();
    }
    this.contexts = [];

    // Close the browser
    if (this.playwrightBrowser) {
      await this.playwrightBrowser.close();
      this.playwrightBrowser = null;
    }
  }

  /**
   * Navigate to a URL
   */
  async navigateTo(url: string, context?: BrowserContext): Promise<void> {
    if (!isValidUrl(url)) {
      throw new Error(`Invalid URL: ${url}`);
    }

    const ctx = context || (await this.newContext());
    const page = await ctx.getCurrentPage();
    await page.goto(url);
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(path: string, context?: BrowserContext): Promise<Buffer> {
    const ctx = context || (await this.newContext());
    const page = await ctx.getCurrentPage();
    return await page.screenshot({ path });
  }

  /**
   * Get the browser contexts
   */
  getContexts(): BrowserContext[] {
    return [...this.contexts];
  }
}
