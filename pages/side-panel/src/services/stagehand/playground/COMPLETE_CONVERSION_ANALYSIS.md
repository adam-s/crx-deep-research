# Stagehand to Cordyceps: Complete File Analysis & Test Coverage

## Overview

This document provides a comprehensive analysis of all Stagehand files that import Playwright components with Cordyceps equivalents, organized by conversion priority and complexity. Each category has dedicated test files for systematic conversion testing.

## Files with Playwright Imports (Cordyceps Equivalents Available)

### 🔴 CRITICAL PRIORITY - Core Stagehand Components

**Files with Complex Playwright Dependencies:**

| File | Playwright Imports | Cordyceps Equivalents | Complexity |
|------|-------------------|----------------------|------------|
| `lib/StagehandPage.ts` | `Page as PlaywrightPage`, `Frame`, `CDPSession`, `selectors` | `Page`, `Frame`, `Session`, selector utilities | **HIGH** |
| `lib/StagehandContext.ts` | `BrowserContext as PlaywrightContext`, `CDPSession`, `Page as PlaywrightPage` | `BrowserWindow`, `Session`, `Page` | **HIGH** |
| `lib/index.ts` | `Browser`, `chromium` | `BrowserWindow.create()` | **HIGH** |

**Test Coverage:** ✅ `coreStagehandConversionTests.ts`

### 🟡 MEDIUM PRIORITY - Handler Utilities

**Files with Direct API Usage:**

| File | Playwright Imports | Cordyceps Equivalents | Complexity |
|------|-------------------|----------------------|------------|
| `lib/handlers/actHandler.ts` | `Locator` | `Locator` | **MEDIUM** |
| `lib/handlers/handlerUtils/actHandlerUtils.ts` | `Page`, `Locator`, `FrameLocator` | `Page`, `Locator`, `FrameLocator` | **MEDIUM** |
| `lib/a11y/utils.ts` | `CDPSession`, `Frame` | `Session`, `Frame` | **MEDIUM** |

**Test Coverage:**

- ✅ `handlerUtilitiesConversionTests.ts` (covers actHandler.ts & actHandlerUtils.ts)
- ✅ `accessibilityAdvancedConversionTests.ts` (covers a11y/utils.ts)

### 🟢 LOW PRIORITY - Type Definitions & Utilities

**Files with Minimal Changes Needed:**

| Category | Files | Changes Needed | Complexity |
|----------|-------|---------------|------------|
| **Type Definitions** | `types/act.ts`, `types/context.ts`, `types/page.ts`, `types/stagehand.ts`, `types/playwright.ts` | Import replacements | **LOW** |
| **Utility Functions** | `lib/api.ts`, `lib/utils.ts`, `lib/logger.ts`, `lib/inference.ts`, `lib/prompt.ts` | Minor API updates | **LOW-MEDIUM** |
| **Storage Adaptation** | `lib/cache.ts` | fs → chrome.storage | **MEDIUM** |

**Test Coverage:**

- ✅ `typeDefinitionsConversionTests.ts`
- ✅ `utilityFunctionsConversionTests.ts`
- ✅ `storageFileSystemConversionTests.ts`

## Conversion Mapping: Playwright → Cordyceps

### Direct API Equivalents

```typescript
// Playwright → Cordyceps Mapping
Page                 → Page
Frame                → Frame  
Locator              → Locator
ElementHandle        → ElementHandle
BrowserContext       → BrowserWindow
Browser.launch()     → BrowserWindow.create()
FrameLocator         → FrameLocator
```

### API Method Compatibility

```typescript
// Navigation Methods
page.goto()          → page.goto()          ✅ Direct equivalent
page.goBack()        → page.goBack()        ✅ Direct equivalent
page.goForward()     → page.goForward()     ✅ Direct equivalent
page.reload()        → page.reload()        ✅ Direct equivalent

// Element Interaction
page.locator()       → page.locator()       ✅ Direct equivalent
locator.click()      → locator.click()      ✅ Direct equivalent
locator.fill()       → locator.fill()       ✅ Direct equivalent
locator.type()       → locator.type()       ✅ Direct equivalent

// Frame Management
page.frame()         → page.frameManager    ✅ Available
frame.locator()      → frame.locator()      ✅ Direct equivalent
frame.evaluate()     → frame.evaluate()     ✅ Direct equivalent

// Screenshots & Media
page.screenshot()    → page.screenshot()    ✅ Available with progress
```

### Components Requiring Adaptation

```typescript
// CDP Protocol → Chrome Extension APIs
CDPSession           → Session (custom shim)
chromium.launch()    → BrowserWindow.create()
BrowserContext       → BrowserWindow + Session
selectors.register() → Custom selector utilities

// File System → Chrome Storage
fs.readFileSync()    → chrome.storage.local.get()
fs.writeFileSync()   → chrome.storage.local.set()
```

## Test File Structure

### ✅ Created Test Files

1. **`typeDefinitionsConversionTests.ts`**
   - **Purpose:** Test type import replacements
   - **Files:** `types/*.ts`
   - **Complexity:** Low
   - **Status:** Skeleton created

