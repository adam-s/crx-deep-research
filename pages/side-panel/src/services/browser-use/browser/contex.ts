import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { Page } from '@src/services/cordyceps/page';
import {
  RequestInfo,
  ResponseInfo,
  ScreenshotOptions,
} from '@src/services/cordyceps/utilities/types';
import { BrowserState, TabInfo } from './views';
import type {
  NavigateOptionsWithProgress,
  NavigationResponse,
} from '@src/services/cordyceps/utilities/types';
import { executeWithProgress } from '@src/services/cordyceps/core/progress';

// Interface for element objects used in CSS selector generation
interface ElementForSelector {
  xpath: string;
  tag_name?: string;
  highlight_index?: number;
  attributes?: Record<string, string>;
}

// Configuration interface for browser-use context
interface BrowserContextConfig {
  maximumWaitPageLoadTime?: number; // seconds
  waitForNetworkIdlePageLoadTime?: number; // seconds
  allowedDomains?: string[]; // Optional list of allowed domains for URL filtering
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
  context: unknown;
  // Add cachedState property to match Python implementation
  cachedState: BrowserState | null;

  constructor(id: string = crypto.randomUUID()) {
    this.id = id;
    this.startTime = new Date();
    this.endTime = null;
    this.state = BrowserContextState.CREATED;
    this.context = null;
    this.cachedState = null;
  }

  end(): void {
    // Only set endTime if not already closed (idempotent behavior)
    if (this.state !== BrowserContextState.CLOSED) {
      this.endTime = new Date();
      this.state = BrowserContextState.CLOSED;
    }
  }

