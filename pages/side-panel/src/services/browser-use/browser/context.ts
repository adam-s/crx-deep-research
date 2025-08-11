/**
 * TypeScript implementation of browser-use browser context
 */

import { v4 as uuidv4 } from 'uuid';
import { BrowserState, TabInfo } from './views';
import { Browser } from './browser';
import { Page } from 'playwright';
import { DOMService } from '../dom/service';
import { SelectorMap } from '../dom/views';

/**
 * Configuration for browser context
 * Matches Python implementation's BrowserContextConfig parameters
 */
export class BrowserContextConfig {
  // Core browser settings
  userAgent: string;
  viewport: { width: number; height: number };
  browserWindowSize: { width: number; height: number };
  ignoreHTTPSErrors: boolean;
  bypassCSP: boolean;
  javaScriptEnabled: boolean;
  locale: string | null;
  timezoneId: string;
  geolocation: { latitude: number; longitude: number; accuracy: number } | null;
  permissions: string[];
  extraHTTPHeaders: Record<string, string>;
  offline: boolean;
  httpCredentials: { username: string; password: string } | null;
  deviceScaleFactor: number;
  isMobile: boolean;
  hasTouch: boolean;
  colorScheme: 'light' | 'dark' | 'no-preference';
  acceptDownloads: boolean;
  defaultTimeout: number;
  strictSelectors: boolean;
  baseUrl: string | null;
  serviceWorkers: 'allow' | 'block';

  // Python-specific parameters (exact match with Python implementation)
  cookiesFile: string | null;
  minimumWaitPageLoadTime: number; // seconds
  waitForNetworkIdlePageLoadTime: number; // seconds
  maximumWaitPageLoadTime: number; // seconds
  waitBetweenActions: number; // seconds
  disableSecurity: boolean;
  noViewport: boolean | null;
  saveRecordingPath: string | null;
  saveDownloadsPath: string | null;
  tracePath: string | null;
  highlightElements: boolean;
  viewportExpansion: number;
  allowedDomains: string[] | null;
  includeDynamicAttributes: boolean;
  forceKeepContextAlive: boolean;

  constructor(config: Partial<BrowserContextConfig> = {}) {
    // Core browser settings
    this.userAgent =
      config.userAgent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36';
    this.viewport = config.viewport || { width: 1280, height: 720 };
    this.browserWindowSize = config.browserWindowSize || { width: 1280, height: 1100 };
    this.ignoreHTTPSErrors = config.ignoreHTTPSErrors ?? true;
    this.bypassCSP = config.bypassCSP ?? true;
    this.javaScriptEnabled = config.javaScriptEnabled !== false;
    this.locale = config.locale || null;
    this.timezoneId = config.timezoneId || 'UTC';
    this.geolocation = config.geolocation || null;
    this.permissions = config.permissions || [];
    this.extraHTTPHeaders = config.extraHTTPHeaders || {};
    this.offline = config.offline || false;
    this.httpCredentials = config.httpCredentials || null;
    this.deviceScaleFactor = config.deviceScaleFactor || 1;
    this.isMobile = config.isMobile || false;
    this.hasTouch = config.hasTouch || false;
    this.colorScheme = config.colorScheme || 'light';
    this.acceptDownloads = config.acceptDownloads !== false;
    this.defaultTimeout = config.defaultTimeout || 30000;
    this.strictSelectors = config.strictSelectors || false;
    this.baseUrl = config.baseUrl || null;
    this.serviceWorkers = config.serviceWorkers || 'allow';

    // Python-specific parameters (exact match with Python implementation)
    this.cookiesFile = config.cookiesFile || null;
    this.minimumWaitPageLoadTime = config.minimumWaitPageLoadTime ?? 0.25;
    this.waitForNetworkIdlePageLoadTime = config.waitForNetworkIdlePageLoadTime ?? 0.5;
    this.maximumWaitPageLoadTime = config.maximumWaitPageLoadTime ?? 5.0;
    this.waitBetweenActions = config.waitBetweenActions ?? 0.5;
    this.disableSecurity = config.disableSecurity !== false;
    this.noViewport = config.noViewport || null;
    this.saveRecordingPath = config.saveRecordingPath || null;
    this.saveDownloadsPath = config.saveDownloadsPath || null;
    this.tracePath = config.tracePath || null;
    this.highlightElements = config.highlightElements !== false;
    this.viewportExpansion = config.viewportExpansion ?? 500;
    this.allowedDomains = config.allowedDomains || null;
    this.includeDynamicAttributes = config.includeDynamicAttributes !== false;
    this.forceKeepContextAlive = config.forceKeepContextAlive || false;
  }

  /**
   * Convert to Playwright options
   * Maps the configuration to Playwright browser context options
   * Matches Python implementation parameter mapping
   */
  toPlaywrightOptions(): Record<string, any> {
    const options: Record<string, any> = {};

    // Only add viewport if not explicitly disabled
    if (!this.noViewport) {
      options['viewport'] = this.viewport;
    }

    // Basic browser settings
    options['userAgent'] = this.userAgent;
    options['ignoreHTTPSErrors'] = this.ignoreHTTPSErrors;
    options['bypassCSP'] = this.bypassCSP;
    options['javaScriptEnabled'] = this.javaScriptEnabled;

    // Additional options that match Python implementation
    if (this.locale) {
      options['locale'] = this.locale;
    }

    if (this.timezoneId) {
      options['timezoneId'] = this.timezoneId;
    }

    if (this.geolocation) {
      options['geolocation'] = this.geolocation;
    }

    if (this.permissions && this.permissions.length > 0) {
      options['permissions'] = this.permissions;
    }

    if (this.extraHTTPHeaders && Object.keys(this.extraHTTPHeaders).length > 0) {
      options['extraHTTPHeaders'] = this.extraHTTPHeaders;
    }

    if (this.offline) {
      options['offline'] = true;
    }

    if (this.httpCredentials) {
      options['httpCredentials'] = this.httpCredentials;
    }

    options['deviceScaleFactor'] = this.deviceScaleFactor;
    options['isMobile'] = this.isMobile;
    options['hasTouch'] = this.hasTouch;
    options['colorScheme'] = this.colorScheme;
    options['acceptDownloads'] = this.acceptDownloads;
    options['serviceWorkers'] = this.serviceWorkers;
    options['defaultTimeout'] = this.defaultTimeout;

    // Additional Python-specific settings
    if (this.baseUrl) {
      options['baseURL'] = this.baseUrl;
    }

    if (this.saveRecordingPath) {
      options['recordVideo'] = {
        dir: this.saveRecordingPath,
      };
    }

    if (this.saveDownloadsPath) {
      options['acceptDownloads'] = true;
      options['downloadsPath'] = this.saveDownloadsPath;
    }

    return options;
  }
}

