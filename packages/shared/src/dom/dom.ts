/**
 * DOM Utility Library for Chrome Extension Content Scripts
 * Provides Playwright-like functionality using native browser APIs
 */

export interface ClickOptions {
  button?: 'left' | 'right' | 'middle';
  clickCount?: number;
  delay?: number;
  force?: boolean;
  modifiers?: Array<'Alt' | 'Control' | 'Meta' | 'Shift'>;
  position?: { x: number; y: number };
  timeout?: number;
}

export interface TypeOptions {
  delay?: number;
  timeout?: number;
}

export interface WaitForOptions {
  timeout?: number;
  visible?: boolean;
  hidden?: boolean;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

export interface ScreenshotOptions {
  quality?: number;
  type?: 'png' | 'jpeg';
  fullPage?: boolean;
}

export class DOMLocator {
  constructor(private selector: string) {}

  async click(options: ClickOptions = {}): Promise<void> {
    const element = await this.waitFor({ visible: true, timeout: options.timeout });
    if (!element) throw new Error(`Element not found: ${this.selector}`);

    const rect = element.getBoundingClientRect();
    const x = options.position?.x ?? rect.left + rect.width / 2;
    const y = options.position?.y ?? rect.top + rect.height / 2;

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 100));

    const clickCount = options.clickCount ?? 1;
    const button = options.button ?? 'left';
    
