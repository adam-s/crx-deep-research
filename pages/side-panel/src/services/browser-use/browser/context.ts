import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import { Page } from '@src/services/cordyceps/page';
import { ElementHandle } from '@src/services/cordyceps/elementHandle';
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
import { DOMService } from '../dom/service';
import { DOMElementNode, SelectorMap } from '../dom/views';
import { ElementForSelector, ElementNode } from '../dom/types';
import { generateUuid } from 'vs/base/common/uuid';

// Configuration interface for browser-use context
interface BrowserContextConfig {
  maximumWaitPageLoadTime?: number; // seconds
  waitForNetworkIdlePageLoadTime?: number; // seconds
  allowedDomains?: string[]; // Optional list of allowed domains for URL filtering
  // Whether to draw highlight overlays for detected clickable elements
  highlightElements?: boolean;
  // Pixels to expand viewport bounds when collecting elements (-1 for no limit)
  viewportExpansion?: number;
  saveDownloadsPath: string | null;
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
  context: BrowserWindow | null;
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
  // Following the Python implementation's state storage
  state: { targetId?: string; [key: string]: unknown } = {};

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
      highlightElements: true,
      viewportExpansion: 500,
      saveDownloadsPath: null, // Default to null (no download path)
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
    console.log(`[BrowserContext.getCurrentPage] ############ Starting getCurrentPage()`);

    // Ensure we're in an active state
    if (this.session.state !== BrowserContextState.ACTIVE) {
      console.log(
        `[BrowserContext.getCurrentPage] ############ Session not active, calling enter()`,
      );
      await this.enter();
      console.log(`[BrowserContext.getCurrentPage] ############ enter() completed`);
    }

    // Get the current active page from the browser window
    console.log(
      `[BrowserContext.getCurrentPage] ############ Getting current page from browser window`,
    );
    const currentPage = await this.browserWindow.getCurrentPage();
    console.log(
      `[BrowserContext.getCurrentPage] ############ Got current page: ${currentPage.tabId}`,
    );

    // Update our pages array to reflect the current state
    if (!this.pages.includes(currentPage)) {
      console.log(`[BrowserContext.getCurrentPage] ############ Updating pages array`);
      this.pages = [currentPage];
    }

    console.log(`[BrowserContext.getCurrentPage] ############ getCurrentPage completed`);
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
    console.log(
      `[BrowserContext.takeScreenshot] ############ Starting takeScreenshot(fullPage=${fullPage}, throwOnError=${throwOnError})`,
    );

    try {
      return await executeWithProgress(async progress => {
        console.log(`[BrowserContext.takeScreenshot] ############ About to get current page`);
        const page = await this.getCurrentPage();
        console.log(`[BrowserContext.takeScreenshot] ############ Got current page: ${page.tabId}`);

        progress.log('Taking screenshot');
        console.log(`[BrowserContext.takeScreenshot] ############ Progress: Taking screenshot`);

        const screenshotOptions: ScreenshotOptions = {
          fullPage,
          animations: 'disabled',
          type: 'png',
        };

        console.log(
          `[BrowserContext.takeScreenshot] ############ About to call page.screenshot with options:`,
          screenshotOptions,
        );
        const screenshot = await page.screenshot(progress, screenshotOptions);
        console.log(
          `[BrowserContext.takeScreenshot] ############ Screenshot taken, size: ${screenshot.length} bytes`,
        );

        const screenshotB64 = screenshot.toString('base64');
        console.log(
          `[BrowserContext.takeScreenshot] ############ Screenshot converted to base64, length: ${screenshotB64.length}`,
        );

        // await this.removeHighlights();
        // Note: This line is commented out in the Python implementation

        console.log(
          `[BrowserContext.takeScreenshot] ############ takeScreenshot completed successfully`,
        );
        return screenshotB64;
      });
    } catch (error) {
      console.error(`[BrowserContext.takeScreenshot] ############ Error taking screenshot:`, error);

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
    console.log(
      `[BrowserContext._waitForStableNetwork] ############ Starting _waitForStableNetwork()`,
    );

    const page = await this.browserWindow.getCurrentPage();
    console.log(
      `[BrowserContext._waitForStableNetwork] ############ Got current page: ${page.tabId}`,
    );

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

    console.log(
      `[BrowserContext._waitForStableNetwork] ############ Setting up request/response listeners`,
    );

    // Set up listener for new requests
    const onRequest = (request: RequestInfo) => {
      console.log(
        `[BrowserContext._waitForStableNetwork] ############ Request: ${request.url} (${request.resourceType})`,
      );

      // Filter by resource type
      if (!RELEVANT_RESOURCE_TYPES.has(request.resourceType)) {
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Filtered out by resource type: ${request.resourceType}`,
        );
        return;
      }

      // Filter out specific resource types
      if (
        ['websocket', 'media', 'eventsource', 'manifest', 'other'].includes(request.resourceType)
      ) {
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Filtered out by specific resource type: ${request.resourceType}`,
        );
        return;
      }

      // Filter out by URL patterns
      const url = request.url.toLowerCase();
      if (IGNORED_URL_PATTERNS.some(pattern => url.includes(pattern))) {
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Filtered out by URL pattern: ${url}`,
        );
        return;
      }

      // Filter out data URLs and blob URLs
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Filtered out data/blob URL: ${url}`,
        );
        return;
      }

