/**
 * Simplified type-safe element operations for Chrome extension
 * Clean, elegant API that replaces unsafe evaluate() calls
 */

// Simple operation types
export type ElementOp =
  | 'textContent'
  | 'innerText'
  | 'innerHTML'
  | 'outerHTML'
  | 'value'
  | 'checked'
  | 'disabled'
  | 'tagName'
  | 'className'
  | 'id'
  | 'isVisible'
  | 'isEnabled'
  | 'isFocused'
  | 'focus'
  | 'blur'
  | 'click';

export type ElementAction =
  | { op: 'get'; prop: ElementOp }
  | {
      op: 'set';
      prop: 'value' | 'textContent' | 'innerHTML' | 'checked' | 'disabled';
      value: unknown;
    }
  | { op: 'attr'; name: string; value?: string | null } // get/set/remove attr (null = remove)
  | { op: 'class'; name: string; action: 'add' | 'remove' | 'toggle' | 'has' }
  | { op: 'rect' }
  | { op: 'action'; name: 'focus' | 'blur' | 'click' };

/**
 * Execute element operation - clean, simple function
 */
/**
 * Execute an element operation on a DOM element.
 * This function is injected into the page context and must be self-contained.
 * No imports allowed since it runs in the browser context.
 * All helper functions must be defined inside this function due to Chrome's executeScript serialization.
 */
export function executeElementOp(
  handle: string,
  action: {
    op: 'get' | 'set' | 'attr' | 'class' | 'rect' | 'action';
    [key: string]: unknown;
  },
): unknown {
  // Helper functions must be inside the main function due to executeScript serialization
  function getProperty(element: Element, prop: string): unknown {
    switch (prop) {
      case 'textContent':
        return element.textContent || '';
      case 'innerText':
        return (element as HTMLElement).innerText || '';
      case 'innerHTML':
        return element.innerHTML || '';
      case 'outerHTML':
        return element.outerHTML || '';
      case 'value':
        return (element as HTMLInputElement).value || '';
      case 'checked':
        return (element as HTMLInputElement).checked || false;
      case 'disabled':
        return (element as HTMLInputElement).disabled || false;
      case 'tagName':
        return element.tagName || '';
      case 'className':
        return element.className || '';
      case 'id':
        return element.id || '';
      case 'isVisible':
        return isVisible(element);
      case 'isEnabled':
        return !('disabled' in element) || !(element as HTMLInputElement).disabled;
      case 'isFocused':
        return document.activeElement === element;
      default:
        return null;
    }
  }

  function setProperty(element: Element, prop: string, value: unknown): void {
    switch (prop) {
      case 'textContent':
        element.textContent = String(value);
        break;
      case 'innerHTML':
        element.innerHTML = String(value);
        break;
      case 'value':
        (element as HTMLInputElement).value = String(value);
        break;
      case 'checked':
        (element as HTMLInputElement).checked = Boolean(value);
        break;
      case 'disabled':
        (element as HTMLInputElement).disabled = Boolean(value);
        break;
    }
  }

  function isVisible(element: Element): boolean {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      parseFloat(style.opacity) > 0
    );
  }

  // Main execution logic
  const injected = (
    window as {
      __cordyceps_handledInjectedScript?: {
        getElementByHandle: (handle: string) => Element | null;
      };
    }
  ).__cordyceps_handledInjectedScript;
  if (!injected) throw new Error('Cordyceps injected script not found');
  const element = injected.getElementByHandle(handle);
  if (!element) throw new Error('Element not found');

  switch (action.op) {
    case 'get':
      return getProperty(element, action.prop as string);

    case 'set':
      setProperty(element, action.prop as string, action.value);
      return;

    case 'attr':
      if (action.value === undefined) {
        return element.getAttribute(action.name as string);
      }
      if (action.value === null) {
        element.removeAttribute(action.name as string);
        return;
      }
      element.setAttribute(action.name as string, String(action.value));
      return;

    case 'class':
      switch (action.action) {
        case 'contains':
          return element.classList.contains(action.name as string);
        case 'add':
          element.classList.add(action.name as string);
          return;
        case 'remove':
          element.classList.remove(action.name as string);
          return;
        case 'toggle':
          element.classList.toggle(action.name as string);
          return;
        default:
          throw new Error(`Unknown class action: ${action.action}`);
      }

    case 'rect':
      return element.getBoundingClientRect();

    case 'action':
      switch (action.name) {
        case 'focus':
          (element as HTMLElement).focus();
          return;
        case 'blur':
          (element as HTMLElement).blur();
          return;
        case 'click':
          (element as HTMLElement).click();
          return;
        default:
          throw new Error(`Unknown action: ${action.name}`);
      }

    default:
      throw new Error(`Unknown operation: ${action.op}`);
  }
}