    for (let i = 0; i < clickCount; i++) {
      if (options.delay && i > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }

      const mouseEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
        button: button === 'left' ? 0 : button === 'right' ? 2 : 1,
        clientX: x,
        clientY: y,
        ctrlKey: options.modifiers?.includes('Control') ?? false,
        altKey: options.modifiers?.includes('Alt') ?? false,
        shiftKey: options.modifiers?.includes('Shift') ?? false,
        metaKey: options.modifiers?.includes('Meta') ?? false,
      });

      element.dispatchEvent(mouseEvent);
    }
  }

  async type(text: string, options: TypeOptions = {}): Promise<void> {
    const element = await this.waitFor({ visible: true, timeout: options.timeout });
    if (!element) throw new Error(`Element not found: ${this.selector}`);

    (element as HTMLElement).focus();
    
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.value = '';
      for (const char of text) {
        if (options.delay) {
          await new Promise(resolve => setTimeout(resolve, options.delay));
        }
        element.value += char;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      element.textContent = text;
    }
  }

  async fill(text: string, options: TypeOptions = {}): Promise<void> {
    const element = await this.waitFor({ visible: true, timeout: options.timeout });
    if (!element) throw new Error(`Element not found: ${this.selector}`);

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      (element as HTMLElement).focus();
      element.select();
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      element.textContent = text;
    }
  }

  async press(key: string, options: { delay?: number } = {}): Promise<void> {
    const element = await this.waitFor({ visible: true });
    if (!element) throw new Error(`Element not found: ${this.selector}`);

    (element as HTMLElement).focus();
    
    const keyboardEvent = new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    });
    
    element.dispatchEvent(keyboardEvent);
    
    if (options.delay) {
      await new Promise(resolve => setTimeout(resolve, options.delay));
    }
    
    const keyupEvent = new KeyboardEvent('keyup', {
      key,
      bubbles: true,
      cancelable: true,
    });
    
    element.dispatchEvent(keyupEvent);
  }

  async getText(): Promise<string> {
    const element = await this.waitFor();
    if (!element) return '';
    
    return element.textContent?.trim() ?? '';
  }

  async getAttribute(name: string): Promise<string | null> {
    const element = await this.waitFor();
    if (!element) return null;
    
    return element.getAttribute(name);
  }

  async isVisible(): Promise<boolean> {
    const element = this.querySelector();
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           window.getComputedStyle(element).visibility !== 'hidden';
  }

  async isHidden(): Promise<boolean> {
    return !(await this.isVisible());
  }

  async waitFor(options: WaitForOptions = {}): Promise<Element | null> {
    const timeout = options.timeout ?? 30000;
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const check = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for element: ${this.selector}`));
          return;
        }

        const element = this.querySelector();
        
        if (options.state === 'detached' && !element) {
          resolve(null);
          return;
        }
        
        if (!element) {
          setTimeout(check, 100);
          return;
        }

        if (options.visible !== undefined || options.state === 'visible') {
          const isVisible = this.isElementVisible(element);
          if (options.visible === true || options.state === 'visible') {
            if (isVisible) {
              resolve(element);
            } else {
              setTimeout(check, 100);
            }
          } else if (options.visible === false) {
            if (!isVisible) {
              resolve(element);
            } else {
              setTimeout(check, 100);
            }
          }
        } else if (options.hidden === true || options.state === 'hidden') {
          if (!this.isElementVisible(element)) {
            resolve(element);
          } else {
            setTimeout(check, 100);
          }
        } else {
          resolve(element);
        }
      };
      
      check();
    });
  }

  private querySelector(): Element | null {
    return document.querySelector(this.selector);
  }

  private isElementVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           window.getComputedStyle(element).visibility !== 'hidden';
  }
}

export class DOMPage {
  async goto(url: string): Promise<void> {
    window.location.href = url;
  }

  async goBack(): Promise<void> {
    window.history.back();
  }

  async goForward(): Promise<void> {
    window.history.forward();
  }

  async reload(): Promise<void> {
    window.location.reload();
  }

  async title(): Promise<string> {
    return document.title;
  }

  async url(): Promise<string> {
    return window.location.href;
  }

  async waitForNavigation(options: { timeout?: number } = {}): Promise<void> {
    const timeout = options.timeout ?? 30000;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Navigation timeout'));
      }, timeout);

      const observer = new MutationObserver(() => {
        if (document.readyState === 'complete') {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve();
        }
      });

      observer.observe(document, {
        childList: true,
        subtree: true,
      });

      window.addEventListener('load', () => {
        clearTimeout(timeoutId);
        observer.disconnect();
        resolve();
      }, { once: true });
    });
  }

  async waitForSelector(selector: string, options: WaitForOptions = {}): Promise<Element | null> {
    return new DOMLocator(selector).waitFor(options);
  }

  async waitForFunction(fn: () => boolean, options: { timeout?: number } = {}): Promise<void> {
    const timeout = options.timeout ?? 30000;
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const check = () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error('Function timeout'));
          return;
        }

        try {
          if (fn()) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        } catch (error) {
          setTimeout(check, 100);
        }
      };
      
      check();
    });
  }

  async $(selector: string): Promise<DOMLocator> {
    return new DOMLocator(selector);
  }

  async $$(selector: string): Promise<Element[]> {
    return Array.from(document.querySelectorAll(selector));
  }

  async evaluate<T>(fn: () => T): Promise<T> {
    return fn();
  }

  async screenshot(options: ScreenshotOptions = {}): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      const rect = options.fullPage 
        ? { width: document.body.scrollWidth, height: document.body.scrollHeight }
        : { width: window.innerWidth, height: window.innerHeight };

      canvas.width = rect.width;
      canvas.height = rect.height;

      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      return canvas.toDataURL(options.type === 'jpeg' ? 'image/jpeg' : 'image/png', options.quality);
    } catch (error) {
      throw new Error(`Screenshot failed: ${error}`);
    }
  }

  async clickAt(x: number, y: number, options: ClickOptions = {}): Promise<void> {
    const element = document.elementFromPoint(x, y);
    if (!element) throw new Error(`No element found at coordinates (${x}, ${y})`);

    const mouseEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: options.button === 'left' ? 0 : options.button === 'right' ? 2 : 1,
      clientX: x,
      clientY: y,
      ctrlKey: options.modifiers?.includes('Control') ?? false,
      altKey: options.modifiers?.includes('Alt') ?? false,
      shiftKey: options.modifiers?.includes('Shift') ?? false,
      metaKey: options.modifiers?.includes('Meta') ?? false,
    });

    element.dispatchEvent(mouseEvent);
  }

  async moveMouse(x: number, y: number): Promise<void> {
    const element = document.elementFromPoint(x, y);
    if (!element) return;

    const mouseEvent = new MouseEvent('mousemove', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
    });

    element.dispatchEvent(mouseEvent);
  }

  async drag(from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
    const fromElement = document.elementFromPoint(from.x, from.y);
    const toElement = document.elementFromPoint(to.x, to.y);
    
    if (!fromElement || !toElement) {
      throw new Error('Could not find elements for drag operation');
    }

    const dataTransfer = new DataTransfer();
    
    const dragStartEvent = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: from.x,
      clientY: from.y,
      dataTransfer,
    });

    const dragEndEvent = new DragEvent('dragend', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: to.x,
      clientY: to.y,
      dataTransfer,
    });

    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: to.x,
      clientY: to.y,
      dataTransfer,
    });

    fromElement.dispatchEvent(dragStartEvent);
    toElement.dispatchEvent(dropEvent);
    fromElement.dispatchEvent(dragEndEvent);
  }
}

export class DOMUtils {
  static async scrollTo(x: number, y: number): Promise<void> {
    window.scrollTo({ top: y, left: x, behavior: 'smooth' });
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  static async scrollIntoView(selector: string): Promise<void> {
    const element = document.querySelector(selector);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  static getViewportSize(): { width: number; height: number } {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  static getDocumentSize(): { width: number; height: number } {
    return {
      width: document.body.scrollWidth,
      height: document.body.scrollHeight,
    };
  }

  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static generateSelector(element: Element): string {
    if (element.id) {
      return `#${element.id}`;
    }

    if (element.className) {
      const classes = element.className.split(' ').filter(Boolean);
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }

    let path = '';
    let current = element;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      
      if (current.id) {
        selector = `#${current.id}`;
        path = selector + (path ? ' > ' + path : '');
        break;
      }
      
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(
          sibling => sibling.nodeName === current.nodeName
        );
        
        if (siblings.length > 1) {
          const index = siblings.indexOf(current) + 1;
          selector += `:nth-of-type(${index})`;
        }
      }
      
      path = selector + (path ? ' > ' + path : '');
      current = parent!;
    }
    
    return path;
  }

  static isElementInViewport(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }

  static getElementText(element: Element): string {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null
    );

    let text = '';
    let node;
    
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (parent && window.getComputedStyle(parent).display !== 'none') {
        text += node.textContent;
      }
    }
    
    return text.trim();
  }
}

export const page = new DOMPage();

export function locator(selector: string): DOMLocator {
  return new DOMLocator(selector);
}

export default {
  DOMLocator,
  DOMPage,
  DOMUtils,
  page,
  locator,
};