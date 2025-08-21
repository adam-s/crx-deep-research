# Generic Element Operation System

A clean, type-safe, domain-agnostic solution for executing functions on DOM elements in Chrome extensions.

## Architecture Overview

This system provides a bridge between side panel code and content script execution while maintaining:

- **Domain Independence**: Cordyceps doesn't know about Stagehand or other libraries
- **Type Safety**: Full TypeScript support with generics
- **CSP Compliance**: No dynamic code execution
- **Consistent API**: Same pattern across ElementHandle, Locator, and direct calls

## Core Components

### 1. Generic Operations (`genericElementOperations.ts`)

- `ElementOperationRequest<TArgs>`: Type-safe request structure
- `ElementOperationResult<TResult>`: Type-safe result structure  
- `executeGenericElementFunction()`: CSP-compliant execution function
- `ElementFunctionRegistry`: Type-safe function registration

### 2. FrameExecutionContext Integration

```typescript
async executeElementFunction<TArgs, TResult>(
  handle: string,
  request: ElementOperationRequest<TArgs>,
  world?: chrome.scripting.ExecutionWorld
): Promise<ElementOperationResult<TResult>>
```

### 3. HandledInjectedScript Integration

- `registerElementFunction()`: Register functions in content script
- `hasElementFunction()`: Check if function exists
- `getRegisteredElementFunctions()`: List all functions

### 4. ElementHandle & Locator Support

```typescript
async executeFunction<TArgs, TResult>(
  functionName: string,
  args?: TArgs,
  options?: { timeout?: number; world?: chrome.scripting.ExecutionWorld }
): Promise<TResult>
```

## Usage Pattern

### Step 1: Register Functions (Content Script)

```typescript
// In content script initialization
const injectedScript = window.__cordyceps_handledInjectedScript;

injectedScript.registerElementFunction(
  'scrollToPercentage',
  (element: Element, args: { yPercent: number }) => {
    // Implementation here
  },
  'Scroll element to percentage position'
);
```

### Step 2: Execute Functions (Side Panel)

```typescript
// Via ElementHandle
const elementHandle = await frame.waitForSelector('#scrollable');
await elementHandle.executeFunction('scrollToPercentage', { yPercent: 50 });

// Via Locator
const locator = page.locator('#scrollable');
await locator.executeFunction('scrollToPercentage', { yPercent: 75 });

// Via FrameExecutionContext (direct)
const result = await frame.context.executeElementFunction(
  handle,
  { functionName: 'scrollToPercentage', args: { yPercent: 25 } }
);
```

## Benefits

### 1. Domain Independence

- Cordyceps provides generic infrastructure
- Stagehand (or any library) registers specific functions
- No tight coupling between systems

### 2. Type Safety

```typescript
// Strong typing for arguments and results
interface ScrollArgs { yPercent: number; }
await element.executeFunction<ScrollArgs, void>('scrollToPercentage', { yPercent: 50 });
```

### 3. CSP Compliance

- All functions pre-registered, no dynamic execution
- Uses `chrome.scripting.executeScript` with static functions
- Registry pattern prevents security issues

### 4. Consistent API

- Same `executeFunction()` method on ElementHandle and Locator
- Progress tracking and timeout support
- Error handling with structured results

### 5. Extensibility

- Any library can register functions
- No modifications to Cordyceps core needed
- Functions can be added/removed dynamically

## Implementation Strategy

### For Stagehand Migration

1. **Create Registry**: Build `StagehandElementFunctionRegistry`
2. **Register Functions**: Initialize in content script
3. **Update Handlers**: Replace `.evaluate()` calls with `.executeFunction()`
4. **Test Integration**: Verify all functionality works

### For Other Libraries

1. **Follow Pattern**: Use same registration approach
2. **Define Types**: Create strong interfaces for args/results
3. **Initialize**: Register functions during content script setup
4. **Execute**: Use consistent API across all components

## Example: Stagehand Integration

```typescript
// Register Stagehand functions
injectedScript.registerElementFunction(
  'scrollToNextChunk',
  (element: Element) => {
    // Stagehand's smart scrolling logic
  }
);

// Use in handlers
const locator = page.locator('#content');
await locator.executeFunction('scrollToNextChunk');
```

This approach provides a clean, elegant solution that maintains separation of concerns while enabling powerful DOM manipulation capabilities.
