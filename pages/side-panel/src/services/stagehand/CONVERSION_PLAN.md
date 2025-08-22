Looking at the three critical files that need conversion, I'll analyze each one and create a comprehensive conversion plan. Let me examine the current state and dependencies first. Now let me analyze the dependencies and create a comprehensive conversion plan.

# 🎯 **Stagehand to Cordyceps Conversion Plan**

## **Overview**

We need to convert three critical files from Playwright/Node.js to Cordyceps/Chrome Extension while maintaining **exact API compatibility**. Here's the strategic conversion plan:

## **🔴 CRITICAL DEPENDENCIES TO RESOLVE**

### 1. **Playwright → Cordyceps API Mapping**

| Playwright Import | Cordyceps Equivalent | Notes |
|-------------------|---------------------|-------|
| `BrowserContext` | `BrowserWindow` | Context management |
| `Page as PlaywrightPage` | `Page` | Page manipulation |
| `CDPSession` | `Session` | Chrome DevTools Protocol |
| `Frame` | `Frame` | Already imported correctly |

### 2. **Node.js → Chrome Extension Adaptations**

| Node.js Feature | Chrome Extension Alternative |
|----------------|------------------------------|
| CDP Protocol direct access | `chrome.debugger` API with Session wrapper |
| File system operations | `chrome.storage.local` |
| Process/signal handling | Extension lifecycle events |

---

## **📋 FILE-BY-FILE CONVERSION STRATEGY**

### **File 1: utils.ts (EASIEST - Start Here)**

**Priority: HIGH - Foundation for other files**

**Key Changes:**

```typescript
// BEFORE
import { CDPSession } from 'playwright';

// AFTER  
import { Session } from '../../../cordyceps/session';
type CDPSession = Session; // Compatibility alias
```

**Conversion Points:**

1. **Line 15**: Replace `CDPSession` import with Cordyceps `Session`
2. **CDP Protocol calls**: Most can remain the same via Session wrapper
3. **Frame management**: Already using Cordyceps Frame
4. **DOM tree traversal**: Pure logic - no changes needed

**Estimated Effort**: 2-3 hours ⭐

---

### **File 2: StagehandPage.ts (MEDIUM - Core Functionality)**

**Priority: HIGH - Core page management**

**Key Changes:**

```typescript
// Already partially converted! Page import is correct
import { Page } from '../../cordyceps/page';

// Need to add missing compatibility for enhanced interface
export interface EnhancedCordycepsPage extends Page {
  act(actionOrOptions: string | ActOptions | ObserveResult): Promise<ActResult>;
  extract<T extends z.AnyZodObject = typeof defaultExtractSchema>(
    instructionOrOptions?: string | ExtractOptions<T>
  ): Promise<ExtractResult<T>>;
  observe(instructionOrOptions?: string | ObserveOptions): Promise<ObserveResult[]>;
}
```

**Already Done:** ✅

- Page import is already Cordyceps
- Basic structure exists

**Still Needed:**

1. **Enhanced page proxy system** for AI methods
2. **Handler initialization** (already imported correctly)
3. **Script injection** using Cordyceps evaluate
4. **Network stability detection** via load states

**Estimated Effort**: 4-6 hours ⭐⭐

---

### **File 3: StagehandContext.ts (HARDEST - Complex Refactor)**

**Priority: HIGH - But dependent on Page completion**

**Key Changes:**

```typescript
// BEFORE
import type {
  BrowserContext as PlaywrightContext,
  CDPSession,
  Page as PlaywrightPage,
} from 'playwright';

// AFTER
import { BrowserWindow } from '../../../cordyceps/browserWindow';
import { Session } from '../../../cordyceps/session';
import { Page } from '../../../cordyceps/page';

type PlaywrightContext = BrowserWindow; // Compatibility alias
type PlaywrightPage = Page; // Compatibility alias  
type CDPSession = Session; // Compatibility alias
```

**Major Architectural Changes:**

1. **Context → BrowserWindow**: Different lifecycle management
2. **Page mapping**: WeakMap approach needs adaptation
3. **Frame ID tracking**: Different in Chrome extension context
4. **CDP session management**: Via chrome.debugger API

**Estimated Effort**: 6-8 hours ⭐⭐⭐

---

## **🚀 IMPLEMENTATION PHASES**

### **Phase 1: Foundation (Day 1)**

1. ✅ **Convert utils.ts** - CDPSession → Session
2. ✅ **Test accessibility tree functions**
3. ✅ **Verify DOM tree traversal works**

### **Phase 2: Core Page (Day 2-3)**

1. ✅ **Complete StagehandPage.ts enhanced interface**
2. ✅ **Implement AI method proxying**
3. ✅ **Test act/extract/observe methods**
4. ✅ **Verify script injection works**

### **Phase 3: Context Management (Day 4-5)**

1. ✅ **Convert StagehandContext.ts to BrowserWindow**
2. ✅ **Implement page lifecycle management**
3. ✅ **Test multi-page scenarios**
4. ✅ **Integration testing**

---

## **⚡ QUICK WINS & PRESERVATION STRATEGIES**

### **What to Keep Unchanged (80% of code):**

- ✅ **All handler logic** (ActHandler, ExtractHandler, ObserveHandler)
- ✅ **LLM integration** (no browser dependencies)
- ✅ **DOM utilities** (pure functions)
- ✅ **XPath/CSS selector generation**
- ✅ **Text processing utilities**

### **API Compatibility Guarantees:**

```typescript
// These signatures MUST remain identical:
class StagehandPage {
  async act(actionOrOptions: string | ActOptions | ObserveResult): Promise<ActResult>
  async extract<T extends z.AnyZodObject>(opts?: ExtractOptions<T>): Promise<ExtractResult<T>>
  async observe(instructionOrOptions?: string | ObserveOptions): Promise<ObserveResult[]>
}

class StagehandContext {
  async getStagehandPage(page: PlaywrightPage): Promise<StagehandPage>
  getStagehandPages(): Promise<StagehandPage[]>
  setActivePage(page: StagehandPage): void
}
```

---

## **🛡️ RISK MITIGATION**

### **High Risk Areas:**

1. **CDP session management** - Use Session wrapper carefully
2. **Frame ID tracking** - Chrome extension context differs
3. **Cross-origin access** - More restricted in extensions

### **Mitigation Strategies:**

1. **Incremental testing** after each file conversion
2. **Compatibility aliases** to maintain API surface
3. **Graceful degradation** for restricted operations
4. **Comprehensive test coverage** for each converted component

---

## **✅ SUCCESS CRITERIA**

1. **All existing tests pass** without modification
2. **Exact API compatibility** maintained
3. **Performance equivalent** to Playwright version  
4. **Chrome extension security compliance**
5. **Zero breaking changes** for consumers

Would you like me to start with **utils.ts** since it's the foundation file and has the clearest conversion path?
