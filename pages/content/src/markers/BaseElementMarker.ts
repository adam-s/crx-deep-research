import { CaptureOptions, InteractiveElement, ElementFilterFunction } from './types';

/**
 * Base abstract class for element marking functionality
 * Contains shared methods and defines abstract methods that must be implemented by subclasses
 */
export abstract class BaseElementMarker {
  protected readonly DEBUG_HIGHLIGHT: boolean;
  protected readonly highlightColors: string[] = ['#FF0000', '#00FF00', '#0000FF', '#FFA500'];
  protected elementIndex: number = 0;
  protected highlightContainer: HTMLElement | null = null;

  constructor(options: CaptureOptions = {}) {
    this.DEBUG_HIGHLIGHT = options.debugHighlight || false;
  }

  /**
   * Main entry point for capturing interactive elements
   */
  public captureInteractiveElements(): InteractiveElement[] {
    // Reset state
    this.elementIndex = 0;
    this.highlightContainer = null;

    // Check for PDF
    if (this.isPDFDetected()) {
      return this.createPDFResult();
    }

    // Setup debug highlighting if enabled
    if (this.DEBUG_HIGHLIGHT) {
      this.setupHighlightContainer();
    }

    // Collect elements using the tree walker
    const capturedElements = this.collectElements();

    // Convert to result format
    return this.mapElementsToResults(capturedElements);
  }

  /**
   * PDF Detection - identical across all files
   */
  protected isPDFDetected(): boolean {
    const url = window.location.href.toLowerCase();
    return (
      url.endsWith('.pdf') || !!document.querySelector("embed[type*='pdf'], iframe[src*='.pdf']")
    );
  }

  /**
   * Create PDF result - identical across most files
   */
  protected createPDFResult(): InteractiveElement[] {
    console.warn('PDF detected - skipping element detection');
    return [
      {
        index: 0,
        type: 'pdf',
        xpath: '',
        description: 'PDF viewer detected',
        text: '',
        x: 0,
        y: 0,
        inViewport: false,
      },
    ];
  }

  /**
   * Setup debug highlight container - identical across all files
   */
  protected setupHighlightContainer(): void {
    this.highlightContainer = document.createElement('div');
    Object.assign(this.highlightContainer.style, {
      position: 'fixed',
      pointerEvents: 'none',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: '2147483647',
    });
    this.highlightContainer.id = 'web-agent-highlight-container';
    document.body.appendChild(this.highlightContainer);
  }

  /**
   * Generate XPath for element - identical across all files
   */
  protected getXPath(element: Element | null): string {
    if (!element) return '';
    if (element.id) return `//*[@id="${element.id}"]`;

    const parts: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousSibling;

      while (sibling) {
        if (
          sibling.nodeType === Node.ELEMENT_NODE &&
          (sibling as Element).tagName === current.tagName
        ) {
          index++;
        }
        sibling = sibling.previousSibling;
      }

      const tagName = current.tagName.toLowerCase();
      parts.unshift(index > 1 ? `${tagName}[${index}]` : tagName);
      current = current.parentNode as Element;
    }

    return parts.length ? `/${parts.join('/')}` : '';
  }

  /**
   * Check if element is interactive - nearly identical across all files
   */
  protected isInteractiveElement(element: Element): boolean {
    const htmlElement = element as HTMLElement;
    if (!htmlElement.offsetWidth || !htmlElement.offsetHeight) return false;

    const style = window.getComputedStyle(htmlElement);
    if (['none', 'hidden', '0'].includes(style.display) || style.visibility === 'hidden') {
      return false;
    }

    const interactiveTags = new Set([
      'a',
      'button',
      'input',
      'select',
      'textarea',
      'summary',
      'video',
    ]);

    const role = element.getAttribute('role')?.toLowerCase() || '';
    const interactiveRoles = new Set([
      'button',
      'link',
      'textbox',
      'checkbox',
      'radio',
      'menuitem',
      'switch',
    ]);

    return (
      interactiveTags.has(element.tagName.toLowerCase()) ||
      interactiveRoles.has(role) ||
      element.hasAttribute('onclick') ||
      style.cursor === 'pointer'
    );
  }

  /**
   * Check if element is in viewport - present in newer files
   */
  protected isElementInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Get text content for element - similar across files
   */
  protected getElementText(element: Element, type: string): string {
    const visibleText = element.textContent?.trim().replace(/\s+/g, ' ') || '';
    if (visibleText) return visibleText;

    if (type.endsWith('-input') || ['checkbox', 'radio', 'dropdown'].includes(type)) {
      const id = element.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return label.textContent?.trim() || '';
      }
    }

    if (element.tagName === 'IMG') {
      return element.getAttribute('alt')?.trim() || '';
    }

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
      const refElement = document.getElementById(labelledBy);
      if (refElement) return refElement.textContent?.trim() || '';
    }

    return '';
  }

  /**
   * Collect elements using TreeWalker
   */
  protected collectElements(): Element[] {
    const capturedElements: Element[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode: this.createElementFilter(),
    });

    while (walker.nextNode()) {
      const current = walker.currentNode as Element;
      if (!capturedElements.some(el => el.contains(current))) {
        capturedElements.push(current);
        this.highlightElement(current, this.elementIndex);
        this.elementIndex++;
      }
    }

    return capturedElements;
  }

  /**
   * Map elements to result format
   */
  protected mapElementsToResults(elements: Element[]): InteractiveElement[] {
    return elements.map((el, idx) => {
      const rects = Array.from(el.getClientRects());
      const type = this.getElementType(el);
      const primaryRect = rects[0] || el.getBoundingClientRect();

      return {
        index: idx,
        type: type,
        xpath: this.getXPath(el),
        description: this.getElementDescription(el, type),
        text: this.getElementText(el, type),
        x: Math.round(primaryRect.left + primaryRect.width / 2 + window.scrollX),
        y: Math.round(primaryRect.top + primaryRect.height / 2 + window.scrollY),
        inViewport: this.isElementInViewport(el),
      };
    });
  }

  /**
   * Abstract methods that must be implemented by subclasses
   */
  protected abstract getElementType(element: Element): string;
  protected abstract getElementDescription(element: Element, type: string): string;
  protected abstract highlightElement(element: Element, index: number): void;
  protected abstract createElementFilter(): ElementFilterFunction;
}
