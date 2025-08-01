# HandledInjectedScript Documentation

## Overview

The `HandledInjectedScript` provides a safe way to interact with DOM elements across different JavaScript contexts by using UUID handles instead of direct element references. This enables secure element serialization for cross-context communication in Chrome extensions.

## Architecture

- **HandledInjectedScript**: Main class that wraps InjectedScript functionality
- **HandleManager**: Manages bidirectional mapping between DOM Elements and UUID handles
- **Composition Pattern**: Uses composition over inheritance for clean separation of concerns

## Global Window Access

Once the content script loads, the HandledInjectedScript instance is available at:

```javascript
window.__cordyceps_handledInjectedScript
```

## Basic Usage with chrome.scripting.executeScript

### Simple Element Query

```javascript
// Background script or popup
const results = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (args) => {
    const selector = window.__cordyceps_handledInjectedScript.parseSelector(args.selector);
    return window.__cordyceps_handledInjectedScript.querySelector(selector, document, false);
  },
  args: [{ selector: '.help-article' }]
});

const elementHandle = results[0].result; // UUID string or undefined
console.log('Element handle:', elementHandle);
```

### Multiple Elements Query

```javascript
const results = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (args) => {
    const selector = window.__cordyceps_handledInjectedScript.parseSelector(args.selector);
    return window.__cordyceps_handledInjectedScript.querySelectorAll(selector, document);
  },
  args: [{ selector: 'p' }]
});

const elementHandles = results[0].result; // Array of UUID strings
console.log('Found elements:', elementHandles.length);
```

### Retrieving Element Details

```javascript
// First, get element handles
const getHandlesResult = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (args) => {
    const selector = window.__cordyceps_handledInjectedScript.parseSelector(args.selector);
    return window.__cordyceps_handledInjectedScript.querySelectorAll(selector, document);
  },
  args: [{ selector: 'a' }]
});

const linkHandles = getHandlesResult[0].result;

// Then, get details for specific elements
const getDetailsResult = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (args) => {
    return args.handles.map(handle => {
      const element = window.__cordyceps_handledInjectedScript.getElementByHandle(handle);
      if (!element) return null;
      
      return {
        handle: handle,
        tagName: element.tagName,
        textContent: element.textContent?.trim(),
        href: element.href || null,
        className: element.className || null,
        id: element.id || null
      };
    }).filter(Boolean);
  },
  args: [{ handles: linkHandles }]
});

const linkDetails = getDetailsResult[0].result;
console.log('Link details:', linkDetails);
```

### Capturing ARIA Snapshot

```javascript
// First, get an element handle
const getHandleResult = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (args) => {
    const selector = window.__cordyceps_handledInjectedScript.parseSelector(args.selector);
    return window.__cordyceps_handledInjectedScript.querySelector(selector, document);
  },
  args: [{ selector: 'main' }]
});

const mainContentHandle = getHandleResult[0].result;

if (mainContentHandle) {
  // Then, get the ARIA snapshot for that element
  const getSnapshotResult = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (args) => {
      return window.__cordyceps_handledInjectedScript.ariaSnapshot(args.handle);
    },
    args: [{ handle: mainContentHandle }]
  });

  const ariaSnapshot = getSnapshotResult[0].result;
  console.log('ARIA Snapshot:', ariaSnapshot);
}
```

## Advanced Usage Patterns

### Batch Operations

```javascript
// Get multiple element types in a single execution
const results = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (args) => {
    const results = {};
    
    for (const [key, selectorString] of Object.entries(args.selectors)) {
      const selector = window.__cordyceps_handledInjectedScript.parseSelector(selectorString);
      results[key] = window.__cordyceps_handledInjectedScript.querySelectorAll(selector, document);
    }
    
    return results;
  },
  args: [{
    selectors: {
      headings: 'h1, h2, h3',
      links: 'a',
      paragraphs: 'p',
      images: 'img'
    }
  }]
});

const elementsByType = results[0].result;
console.log('Headings found:', elementsByType.headings.length);
console.log('Links found:', elementsByType.links.length);
```

### Element Interaction

