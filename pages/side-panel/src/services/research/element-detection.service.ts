import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { Disposable } from 'vs/base/common/lifecycle';
import type { InteractiveElement } from '@shared/markers/types';

export const IElementDetectionService = createDecorator<IElementDetectionService>('elementDetectionService');

export interface IElementDetectionService {
  readonly _serviceBrand: undefined;
  
  detectElements(type: 'final' | 'button' | 'input' | 'link' | 'general'): Promise<InteractiveElement[]>;
  highlightElement(index: number): Promise<void>;
  clearHighlights(): Promise<void>;
  getCurrentUrl(): Promise<string>;
  getPageTitle(): Promise<string>;
  getPageContent(): Promise<string>;
}

export class ElementDetectionService extends Disposable implements IElementDetectionService {
  readonly _serviceBrand: undefined;

  constructor() {
    super();
  }

  async detectElements(type: 'final' | 'button' | 'input' | 'link' | 'general'): Promise<InteractiveElement[]> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error('No active tab found');
    }

    try {
      // Execute the appropriate marker function in the content script
      const functionName = this.getMarkerFunctionName(type);
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.createExecutorFunction(functionName),
      });

      if (!results || !results[0]) {
        throw new Error('Failed to execute script in tab');
      }

      return results[0].result || [];
    } catch (error) {
      console.error('Element detection failed:', error);
      throw new Error(`Element detection failed: ${error}`);
    }
  }

  async highlightElement(index: number): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error('No active tab found');
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (elementIndex: number) => {
        // Simple highlight function
        const elements = document.querySelectorAll('[data-marker-index]');
        const element = Array.from(elements).find(el => 
          el.getAttribute('data-marker-index') === elementIndex.toString()
        ) as HTMLElement;
        
        if (element) {
          element.style.outline = '3px solid red';
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      args: [index]
    });
  }

  async clearHighlights(): Promise<void> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error('No active tab found');
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Clear all highlights
        const elements = document.querySelectorAll('[data-marker-index]');
        elements.forEach((element: Element) => {
          (element as HTMLElement).style.outline = '';
        });
      }
    });
  }

  async getCurrentUrl(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.url || '';
  }

  async getPageTitle(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab.title || '';
  }

  async getPageContent(): Promise<string> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.id) {
      throw new Error('No active tab found');
    }

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // Extract text content from the page
          const textContent = document.body.innerText || '';
          // Limit content size
          return textContent.slice(0, 10000);
        }
      });

      return results[0]?.result || '';
    } catch (error) {
      console.error('Failed to get page content:', error);
      return '';
    }
  }

  private getMarkerFunctionName(type: string): string {
    switch (type) {
      case 'final':
        return 'executeFinalMarking';
      case 'button':
        return 'executeButtonMarking';
      case 'input':
        return 'executeInputMarking';
      case 'link':
        return 'executeLinkMarking';
      case 'general':
        return 'executeGeneralMarking';
      default:
        return 'executeFinalMarking';
    }
  }

  private createExecutorFunction(functionName: string) {
    return () => {
      // Access the globally exposed marker functions
      const fn = (window as any)[functionName];
      if (typeof fn === 'function') {
        return fn();
      } else {
        console.error(`Function ${functionName} not found on window`);
        return [];
      }
    };
  }
}

registerSingleton(IElementDetectionService, ElementDetectionService, InstantiationType.Delayed);
