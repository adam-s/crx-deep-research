# DOM Module

This module provides functionality for interacting with the Document Object Model (DOM) of web pages. It's a TypeScript implementation of the DOM module from the Python browser-use repository.

## Overview

The DOM module allows you to:

1. Extract DOM elements from a web page
2. Identify clickable and interactive elements
3. Build a DOM tree structure
4. Check element visibility and interactivity

## Key Components

### DOMService

The main service class that provides methods for interacting with the DOM:

```typescript
import { DOMService } from './dom/service';

// Create a new DOM service with a Playwright page
const domService = new DOMService(page);

// Get clickable elements from the page
const domState = await domService.getClickableElements(
  true,  // highlight elements
  -1,    // focus on all elements (-1) or a specific element index
  500    // viewport expansion in pixels
);
```

### DOM Node Classes

The module includes several classes for representing DOM nodes:

- `DOMBaseNode`: Base class for all DOM nodes
- `DOMTextNode`: Represents text nodes in the DOM
- `DOMElementNode`: Represents element nodes in the DOM with attributes, children, and interactivity information

```typescript
// Example of accessing DOM elements
const rootElement = domState.rootElement;
const clickableElements = Object.values(domState.selectorMap);

// Check if an element is clickable
if (element.isClickable()) {
  // Perform click action
}

// Get element text content
const text = element.getTextContent();
```

### buildDomTree.js

A JavaScript file that runs in the browser context to build the DOM tree. It includes functions for:

- Measuring performance
- Checking element visibility
- Determining if elements are interactive
- Highlighting elements in the DOM

## Integration with Browser Context

The DOM module integrates with Playwright's browser context to evaluate JavaScript code and extract DOM information:

```typescript
// Example of using the DOM module with Playwright
import { chromium } from 'playwright';
import { DOMService } from './dom/service';

// Launch browser and create page
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

// Navigate to a URL
await page.goto('https://example.com');

// Create DOM service and extract elements
const domService = new DOMService(page);
const domState = await domService.getClickableElements();

// Use the DOM information
console.log(`Found ${Object.keys(domState.selectorMap).length} clickable elements`);
```

## Performance Considerations

The DOM module includes performance tracking to measure the efficiency of DOM operations. In debug mode, it will output detailed metrics about:

- Time spent building the DOM tree
- Cache hit rates for DOM operations
- Number of nodes processed and skipped

## Error Handling

The module includes robust error handling for common DOM-related issues:

- Inaccessible iframes
- Shadow DOM boundaries
- JavaScript evaluation failures
