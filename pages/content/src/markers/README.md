# WebRover Marking Scripts - TypeScript Implementation

This directory contains the TypeScript implementation of the WebRover marking scripts, converted from the original JavaScript files in the `marking_scripts` directory.

## Class Hierarchy

### Base Class: `BaseElementMarker`

The abstract base class containing all shared functionality:

#### **Identical Methods (Same Implementation Across All Scripts):**
- `getXPath(element)` - Generates XPath for DOM elements
- `isInteractiveElement(element)` - Determines if an element is interactive
- `getElementText(element, type)` - Extracts text content from elements
- `isElementInViewport(element)` - Checks if element is visible in viewport
- `isPDFDetected()` - Detects PDF documents
- `createPDFResult()` - Returns PDF detection result
- `setupHighlightContainer()` - Sets up debug highlighting
- `collectElements()` - Uses TreeWalker to collect elements
- `mapElementsToResults()` - Converts elements to result format

#### **Abstract Methods (Must Be Implemented by Child Classes):**
- `getElementType(element)` - Determines element type (different logic per implementation)
- `getElementDescription(element, type)` - Creates element descriptions (different per type)
- `highlightElement(element, index)` - Handles visual highlighting (different strategies)
- `createElementFilter()` - Creates TreeWalker filter function (different element filtering)

## Implementations

### 1. `FinalElementMarker` 
**Source:** `final_marking.js`
- **Purpose:** Most comprehensive implementation, captures all interactive elements
- **Filter:** All interactive elements
- **Highlight:** Simple overlay with index label

### 2. `ButtonElementMarker`
**Source:** `marking_buttons.js` / `marking_buttons_2.js`
- **Purpose:** Captures only button and icon-button elements
- **Filter:** `type === 'button' || type === 'icon-button'` (excludes date-buttons)
- **Highlight:** Index above, description below
- **Special Features:** 
  - Date button detection (numeric text content)
  - Enhanced menu/toolbar handling

### 3. `InputElementMarker`
**Source:** `marking_input.js`
- **Purpose:** Captures only input field elements
- **Filter:** Input types (text-input, search-input, checkbox, radio, email-input, etc.)
- **Highlight:** Index above, description below
- **Special Features:**
  - Comprehensive input type classification
  - Search input detection across multiple attributes

### 4. `LinkElementMarker`
**Source:** `marking_links.js`
- **Purpose:** Captures only link and icon-link elements
- **Filter:** `type === 'link' || type === 'icon-link'`
- **Highlight:** Index above, description below

### 5. `GeneralElementMarker`
**Source:** `marking.js`
- **Purpose:** Captures all interactive elements with selective highlighting
- **Filter:** All interactive elements
- **Highlight:** Conditional - shows full description only for important elements (login, submit, search, text inputs)

### 6. `TextEditorDetector`
**Source:** `text_editor.js`
- **Purpose:** Standalone detector for contenteditable and textarea elements
- **Different Structure:** Not inherited from base class due to completely different logic
- **Returns:** `TextEditorDetection` interface with detection status and coordinates

## Type Definitions

### `CaptureOptions`
```typescript
interface CaptureOptions {
  debugHighlight?: boolean;
}
```

### `InteractiveElement`
```typescript
interface InteractiveElement {
  index: number;
  type: string;
  xpath: string;
  description: string;
  text: string;
  x: number;
  y: number;
  inViewport?: boolean;
}
```

### `TextEditorDetection`
```typescript
interface TextEditorDetection {
  detected: boolean;
  XPath?: string;
  X?: number;
  Y?: number;
}
```

## Usage

### Import and Use Specific Implementations
```typescript
import { FinalElementMarker, ButtonElementMarker } from './marking-scripts-typescript';

// Create instances
const finalMarker = new FinalElementMarker({ debugHighlight: true });
const buttonMarker = new ButtonElementMarker({ debugHighlight: false });

// Capture elements
const allElements = finalMarker.captureInteractiveElements();
const buttonElements = buttonMarker.captureInteractiveElements();
```

### Use Factory Function
```typescript
import { createElementMarker } from './marking-scripts-typescript';

const marker = createElementMarker('button', { debugHighlight: true });
const elements = marker.captureInteractiveElements();
```

### Use Convenience Functions
```typescript
import { 
  executeFinalMarking, 
  executeButtonMarking, 
  executeTextEditorDetection 
} from './marking-scripts-typescript';

const finalElements = executeFinalMarking({ debugHighlight: true });
const buttonElements = executeButtonMarking();
const editorInfo = executeTextEditorDetection();
```

## Key Differences from JavaScript

1. **Type Safety:** All methods and parameters are properly typed
2. **Class Hierarchy:** Clear inheritance structure with abstract base class
3. **Interface Definitions:** Explicit contracts for all data structures
4. **Error Handling:** Better compile-time error detection
5. **IDE Support:** Enhanced autocomplete and refactoring capabilities

## Original JavaScript Files Mapping

- `final_marking.js` → `FinalElementMarker.ts`
- `marking_buttons.js` + `marking_buttons_2.js` → `ButtonElementMarker.ts`
- `marking_input.js` → `InputElementMarker.ts`
- `marking_links.js` → `LinkElementMarker.ts`
- `marking.js` → `GeneralElementMarker.ts`
- `text_editor.js` → `TextEditorDetector.ts`

## Architecture Benefits

1. **Code Reuse:** Common functionality extracted to base class
2. **Maintainability:** Changes to shared logic only need to be made once
3. **Extensibility:** Easy to add new marking implementations
4. **Type Safety:** Compile-time error checking and IDE support
5. **Documentation:** Self-documenting through TypeScript interfaces and types
