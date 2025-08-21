/**
 * ObserveHandlerUtils Redux - Chrome Extension Compatible Functions
 *
 * This module provides content script functions for observing and highlighting elements
 * in Chrome extension environments. All functions are CSP-compliant and work within
 * content script contexts.
 *
 * Features:
 * - Complete TypeScript safety with no 'any' types
 * - Real DOM manipulation with proper element highlighting
 * - Chrome extension Content Security Policy compliance
 * - XPath and CSS selector support for element location
 * - Visual overlay system for element observation
 * - Production-ready code quality with comprehensive error handling
 */

// =============================================================================
// CONTENT SCRIPT FUNCTIONS FOR OBSERVE HANDLER
// =============================================================================

/**
 * Content script function to draw visual overlays on observed elements
 * This function runs in the MAIN world content script context to highlight elements
 *
 * @param selectors - Array of CSS selectors or XPath selectors (with xpath= prefix)
 */
export const drawObserveOverlayFunction = (selectors: string[]): void => {
  selectors.forEach(selector => {
    let element: Element | null;

    if (selector.startsWith('xpath=')) {
      const xpath = selector.substring(6);
      element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue as Element | null;
    } else {
      element = document.querySelector(selector);
    }

    if (element instanceof HTMLElement) {
      const overlay = document.createElement('div');
      overlay.setAttribute('stagehandObserve', 'true');
      const rect = element.getBoundingClientRect();
      overlay.style.position = 'absolute';
      overlay.style.left = rect.left + 'px';
      overlay.style.top = rect.top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '10000';
      document.body.appendChild(overlay);
    }
  });
};

/**
 * Content script function to clear all observation overlays
 * Removes all visual highlights created by drawObserveOverlayFunction
 */
export const clearObserveOverlaysFunction = (): void => {
  const overlays = document.querySelectorAll('[stagehandObserve="true"]');
  overlays.forEach(overlay => overlay.remove());
};

/**
 * Content script function to count observable elements matching given selectors
 * Returns count information for validation and testing
 *
 * @param selectors - Array of CSS selectors or XPath selectors (with xpath= prefix)
 * @returns Object with counts and element information
 */
export const countObservableElementsFunction = (
  selectors: string[]
): {
  totalSelectors: number;
  foundElements: number;
  foundElementTypes: string[];
  missingSelectors: string[];
} => {
  const foundElementTypes: string[] = [];
  const missingSelectors: string[] = [];
  let foundElements = 0;

  selectors.forEach(selector => {
    let element: Element | null;

    if (selector.startsWith('xpath=')) {
      const xpath = selector.substring(6);
      element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue as Element | null;
    } else {
      element = document.querySelector(selector);
    }

    if (element) {
      foundElements++;
      foundElementTypes.push(element.tagName.toLowerCase());
    } else {
      missingSelectors.push(selector);
    }
  });

  return {
    totalSelectors: selectors.length,
    foundElements,
    foundElementTypes,
    missingSelectors,
  };
};

/**
 * Content script function to get detailed element information for observed elements
 * Provides comprehensive element data for testing and validation
 *
 * @param selectors - Array of CSS selectors or XPath selectors (with xpath= prefix)
 * @returns Array of element information objects
 */
export const getObservedElementInfoFunction = (
  selectors: string[]
): Array<{
  selector: string;
  found: boolean;
  tagName?: string;
  id?: string;
  className?: string;
  textContent?: string;
  visible?: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}> => {
  return selectors.map(selector => {
    let element: Element | null;

    if (selector.startsWith('xpath=')) {
      const xpath = selector.substring(6);
      element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue as Element | null;
    } else {
      element = document.querySelector(selector);
    }

    if (!element) {
      return {
        selector,
        found: false,
      };
    }

    const htmlElement = element as HTMLElement;
    const rect = htmlElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(htmlElement);

    return {
      selector,
      found: true,
      tagName: element.tagName.toLowerCase(),
      id: element.id || undefined,
      className: element.className || undefined,
      textContent: element.textContent?.trim().slice(0, 100) || undefined,
      visible:
        computedStyle.display !== 'none' &&
        computedStyle.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0,
      boundingBox: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
    };
  });
};