```javascript
// Get element handle first
const getElementResult = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (args) => {
    const selector = window.__cordyceps_handledInjectedScript.parseSelector(args.selector);
    return window.__cordyceps_handledInjectedScript.querySelector(selector, document, false);
  },
  args: [{ selector: 'button#submit' }]
});

const buttonHandle = getElementResult[0].result;

// Then interact with the element
if (buttonHandle) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (args) => {
      const element = window.__cordyceps_handledInjectedScript.getElementByHandle(args.handle);
      if (element && element instanceof HTMLButtonElement) {
        element.click();
        return { success: true, clicked: true };
      }
      return { success: false, reason: 'Element not found or not a button' };
    },
    args: [{ handle: buttonHandle }]
  });
}
```

### Handle Management

```javascript
// Check cache size and manage handles
const cacheInfo = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    const handleManager = window.__cordyceps_handledInjectedScript.handleManager;
    return {
      cacheSize: handleManager.cacheSize,
      // Get some element handles for testing
      testHandles: {
        body: window.__cordyceps_handledInjectedScript.getHandleForElement(document.body),
        head: window.__cordyceps_handledInjectedScript.getHandleForElement(document.head)
      }
    };
  }
});

console.log('Cache info:', cacheInfo[0].result);
```

## Error Handling

```javascript
try {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (args) => {
      // Check if HandledInjectedScript is available
      if (!window.__cordyceps_handledInjectedScript) {
        throw new Error('HandledInjectedScript not loaded');
      }
      
      try {
        const selector = window.__cordyceps_handledInjectedScript.parseSelector(args.selector);
        return {
          success: true,
          handles: window.__cordyceps_handledInjectedScript.querySelectorAll(selector, document)
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    },
    args: [{ selector: args.selector }]
  });
  
  const result = results[0].result;
  if (result.success) {
    console.log('Found elements:', result.handles);
  } else {
    console.error('Query failed:', result.error);
  }
} catch (error) {
  console.error('Script execution failed:', error);
}
```

## Best Practices

### 1. Always Check Availability

```javascript
const checkAvailability = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    return {
      available: !!window.__cordyceps_handledInjectedScript,
      cacheSize: window.__cordyceps_handledInjectedScript?.handleManager?.cacheSize || 0
    };
  }
});
```

### 2. Batch Related Operations

```javascript
// Good: Single execution for related queries
const batchResult = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (args) => {
    const results = {};
    args.queries.forEach(query => {
      const selector = window.__cordyceps_handledInjectedScript.parseSelector(query.selector);
      results[query.name] = window.__cordyceps_handledInjectedScript.querySelectorAll(selector, document);
    });
    return results;
  },
  args: [{ queries: [
    { name: 'links', selector: 'a' },
    { name: 'buttons', selector: 'button' }
  ]}]
});
```

### 3. Handle Validation

```javascript
// Always validate handles before using them
const validateAndUse = await chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: (args) => {
    const element = window.__cordyceps_handledInjectedScript.getElementByHandle(args.handle);
    if (!element) {
      return { error: 'Invalid handle or element no longer exists' };
    }
    
    // Safe to use element
    return {
      tagName: element.tagName,
      isConnected: element.isConnected,
      textContent: element.textContent?.substring(0, 100)
    };
  },
  args: [{ handle: elementHandle }]
});
```

## API Reference

### HandledInjectedScript Methods

- `parseSelector(selector: string): ParsedSelector` - Parse a selector string
- `querySelector(selector: ParsedSelector, root: Node, strict?: boolean): string | undefined` - Get single element handle
- `querySelectorAll(selector: ParsedSelector, root: Node): string[]` - Get multiple element handles
- `ariaSnapshot(handle: string): string | undefined` - Captures an ARIA snapshot for an element.
- `getElementByHandle(handle: string): Element | undefined` - Retrieve element from handle
- `getHandleForElement(element: Element): string` - Get handle for element
- `get handleManager(): HandleManager` - Access the underlying handle manager

### HandleManager Methods

- `get cacheSize(): number` - Get number of cached elements
- `clear(): void` - Clear all cached elements
- `unregisterHandle(handle: string): boolean` - Remove specific handle
- `unregisterElement(element: Element): boolean` - Remove element from cache

## Security Considerations

1. **Handle Validation**: Always validate handles before use as DOM elements may be removed
2. **Memory Management**: Handles maintain references to DOM elements - clear cache when appropriate
3. **Cross-Frame**: Handles are context-specific and don't work across frames
4. **Serialization**: Only the handle strings are serializable, not the elements themselves