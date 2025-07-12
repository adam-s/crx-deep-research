import { BaseElementMarker } from './BaseElementMarker';
import { ElementFilterFunction } from './types';

/**
 * Final marking implementation - captures all interactive elements
 * This is the most comprehensive implementation similar to final_marking.js
 */
export class FinalElementMarker extends BaseElementMarker {
  
  protected getElementType(element: Element): string {
    const tag = element.tagName.toLowerCase();

    // For <input> elements, return "button" for button types, else "input".
    if (tag === "input") {
      const inputElement = element as HTMLInputElement;
      const inputType = inputElement.type.toLowerCase();
      if (["button", "submit", "reset"].includes(inputType)) {
        return "button";
      }
      return "input";
    }

    // Prioritize the actual tag: if it is a <button>, always classify as "button"
    if (tag === "button") {
      return "button";
    }

    // Check the role attribute only if the tag is not already forcing a specific type.
    const role = element.getAttribute("role");
    if (role) {
      const r = role.toLowerCase();

      // Special handling for combobox
      if (r === "combobox") {
        if (element.hasAttribute("aria-autocomplete") || element.querySelector("input")) {
          return "input";
        }
        return "combobox";
      }

      // For a role of "link", only consider it a link if the element is an <a> tag.
      if (r === "link" && tag !== "a") {
        return tag;
      }

      // Return the role if it matches common interactive types.
      if (["button", "textbox", "checkbox", "radio", "listbox", "menuitem", "switch", "searchbox"].includes(r)) {
        return r;
      }
    }

    // For anchor tags, confirm it's a proper link.
    if (tag === "a" && element.hasAttribute("href")) {
      return "link";
    }
    if (tag === "select") return "select";
    if (tag === "textarea") return "textarea";
    if (element.hasAttribute('onclick')) return "button";

    return tag;
  }

  protected getElementDescription(element: Element, type: string): string {
    let desc = element.getAttribute("aria-label");
    if (desc && desc.trim().length > 0) return desc.trim();
    
    desc = element.getAttribute("title");
    if (desc && desc.trim().length > 0) return desc.trim();

    if (type === "link") {
      const txt = element.textContent?.trim() || '';
      return txt ? `Go to ${txt}` : "link";
    }
    
    if (type === "button") {
      const txt = element.textContent?.trim() || '';
      return txt ? txt : "button";
    }
    
    if (type === "input") {
      const inputElement = element as HTMLInputElement;
      const placeholder = inputElement.placeholder;
      if (placeholder && placeholder.trim().length > 0) {
        return placeholder.trim();
      }
      const val = inputElement.value;
      if (val && val.trim().length > 0) {
        return val.trim();
      }
      return "input field";
    }
    
    const txt = element.textContent?.trim() || '';
    return txt ? txt : "";
  }

  protected highlightElement(element: Element, index: number): void {
    if (!this.DEBUG_HIGHLIGHT || !this.highlightContainer) return;
    
    const rect = element.getBoundingClientRect();
    const color = this.highlightColors[index % this.highlightColors.length];

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'absolute',
      border: `2px solid ${color}`,
      backgroundColor: `${color}22`,
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });

    const label = document.createElement('div');
    Object.assign(label.style, {
      position: 'absolute',
      top: '-20px',
      left: '0',
      background: color,
      color: 'white',
      padding: '2px 4px',
      borderRadius: '3px',
      fontSize: '12px'
    });
    label.textContent = index.toString();
    overlay.appendChild(label);

    this.highlightContainer.appendChild(overlay);
  }

  protected createElementFilter(): ElementFilterFunction {
    return (node: Element) => {
      return this.isInteractiveElement(node)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP;
    };
  }
}