  toDict(): Record<string, unknown> {
    return {
      id: this.id,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime ? this.endTime.toISOString() : null,
      state: this.state,
      context: this.context,
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

export class BrowserContext {
  browserWindow: BrowserWindow;
  pages: Page[];
  session: BrowserSession;
  config: BrowserContextConfig;

  static _enhancedCssSelectorForElement(
    element: ElementForSelector,
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

  constructor(browserWindow: BrowserWindow, config?: Partial<BrowserContextConfig>) {
    this.browserWindow = browserWindow;
    this.pages = [];
    this.session = new BrowserSession();
    this.config = {
      maximumWaitPageLoadTime: 5, // 5 seconds default
      waitForNetworkIdlePageLoadTime: 0.5, // 0.5 seconds default
      ...config,
    };
  }

  /**
   * Enter the browser context - Initialize connection to the current Chrome window
   * This method ensures the BrowserContext is properly connected to the Chrome extension environment
   * and handles session-level initialization that goes beyond basic BrowserWindow setup
   */
  async enter(): Promise<void> {
    try {
      console.log('🚀 Entering browser-use context for Chrome extension');

      // Verify we can access the current window
      const currentWindow = await chrome.windows.get(this.browserWindow.windowId);
      if (!currentWindow) {
        throw new Error(`Window ${this.browserWindow.windowId} no longer exists`);
      }

      // Ensure at least one page exists for browser automation
      const pages = this.browserWindow.pages();
      if (pages.length === 0) {
        console.log('🆕 No pages found, creating new tab for automation');
        await this.browserWindow.newPage();
      }

      // Get the current page and initialize our pages array
      const currentPage = await this.browserWindow.getCurrentPage();
      this.pages = [currentPage];

      // Update session state to active
      this.session.state = BrowserContextState.ACTIVE;
      this.session.context = this.browserWindow;

      console.log(`✅ Browser-use context entered successfully with ${this.pages.length} pages`);
    } catch (error) {
      console.error('❌ Failed to enter browser-use context:', error);
      throw new Error(
        `Failed to enter browser-use context: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get the current page from the browser window
   */
  async getCurrentPage(): Promise<Page> {
    // Ensure we're in an active state
    if (this.session.state !== BrowserContextState.ACTIVE) {
      await this.enter();
    }

    // Get the current active page from the browser window
    const currentPage = await this.browserWindow.getCurrentPage();

    // Update our pages array to reflect the current state
    if (!this.pages.includes(currentPage)) {
      this.pages = [currentPage];
    }

    return currentPage;
  }

  /**
   * Safe navigation that validates URL before navigating
   * This method should be used instead of direct page.goto() to ensure URL validation
   */
  async safeGoto(
    url: string,
    options?: NavigateOptionsWithProgress,
  ): Promise<NavigationResponse | null> {
    // Check if URL is allowed before navigation
    if (!this._isUrlAllowed(url)) {
      await this._handleDisallowedNavigation(url);
      return null; // This line won't be reached due to exception, but for clarity
    }

    // If URL is allowed, proceed with navigation
    const page = await this.getCurrentPage();
    return await page.goto(url, options);
  }

  /**
   * Stop loading the current page
   */
  async stopLoading(): Promise<void> {
    try {
      const page = await this.getCurrentPage();

      // Try using page.evaluate first
      if (typeof page.evaluate === 'function') {
        await page.evaluate(() => window.stop());
        console.info('Stopped page loading via page.evaluate');
      } else {
        // Fallback: use Chrome tabs API to stop loading
        console.info('Using fallback method to stop page loading');
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => window.stop(),
            });
            console.info('Stopped page loading via chrome.scripting');
          } catch (scriptError) {
            console.warn('Failed to execute stop script via chrome.scripting:', scriptError);
          }
        }
      }
    } catch (e: unknown) {
      console.error('Error stopping page loading:', e);
    }
  }

  /**
   * Takes a screenshot of the current page
   * Exact match to Python implementation's take_screenshot method
   * @param fullPage Whether to take a screenshot of the full page or just the viewport
   * @param throwOnError Whether to throw errors or return undefined on failure (default: false for graceful handling)
   * @returns Base64 encoded screenshot or undefined if error occurs and throwOnError is false
   */
  async takeScreenshot(
    fullPage: boolean = false,
    throwOnError: boolean = false,
  ): Promise<string | undefined> {
    try {
      return await executeWithProgress(async progress => {
        const page = await this.getCurrentPage();

        progress.log('Taking screenshot');

        const screenshotOptions: ScreenshotOptions = {
          fullPage,
          animations: 'disabled',
          type: 'png',
        };

        const screenshot = await page.screenshot(progress, screenshotOptions);
        const screenshotB64 = screenshot.toString('base64');

        // await this.removeHighlights();
        // Note: This line is commented out in the Python implementation

        return screenshotB64;
      });
    } catch (error) {
      console.error('Error taking screenshot:', error);

      if (throwOnError) {
        throw error;
      }

      return undefined;
    }
  }

  /**
   * Close the browser context - Clean up resources and prepare for shutdown
   * Note: In a Chrome extension side panel, we don't actually close browser tabs
   */
  async close(): Promise<void> {
    try {
      console.log('🚪 Closing browser-use context');

      // Clear our pages reference (but don't actually close browser tabs)
      this.pages = [];

      // End the session
      this.session.end();

      console.log('✅ Browser-use context closed successfully');
    } catch (error) {
      console.error('❌ Error closing browser-use context:', error);
      // Don't throw here - we want cleanup to complete even if there are errors
    }
  }

  /**
   * Check if the browser context is active
   */
  isActive(): boolean {
    return this.session.state === BrowserContextState.ACTIVE;
  }

  /**
   * @TODO change after public methods use
   *
   * Wait for network to stabilize using advanced filtering
   * This matches the Python implementation's _wait_for_stable_network method
   */
  async _waitForStableNetwork(): Promise<void> {
    const page = await this.browserWindow.getCurrentPage();

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

    const pendingRequests = new Set<RequestInfo>();
    let lastActivity = Date.now();
    const startTime = Date.now();

    // Set up listener for new requests
    const onRequest = (request: RequestInfo) => {
      // Filter by resource type
      if (!RELEVANT_RESOURCE_TYPES.has(request.resourceType)) {
        return;
      }

      // Filter out specific resource types
      if (
        ['websocket', 'media', 'eventsource', 'manifest', 'other'].includes(request.resourceType)
      ) {
        return;
      }

      // Filter out by URL patterns
      const url = request.url.toLowerCase();
      if (IGNORED_URL_PATTERNS.some(pattern => url.includes(pattern))) {
        return;
      }

      // Filter out data URLs and blob URLs
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        return;
      }

      // Filter out requests with specific headers
      const headers = request.headers;
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
    const onResponse = (response: ResponseInfo) => {
      const request = response.request;
      if (!pendingRequests.has(request)) {
        return;
      }

      // Filter by content type if available
      const contentType = (response.headers['content-type'] || '').toLowerCase();

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
      const contentLength = response.headers['content-length'];
      if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
        // 5MB
        pendingRequests.delete(request);
        return;
      }

      pendingRequests.delete(request);
      lastActivity = Date.now();
    };

    // Add event listeners using Cordyceps Page events
    const requestDisposable = page.onRequest(onRequest);
    const responseDisposable = page.onResponse(onResponse);

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
          requestDisposable.dispose();
          responseDisposable.dispose();
        };

        // Start checking
        checkNetworkIdle();
      });
    } catch (e: unknown) {
      console.error('Error while waiting for stable network:', e);
      requestDisposable.dispose();
      responseDisposable.dispose();
      throw e;
    }
  }

  /**
   * @TODO change after public methods use
   *
   * Check if a URL is allowed based on the allowed domains configuration
   * Matches the Python implementation's _is_url_allowed method
   */
  /**
   * Check if a URL is allowed based on the configured allowed domains.
   * Matches the Python implementation's _is_url_allowed method
   */
  _isUrlAllowed(url: string): boolean {
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
      // Normal behavior when testing malformed URLs
      console.log('Invalid URL format tested:', url);
      return false;
    }
  }

  /**
   * @TODO change after public methods use
   *
   * Handle disallowed navigation - throw error or navigate to a safe URL
   */
  async _handleDisallowedNavigation(url: string): Promise<void> {
    console.error(`Disallowed URL: ${url}`);

    // Navigate to a blank page if the current URL is not allowed
    try {
      const page = await this.getCurrentPage();
      await page.goto('about:blank');
      console.log('Successfully navigated to about:blank for security');
    } catch (error) {
      console.warn('Failed to navigate to about:blank, but continuing with error:', error);
      // Continue anyway - the important part is throwing the error
    }

    // Throw error to notify the calling code
    throw new Error(`URL not allowed: ${url}`);
  }

  /**
   * @TODO change after public methods use
   *
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
   * Get tabs info
   */
  async _getTabsInfo(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = [];
    const pages = this.browserWindow.pages();
    for (let i = 0; i < pages.length; i++) {
      tabs.push({
        pageId: i,
        url: pages[i].url(),
        title: await pages[i].title(),
      });
    }
    return tabs;
  }
}