2. **`utilityFunctionsConversionTests.ts`**
   - **Purpose:** Test utility function adaptations
   - **Files:** `lib/api.ts`, `lib/utils.ts`, `lib/logger.ts`, `lib/inference.ts`, `lib/prompt.ts`
   - **Complexity:** Low-Medium
   - **Status:** Skeleton created

3. **`handlerUtilitiesConversionTests.ts`**
   - **Purpose:** Test action handler conversions
   - **Files:** `lib/handlers/actHandler.ts`, `lib/handlers/handlerUtils/actHandlerUtils.ts`
   - **Complexity:** Medium
   - **Status:** Skeleton created

4. **`storageFileSystemConversionTests.ts`**
   - **Purpose:** Test fs → chrome.storage conversion
   - **Files:** `lib/cache.ts`
   - **Complexity:** Medium-High
   - **Status:** Skeleton created

5. **`coreStagehandConversionTests.ts`** 🔴 **CRITICAL**
   - **Purpose:** Test core Stagehand component conversions
   - **Files:** `lib/StagehandPage.ts`, `lib/StagehandContext.ts`, `lib/index.ts`
   - **Complexity:** High
   - **Status:** Skeleton created

6. **`accessibilityAdvancedConversionTests.ts`**
   - **Purpose:** Test accessibility and advanced feature conversions
   - **Files:** `lib/a11y/utils.ts`
   - **Complexity:** Medium-High
   - **Status:** Skeleton created

## Implementation Strategy

### Phase 1: Foundation (Week 1)

**Files:** Type definitions and utility functions

- Convert all `types/*.ts` files
- Update `lib/api.ts`, `lib/utils.ts`, `lib/logger.ts`
- Test with `typeDefinitionsConversionTests.ts` and `utilityFunctionsConversionTests.ts`

### Phase 2: Handlers (Week 2)

**Files:** Action handlers and utilities

- Convert `lib/handlers/actHandler.ts`
- Convert `lib/handlers/handlerUtils/actHandlerUtils.ts`
- Test with `handlerUtilitiesConversionTests.ts`

### Phase 3: Storage (Week 3)

**Files:** File system adaptations

- Convert `lib/cache.ts` from fs to chrome.storage
- Test with `storageFileSystemConversionTests.ts`

### Phase 4: Core Components (Week 4) 🔴 **CRITICAL**

**Files:** Core Stagehand classes

- Convert `lib/StagehandPage.ts` (most complex)
- Convert `lib/StagehandContext.ts`
- Convert `lib/index.ts`
- Test with `coreStagehandConversionTests.ts`

### Phase 5: Advanced Features (Week 5)

**Files:** Accessibility and advanced features

- Convert `lib/a11y/utils.ts`
- Implement CDP shims where needed
- Test with `accessibilityAdvancedConversionTests.ts`

## Service Integration

The `StagehandPlaygroundService` includes all test categories:

```typescript
// Comprehensive test coverage
await stagehandPlaygroundService.runEasyConversionTests();

// Individual category testing
await testTypeDefinitionsConversion(context);      // Types
await testUtilityFunctionsConversion(context);     // Utils  
await testHandlerUtilitiesConversion(context);     // Handlers
await testStorageFileSystemConversion(context);    // Storage
await testCoreStagehandConversion(context);        // Core (CRITICAL)
await testAccessibilityAdvancedConversion(context); // A11y
```

## Conversion Checklist

### ✅ Analysis Complete

- [x] Identified all Playwright imports
- [x] Mapped to Cordyceps equivalents
- [x] Created comprehensive test coverage
- [x] Prioritized by complexity and criticality

### 🔄 Next Steps

- [ ] **Phase 1:** Implement type definition conversions
- [ ] **Phase 2:** Implement handler utility conversions
- [ ] **Phase 3:** Implement storage system conversion
- [ ] **Phase 4:** Implement core component conversions (CRITICAL)
- [ ] **Phase 5:** Implement accessibility feature conversions

### 🎯 Success Metrics

- All test files pass without errors
- Stagehand functionality preserved
- Performance maintained or improved
- Chrome extension compatibility achieved
- No breaking changes to public API

## File-by-File Conversion Order

Based on dependencies and complexity:

1. **`types/*.ts`** → Update all type definitions first
2. **`lib/utils.ts`** → Pure utility functions
3. **`lib/api.ts`** → HTTP client adaptations
4. **`lib/logger.ts`** → Logging system adaptation
5. **`lib/cache.ts`** → Storage system conversion
6. **`lib/handlers/actHandler.ts`** → Action handler conversion
7. **`lib/handlers/handlerUtils/actHandlerUtils.ts`** → Complex handler utilities
8. **`lib/StagehandContext.ts`** → Context management (CRITICAL)
9. **`lib/StagehandPage.ts`** → Main page wrapper (CRITICAL)
10. **`lib/index.ts`** → Main entry point (CRITICAL)
11. **`lib/a11y/utils.ts`** → Accessibility utilities

This systematic approach ensures dependencies are resolved in order and provides comprehensive test coverage for each conversion step.
