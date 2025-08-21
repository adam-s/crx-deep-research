Summarized conversation historyBased on our comprehensive ActHandlerUtils Redux conversion experience, here's a generalized prompt for converting other Stagehand handler files one at a time:

## Universal Stagehand Handler Conversion Prompt

### Conversion Context
I need to convert a Stagehand handler file from Playwright-based implementation to Chrome extension compatible code using the Cordyceps engine. This conversion should follow the same patterns established in the successful ActHandlerUtils Redux implementation.

### Target File
**File to Convert**: `[SPECIFY HANDLER FILE PATH]` (e.g., `observeHandler.ts`, `extractHandler.ts`, `agentHandler.ts`, etc.)

### Conversion Requirements

#### 1. API Compatibility & Patterns
- **Maintain 100% API compatibility** with original handler interface
- **Implement dual patterns** where applicable:
  - Direct element operations using Cordyceps Locator/Page APIs
  - MethodHandlerContext pattern for complex operations
- **Preserve all public methods** exactly as they exist in the original
- **Keep all method signatures identical** - no breaking changes

#### 2. Chrome Extension Compliance
- **No Playwright imports** - replace with Cordyceps equivalents:
  - `Page` → Cordyceps `Page`
  - `Locator` → Cordyceps `Locator`
  - `ElementHandle` → Cordyceps `ElementHandle`
  - `FrameLocator` → Cordyceps `FrameLocator`
- **CSP-compliant code only**:
  - No `new Function('')`
  - No `eval('')`
  - Use `executeFunction()` instead of `evaluate()`
  - No dynamic code execution from strings
- **Use message passing** for cross-context communication
- **Handle extension lifecycle** events and context invalidation

#### 3. Implementation Strategy

**Phase 1: Core Infrastructure**
```typescript
// 1. Update imports to Cordyceps
import { Page, Locator, FrameLocator } from 'cordyceps-types';

// 2. Create methodHandlerMap if the handler has method dispatch
const methodHandlerMap: Record<string, (context: MethodHandlerContext) => Promise<void>> = {
  // Map methods to handler functions
};

// 3. Implement MethodHandlerContext interface if needed
interface MethodHandlerContext {
  method: string;
  locator: Locator;
  xpath: string;
  args: unknown[];
  logger: (logLine: LogLine) => void;
  stagehandPage: StagehandPage;
  // Add handler-specific context properties
}
```

**Phase 2: Method Conversion**
- **Preserve pure functions** that don't use Playwright (CSS selectors, XPath conversion, etc.)
- **Convert Playwright API calls** to Cordyceps equivalents:
  ```typescript
  // Before: page.evaluate(fn, args)
  // After: page.executeFunction(fn, args)
  
  // Before: page.locator(selector)
  // After: page.locator(selector)
  
  // Before: elementHandle.click()
  // After: locator.click()
  ```
- **Adapt network operations** using `chrome.webRequest` if applicable
- **Convert file operations** to `chrome.storage` or `chrome.downloads`

**Phase 3: Advanced Features**
- **Screenshot handling** using Cordyceps screenshot API
- **Cookie management** with `chrome.cookies` API
- **Download detection** using `chrome.downloads` events
- **Cross-origin handling** with graceful degradation

#### 4. Testing Integration
- **Create comprehensive test suite** for the converted handler
- **Test all public methods** with various input scenarios
- **Validate API compatibility** by comparing outputs with original
- **Include edge case testing** (empty inputs, invalid selectors, etc.)
- **Performance testing** for critical paths

#### 5. Quality Standards
- **Zero TypeScript errors** - no `any` types allowed
- **Consistent naming conventions** - camelCase for variables/methods, PascalCase for classes
- **Comprehensive error handling** with proper logging
- **Production-ready code quality** suitable for senior engineer review
- **Documentation for complex logic** where self-explanatory code isn't sufficient

### Specific Conversion Patterns

#### Element Location Pattern
```typescript
async getLocateElement(element: ElementForSelector): Promise<ElementHandle | null> {
  const page = await this.stagehandPage.page;
  const cssSelector = this._generateSelector(element);
  return await page.locator(cssSelector).elementHandle();
}
```

#### Network Monitoring Pattern
```typescript
async _waitForStableNetwork(): Promise<void> {
  // Use chrome.webRequest instead of Playwright events
  // Implement request tracking in background script
  // Use message passing for side panel communication
}
```

#### State Management Pattern
```typescript
async _updateState(): Promise<HandlerState> {
  const page = await this.stagehandPage.page;
  const screenshot = await page.screenshot(progress, options);
  // Adapt to Cordyceps screenshot format
  return this._buildStateObject(screenshot, additionalData);
}
```

### Deliverables

1. **Converted Handler File**: Complete Chrome extension compatible version
2. **Test Suite**: Comprehensive testing covering all methods
3. **Integration Tests**: Validation within StagehandPlaygroundService
4. **Documentation**: Any breaking changes or limitations noted
5. **Performance Metrics**: Timing comparisons with original where applicable

### Success Criteria

- ✅ 100% API compatibility maintained
- ✅ All tests passing (>95% success rate)
- ✅ Zero TypeScript compilation errors
- ✅ Chrome extension CSP compliance
- ✅ Production-ready code quality
- ✅ Comprehensive error handling
- ✅ Integration with existing Stagehand ecosystem

### Example Usage
```typescript
// Start conversion with:
"Convert [HANDLER_NAME] from Playwright to Cordyceps using the universal conversion prompt. 
Target file: pages/side-panel/src/services/stagehand/lib/handlers/[HANDLER_FILE].ts
Follow the established patterns from ActHandlerUtils Redux implementation."
```

This prompt provides a complete framework for converting any Stagehand handler file while maintaining the quality and compatibility standards achieved in our ActHandlerUtils Redux implementation.

The new functions have to have the calling signature, side effects, and return value shape as the original. Use advanced typescript types to make sure everything is strongly typed. Make sure the new code is simple, clean, and elegant!
