import { Progress } from './progress';
import { OperationResult, handleOperationResult, STANDARD_TIMEOUT } from './utils';
import { SelectOption } from './types';

export function validateElementOperationResult(result: OperationResult, operation: string): void {
  handleOperationResult(result, operation);
}

export async function executeElementOperation(
  operation: (progress: Progress) => Promise<OperationResult>,
  operationName: string,
  timeout: number = STANDARD_TIMEOUT,
): Promise<void> {
  const { executeWithProgress } = await import('./progress');
  return executeWithProgress(
    async progress => {
      const result = await operation(progress);
      validateElementOperationResult(result, operationName);
    },
    { timeout },
  );
}

export function createFillElementScript() {
  return (handle: string, fillValue: string, force: boolean) => {
    const injected = window.__cordyceps_handledInjectedScript;
    const element = injected.getElementByHandle(handle);
    if (!element) {
      throw new Error('Element not found for handle');
    }

    const inputElement = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

    // Check if element is editable unless force is true
    if (!force) {
      // Check if element is visible
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        throw new Error('Element is not visible');
      }

      // Check if element is enabled
      if ('disabled' in inputElement && inputElement.disabled) {
        throw new Error('Element is disabled');
      }

      // Check if element is editable
      if ('readOnly' in inputElement && inputElement.readOnly) {
        throw new Error('Element is readonly');
      }
    }

    // Focus the element first
    inputElement.focus();

    // Clear existing value and set new value
    if ('value' in inputElement) {
      inputElement.value = fillValue;

      // Trigger input events to simulate user typing
      const inputEvent = new Event('input', { bubbles: true });
      const changeEvent = new Event('change', { bubbles: true });

      inputElement.dispatchEvent(inputEvent);
      inputElement.dispatchEvent(changeEvent);

      return 'done';
    } else {
      throw new Error('Element is not fillable');
    }
  };
}

export function createSelectOptionScript() {
  return (handle: string, selectValues: SelectOption[], force: boolean) => {
    const injected = window.__cordyceps_handledInjectedScript;
    const element = injected.getElementByHandle(handle) as HTMLSelectElement;
    if (!element) {
      return 'error:notconnected';
    }

    if (element.tagName.toLowerCase() !== 'select') {
      return { error: 'Element is not a select element' };
    }

    // Check visibility and enabled state unless force is true
    if (!force) {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.disabled) {
        return { error: 'Element is not visible or enabled' };
      }
    }

    const selectedValues: string[] = [];
    const options = Array.from(element.options);

    // Clear all selections first for single select, or only clear if not multiple
    if (!element.multiple) {
      options.forEach(option => {
        option.selected = false;
      });
    } else {
      // For multiple select, only clear if we're not adding to selection
      options.forEach(option => {
        option.selected = false;
      });
    }

    for (const selectValue of selectValues) {
      let option: HTMLOptionElement | undefined;

      if (typeof selectValue === 'string') {
        // Select by value
        option = options.find(opt => opt.value === selectValue);
      } else {
        if (selectValue.value !== undefined) {
          // Select by value
          option = options.find(opt => opt.value === selectValue.value);
        } else if (selectValue.label !== undefined) {
          // Select by label text
          option = options.find(opt => opt.textContent?.trim() === selectValue.label);
        } else if (selectValue.index !== undefined) {
          // Select by index
          option = options[selectValue.index];
        }
      }

      if (option) {
        option.selected = true;
        selectedValues.push(option.value);
      } else if (!force) {
        return { error: `Option not found: ${JSON.stringify(selectValue)}` };
      }
    }

    // Trigger change and input events
    element.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
    element.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));

    return selectedValues;
  };
}

export function createSelectTextScript() {
  return (handle: string, force: boolean) => {
    const injected = window.__cordyceps_handledInjectedScript;
    const element = injected.getElementByHandle(handle);
    if (!element) {
      return 'error:notconnected';
    }

    // Check if element is visible unless force is true
    if (!force) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        throw new Error('Element is not visible');
      }
    }

    // Select text based on element type
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      // For input and textarea elements, select all text
      element.select();
    } else {
      // For other elements, create a text range selection
      const range = document.createRange();
      range.selectNodeContents(element);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    return 'done';
  };
}

export function createKeyboardEventScript() {
  return (handle: string, eventType: string, keyValue: string, printable: boolean): void => {
    const injected = (
      window as unknown as {
        __cordyceps_handledInjectedScript?: {
          getElementByHandle: (h: string) => Element | null;
        };
      }
    ).__cordyceps_handledInjectedScript;
    if (!injected) throw new Error('Injected script not found');
    const el = injected.getElementByHandle(handle) as HTMLElement | null;
    if (!el) throw new Error('Element not found');
    const eventInit: KeyboardEventInit = {
      key: keyValue,
      bubbles: true,
      cancelable: true,
    };
    const ev = new KeyboardEvent(eventType, eventInit);
    el.dispatchEvent(ev);
    if (printable && eventType === 'keypress') {
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.value += keyValue;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };
}

export function isPrintableKey(key: string): boolean {
  return key.length === 1;
}

export function createDelay(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function validateSelectOption(option: SelectOption): boolean {
  if (typeof option === 'string') {
    return true;
  }

  if (typeof option === 'object' && option !== null) {
    const hasValue = option.value !== undefined;
    const hasLabel = option.label !== undefined;
    const hasIndex = option.index !== undefined;

    // Must have exactly one of: value, label, or index
    return (hasValue ? 1 : 0) + (hasLabel ? 1 : 0) + (hasIndex ? 1 : 0) === 1;
  }

  return false;
}

export function normalizeSelectOptions(values: SelectOption | SelectOption[]): SelectOption[] {
  return Array.isArray(values) ? values : [values];
}

export function createElementOperationError(operation: string, details?: string): string {
  return `${operation} failed${details ? `: ${details}` : ''}`;
}

export function isSuccessfulOperation(result: unknown): result is 'done' {
  return result === 'done';
}

export function isElementDisconnected(result: unknown): result is 'error:notconnected' {
  return result === 'error:notconnected';
}

export function extractErrorMessage(result: unknown): string | null {
  if (
    result &&
    typeof result === 'object' &&
    !Array.isArray(result) &&
    Object.prototype.hasOwnProperty.call(result as Record<string, unknown>, 'error')
  ) {
    return (result as { error: string }).error;
  }
  return null;
}

export function createScrollIntoViewScript() {
  return (handle: string) => {
    const injectedScript = window.__cordyceps_handledInjectedScript;
    const element = injectedScript.getElementByHandle(handle);
    if (!element) {
      return { success: false, error: 'Element not found' };
    }

    // Check if element is already in view
    const rect = element.getBoundingClientRect();
    const isInView =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth;

    if (!isInView) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }

    return { success: true };
  };
}
