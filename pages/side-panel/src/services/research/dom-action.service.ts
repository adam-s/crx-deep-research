import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { Disposable } from 'vs/base/common/lifecycle';
import type { InteractiveElement } from '@shared/markers/types';

export const IDOMActionService = createDecorator<IDOMActionService>('domActionService');

export interface DOMActionResult {
  success: boolean;
  error?: string;
  newUrl?: string;
  contentChanged?: boolean;
}

export interface IDOMActionService {
  readonly _serviceBrand: undefined;
  
  clickElement(element: InteractiveElement): Promise<DOMActionResult>;
  typeInElement(element: InteractiveElement, text: string): Promise<DOMActionResult>;
  navigateToUrl(url: string): Promise<DOMActionResult>;
  scrollToElement(element: InteractiveElement): Promise<DOMActionResult>;
  waitForNavigation(timeout?: number): Promise<DOMActionResult>;
}

export class DOMActionService extends Disposable implements IDOMActionService {
  readonly _serviceBrand: undefined;

  constructor() {
    super();
  }

  async clickElement(element: InteractiveElement): Promise<DOMActionResult> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      return { success: false, error: 'No active tab found' };
    }

    const originalUrl = tab.url;

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (elementData: InteractiveElement) => {
          // Find the element by its marker index or selector
          let targetElement: HTMLElement | null = null;
          
          if (elementData.index !== undefined) {
            const markedElement = document.querySelector(`[data-marker-index="${elementData.index}"]`);
            if (markedElement) {
              targetElement = markedElement as HTMLElement;
            }
          }
          
          // Fallback: try to find by selector if available
          if (!targetElement && elementData.selector) {
            targetElement = document.querySelector(elementData.selector) as HTMLElement;
          }
          
          if (!targetElement) {
            throw new Error('Element not found for clicking');
          }
          
          // Scroll element into view
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Click the element
          targetElement.click();
          
          return { success: true };
        },
        args: [element]
      });

      // Wait a bit for potential navigation
      await this.sleep(1000);
      
      // Check if URL changed
      const [updatedTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const newUrl = updatedTab.url;
      const contentChanged = newUrl !== originalUrl;

      return {
        success: true,
        newUrl: contentChanged ? newUrl : undefined,
        contentChanged
      };
    } catch (error) {
      console.error('Click action failed:', error);
      return {
        success: false,
        error: `Click failed: ${error}`
      };
    }
  }

  async typeInElement(element: InteractiveElement, text: string): Promise<DOMActionResult> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      return { success: false, error: 'No active tab found' };
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (elementData: InteractiveElement, textToType: string) => {
          // Find the element
          let targetElement: HTMLInputElement | HTMLTextAreaElement | null = null;
          
          if (elementData.index !== undefined) {
            const markedElement = document.querySelector(`[data-marker-index="${elementData.index}"]`);
            if (markedElement) {
              targetElement = markedElement as HTMLInputElement | HTMLTextAreaElement;
            }
          }
          
          if (!targetElement && elementData.selector) {
            targetElement = document.querySelector(elementData.selector) as HTMLInputElement | HTMLTextAreaElement;
          }
          
          if (!targetElement) {
            throw new Error('Input element not found for typing');
          }
          
          // Focus and clear the element
          targetElement.focus();
          targetElement.select();
          
          // Set the value
          targetElement.value = textToType;
          
          // Trigger events to simulate real typing
          targetElement.dispatchEvent(new Event('input', { bubbles: true }));
          targetElement.dispatchEvent(new Event('change', { bubbles: true }));
          
          return { success: true };
        },
        args: [element, text]
      });

      return { success: true };
    } catch (error) {
      console.error('Type action failed:', error);
      return {
        success: false,
        error: `Type failed: ${error}`
      };
    }
  }

  async navigateToUrl(url: string): Promise<DOMActionResult> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.id) {
        return { success: false, error: 'No active tab found' };
      }

      await chrome.tabs.update(tab.id, { url });
      
      // Wait for navigation to complete
      await this.waitForNavigation(10000);
      
      return {
        success: true,
        newUrl: url,
        contentChanged: true
      };
    } catch (error) {
      console.error('Navigation failed:', error);
      return {
        success: false,
        error: `Navigation failed: ${error}`
      };
    }
  }

  async scrollToElement(element: InteractiveElement): Promise<DOMActionResult> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      return { success: false, error: 'No active tab found' };
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (elementData: InteractiveElement) => {
          let targetElement: HTMLElement | null = null;
          
          if (elementData.index !== undefined) {
            const markedElement = document.querySelector(`[data-marker-index="${elementData.index}"]`);
            if (markedElement) {
              targetElement = markedElement as HTMLElement;
            }
          }
          
          if (!targetElement && elementData.selector) {
            targetElement = document.querySelector(elementData.selector) as HTMLElement;
          }
          
          if (!targetElement) {
            throw new Error('Element not found for scrolling');
          }
          
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          return { success: true };
        },
        args: [element]
      });

      return { success: true };
    } catch (error) {
      console.error('Scroll action failed:', error);
      return {
        success: false,
        error: `Scroll failed: ${error}`
      };
    }
  }

  async waitForNavigation(timeout: number = 5000): Promise<DOMActionResult> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve({ success: false, error: 'Navigation timeout' });
      }, timeout);

      const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
        if (changeInfo.status === 'complete') {
          clearTimeout(timeoutId);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve({ success: true, contentChanged: true });
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

registerSingleton(IDOMActionService, DOMActionService, InstantiationType.Delayed);
