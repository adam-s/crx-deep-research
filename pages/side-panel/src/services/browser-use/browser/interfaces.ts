/**
 * Extended browser context interfaces for TypeScript implementation
 */
import { BrowserContext } from './context';

/**
 * Extended interface for BrowserContext with additional methods
 * needed for controller actions
 */
export interface ExtendedBrowserContext extends BrowserContext {
  // Navigation methods
  goBack(): Promise<void>;

  // Session methods
  getSession(): Promise<any>;

  // DOM interaction methods
  getSelectorMap(): Promise<any>;
  getDomElementByIndex(index: number | string): Promise<any>;
  getElementByIndex(index: number | string): Promise<any>;
  getLocateElement(element: any): Promise<any>;
  isFileUploader(element: any): Promise<boolean>;
  _clickElementNode(element: any): Promise<string | null>;
  _inputTextElementNode(element: any, text: string): Promise<void>;

  // Tab management methods
  switchToTab(pageId: number): Promise<void>;
  createNewTab(url?: string): Promise<void>;
}
