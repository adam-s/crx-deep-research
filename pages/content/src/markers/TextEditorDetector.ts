import { TextEditorDetection } from './types';

/**
 * Text Editor Detection - separate implementation for text_editor.js functionality
 * This is a standalone class as it has completely different logic from the others
 */
export class TextEditorDetector {
  
  /**
   * Get XPath for a given element - identical to other implementations
   */
  private getXPath(element: Element | null): string | null {
    if (!element) return null;
    if (element.id) return `//*[@id="${element.id}"]`;
    
    const path: string[] = [];
    let current: Element | null = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousSibling;
      
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && (sibling as Element).tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      
      const tagName = current.tagName.toLowerCase();
      path.unshift(index > 1 ? `${tagName}[${index}]` : tagName);
      current = current.parentNode as Element;
    }
    
    return path.length ? `/${path.join('/')}` : null;
  }

  /**
   * Find the active or first editable element
   */
  private getEditorElement(): Element | null {
    // Check if the user is actively focused inside an editor
    if (document.activeElement && (document.activeElement as HTMLElement).isContentEditable) {
      return document.activeElement;
    }
    
    // Otherwise, find the first editable element
    return document.querySelector('[contenteditable="true"]') || document.querySelector('textarea');
  }

  /**
   * Detect text editor and return detection result
   */
  public detectTextEditor(): TextEditorDetection {
    const editor = this.getEditorElement();
    
    if (editor) {
      const rect = editor.getBoundingClientRect();
      return {
        detected: true,
        XPath: this.getXPath(editor) || undefined,
        X: Math.round(rect.left + window.scrollX + rect.width / 2),
        Y: Math.round(rect.top + window.scrollY + rect.height / 2)
      };
    }
    
    return { detected: false };
  }
}