/**
 * Represents a browser session
 */
export class BrowserSession {
  id: string;
  startTime: Date;
  endTime: Date | null;
  state: BrowserContextState;
  // Add context property to match Python implementation
  context: BrowserContext | null;
  // Add cachedState property to match Python implementation
  cachedState: BrowserState | null;

  constructor(id: string = uuidv4()) {
    this.id = id;
    this.startTime = new Date();
    this.endTime = null;
    this.state = BrowserContextState.CREATED;
    this.context = null;
    this.cachedState = null;
  }

  end(): void {
    this.endTime = new Date();
    this.state = BrowserContextState.CLOSED;
  }

  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime ? this.endTime.toISOString() : null,
      state: this.state,
      cachedState: this.cachedState,
    };
  }
}

/**
 * Enum for browser context state
 */
export enum BrowserContextState {
  CREATED = 'created',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

/**
 * Represents a browser context
 */
export class BrowserContext {
  browser: Browser;
  config: BrowserContextConfig;
  session: BrowserSession;
  context: any;
  pages: any[];
  // Following the Python implementation's state storage
  state: { targetId?: string; [key: string]: any } = {};

  /**
   * Generate an enhanced CSS selector for a DOM element
   * This is a static method to allow it to be used without an instance
   */
  static _enhancedCssSelectorForElement(
    element: any,
    includeDynamicAttributes: boolean = true,
  ): string {
    try {
      // Get base selector from XPath
      const cssSelector = BrowserContext._convertSimpleXpathToCssSelector(element.xpath);

      let result = cssSelector || element.tag_name || 'div';

      // Handle class attributes
      if (
        element.attributes &&
        'class' in element.attributes &&
        element.attributes.class &&
        includeDynamicAttributes
      ) {
        // Define a regex pattern for valid class names in CSS
        const validClassNamePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;

        // Iterate through the class attribute values
        const classes =
          typeof element.attributes.class === 'string' ? element.attributes.class.split(/\s+/) : [];

        for (const className of classes) {
          // Skip empty class names
          if (!className.trim()) {
            continue;
          }

          // Check if the class name is valid
          if (validClassNamePattern.test(className)) {
            // Append the valid class name to the CSS selector
            result += `.${className}`;
          } else {
            // Skip invalid class names
            continue;
          }
        }
      }

      // Expanded set of safe attributes that are stable and useful for selection
      const SAFE_ATTRIBUTES = new Set([
        // Data attributes
        'id',
        // Standard HTML attributes
        'name',
        'type',
        'placeholder',
        // Accessibility attributes
        'aria-label',
        'aria-labelledby',
        'aria-describedby',
        'role',
        // Common form attributes
        'for',
        'autocomplete',
        'required',
        'readonly',
        // Media attributes
        'alt',
        'title',
        'src',
        // Custom stable attributes
        'href',
        'target',
      ]);

      if (includeDynamicAttributes) {
        const dynamicAttributes = new Set(['data-id', 'data-qa', 'data-cy', 'data-testid']);

        // Add dynamic attributes to the safe attributes set
        // Convert Set to Array to avoid TypeScript iteration errors
        Array.from(dynamicAttributes).forEach(attr => {
          SAFE_ATTRIBUTES.add(attr);
        });
      }

      // Handle other attributes
      if (element.attributes) {
        for (const [attribute, value] of Object.entries(element.attributes)) {
          if (attribute === 'class') {
            continue;
          }

          // Skip invalid attribute names
          if (!attribute.trim()) {
            continue;
          }

          if (!SAFE_ATTRIBUTES.has(attribute)) {
            continue;
          }

          // Escape special characters in attribute names
          const safeAttribute = attribute.replace(':', '\\:');

          // Handle different value cases
          if (value === '') {
            result += `[${safeAttribute}]`;
          } else if (typeof value === 'string' && /["'<>`\n\r\t]/.test(value)) {
            // Use contains for values with special characters
            // Regex-substitute *any* whitespace with a single space, then strip.
            const collapsedValue = value.replace(/\s+/g, ' ').trim();
            // Escape embedded double-quotes.
            const safeValue = collapsedValue.replace(/"/g, '\\"');
            result += `[${safeAttribute}*="${safeValue}"]`;
          } else if (value !== undefined && value !== null) {
            result += `[${safeAttribute}="${value}"]`;
          }
        }
      }

      return result;
    } catch (error) {
      // Fallback to a more basic selector if something goes wrong
      const tagName = element.tag_name || '*';
      return `${tagName}[highlight_index='${element.highlight_index}']`;
    }
  }

  private static _convertSimpleXpathToCssSelector(xpath: string | undefined): string {
    if (!xpath) return 'div';

    const parts = xpath.split('/');
    const cssParts: string[] = [];

    for (const part of parts) {
      if (!part) {
        continue;
      }

      // Handle custom elements with colons by escaping them
      if (part.includes(':') && !part.includes('[')) {
        const basePart = part.replace(':', '\\:');
        cssParts.push(basePart);
        continue;
      }

      // Handle index notation [n]
      if (part.includes('[')) {
        const basePart = part.substring(0, part.indexOf('['));
        // Handle custom elements with colons in the base part
        const basePartEscaped = basePart.includes(':') ? basePart.replace(':', '\\:') : basePart;
        const indexPart = part.substring(part.indexOf('['));

        // Handle multiple indices
        const indices = indexPart
          .split(']')
          .slice(0, -1)
          .map(i => i.replace('[', ''));

        let finalPart = basePartEscaped;
        for (const idx of indices) {
          try {
            // Handle numeric indices
            if (/^\d+$/.test(idx)) {
              const index = parseInt(idx) - 1;
              finalPart += `:nth-of-type(${index + 1})`;
            }
            // Handle last() function
            else if (idx === 'last()') {
              finalPart += ':last-of-type';
            }
            // Handle position() functions
            else if (idx.includes('position()')) {
              if (idx.includes('>1')) {
                finalPart += ':nth-of-type(n+2)';
              }
            }
          } catch (error) {
            continue;
          }
        }

        cssParts.push(finalPart);
      } else {
        cssParts.push(part);
      }
    }

    const baseSelector = cssParts.join(' > ');
    return baseSelector;
  }

  constructor(browser: Browser, config: BrowserContextConfig) {
    this.browser = browser;
    this.config = config;
    this.session = new BrowserSession();
    this.context = null;
    this.pages = [];
  }

  /**
   * Enter the browser context
   */
  async enter(): Promise<void> {
    if (this.context) {
      return;
    }

    try {
      if (!this.browser.playwrightBrowser) {
        await this.browser.initialize();
      }

      this.context = await this.browser.playwrightBrowser!.newContext(
        this.config.toPlaywrightOptions(),
      );

      // Create a new page
      const page = await this.context.newPage();
      this.pages.push(page);

      this.session.state = BrowserContextState.ACTIVE;
    } catch (error) {
      console.error('Failed to enter browser context:', error);
      throw error;
    }
  }

  /**
   * Get the current page
   */
  async getCurrentPage(): Promise<any> {
    if (!this.context) {
      await this.enter();
    }

    if (this.pages.length === 0) {
      const page = await this.context.newPage();
      this.pages.push(page);
    }

    return this.pages[this.pages.length - 1];
  }

  /**
   * Close the browser context
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.pages = [];
      this.session.end();
    }
  }

  /**
   * Get cookies from the browser context
   */
  async getCookies(): Promise<any[]> {
    if (!this.context) {
      await this.enter();
    }

    return await this.context.cookies();
  }

  /**
   * Set cookies in the browser context
   */
  async setCookies(cookies: any[]): Promise<void> {
    if (!this.context) {
      await this.enter();
    }

    await this.context.addCookies(cookies);
  }

  /**
   * Clear cookies from the browser context
   */
  async clearCookies(): Promise<void> {
    if (!this.context) {
      await this.enter();
    }

    await this.context.clearCookies();
  }

  /**
   * Save cookies to a file if configured
   * Matches the Python implementation's save_cookies method
   */
  async saveCookies(): Promise<void> {
    if (!this.config.cookiesFile) {
      return;
    }

    try {
      const cookies = await this.getCookies();

      const fs = require('fs');
      const path = require('path');

      // Create directory if it doesn't exist
      const dir = path.dirname(this.config.cookiesFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write cookies to file
      fs.writeFileSync(this.config.cookiesFile, JSON.stringify(cookies, null, 2));
      console.log(`Saved ${cookies.length} cookies to ${this.config.cookiesFile}`);
    } catch (e: unknown) {
      console.error('Error saving cookies:', e);
    }
  }

  /**
   * Load cookies from a file if configured
   * Matches the Python implementation's load_cookies method
   */
  async loadCookies(): Promise<void> {
    if (!this.config.cookiesFile) {
      return;
    }

    try {
      const fs = require('fs');

      // Check if cookies file exists
      if (!fs.existsSync(this.config.cookiesFile)) {
        console.log(`Cookies file not found: ${this.config.cookiesFile}`);
        return;
      }

      // Read and parse cookies
      const cookiesData = fs.readFileSync(this.config.cookiesFile, 'utf8');
      const cookies = JSON.parse(cookiesData);

      // Add cookies to context
      await this.setCookies(cookies);
      console.log(`Loaded ${cookies.length} cookies from ${this.config.cookiesFile}`);
    } catch (e: unknown) {
      console.error('Error loading cookies:', e);
    }
  }

  /**
   * Get the state of the browser
   * This is an exact implementation that matches the original Python code
   */
  async getState(): Promise<BrowserState> {
    // Wait for page and frames to load
    await this._waitForPageAndFramesLoad();

    // Update state and store it in the session's cachedState
    const state = await this._updateState();

    // Update the session's cachedState to match the current state
    // This follows the Python implementation pattern where session.cached_state = await self._update_state()
    const session = await this.getSession();
    session.cachedState = state;

    // Return the state
    return state;
  }

  /**
   * Update and return state
   * This matches the original Python implementation
   */
  async _updateState(focusElement: number = -1): Promise<BrowserState> {
    try {
      // Get the current page
      const page = await this.getCurrentPage();

      // Test if page is still accessible
      await page.evaluate('1');

      // Remove highlights
      await this._removeHighlights();

      // Get clickable elements
      const domService = new DOMService(page);
      const content = await domService.getClickableElements(
        this.config.highlightElements,
        focusElement,
        this.config.viewportExpansion,
      );

      // Take screenshot
      const screenshot = await this._takeScreenshot();

      // Get scroll info
      const [pixelsAbove, pixelsBelow] = await this._getScrollInfo(page);

      // Get tabs info
      const tabs = await this._getTabsInfo();

      // Create and return the browser state
      const state = new BrowserState(
        page.url(),
        await page.title(),
        tabs,
        screenshot,
        pixelsAbove,
        pixelsBelow,
        [], // browserErrors
        content.elementTree,
        content.rootElement,
        content.selectorMap,
      );

      // Store the current state for future reference
      this.currentState = state;

      // Explicitly update the session's cachedState here (this is critical for selector map access)
      const session = await this.getSession();
      session.cachedState = state;

      return state;
    } catch (error) {
      console.error('Failed to update state:', error);
      // Return last known good state if available
      if (this.currentState) {
        return this.currentState;
      }
      throw error;
    }
  }

  /**
   * Ensures page is fully loaded before continuing.
   * Waits for either network to be idle or minimum WAIT_TIME, whichever is longer.
   * Also checks if the loaded URL is allowed.
   *
   * This matches the Python implementation's _wait_for_page_and_frames_load method
   * @param timeoutOverwrite Optional timeout override in seconds
   */
  async _waitForPageAndFramesLoad(options?: { timeoutOverwrite?: number }): Promise<void> {
    // Start timing
    const startTime = Date.now();

    try {
      // Wait for network to stabilize with smart filtering
      await this._waitForStableNetwork();

      // Check if the loaded URL is allowed
      const page = await this.getCurrentPage();
      const url = page.url();

      if (!this._isUrlAllowed(url)) {
        await this._handleDisallowedNavigation(url);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('URL not allowed:')) {
        throw error; // Re-throw URL not allowed errors
      }
      console.warn('Page load failed, continuing...');
    }

    // Use timeout override if provided (match Python implementation's default value)
    // Use a default of 0.25 seconds if minimumWaitPageLoadTime is not available
    const minimumWait = options?.timeoutOverwrite ?? 0.25;

    // Calculate remaining time to meet minimum wait time
    const elapsed = (Date.now() - startTime) / 1000; // Convert to seconds
    const remaining = Math.max(minimumWait - elapsed, 0);

    // Sleep remaining time if needed
    if (remaining > 0) {
      await new Promise(resolve => setTimeout(resolve, remaining * 1000));
    }
  }

  /**
   * Wait for network to stabilize using advanced filtering
   * This matches the Python implementation's _wait_for_stable_network method
   */
  private async _waitForStableNetwork(): Promise<void> {
    const page = await this.getCurrentPage();

    // Define relevant resource types and content types for filtering
    const RELEVANT_RESOURCE_TYPES = new Set([
      'document',
      'stylesheet',
      'image',
      'font',
      'script',
      'fetch',
      'xhr',
      'iframe',
    ]);

    const RELEVANT_CONTENT_TYPES = [
      'text/html',
      'text/css',
      'application/javascript',
      'image/',
      'font/',
      'application/json',
    ];

    // Additional patterns to filter out
    const IGNORED_URL_PATTERNS = [
      // Analytics and tracking
      'analytics',
      'tracking',
      'telemetry',
      'beacon',
      'metrics',
      // Ad-related
      'doubleclick',
      'adsystem',
      'adserver',
      'advertising',
      // Social media widgets
      'facebook.com/plugins',
      'platform.twitter',
      'linkedin.com/embed',
      // Live chat and support
      'livechat',
      'zendesk',
      'intercom',
      'crisp.chat',
      'hotjar',
      // Push notifications
      'push-notifications',
      'onesignal',
      'pushwoosh',
      // Background sync/heartbeat
      'heartbeat',
      'ping',
      'alive',
      // WebRTC and streaming
      'webrtc',
      'rtmp://',
      'wss://',
      // Common CDNs for dynamic content
      'cloudfront.net',
      'fastly.net',
    ];

    const pendingRequests = new Set<any>();
    let lastActivity = Date.now();
    let startTime = Date.now();

    // Set up listener for new requests
    const onRequest = (request: any) => {
      // Filter by resource type
      if (!RELEVANT_RESOURCE_TYPES.has(request.resourceType())) {
        return;
      }

      // Filter out specific resource types
      if (
        ['websocket', 'media', 'eventsource', 'manifest', 'other'].includes(request.resourceType())
      ) {
        return;
      }

      // Filter out by URL patterns
      const url = request.url().toLowerCase();
      if (IGNORED_URL_PATTERNS.some(pattern => url.includes(pattern))) {
        return;
      }

      // Filter out data URLs and blob URLs
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return;
      }

      // Filter out requests with specific headers
      const headers = request.headers();
      if (
        headers['purpose'] === 'prefetch' ||
        headers['sec-fetch-dest'] === 'video' ||
        headers['sec-fetch-dest'] === 'audio'
      ) {
        return;
      }

      pendingRequests.add(request);
      lastActivity = Date.now();
    };

    // Set up listener for responses
    const onResponse = (response: any) => {
      const request = response.request();
      if (!pendingRequests.has(request)) {
        return;
      }

      // Filter by content type if available
      const contentType = (response.headers()['content-type'] || '').toLowerCase();

      // Skip if content type indicates streaming or real-time data
      if (
        [
          'streaming',
          'video',
          'audio',
          'webm',
          'mp4',
          'event-stream',
          'websocket',
          'protobuf',
        ].some(t => contentType.includes(t))
      ) {
        pendingRequests.delete(request);
        return;
      }

      // Only process relevant content types
      if (!RELEVANT_CONTENT_TYPES.some(ct => contentType.includes(ct))) {
        pendingRequests.delete(request);
        return;
      }

      // Skip if response is too large (likely not essential for page load)
      const contentLength = response.headers()['content-length'];
      if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
        // 5MB
        pendingRequests.delete(request);
        return;
      }

      pendingRequests.delete(request);
      lastActivity = Date.now();
    };

    // Add event listeners
    page.on('request', onRequest);
    page.on('response', onResponse);

    try {
      // Wait for network to stabilize
      const maxWaitTime = (this.config.maximumWaitPageLoadTime || 5) * 1000; // In milliseconds
      const networkIdleTime = (this.config.waitForNetworkIdlePageLoadTime || 0.5) * 1000; // In milliseconds

      return new Promise<void>(resolve => {
        const checkNetworkIdle = () => {
          const now = Date.now();

          // Wait for network idle
          if (pendingRequests.size === 0 && now - lastActivity >= networkIdleTime) {
            cleanup();
            resolve();
            return;
          }

          // Time out if waiting too long
          if (now - startTime > maxWaitTime) {
            console.log(
              `Network timeout after ${maxWaitTime}ms with ${pendingRequests.size} pending requests`,
            );
            cleanup();
            resolve(); // Resolve anyway to continue
            return;
          }

          // Otherwise check again after a short delay
          setTimeout(checkNetworkIdle, 100);
        };

        const cleanup = () => {
          page.removeListener('request', onRequest);
          page.removeListener('response', onResponse);
        };

        // Start checking
        checkNetworkIdle();
      });
    } catch (e: unknown) {
      console.error('Error while waiting for stable network:', e);
      page.removeListener('request', onRequest);
      page.removeListener('response', onResponse);
      throw e;
    }
  }

  /**
   * Check if a URL is allowed based on the allowed domains configuration
   * Matches the Python implementation's _is_url_allowed method
   */
  private _isUrlAllowed(url: string): boolean {
    if (!this.config.allowedDomains || this.config.allowedDomains.length === 0) {
      return true;
    }

    try {
      // Parse the URL to extract the domain
      const urlObj = new URL(url);
      let domain = urlObj.hostname.toLowerCase();

      // Remove port number if present
      if (domain.includes(':')) {
        const parts = domain.split(':');
        domain = parts[0] || '';
      }

      // Check if domain matches any allowed domain pattern
      return this.config.allowedDomains.some(
        allowedDomain =>
          domain === allowedDomain.toLowerCase() ||
          domain.endsWith('.' + allowedDomain.toLowerCase()),
      );
    } catch (e: unknown) {
      console.error('Error checking URL allowlist:', e);
      return false;
    }
  }

  /**
   * Handle disallowed navigation - throw error or navigate to a safe URL
   */
  private async _handleDisallowedNavigation(url: string): Promise<void> {
    console.error(`Disallowed URL: ${url}`);

    // Navigate to a blank page if the current URL is not allowed
    const page = await this.getCurrentPage();
    await page.goto('about:blank');

    // Throw error to notify the calling code
    throw new Error(`URL not allowed: ${url}`);
  }

  /**
   * Take screenshot
   */
  /**
   * Takes a screenshot of the current page
   * Exact match to Python implementation's take_screenshot method
   * @param fullPage Whether to take a screenshot of the full page or just the viewport
   * @returns Base64 encoded screenshot
   */
  async takeScreenshot(fullPage: boolean = false): Promise<string> {
    const page = await this.getCurrentPage();

    await page.bringToFront();
    await page.waitForLoadState();

    const screenshot = await page.screenshot({
      fullPage,
      animations: 'disabled',
    });

    const screenshotB64 = Buffer.from(screenshot).toString('base64');

    // await this.removeHighlights();
    // Note: This line is commented out in the Python implementation

    return screenshotB64;
  }

  /**
   * Internal method for taking screenshots
   * @private
   */
  async _takeScreenshot(fullPage: boolean = false): Promise<string | undefined> {
    try {
      return await this.takeScreenshot(fullPage);
    } catch (error) {
      console.error('Error taking screenshot:', error);
      return undefined;
    }
  }

  /**
   * Removes all highlight overlays and labels created by the highlightElement function
   * Exact match to Python implementation's remove_highlights method
   */
  async removeHighlights(): Promise<void> {
    try {
      const page = await this.getCurrentPage();
      await page.evaluate(`
        try {
          // Remove the highlight container and all its contents
          const container = document.getElementById('playwright-highlight-container');
          if (container) {
            container.remove();
          }

          // Remove highlight attributes from elements
          const highlightedElements = document.querySelectorAll('[browser-user-highlight-id^="playwright-highlight-"]');
          highlightedElements.forEach(el => {
            el.removeAttribute('browser-user-highlight-id');
          });
        } catch (e) {
          console.error('Failed to remove highlights:', e);
        }
      `);
    } catch (error) {
      // Don't raise the error since this is not critical functionality
    }
  }

  /**
   * Internal method for removing highlights
   * @private
   */
  async _removeHighlights(): Promise<void> {
    return this.removeHighlights();
  }

  /**
   * Get scroll position information for the current page
   * Exact match to Python implementation's get_scroll_info method
   */
  async getScrollInfo(page: Page): Promise<[number, number]> {
    const scrollY = (await page.evaluate('window.scrollY')) as number;
    const viewportHeight = (await page.evaluate('window.innerHeight')) as number;
    const totalHeight = (await page.evaluate('document.documentElement.scrollHeight')) as number;
    const pixelsAbove = scrollY;
    const pixelsBelow = totalHeight - (scrollY + viewportHeight);
    return [pixelsAbove, pixelsBelow];
  }

  /**
   * Internal method for getting scroll info
   * @private
   */
  async _getScrollInfo(page: any): Promise<[number, number]> {
    try {
      const scrollInfo = await page.evaluate(() => {
        return {
          pixelsAbove: window.scrollY,
          pixelsBelow: document.documentElement.scrollHeight - window.scrollY - window.innerHeight,
        };
      });
      return [scrollInfo.pixelsAbove, scrollInfo.pixelsBelow];
    } catch (error) {
      console.error('Error getting scroll info:', error);
      return [0, 0];
    }
  }

  /**
   * Reset the browser session
   * Call this when you don't want to kill the context but just kill the state
   * Exact match to Python implementation's reset_context method
   */
  async resetContext(): Promise<void> {
    // Close all tabs and clear cached state
    const session = await this.getSession();

    const pages = session.context.pages();
    for (const page of pages) {
      await page.close();
    }

    session.cachedState = null;
    // In Python, this is set to None, but in TypeScript we need to handle the type correctly
    delete this.state.targetId;
  }

  /**
   * Get tabs info
   */
  async _getTabsInfo(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = [];
    const pages = this.context.pages();
    for (let i = 0; i < pages.length; i++) {
      tabs.push({
        pageId: i,
        url: pages[i].url(),
        title: await pages[i].title(),
      });
    }
    return tabs;
  }

  /**
   * Click on a DOM element node
   * Exact match to Python implementation's _click_element_node
   */
  async _clickElementNode(elementNode: any): Promise<string | null> {
    const page = await this.getCurrentPage();

    try {
      // Get element using getLocateElement (equivalent to Python's get_locate_element)
      const elementHandle = await this.getLocateElement(elementNode);

      if (!elementHandle) {
        throw new Error(
          `Element: ${JSON.stringify({
            tagName: elementNode.tag_name,
            xpath: elementNode.xpath,
          })} not found`,
        );
      }

      // Define a perform_click function just like in the Python implementation
      const performClick = async (clickFunc: () => Promise<void>): Promise<string | null> => {
        if (this.config.saveDownloadsPath) {
          try {
            // Try short-timeout expect_download to detect a file download triggered
            const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
            await clickFunc();
            const download = await downloadPromise;

            // Get the suggested filename and save the file
            const suggestedFilename = download.suggestedFilename();

            // Get unique filename to avoid conflicts
            const uniqueFilename = await this._getUniqueFilename(
              this.config.saveDownloadsPath,
              suggestedFilename,
            );
            const path = require('path');
            const downloadPath = path.join(this.config.saveDownloadsPath, uniqueFilename);

            await download.saveAs(downloadPath);
            return downloadPath;
          } catch (e) {
            // If no download is triggered, treat as normal click
            if (e instanceof Error && e.message.includes('timeout')) {
              await page.waitForLoadState();

              // Check and handle navigation
              await this._checkAndHandleNavigation(page);
            } else {
              throw e;
            }
          }
        } else {
          // Standard click logic if no download is expected
          await clickFunc();

          // Wait for load state - this is critical and matches Python exactly
          await page.waitForLoadState();

          // Check and handle navigation
          await this._checkAndHandleNavigation(page);
        }
        return null;
      };

      // Try direct click as per Python implementation
      try {
        return await performClick(() => elementHandle.click({ timeout: 1500 }));
      } catch (standardError) {
        // If URL not allowed error, rethrow it
        if (standardError instanceof Error && standardError.message.includes('URL not allowed')) {
          throw standardError;
        }

        // If standard clicks fail, try JavaScript click as fallback (Python approach)
        try {
          return await performClick(() => page.evaluate('(el) => el.click()', elementHandle));
        } catch (jsClickErr) {
          // If URL not allowed error, rethrow it
          if (jsClickErr instanceof Error && jsClickErr.message.includes('URL not allowed')) {
            throw jsClickErr;
          }
          throw new Error(`Failed to click element: ${jsClickErr}`);
        }
      }
    } catch (e) {
      // Special handling for URL not allowed, to match Python's URLNotAllowedError
      if (e instanceof Error && e.message.includes('URL not allowed')) {
        throw e;
      }
      throw new Error(
        `Failed to click element: ${JSON.stringify({
          tagName: elementNode.tag_name,
          xpath: elementNode.xpath,
        })}. Error: ${e}`,
      );
    }
  }

  async getLocateElement(element: any): Promise<any> {
    if (!element) {
      return null;
    }

    let currentFrame = await this.getCurrentPage();

    // Start with the target element and collect all parents
    const parents: any[] = [];
    let current = element;
    while (current.parent) {
      const parent = current.parent;
      parents.push(parent);
      current = parent;
    }

    // Reverse the parents list to process from top to bottom
    parents.reverse();

    // Process all iframe parents in sequence
    const iframes = parents.filter(item => item.tag_name === 'iframe');

    for (const parent of iframes) {
      const cssSelector = BrowserContext._enhancedCssSelectorForElement(
        parent,
        this.config.includeDynamicAttributes,
      );
      currentFrame = currentFrame.frameLocator(cssSelector);
    }

    const cssSelector = BrowserContext._enhancedCssSelectorForElement(
      element,
      this.config.includeDynamicAttributes,
    );

    try {
      if (typeof currentFrame.locator === 'function') {
        // We're in a frame locator
        try {
          // Direct match to Python implementation
          const elementHandle = await currentFrame.locator(cssSelector).elementHandle();

          if (elementHandle) {
            return elementHandle;
          } else {
            return null;
          }
        } catch (locatorError) {
          return null;
        }
      } else {
        // We're in a page - direct match to Python implementation
        try {
          const elementHandle = await currentFrame.querySelector(cssSelector);

          if (elementHandle) {
            try {
              // Try to scroll into view if hidden - matches Python implementation
              await elementHandle.scrollIntoViewIfNeeded();
            } catch (scrollError) {}

            return elementHandle;
          }

          return null;
        } catch (querySelectorError) {
          return null;
        }
      }
    } catch (error) {
      return null;
    }
  }

  /**
   * Input text into a DOM element node
   * Exact match to Python implementation's _input_text_element_node
   */
  async _inputTextElementNode(elementNode: any, text: string): Promise<void> {
    try {
      // Get the element handle
      const elementHandle = await this.getLocateElement(elementNode);

      if (!elementHandle) {
        throw new Error(`Element: ${JSON.stringify(elementNode)} not found`);
      }

      // Ensure element is ready for input
      try {
        await elementHandle.waitForElementState('stable', { timeout: 1000 });
        await elementHandle.scrollIntoViewIfNeeded({ timeout: 1000 });
      } catch (e) {
        // Silently continue if these operations fail
      }

      // Get element properties to determine input method
      const tagHandle = await elementHandle.getProperty('tagName');
      const tagName = ((await tagHandle.jsonValue()) as string).toLowerCase();

      const isContentEditableHandle = await elementHandle.getProperty('isContentEditable');
      const readonlyHandle = await elementHandle.getProperty('readOnly');
      const disabledHandle = await elementHandle.getProperty('disabled');

      const isContentEditable = (await isContentEditableHandle.jsonValue()) as boolean;
      const readonly = readonlyHandle ? ((await readonlyHandle.jsonValue()) as boolean) : false;
      const disabled = disabledHandle ? ((await disabledHandle.jsonValue()) as boolean) : false;

      // Use appropriate input method based on element properties
      if ((isContentEditable || tagName === 'input') && !(readonly || disabled)) {
        await elementHandle.evaluate((el: HTMLElement) => {
          el.textContent = '';
        });
        await elementHandle.type(text, { delay: 5 });
      } else {
        await elementHandle.fill(text);
      }
    } catch (error) {
      throw new Error(`Failed to input text into index ${elementNode.highlightIndex}`);
    }
  }

  /**
   * Stop loading the current page
   */
  async stopLoading(): Promise<void> {
    try {
      const page = await this.getCurrentPage();
      await page.evaluate(() => window.stop());
      console.info('Stopped page loading');
    } catch (e: unknown) {
      console.error('Error stopping page loading:', e);
    }
  }

  /**
   * Refresh the current page
   * Exact match to Python implementation's refresh_page method
   */
  async refreshPage(): Promise<void> {
    const page = await this.getCurrentPage();
    await page.reload();
    await page.waitForLoadState();
  }

  /**
   * Alias for refreshPage to maintain backward compatibility
   */
  async refresh(): Promise<void> {
    return this.refreshPage();
  }

  /**
   * Scroll to the bottom of the page
   */
  async scrollToBottom(): Promise<void> {
    try {
      const page = await this.getCurrentPage();
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      console.info('Scrolled to bottom of page');
    } catch (e: unknown) {
      console.error('Error scrolling to bottom:', e);
    }
  }

  /**
   * Scroll to the top of the page
   */
  async scrollToTop(): Promise<void> {
    try {
      const page = await this.getCurrentPage();
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      console.info('Scrolled to top of page');
    } catch (e: unknown) {
      console.error('Error scrolling to top:', e);
    }
  }

  /**
   * Reinitialize the page (close and create a new one)
   */
  async reinitializePage(): Promise<void> {
    try {
      const page = await this.getCurrentPage();
      const url = page.url();
      console.info('Reinitializing page for recovery, current URL:', url);

      // Close current page if it exists
      if (page) {
        await page.close().catch((e: unknown) => console.warn('Error closing page:', e));
      }

      // Create a new page in the context
      if (this.context) {
        const newPage = await this.context.newPage();
        this.pages = [newPage];

        // Navigate back to the URL if it was valid
        if (url && url !== 'about:blank') {
          await newPage.goto(url);
        }

        console.info('Page reinitialized');
      } else {
        throw new Error('Browser context not initialized');
      }
    } catch (e: unknown) {
      console.error('Error reinitializing page:', e);
      throw e;
    }
  }

  /**
   * Public wrapper for _waitForStableNetwork to be used in recovery
   */
  async waitForStableNetwork(): Promise<boolean> {
    try {
      await this._waitForStableNetwork();
      return true;
    } catch (e: unknown) {
      console.error('Error in waitForStableNetwork:', e);
      return false;
    }
  }

  /**
   * Check if the browser context is active
   */
  isActive(): boolean {
    return this.session.state === BrowserContextState.ACTIVE;
  }

  /**
   * Create a new tab with optional URL
   */
  /**
   * Create a new tab and optionally navigate to a URL
   * Exact match to Python implementation's create_new_tab method
   */
  async createNewTab(url?: string): Promise<void> {
    if (url && !this._isUrlAllowed(url)) {
      throw new Error(`Cannot create new tab with non-allowed URL: ${url}`);
    }

    if (!this.context) {
      await this.enter();
    }

    const newPage = await this.context.newPage();
    this.pages.push(newPage);
    await newPage.waitForLoadState();

    if (url) {
      await newPage.goto(url);
      await this._waitForPageAndFramesLoad({ timeoutOverwrite: 1 });
    }

    // Get target ID for new page if using CDP
    if (this.browser?.config?.cdpUrl) {
      const targets = await this._getCdpTargets();
      // Update targetId if found matching URL
      for (const target of targets) {
        if (target.url === newPage.url()) {
          this.state.targetId = target.targetId;
          break;
        }
      }
    }
  }

  /**
   * Switch to a specific tab by its page_id
   * Exact match to Python implementation's switch_to_tab method
   */
  async switchToTab(pageId: number): Promise<void> {
    if (!this.context) {
      await this.enter();
    }

    const pages = this.context.pages();

    if (pageId >= pages.length) {
      throw new Error(`No tab found with page_id: ${pageId}`);
    }

    const page = pages[pageId];

    // Check if the tab's URL is allowed before switching
    if (!this._isUrlAllowed(page.url())) {
      throw new Error(`Cannot switch to tab with non-allowed URL: ${page.url()}`);
    }

    // Update target ID if using CDP
    if (this.browser?.config?.cdpUrl) {
      const targets = await this._getCdpTargets();
      for (const target of targets) {
        if (target.url === page.url()) {
          this.state.targetId = target.targetId;
          break;
        }
      }
    }

    // Bring page to front and wait for load
    await page.bringToFront();
    await page.waitForLoadState('load');
  }

  /**
   * Navigate back in browser history
   * Exact match to Python implementation's go_back method
   */
  async goBack(): Promise<void> {
    const page = await this.getCurrentPage();
    try {
      // 10 ms timeout
      await page.goBack({ timeout: 10, waitUntil: 'domcontentloaded' });
      // We might want to add this back in later: await this._waitForPageAndFramesLoad({ timeoutOverwrite: 1 });
    } catch (e: unknown) {
      // Continue even if it's not fully loaded, because we wait later for the page to load
    }
  }

  /**
   * Navigate forward in browser history
   * Exact match to Python implementation's go_forward method
   */
  async goForward(): Promise<void> {
    const page = await this.getCurrentPage();
    try {
      await page.goForward({ timeout: 10, waitUntil: 'domcontentloaded' });
      // We might want to add this back in later: await this._waitForPageAndFramesLoad({ timeoutOverwrite: 1 });
    } catch (e: unknown) {
      // Continue even if it's not fully loaded, because we wait later for the page to load
    }
  }

  /**
   * Close the current tab
   * Exact match to Python implementation's close_current_tab method
   */
  async closeCurrentTab(): Promise<void> {
    const session = await this.getSession();
    const page = await this.getCurrentPage(); // Using getCurrentPage instead of _get_current_page
    await page.close();

    // Switch to the first available tab if any exist
    if (session.context && session.context.pages && session.context.pages.length > 0) {
      await this.switchToTab(0);
    }
    // otherwise the browser will be closed
  }

  /**
   * Get the current page HTML content
   * Exact match to Python implementation's get_page_html method
   */
  async getPageHtml(): Promise<string> {
    const page = await this.getCurrentPage();
    return await page.content();
  }

  /**
   * Execute JavaScript code on the page
   * Exact match to Python implementation's execute_javascript method
   */
  async executeJavaScript(script: string): Promise<any> {
    const page = await this.getCurrentPage();
    return await page.evaluate(script);
  }

  /**
   * Get all CDP targets directly using CDP protocol
   * Exact match to Python implementation's _get_cdp_targets method
   */
  async _getCdpTargets(): Promise<Array<{ targetId: string; url: string }>> {
    if (!this.browser?.config?.cdpUrl) {
      return [];
    }

    try {
      if (!this.context) {
        return [];
      }

      const pages = this.context.pages();
      if (!pages.length) {
        return [];
      }

      const cdpSession = await pages[0].context().newCDPSession(pages[0]);
      const result = await cdpSession.send('Target.getTargets');
      await cdpSession.detach();
      return result.targetInfos || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Navigate to a URL
   * Exact match to Python implementation's navigate_to method
   */
  async navigateTo(url: string): Promise<void> {
    if (!this._isUrlAllowed(url)) {
      throw new Error(`Navigation to non-allowed URL: ${url}`);
    }

    const page = await this.getCurrentPage();
    await page.goto(url);
    await page.waitForLoadState();
  }

  /**
   * Get a debug view of the page structure including iframes
   * Exact match to Python implementation's get_page_structure method
   */
  async getPageStructure(): Promise<string> {
    const debugScript = `
    (() => {
      function getPageStructure(element = document, depth = 0, maxDepth = 10) {
        if (depth >= maxDepth) return '';
        
        const indent = '  '.repeat(depth);
        let structure = '';
        
        // Skip certain elements that clutter the output
        const skipTags = new Set(['script', 'style', 'link', 'meta', 'noscript']);
        
        // Add current element info if it's not the document
        if (element !== document) {
          const tagName = element.tagName.toLowerCase();
          
          // Skip uninteresting elements
          if (skipTags.has(tagName)) return '';
          
          const id = element.id ? '#' + element.id : '';
          const classes = element.className && typeof element.className === 'string' ? 
            '.' + element.className.split(' ').filter(c => c).join('.') : '';
          
          // Get additional useful attributes
          const attrs = [];
          if (element.getAttribute('role')) attrs.push('role="' + element.getAttribute('role') + '"');
          if (element.getAttribute('aria-label')) attrs.push('aria-label="' + element.getAttribute('aria-label') + '"');
          if (element.getAttribute('type')) attrs.push('type="' + element.getAttribute('type') + '"');
          if (element.getAttribute('name')) attrs.push('name="' + element.getAttribute('name') + '"');
          if (element.getAttribute('src')) {
            const src = element.getAttribute('src');
            attrs.push('src="' + src.substring(0, 50) + (src.length > 50 ? '...' : '') + '"');
          }
          
          // Add element info
          structure += indent + tagName + id + classes + (attrs.length ? ' [' + attrs.join(', ') + ']' : '') + '\\n';
          
          // Handle iframes specially
          if (tagName === 'iframe') {
            try {
              const iframeDoc = element.contentDocument || element.contentWindow?.document;
              if (iframeDoc) {
                structure += indent + '  --- IFRAME CONTENT ---\\n';
                structure += getPageStructure(iframeDoc, depth + 1, maxDepth);
                structure += indent + '  --- END IFRAME ---\\n';
              } else {
                structure += indent + '  [Cannot access iframe content - likely cross-origin]\\n';
              }
            } catch (e) {
              structure += indent + '  [Cannot access iframe: ' + e.message + ']\\n';
            }
            // Skip child processing as we handled it specially
            return structure;
          }
        } else {
          // Document node
          structure += indent + 'document [URL: ' + document.location.href + ']\\n';
        }
        
        // Process child elements
        for (const child of element.children) {
          structure += getPageStructure(child, depth + 1, maxDepth);
        }
        
        return structure;
      }
      
      return getPageStructure();
    })();`;

    const page = await this.getCurrentPage();
    return await page.evaluate(debugScript);
  }

  /**
   * Get the current session information
   * In Python this returns the actual session object, not a serialized dictionary
   */
  async getSession(): Promise<BrowserSession> {
    return this.session;
  }

  /**
   * Get a map of selectors for the current page
   * This retrieves the selector map from the cached state
   */
  async getSelectorMap(): Promise<SelectorMap> {
    // Get the selector map from the cached state directly from the session
    const session = await this.getSession();
    if (session.cachedState && session.cachedState.selectorMap) {
      return session.cachedState.selectorMap;
    }
    return {};
  }

  /**
   * Generate a CSS selector for a DOM element
   */
  /**
   * Converts a simple XPath to CSS selector
   * Matching Python implementation's _convert_simple_xpath_to_css_selector
   */
  /**
   * Get a DOM element by its index in the selector map
   * Exact match to Python implementation's get_dom_element_by_index method
   */
  async getDomElementByIndex(index: number | string): Promise<any> {
    const indexKey = String(index);
    const selectorMap = await this.getSelectorMap();

    if (!(indexKey in selectorMap)) {
      throw new Error(`Element index ${index} does not exist in selector map`);
    }

    // Direct match to Python implementation - returns element descriptor directly
    return selectorMap[indexKey];
  }

  /**
   * Get an element handle by its index in the selector map
   * Exact match to Python implementation's get_element_by_index method
   */
  async getElementByIndex(index: number | string): Promise<any> {
    const selectorMap = await this.getSelectorMap();
    const indexKey = String(index);
    const elementHandle = await this.getLocateElement(selectorMap[indexKey]);
    return elementHandle;
  }

  /**
   * Check if current page URL is allowed and handle if not
   * Exactly matches the Python implementation's _check_and_handle_navigation method
   */
  async _checkAndHandleNavigation(page: any): Promise<void> {
    const url = page.url() || '';
    if (!this._isUrlAllowed(url)) {
      console.warn(`Navigation to non-allowed URL detected: ${url}`);
      try {
        await this.goBack();
      } catch (e) {
        console.error(`Failed to go back after detecting non-allowed URL: ${e}`);
      }
      throw new Error(`Navigation to non-allowed URL: ${url}`);
    }
  }

  async _getUniqueFilename(directory: string, filename: string): Promise<string> {
    const fs = require('fs');
    const path = require('path');

    // Split filename into base and extension
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);

    let counter = 1;
    let newFilename = filename;

    // Keep incrementing counter until we find a filename that doesn't exist
    while (fs.existsSync(path.join(directory, newFilename))) {
      newFilename = `${base} (${counter})${ext}`;
      counter += 1;
    }

    return newFilename;
  }

  /**
   * Property to store the current state
   */
  private currentState?: BrowserState;

  /**
   * Check if element or its children are file uploaders
   * Exact match to Python implementation's is_file_uploader method
   */
  async isFileUploader(
    element: any,
    maxDepth: number = 3,
    currentDepth: number = 0,
  ): Promise<boolean> {
    if (currentDepth > maxDepth) {
      return false;
    }

    // Check if element is valid
    if (!element) {
      return false;
    }

    // Check current element
    let isUploader = false;

    // Check for file input attributes
    if (element.tag_name === 'input') {
      isUploader = element.attributes?.type === 'file' || element.attributes?.accept !== undefined;
    }

    if (isUploader) {
      return true;
    }

    // Recursively check children
    if (element.children && currentDepth < maxDepth) {
      for (const child of element.children) {
        if (child) {
          if (await this.isFileUploader(child, maxDepth, currentDepth + 1)) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