      // Filter out requests with specific headers
      const headers = request.headers;
      if (
        headers['purpose'] === 'prefetch' ||
        headers['sec-fetch-dest'] === 'video' ||
        headers['sec-fetch-dest'] === 'audio'
      ) {
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Filtered out by headers: ${JSON.stringify(headers)}`,
        );
        return;
      }

      pendingRequests.add(request);
      lastActivity = Date.now();
      console.log(
        `[BrowserContext._waitForStableNetwork] ############ Added request, pending count: ${pendingRequests.size}`,
      );
    };

    // Set up listener for responses
    const onResponse = (response: ResponseInfo) => {
      const request = response.request;
      console.log(
        `[BrowserContext._waitForStableNetwork] ############ Response for: ${request.url}`,
      );

      if (!pendingRequests.has(request)) {
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Response for unknown request: ${request.url}`,
        );
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
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Filtered out response by streaming content type: ${contentType}`,
        );
        return;
      }

      // Only process relevant content types
      if (!RELEVANT_CONTENT_TYPES.some(ct => contentType.includes(ct))) {
        pendingRequests.delete(request);
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Filtered out response by irrelevant content type: ${contentType}`,
        );
        return;
      }

      // Skip if response is too large (likely not essential for page load)
      const contentLength = response.headers['content-length'];
      if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
        // 5MB
        pendingRequests.delete(request);
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Filtered out response by large size: ${contentLength}`,
        );
        return;
      }

      pendingRequests.delete(request);
      lastActivity = Date.now();
      console.log(
        `[BrowserContext._waitForStableNetwork] ############ Removed request, pending count: ${pendingRequests.size}`,
      );
    };

    // Add event listeners using Cordyceps Page events
    console.log(`[BrowserContext._waitForStableNetwork] ############ Adding event listeners`);
    const requestDisposable = page.onRequest(onRequest);
    const responseDisposable = page.onResponse(onResponse);
    console.log(`[BrowserContext._waitForStableNetwork] ############ Event listeners added`);

    try {
      // Wait for network to stabilize
      const maxWaitTime = (this.config.maximumWaitPageLoadTime || 5) * 1000; // In milliseconds
      const networkIdleTime = (this.config.waitForNetworkIdlePageLoadTime || 0.5) * 1000; // In milliseconds

      console.log(
        `[BrowserContext._waitForStableNetwork] ############ Starting network stabilization wait - maxWaitTime: ${maxWaitTime}ms, networkIdleTime: ${networkIdleTime}ms`,
      );

      return new Promise<void>(resolve => {
        const checkNetworkIdle = () => {
          const now = Date.now();
          const elapsedSinceLastActivity = now - lastActivity;
          const totalElapsed = now - startTime;

          console.log(
            `[BrowserContext._waitForStableNetwork] ############ Check: pendingRequests=${pendingRequests.size}, elapsedSinceLastActivity=${elapsedSinceLastActivity}ms, totalElapsed=${totalElapsed}ms`,
          );

          // Wait for network idle
          if (pendingRequests.size === 0 && elapsedSinceLastActivity >= networkIdleTime) {
            console.log(
              `[BrowserContext._waitForStableNetwork] ############ Network is stable, resolving`,
            );
            cleanup();
            resolve();
            return;
          }

          // Time out if waiting too long
          if (totalElapsed > maxWaitTime) {
            console.log(
              `[BrowserContext._waitForStableNetwork] ############ Network wait timed out after ${maxWaitTime}ms with ${pendingRequests.size} pending requests, resolving anyway`,
            );
            cleanup();
            resolve(); // Resolve anyway to continue
            return;
          }

          // Otherwise check again after a short delay
          setTimeout(checkNetworkIdle, 100);
        };

        const cleanup = () => {
          console.log(
            `[BrowserContext._waitForStableNetwork] ############ Cleaning up event listeners`,
          );
          requestDisposable.dispose();
          responseDisposable.dispose();
        };

        // Start checking
        console.log(
          `[BrowserContext._waitForStableNetwork] ############ Starting periodic network check`,
        );
        checkNetworkIdle();
      });
    } catch (e: unknown) {
      console.error(
        `[BrowserContext._waitForStableNetwork] ############ Error while waiting for stable network:`,
        e,
      );
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
      // Do not await here: about:blank often doesn't emit webNavigation events,
      // causing goto() to wait for lifecycle that never arrives. Fire-and-forget.
      try {
        chrome.tabs.update(page.tabId, { url: 'about:blank' });
        console.log('Issued navigation to about:blank for security');
      } catch (innerErr) {
        console.warn('chrome.tabs.update failed when navigating to about:blank:', innerErr);
      }
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
    console.log(
      `[BrowserContext._waitForPageAndFramesLoad] ############ Starting _waitForPageAndFramesLoad()`,
    );

    // Start timing
    const startTime = Date.now();

    try {
      // Wait for network to stabilize with smart filtering
      console.log(
        `[BrowserContext._waitForPageAndFramesLoad] ############ About to call _waitForStableNetwork()`,
      );
      await this._waitForStableNetwork();
      console.log(
        `[BrowserContext._waitForPageAndFramesLoad] ############ _waitForStableNetwork() completed`,
      );

      // Check if the loaded URL is allowed
      console.log(
        `[BrowserContext._waitForPageAndFramesLoad] ############ About to get current page for URL check`,
      );
      const page = await this.getCurrentPage();
      const url = page.url();
      console.log(`[BrowserContext._waitForPageAndFramesLoad] ############ Current URL: ${url}`);

      if (!this._isUrlAllowed(url)) {
        console.log(
          `[BrowserContext._waitForPageAndFramesLoad] ############ URL not allowed, handling disallowed navigation`,
        );
        await this._handleDisallowedNavigation(url);
      } else {
        console.log(`[BrowserContext._waitForPageAndFramesLoad] ############ URL is allowed`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('URL not allowed:')) {
        console.log(
          `[BrowserContext._waitForPageAndFramesLoad] ############ Re-throwing URL not allowed error`,
        );
        throw error; // Re-throw URL not allowed errors
      }
      console.warn(
        `[BrowserContext._waitForPageAndFramesLoad] ############ Page load failed, continuing...`,
        error,
      );
    }

    // Use timeout override if provided (match Python implementation's default value)
    // Use a default of 0.25 seconds if minimumWaitPageLoadTime is not available
    const minimumWait = options?.timeoutOverwrite ?? 0.25;

    // Calculate remaining time to meet minimum wait time
    const elapsed = (Date.now() - startTime) / 1000; // Convert to seconds
    const remaining = Math.max(minimumWait - elapsed, 0);

    console.log(
      `[BrowserContext._waitForPageAndFramesLoad] ############ Minimum wait: ${minimumWait}s, elapsed: ${elapsed}s, remaining: ${remaining}s`,
    );

    // Sleep remaining time if needed
    if (remaining > 0) {
      console.log(
        `[BrowserContext._waitForPageAndFramesLoad] ############ Waiting additional ${remaining}s`,
      );
      await new Promise(resolve => setTimeout(resolve, remaining * 1000));
    }

    console.log(
      `[BrowserContext._waitForPageAndFramesLoad] ############ _waitForPageAndFramesLoad() completed`,
    );
  }

  /**
   * Get tabs info
   */
  async _getTabsInfo(): Promise<TabInfo[]> {
    console.log(`[BrowserContext._getTabsInfo] ############ Starting _getTabsInfo()`);
    const tabs: TabInfo[] = [];
    const pages = this.browserWindow.pages();
    console.log(`[BrowserContext._getTabsInfo] ############ Got ${pages.length} pages`);

    for (let i = 0; i < pages.length; i++) {
      console.log(`[BrowserContext._getTabsInfo] ############ Processing page ${i}`);

      let title = 'Unknown';
      try {
        // Try to get the title with a short timeout to avoid hanging on chrome:// pages
        console.log(`[BrowserContext._getTabsInfo] ############ About to get title for page ${i}`);

        // Use a promise race to timeout quickly for problematic pages (like chrome://)
        const titlePromise = pages[i].title();
        const timeoutPromise = new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error('Title retrieval timeout')), 2000); // 2 second timeout
        });

        title = await Promise.race([titlePromise, timeoutPromise]);
        console.log(`[BrowserContext._getTabsInfo] ############ Got title for page ${i}: ${title}`);
      } catch (error) {
        console.log(
          `[BrowserContext._getTabsInfo] ############ Failed to get title for page ${i}, using fallback:`,
          error,
        );
        // Fallback: use URL as title or default
        const url = pages[i].url();
        title = url ? new URL(url).hostname : 'Unknown';
      }

      tabs.push({
        pageId: i,
        url: pages[i].url(),
        title: title,
      });
      console.log(`[BrowserContext._getTabsInfo] ############ Added tab ${i}: ${tabs[i].url}`);
    }

    console.log(
      `[BrowserContext._getTabsInfo] ############ _getTabsInfo completed with ${tabs.length} tabs`,
    );
    return tabs;
  }

  /**
   * Get the state of the browser
   * This is an exact implementation that matches the original Python code
   */
  async getState(): Promise<BrowserState> {
    console.log(`[BrowserContext.getState] ############ Starting getState()`);

    try {
      // Wait for page and frames to load
      console.log(
        `[BrowserContext.getState] ############ About to call _waitForPageAndFramesLoad()`,
      );
      await this._waitForPageAndFramesLoad();
      console.log(`[BrowserContext.getState] ############ _waitForPageAndFramesLoad() completed`);

      // Update state and store it in the session's cachedState
      console.log(`[BrowserContext.getState] ############ About to call _updateState()`);
      const state = await this._updateState();
      console.log(`[BrowserContext.getState] ############ _updateState() completed`);

      // Update the session's cachedState to match the current state
      // This follows the Python implementation pattern where session.cached_state = await self._update_state()
      console.log(`[BrowserContext.getState] ############ About to call getSession()`);
      const session = await this.getSession();
      session.cachedState = state;
      console.log(
        `[BrowserContext.getState] ############ getSession() completed, cached state updated`,
      );

      // Return the state
      console.log(`[BrowserContext.getState] ############ getState() completed successfully`);
      return state;
    } catch (error) {
      console.error(`[BrowserContext.getState] ############ Error in getState():`, error);
      throw error;
    }
  }

  /**
   * Update and return state
   * This matches the original Python implementation
   */
  async _updateState(focusElement: number = -1): Promise<BrowserState> {
    console.log(
      `[BrowserContext._updateState] ############ Starting _updateState(focusElement=${focusElement})`,
    );

    try {
      // Get the current page
      console.log(`[BrowserContext._updateState] ############ About to get current page`);
      const page = await this.getCurrentPage();
      console.log(`[BrowserContext._updateState] ############ Got current page: ${page.tabId}`);

      // Test if page is still accessible
      console.log(`[BrowserContext._updateState] ############ Testing page accessibility`);
      try {
        const evalResult = await page.evaluate(() => {
          return 1;
        });
        console.log(
          `[BrowserContext._updateState] ############ Page accessibility test completed, result: ${JSON.stringify(evalResult)}, type: ${typeof evalResult}`,
        );
        console.log(`[BrowserContext._updateState] ############ Page is accessible`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(
          `[BrowserContext._updateState] ############ Page accessibility test failed, continuing anyway: ${errorMessage}`,
        );
        // Continue without failing - page might still be usable for screenshots/other operations
      }

      // Remove highlights
      console.log(`[BrowserContext._updateState] ############ About to remove highlights`);
      await this.removeHighlights();
      console.log(`[BrowserContext._updateState] ############ Highlights removed`);

      // Get clickable elements
      console.log(`[BrowserContext._updateState] ############ About to get clickable elements`);
      const domService = new DOMService(page);
      const content = await domService.getClickableElements(
        this.config.highlightElements,
        focusElement,
        this.config.viewportExpansion,
      );
      console.log(`[BrowserContext._updateState] ############ Got clickable elements`);

      // Take screenshot
      console.log(`[BrowserContext._updateState] ############ About to take screenshot`);
      const screenshot = await this.takeScreenshot();
      console.log(`[BrowserContext._updateState] ############ Screenshot taken`);

      // Get scroll info
      console.log(`[BrowserContext._updateState] ############ About to get scroll info`);
      const [pixelsAbove, pixelsBelow] = await this._getScrollInfo(page);
      console.log(
        `[BrowserContext._updateState] ############ Got scroll info: above=${pixelsAbove}, below=${pixelsBelow}`,
      );

      // Get tabs info
      console.log(`[BrowserContext._updateState] ############ About to get tabs info`);
      const tabs = await this._getTabsInfo();
      console.log(`[BrowserContext._updateState] ############ Got tabs info: ${tabs.length} tabs`);

      // Create and return the browser state
      console.log(`[BrowserContext._updateState] ############ About to create BrowserState`);
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
      console.log(`[BrowserContext._updateState] ############ BrowserState created`);

      // Store the current state for future reference
      this.currentState = state;

      // Explicitly update the session's cachedState here (this is critical for selector map access)
      const session = await this.getSession();
      session.cachedState = state;

      console.log(`[BrowserContext._updateState] ############ _updateState completed successfully`);
      return state;
    } catch (error) {
      console.error(`[BrowserContext._updateState] ############ Failed to update state:`, error);
      // Return last known good state if available
      if (this.currentState) {
        console.log(`[BrowserContext._updateState] ############ Returning last known good state`);
        return this.currentState;
      }
      throw error;
    }
  }

  /**
   * Get the current session information
   * In Python this returns the actual session object, not a serialized dictionary
   */
  async getSession(): Promise<BrowserSession> {
    console.log(`[BrowserContext.getSession] ############ Getting session: ${this.session.id}`);
    return this.session;
  }

  /**
   * Removes all highlight overlays and labels created by the highlightElement function
   * Exact match to Python implementation's remove_highlights method
   */
  async removeHighlights(): Promise<void> {
    console.log(`[BrowserContext.removeHighlights] ############ Starting removeHighlights()`);
    try {
      console.log(`[BrowserContext.removeHighlights] ############ About to get current page`);
      const page = await this.getCurrentPage();
      console.log(`[BrowserContext.removeHighlights] ############ Got current page: ${page.tabId}`);

      console.log(
        `[BrowserContext.removeHighlights] ############ About to evaluate highlight removal`,
      );
      await page.evaluate(() => {
        try {
          // Remove the highlight container and all its contents
          const container = document.getElementById('playwright-highlight-container');
          if (container) {
            container.remove();
          }

          // Remove highlight attributes from elements
          const highlightedElements = document.querySelectorAll(
            '[browser-user-highlight-id^="playwright-highlight-"]',
          );
          highlightedElements.forEach(el => {
            el.removeAttribute('browser-user-highlight-id');
          });
        } catch (e) {
          console.error('Failed to remove highlights:', e);
        }
      });
      console.log(
        `[BrowserContext.removeHighlights] ############ Highlight removal evaluation completed`,
      );
    } catch (error) {
      console.log(
        `[BrowserContext.removeHighlights] ############ Error in removeHighlights (non-critical):`,
        error,
      );
      // Don't raise the error since this is not critical functionality
    }

    console.log(`[BrowserContext.removeHighlights] ############ removeHighlights completed`);
  }

  /**
   * Internal method for getting scroll info
   * @private
   */
  async _getScrollInfo(page: Page): Promise<[number, number]> {
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
   * Property to store the current state
   */
  private currentState?: BrowserState;

  /**
   * Reset the browser session
   * Call this when you don't want to kill the context but just kill the state
   * Exact match to Python implementation's reset_context method
   */
  async resetContext(): Promise<void> {
    // Close all tabs and clear cached state
    const session = await this.getSession();

    if (session.context) {
      const pages = session.context.pages();
      for (const page of pages) {
        await page.close();
      }
    }

    session.cachedState = null;
    // Reset the targetId in the context state
    delete this.state.targetId;
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
   * Get a debug view of the page structure including iframes
   * Exact match to Python implementation's get_page_structure method
   */
  async getPageStructure(): Promise<string> {
    const debugScript = (): string => {
      function getPageStructureInner(
        element: Document | Element = document,
        depth: number = 0,
        maxDepth: number = 10,
      ): string {
        if (depth >= maxDepth) return '';

        const indent: string = '  '.repeat(depth);
        let structure: string = '';

        // Skip certain elements that clutter the output
        const skipTags = new Set<string>(['script', 'style', 'link', 'meta', 'noscript']);

        // Add current element info if it's not the document
        if (element !== document) {
          const htmlElement = element as Element;
          const tagName: string = htmlElement.tagName.toLowerCase();

          // Skip uninteresting elements
          if (skipTags.has(tagName)) return '';

          const id: string = htmlElement.id ? '#' + htmlElement.id : '';
          const classes: string =
            htmlElement.className && typeof htmlElement.className === 'string'
              ? '.' +
                htmlElement.className
                  .split(' ')
                  .filter((c: string) => c)
                  .join('.')
              : '';

          // Get additional useful attributes
          const attrs: string[] = [];
          const roleAttr: string | null = htmlElement.getAttribute('role');
          if (roleAttr) attrs.push('role="' + roleAttr + '"');

          const ariaLabelAttr: string | null = htmlElement.getAttribute('aria-label');
          if (ariaLabelAttr) attrs.push('aria-label="' + ariaLabelAttr + '"');

          const typeAttr: string | null = htmlElement.getAttribute('type');
          if (typeAttr) attrs.push('type="' + typeAttr + '"');

          const nameAttr: string | null = htmlElement.getAttribute('name');
          if (nameAttr) attrs.push('name="' + nameAttr + '"');

          const srcAttr: string | null = htmlElement.getAttribute('src');
          if (srcAttr) {
            const src: string = srcAttr;
            attrs.push('src="' + src.substring(0, 50) + (src.length > 50 ? '...' : '') + '"');
          }

          // Add element info
          structure +=
            indent +
            tagName +
            id +
            classes +
            (attrs.length ? ' [' + attrs.join(', ') + ']' : '') +
            '\\n';

          // Handle iframes specially
          if (tagName === 'iframe') {
            try {
              const iframeElement = htmlElement as HTMLIFrameElement;
              const iframeDoc: Document | null =
                iframeElement.contentDocument || iframeElement.contentWindow?.document || null;
              if (iframeDoc) {
                structure += indent + '  --- IFRAME CONTENT ---\\n';
                structure += getPageStructureInner(iframeDoc, depth + 1, maxDepth);
                structure += indent + '  --- END IFRAME ---\\n';
              } else {
                structure += indent + '  [Cannot access iframe content - likely cross-origin]\\n';
              }
            } catch (e: unknown) {
              const errorMessage: string = e instanceof Error ? e.message : String(e);
              structure += indent + '  [Cannot access iframe: ' + errorMessage + ']\\n';
            }
            // Skip child processing as we handled it specially
            return structure;
          }
        } else {
          // Document node
          structure += indent + 'document [URL: ' + document.location.href + ']\\n';
        }

        // Process child elements
        const children: HTMLCollection = element.children;
        for (let i = 0; i < children.length; i++) {
          const child: Element = children[i];
          structure += getPageStructureInner(child, depth + 1, maxDepth);
        }

        return structure;
      }

      return getPageStructureInner();
    };

    const page = await this.getCurrentPage();
    return await page.evaluate(debugScript);
  }

  /**
   * Get a DOM element by its index in the selector map
   * Exact match to Python implementation's get_dom_element_by_index method
   */
  async getDomElementByIndex(index: number | string): Promise<DOMElementNode> {
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
  async getElementByIndex(index: number | string): Promise<ElementHandle | null> {
    const selectorMap = await this.getSelectorMap();
    const indexKey = String(index);
    const elementHandle = await this.getLocateElement(selectorMap[indexKey]);
    return elementHandle;
  }

  /**
   * Helper function to get tag name from any ElementNode type
   */
  private static _getTagName(element: ElementNode): string {
    if ('tag' in element && element.tag) {
      return element.tag;
    }
    if ('tag_name' in element && element.tag_name) {
      return element.tag_name;
    }
    return 'unknown';
  }

  /**
   * Click on a DOM element node
   * Exact match to Python implementation's _click_element_node
   */
  async _clickElementNode(elementNode: ElementNode): Promise<string | null> {
    const page = await this.getCurrentPage();

    try {
      // Get element using getLocateElement (equivalent to Python's get_locate_element)
      const elementHandle = await this.getLocateElement(elementNode);

      if (!elementHandle) {
        throw new Error(
          `Element: ${JSON.stringify({
            tagName: BrowserContext._getTagName(elementNode),
            xpath: elementNode.xpath,
          })} not found`,
        );
      }

      // Define a perform_click function just like in the Python implementation
      const performClick = async (clickFunc: () => Promise<void>): Promise<string | null> => {
        if (this.config.saveDownloadsPath) {
          try {
            // Cordyceps Chrome extension download handling
            // Use Cordyceps page.onDownload() instead of Playwright's waitForEvent
            let downloadDetected = false;
            let downloadPath: string | null = null;

            // Set up download listener for Cordyceps
            const downloadDisposable = page.onDownload(async download => {
              downloadDetected = true;

              // Get the suggested filename and save the file
              const suggestedFilename = download.suggestedFilename();

              // Get unique filename to avoid conflicts
              const uniqueFilename = await this._getUniqueFilename(
                this.config.saveDownloadsPath!,
                suggestedFilename,
              );

              // In Chrome extension environment, downloads are handled by Chrome
              // We get the download path from the Chrome downloads API
              downloadPath = await download.path();

              // If we have a specific save path configured, try to save there
              if (this.config.saveDownloadsPath && downloadPath) {
                try {
                  // Create target path using simple string concatenation (Chrome extension compatible)
                  const separator = this.config.saveDownloadsPath.endsWith('/') ? '' : '/';
                  const targetPath = `${this.config.saveDownloadsPath}${separator}${uniqueFilename}`;
                  await download.saveAs(targetPath);
                  downloadPath = targetPath;
                } catch (saveError) {
                  // If saveAs fails in Chrome extension, use the default download path
                  console.warn(
                    'Could not save to custom path, using default download location:',
                    saveError,
                  );
                }
              }
            });

            // Perform the click
            await clickFunc();

            // Wait a short time to see if download was triggered
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Clean up the download listener
            downloadDisposable.dispose();

            if (downloadDetected && downloadPath) {
              return downloadPath;
            }

            // If no download detected, proceed with normal navigation handling
            await page.waitForLoadState();
            await this._checkAndHandleNavigation(page);
            return null;
          } catch (e) {
            // Handle errors in Chrome extension environment
            if (e instanceof Error) {
              // Check for common Chrome extension errors
              if (e.message.includes('timeout') || e.message.includes('download')) {
                await page.waitForLoadState();
                await this._checkAndHandleNavigation(page);
                return null;
              }
            }
            throw e;
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
          tagName: BrowserContext._getTagName(elementNode),
          xpath: elementNode.xpath,
        })}. Error: ${e}`,
      );
    }
  }

  /**
   * Helper function to get parent from any ElementNode type
   */
  private static _getParent(element: ElementNode): ElementNode | null {
    if ('parent' in element && element.parent) {
      return element.parent;
    }
    return null;
  }

  /**
   * Helper function to get highlight index from any ElementNode type
   */
  private static _getHighlightIndex(element: ElementNode): number | undefined {
    if ('highlightIndex' in element) {
      return element.highlightIndex;
    }
    if ('highlight_index' in element) {
      return element.highlight_index;
    }
    return undefined;
  }

  /**
   * Helper function to convert ElementNode to ElementForSelector for CSS generation
   */
  private static _toElementForSelector(element: ElementNode): ElementForSelector {
    const result: ElementForSelector = {
      xpath: element.xpath || '',
      tag_name: BrowserContext._getTagName(element),
      highlight_index: BrowserContext._getHighlightIndex(element),
      attributes: element.attributes,
    };
    return result;
  }

  async getLocateElement(element: ElementNode): Promise<ElementHandle | null> {
    if (!element) {
      return null;
    }

    let currentFrame = await this.getCurrentPage();

    // Start with the target element and collect all parents
    const parents: ElementNode[] = [];
    let current = element;
    let parent = BrowserContext._getParent(current);
    while (parent) {
      parents.push(parent);
      current = parent;
      parent = BrowserContext._getParent(current);
    }

    // Reverse the parents list to process from top to bottom
    parents.reverse();

    // Process all iframe parents in sequence
    const iframes = parents.filter(item => BrowserContext._getTagName(item) === 'iframe');

    for (const parent of iframes) {
      const cssSelector = BrowserContext._enhancedCssSelectorForElement(
        BrowserContext._toElementForSelector(parent),
        true, // Use true as default for includeDynamicAttributes
      );
      currentFrame = currentFrame.frameLocator(cssSelector);
    }

    const cssSelector = BrowserContext._enhancedCssSelectorForElement(
      BrowserContext._toElementForSelector(element),
      true, // Use true as default for includeDynamicAttributes
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
  async _inputTextElementNode(elementNode: ElementNode, text: string): Promise<void> {
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
      const highlightIndex = BrowserContext._getHighlightIndex(elementNode);
      throw new Error(`Failed to input text into index ${highlightIndex || 'unknown'}`);
    }
  }

  /**
   * Get a unique filename using UUID to avoid conflicts
   * Chrome extension compatible version without Node.js dependencies
   */
  async _getUniqueFilename(directory: string, filename: string): Promise<string> {
    // Split filename into base and extension using built-in string methods
    const lastDotIndex = filename.lastIndexOf('.');
    const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

    const base = hasExtension ? filename.substring(0, lastDotIndex) : filename;
    const ext = hasExtension ? filename.substring(lastDotIndex) : '';

    // Use UUID to ensure uniqueness in Chrome extension environment
    const uuid = generateUuid();
    const shortUuid = uuid.substring(0, 8); // Use first 8 characters for shorter filename

    // Create a unique filename with UUID component
    const newFilename = `${base}_${shortUuid}${ext}`;

    return newFilename;
  }

  /**
   * Check if current page URL is allowed and handle if not
   * Exactly matches the Python implementation's _check_and_handle_navigation method
   */
  async _checkAndHandleNavigation(page: Page): Promise<void> {
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
}
