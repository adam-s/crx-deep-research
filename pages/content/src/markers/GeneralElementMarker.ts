import { BaseElementMarker } from './BaseElementMarker';
import { ElementFilterFunction } from './types';

/**
 * General marking implementation - captures all interactive elements with selective highlighting
 * Implements logic from marking.js
 */
export class GeneralElementMarker extends BaseElementMarker {
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

      // Standard input types
      switch (inputType) {
        case 'button':
        case 'submit':
        case 'reset':
          return 'button';
        case 'checkbox':
          return 'checkbox';
        case 'radio':
          return 'radio';
        case 'email':
          return 'email-input';
        case 'password':
          return 'password-input';
        case 'number':
          return 'number-input';
        case 'date':
          return 'date-input';
        case 'time':
          return 'time-input';
        case 'tel':
          return 'phone-input';
        case 'url':
          return 'url-input';
        case 'range':
          return 'range-input';
        case 'color':
          return 'color-input';
        case 'file':
          return 'file-input';
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
      if (role === 'menu' || parentRole === 'menubar') return 'menu-container';

      // List system
      if (role === 'option' || parentRole === 'listbox') return 'list-item';
      if (role === 'listbox') return 'list-container';

      // Toolbar system
      if ((role === 'button' || parentRole === 'toolbar') && isIconContainer) {
        return 'toolbar-button';
      }

      // Generic interactive divs
      if (hasClickHandler) return isIconContainer ? 'icon-button' : 'clickable-div';
      if (isIconContainer) return 'icon-container';
      if (element.hasAttribute('aria-expanded')) return 'expandable-section';
    }

    // Special Elements
    if ((tag === 'a' || role === 'link') && isIconContainer) {
      return (element as HTMLAnchorElement).href ? 'icon-link' : 'icon-button';
    }

    if (tag === 'button' || role === 'button') {
      return isIconContainer ? 'icon-button' : 'button';
    }

    // Modified textarea handling
    if (tag === 'textarea') {
      if (
        element.getAttribute('aria-label')?.toLowerCase().includes('search') ||
        element.getAttribute('placeholder')?.toLowerCase().includes('search') ||
        element.getAttribute('name')?.toLowerCase().includes('search') ||
        element.getAttribute('id')?.toLowerCase().includes('search')
      ) {
        return 'search-input';
      }
      return 'text-area';
    }

    if (tag === 'select') return 'dropdown';
    if ((element as HTMLElement).isContentEditable) return 'rich-text-editor';
    if (tag === 'a' && (element as HTMLAnchorElement).href) return 'link';
    if (tag === 'video') return 'video-player';

    // Final Fallback
    // If nothing specific was determined and the tag is simply 'div' or 'a',
    // use additional cues (click handler, cursor style, or text content) to decide.
    let finalType = tag || role;
    if (finalType === 'div' || finalType === 'a') {
      const style = window.getComputedStyle(element);
      if (hasClickHandler || style.cursor === 'pointer') {
        finalType = 'clickable-element';
      } else if (element.textContent?.trim().length || 0 > 0) {
        finalType = 'text-container';
      } else {
        finalType = 'container';
      }
    }
    return finalType;
  }

  protected getElementDescription(element: Element, type: string): string {
    // Base information
    const ariaLabel = element.getAttribute('aria-label')?.trim();
    const title = element.getAttribute('title')?.trim();
    const baseText = ariaLabel || title || this.getElementText(element, type);

    // State tracking
    const states: string[] = [];
    if ((element as HTMLInputElement).disabled) states.push('disabled');
    if ((element as HTMLInputElement).checked) states.push('checked');
    const statePrefix = states.length ? `[${states.join(',')}] ` : '';

    // Enhanced Descriptions
    if (type.endsWith('-input')) {
      const inputType = type.replace('-input', '');
      const placeholder = element.getAttribute('placeholder') || '';
      const label =
        element.getAttribute('aria-label') ||
        element.getAttribute('title') ||
        element.closest('label')?.textContent?.trim() ||
        inputType;

      return `${statePrefix}${inputType.replace(/\b\w/g, l => l.toUpperCase())} field${placeholder ? `: ${placeholder}` : ''}${label ? ` (${label})` : ''}`;
    }

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
      case 'list-container': {
        return `${statePrefix}List: ${baseText || 'Selectable items'}`;
      }
      case 'list-item': {
        const listParent = element.closest('[role="listbox"]');
        const listLabel = listParent?.getAttribute('aria-label') || '';
        return `${statePrefix}List item${listLabel ? ` in ${listLabel}` : ''}: ${baseText}`;
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

    // Determine type and description for the overlay label.
    const type = this.getElementType(element);
    const description = this.getElementDescription(element, type);

    // Define an array of important keywords for button text.
    const importantKeywords = ['login', 'submit', 'done', 'search'];
    let showFullText = false;

    // Show full text for text input elements.
    if (type === 'text-input' || type === 'search-input') {
      showFullText = true;
    }
    // For buttons, check if the description contains one of the keywords.
    else if (type === 'button' || type === 'icon-button') {
      const lowerDesc = description.toLowerCase();
      for (const keyword of importantKeywords) {
        if (lowerDesc.includes(keyword)) {
          showFullText = true;
          break;
        }
      }
    }

    // Create a top label that shows only the index.
    const topLabelText = `${index}`;
    // Create a bottom label text only if showFullText is true.
    const bottomLabelText = showFullText ? description : '';

    Array.from(element.getClientRects()).forEach(rect => {
      const overlay = document.createElement('div');
      // Choose a color from our palette.
      const color = this.highlightColors[index % this.highlightColors.length];

      // Reduce the overlay box size slightly to avoid visual clutter.
      Object.assign(overlay.style, {
        position: 'absolute',
        border: `1px dashed ${color}`,
        backgroundColor: `${color}10`, // very light background
        top: `${rect.top + window.scrollY + 2}px`,
        left: `${rect.left + window.scrollX + 2}px`,
        width: `${rect.width - 4}px`,
        height: `${rect.height - 4}px`,
        pointerEvents: 'none',
      });

      // Top label: displays the index above the box.
      const topLabel = document.createElement('div');
      topLabel.textContent = topLabelText;
      Object.assign(topLabel.style, {
        position: 'absolute',
        top: '-16px',
        left: '0',
        background: color + '80', // using the highlight color with added opacity
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

      // Bottom label: displays the full text below the box if applicable.
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
      return this.isInteractiveElement(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    };
  }
}
