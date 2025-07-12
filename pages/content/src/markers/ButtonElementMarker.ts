import { BaseElementMarker } from './BaseElementMarker';
import { ElementFilterFunction } from './types';

/**
 * Button-specific element marker - captures only button and icon-button elements
 * Implements logic from marking_buttons.js and marking_buttons_2.js
 */
export class ButtonElementMarker extends BaseElementMarker {
  protected getElementType(element: Element): string {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute('role')?.toLowerCase() || '';
    const hasClickHandler = !!(element as HTMLElement).onclick || element.getAttribute('onclick');
    const isIconContainer = !!element.querySelector('svg, img, i');
    const classList = Array.from(element.classList);
    const parentRole = element.parentElement?.getAttribute('role')?.toLowerCase() || '';

    // Enhanced Input Handling
    if (tag === 'input') {
      const inputElement = element as HTMLInputElement;
      const inputType = inputElement.type.toLowerCase();

      // Special handling for search inputs
      if (
        inputType === 'search' ||
        element.getAttribute('aria-label')?.toLowerCase().includes('search') ||
        element.getAttribute('name')?.toLowerCase().includes('search') ||
        element.getAttribute('id')?.toLowerCase().includes('search')
      ) {
        return 'search-input';
      }

      // For input buttons, check if the button's value is purely numeric (for marking_buttons_2.js)
      switch (inputType) {
        case 'button':
        case 'submit':
        case 'reset': {
          const val = (inputElement.value || '').trim();
          if (val && /^\d+$/.test(val)) {
            return 'date-button';
          }
          return 'button';
        }
        case 'checkbox':
          return 'checkbox';
        case 'radio':
          return 'radio';
        default:
          return 'text-input';
      }
    }

    // Enhanced Menu/Item Handling
    if (tag === 'div') {
      // Document-specific items (Google Docs/Microsoft 365)
      if (classList.some(c => c.includes('docs-') || c.includes('owa-'))) {
        if (classList.some(c => c.match(/menu(-item)?/i))) return 'doc-menu-item';
        if (classList.some(c => c.match(/toolbar(-button)?/i))) return 'doc-toolbar-button';
      }

      // Standard menu system
      if (
        role === 'menuitem' ||
        parentRole === 'menu' ||
        classList.some(c => c.includes('menu-item'))
      ) {
        return 'menu-item';
      }

      // Generic interactive divs
      if (hasClickHandler) return isIconContainer ? 'icon-button' : 'clickable-div';
      if (isIconContainer) return 'icon-container';
    }

    // Special Elements
    if ((tag === 'a' || role === 'link') && isIconContainer) {
      return (element as HTMLAnchorElement).href ? 'icon-link' : 'icon-button';
    }

    if (tag === 'button' || role === 'button') {
      // For native <button> elements, check their text content for date buttons
      const btnText = element.textContent?.trim() || '';
      if (btnText && /^\d+$/.test(btnText)) {
        return 'date-button';
      }
      return isIconContainer ? 'icon-button' : 'button';
    }

    return tag || role;
  }

  protected getElementDescription(element: Element, type: string): string {
    const ariaLabel = element.getAttribute('aria-label')?.trim();
    const title = element.getAttribute('title')?.trim();
    const baseText = ariaLabel || title || this.getElementText(element, type);

    const states: string[] = [];
    if ((element as HTMLInputElement).disabled) states.push('disabled');
    if ((element as HTMLInputElement).checked) states.push('checked');
    const statePrefix = states.length ? `[${states.join(',')}] ` : '';

    switch (type) {
      case 'menu-container': {
        return `${statePrefix}Menu: ${baseText || 'Context options'}`;
      }
      case 'menu-item': {
        const menuParent = element.closest('[role="menu"], [role="menubar"]');
        const menuLabel = menuParent?.getAttribute('aria-label') || '';
        return `${statePrefix}Menu option${menuLabel ? ` in ${menuLabel}` : ''}: ${baseText}`;
      }
      case 'doc-menu-item': {
        const menuPath = Array.from(
          element.closest('[role="menu"]')?.querySelectorAll('[role="menuitem"]') || [],
        )
          .map(item => item.textContent?.trim())
          .join(' ▸ ');
        return `${statePrefix}Document menu: ${menuPath}`;
      }
      case 'doc-toolbar-button': {
        const toolbar = element.closest('[role="toolbar"]');
        const toolbarLabel = toolbar?.getAttribute('aria-label') || 'Document tools';
        return `${statePrefix}${toolbarLabel}: ${baseText}`;
      }
      case 'toolbar-button': {
        const toolbarParent = element.closest('[role="toolbar"]');
        const toolbarParentLabel = toolbarParent?.getAttribute('aria-label') || '';
        return `${statePrefix}Toolbar button${toolbarParentLabel ? ` in ${toolbarParentLabel}` : ''}: ${baseText}`;
      }
      case 'expandable-section': {
        const expandedState =
          element.getAttribute('aria-expanded') === 'true' ? 'expanded' : 'collapsed';
        return `${statePrefix}Expandable section (${expandedState}): ${baseText}`;
      }
      default: {
        return `${statePrefix}${type.replace(/-/g, ' ')}${baseText ? `: ${baseText}` : ''}`;
      }
    }
  }

  protected highlightElement(element: Element, index: number): void {
    if (!this.DEBUG_HIGHLIGHT || !this.highlightContainer) return;

    const type = this.getElementType(element);
    const description = this.getElementDescription(element, type);

    const topLabelText = `${index}`;
    const bottomLabelText = description; // Always show the descriptive text for button-type elements

    Array.from(element.getClientRects()).forEach(rect => {
      const overlay = document.createElement('div');
      const color = this.highlightColors[index % this.highlightColors.length];

      Object.assign(overlay.style, {
        position: 'absolute',
        border: `1px dashed ${color}`,
        backgroundColor: `${color}10`,
        top: `${rect.top + window.scrollY + 2}px`,
        left: `${rect.left + window.scrollX + 2}px`,
        width: `${rect.width - 4}px`,
        height: `${rect.height - 4}px`,
        pointerEvents: 'none',
      });

      // Top label: shows only the index above the box
      const topLabel = document.createElement('div');
      topLabel.textContent = topLabelText;
      Object.assign(topLabel.style, {
        position: 'absolute',
        top: '-16px',
        left: '0',
        background: color + '80',
        color: 'white',
        padding: '1px 3px',
        borderRadius: '2px',
        fontSize: '10px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        lineHeight: '1',
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
      });
      overlay.appendChild(topLabel);

      // Bottom label: shows the associated descriptive text below the box
      if (bottomLabelText) {
        const bottomLabel = document.createElement('div');
        bottomLabel.textContent = bottomLabelText;
        Object.assign(bottomLabel.style, {
          position: 'absolute',
          bottom: '-16px',
          left: '0',
          background: color + '80',
          color: 'white',
          padding: '1px 3px',
          borderRadius: '2px',
          fontSize: '10px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          lineHeight: '1',
          textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        });
        overlay.appendChild(bottomLabel);
      }

      this.highlightContainer!.appendChild(overlay);
    });
  }

  protected createElementFilter(): ElementFilterFunction {
    return (node: Element) => {
      if (!this.isInteractiveElement(node)) return NodeFilter.FILTER_SKIP;
      const type = this.getElementType(node);
      // Only accept if the type is exactly 'button' or 'icon-button' (but not "date-button")
      return type === 'button' || type === 'icon-button'
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    };
  }
}
