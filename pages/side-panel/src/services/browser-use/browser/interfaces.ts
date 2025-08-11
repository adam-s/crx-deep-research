/**
 * Extended browser context interfaces for TypeScript implementation
 */
import { BrowserContext, BrowserSession } from './context';
import { SelectorMap, DOMElementNode } from '../dom/views';

/**
 * Extended interface for BrowserContext with additional methods
 * needed for controller actions
 */
export interface ExtendedBrowserContext extends BrowserContext {
  // Navigation methods
  goBack(): Promise<void>;

  // Session methods - keep original signature from BrowserContext
  getSession(): Promise<BrowserSession>;

  // DOM interaction methods - use proper types from DOM views
  getSelectorMap(): Promise<SelectorMap>;
  getDomElementByIndex(index: number | string): Promise<DOMElementNode | null>;
  getElementByIndex(index: number | string): Promise<DOMElementNode | null>;
  getLocateElement(element: DOMElementNode | string): Promise<DOMElementNode | null>;
  isFileUploader(element: DOMElementNode): Promise<boolean>;
  _clickElementNode(element: DOMElementNode): Promise<string | null>;
  _inputTextElementNode(element: DOMElementNode, text: string): Promise<void>;

  // Tab management methods
  switchToTab(pageId: number): Promise<void>;
  createNewTab(url?: string): Promise<void>;
}