/**
 * Content script function to test XPath evaluation capabilities
 * Validates that XPath expressions can be properly evaluated in the content script context
 *
 * @param xpaths - Array of XPath expressions to test
 * @returns Test results for each XPath
 */
export const testXPathEvaluationFunction = (
  xpaths: string[]
): Array<{
  xpath: string;
  success: boolean;
  error?: string;
  elementCount?: number;
  firstElementTag?: string;
}> => {
  return xpaths.map(xpath => {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );

      const elementCount = result.snapshotLength;
      const firstElement = elementCount > 0 ? result.snapshotItem(0) : null;

      return {
        xpath,
        success: true,
        elementCount,
        firstElementTag: firstElement?.nodeName.toLowerCase(),
      };
    } catch (error) {
      return {
        xpath,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
};

/**
 * Content script function to validate overlay positioning and styling
 * Tests that overlays are correctly positioned and styled relative to target elements
 *
 * @param selectors - Array of selectors to test overlay positioning for
 * @returns Validation results for overlay positioning
 */
export const validateOverlayPositioningFunction = (
  selectors: string[]
): Array<{
  selector: string;
  elementFound: boolean;
  overlayCreated: boolean;
  positionCorrect?: boolean;
  styleCorrect?: boolean;
  overlayInfo?: {
    left: string;
    top: string;
    width: string;
    height: string;
    backgroundColor: string;
    zIndex: string;
  };
}> => {
  const results = selectors.map(selector => {
    let element: Element | null;

    if (selector.startsWith('xpath=')) {
      const xpath = selector.substring(6);
      element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        .singleNodeValue as Element | null;
    } else {
      element = document.querySelector(selector);
    }

    if (!element || !(element instanceof HTMLElement)) {
      return {
        selector,
        elementFound: false,
        overlayCreated: false,
      };
    }

    // Create a test overlay
    const overlay = document.createElement('div');
    overlay.setAttribute('stagehandObserveTest', 'true');
    const rect = element.getBoundingClientRect();
    overlay.style.position = 'absolute';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    overlay.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '10000';
    document.body.appendChild(overlay);

    const overlayRect = overlay.getBoundingClientRect();
    const positionCorrect =
      Math.abs(overlayRect.left - rect.left) < 1 &&
      Math.abs(overlayRect.top - rect.top) < 1 &&
      Math.abs(overlayRect.width - rect.width) < 1 &&
      Math.abs(overlayRect.height - rect.height) < 1;

    const computedStyle = window.getComputedStyle(overlay);
    const styleCorrect =
      computedStyle.backgroundColor === 'rgba(255, 255, 0, 0.3)' &&
      computedStyle.position === 'absolute' &&
      computedStyle.pointerEvents === 'none' &&
      computedStyle.zIndex === '10000';

    const result = {
      selector,
      elementFound: true,
      overlayCreated: true,
      positionCorrect,
      styleCorrect,
      overlayInfo: {
        left: overlay.style.left,
        top: overlay.style.top,
        width: overlay.style.width,
        height: overlay.style.height,
        backgroundColor: overlay.style.backgroundColor,
        zIndex: overlay.style.zIndex,
      },
    };

    // Clean up test overlay
    overlay.remove();

    return result;
  });

  return results;
};

// =============================================================================
// EXPORT ALL CONTENT SCRIPT FUNCTIONS
// =============================================================================

export {
  // Main overlay functions
  drawObserveOverlayFunction as observeDrawOverlayFunction,
  clearObserveOverlaysFunction as observeClearOverlaysFunction,

  // Testing and validation functions
  countObservableElementsFunction as observeCountElementsFunction,
  getObservedElementInfoFunction as observeGetElementInfoFunction,
  testXPathEvaluationFunction as observeTestXPathFunction,
  validateOverlayPositioningFunction as observeValidateOverlayFunction,
};
