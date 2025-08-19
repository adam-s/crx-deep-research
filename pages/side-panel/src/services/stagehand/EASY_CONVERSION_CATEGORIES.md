# Stagehand to Cordyceps: Easy Conversion Categories

## Overview

This document outlines the next set of files that require conversion from Playwright to Cordyceps but are relatively easy to convert. These files have been categorized by complexity and conversion approach, with skeleton test files created for systematic testing.

## Easy Conversion Categories

### Category 1: Type Definitions & Interface Files (Minimal Changes)

**Complexity**: Low - Mostly import statement updates and interface adaptations

**Files to Convert**:

- `types/act.ts` - Replace Playwright Locator import
- `types/context.ts` - Replace Playwright BrowserContext/Frame imports  
- `types/page.ts` - Replace Playwright Browser/Context/Page imports
- `types/stagehand.ts` - Replace Playwright Cookie import
- `types/playwright.ts` - Complete replacement with Cordyceps equivalents

**Conversion Strategy**:

- Update import statements from Playwright to Cordyceps
- Adapt type definitions for API compatibility
- Create equivalent types where direct mapping doesn't exist

**Test File**: `typeDefinitionsConversionTests.ts`

### Category 2: Utility Functions (Low Impact Changes)

**Complexity**: Low-Medium - Pure functions with minimal Playwright dependencies

**Files to Convert**:

- `lib/api.ts` - Update imports, minimal Playwright usage
- `lib/utils.ts` - Pure functions mostly, minor Page type updates
- `lib/logger.ts` - No Playwright dependencies, Chrome storage adaptations
- `lib/inference.ts` - Pure LLM logic, no Playwright dependencies
- `lib/prompt.ts` - Pure prompt building, no Playwright dependencies

**Conversion Strategy**:

- Replace Page interface with Cordyceps equivalent
- Adapt HTTP client for extension context (already using fetch)
- Convert file logging to chrome.storage if needed
- Test LLM integration functions (no changes needed)

**Test File**: `utilityFunctionsConversionTests.ts`

### Category 3: Handler Utilities (Direct API Conversion)

**Complexity**: Medium - Direct API usage requiring careful conversion

**Files to Convert**:

- `lib/handlers/actHandler.ts` - Locator import replacement
- `lib/agent/utils/cuaKeyMapping.ts` - Key mapping utility functions
- `lib/handlers/agentHandler.ts` - Page method usage (goto, screenshot, etc.)
- `lib/handlers/handlerUtils/actHandlerUtils.ts` - Complex shadow DOM utilities

**Conversion Strategy**:

- Replace Playwright Locator with Cordyceps Locator
- Convert page navigation and interaction methods
- Update key mapping from Playwright to Cordyceps
- Test shadow DOM and iframe utilities

**Test File**: `handlerUtilitiesConversionTests.ts`

### Category 4: Storage & File System Adaptations

**Complexity**: Medium-High - Significant adaptation for extension context

**Files to Convert**:

- `lib/cache.ts` - Replace fs operations with chrome.storage

**Conversion Strategy**:

- Replace Node.js `fs` operations with `chrome.storage.local`
- Convert synchronous operations to async/await pattern
- Implement storage quota management
- Test data serialization for chrome.storage compatibility

**Test File**: `storageFileSystemConversionTests.ts`

## Implementation Approach

### Phase 1: Type System Updates (Week 1)

1. Convert all type definition files
2. Create Cordyceps equivalent types
3. Update import statements across codebase
4. Verify compilation without errors

### Phase 2: Utility Functions (Week 2)

1. Update utility functions to use Cordyceps types
2. Test API client with Cordyceps
3. Adapt logger for extension context
4. Verify pure functions work unchanged

### Phase 3: Handler Conversion (Week 3)

1. Convert action handlers to Cordyceps APIs
2. Update key mapping utilities
3. Test complex shadow DOM operations
4. Verify agent execution pipeline

### Phase 4: Storage Adaptation (Week 4)

1. Replace file system with chrome.storage
2. Implement quota management
3. Test cache operations
4. Performance optimization

## Testing Strategy

Each category has comprehensive skeleton test files that will:

1. **Verify Compatibility**: Test that converted APIs work as expected
2. **Error Handling**: Test edge cases and error scenarios
3. **Performance**: Ensure no performance regressions
4. **Integration**: Test interaction between converted components

## Service Integration

The `StagehandPlaygroundService` has been updated with:

- `runEasyConversionTests()` - Runs all easy conversion category tests
- Integration with existing test pipeline
- Progress reporting for each conversion category
- Quick test variants for CI/CD integration

## Usage

```typescript
// Run all easy conversion tests
await stagehandPlaygroundService.runEasyConversionTests();

// Run specific category tests
const testContext = {
  progress: (update) => console.log(update),
  completed: () => console.log('Done')
};

await testTypeDefinitionsConversion(testContext);
await testUtilityFunctionsConversion(testContext);
await testHandlerUtilitiesConversion(testContext);
await testStorageFileSystemConversion(testContext);
```

## Next Steps

1. **Implement Tests**: Fill in the skeleton test functions with actual implementation
2. **Convert Files**: Systematically convert each file using the test-driven approach
3. **Integration Testing**: Test converted components together
4. **Documentation**: Update documentation for Cordyceps equivalents

This categorization provides a clear roadmap for the next phase of the Stagehand to Cordyceps conversion, focusing on files that are relatively straightforward to convert while building confidence and momentum for more complex conversions later.
