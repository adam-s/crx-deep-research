# stuff to do

I'll analyze the `context.ts` file and the existing test files to identify which methods don't have test files yet. Now let me check for the static methods and other methods that might not be captured: Let me also check for the non-async methods and other patterns: Now let me also check for methods that might include safeGoto and takeScreenshot: Now let me check what test files already exist: Let me check what methods are covered in the existing test files: Based on my analysis of the context.ts file and the existing test files, here's the comprehensive list of methods that **do NOT have dedicated test files yet**:

## BrowserContext Methods Without Test Files

### Public Methods

1. `enter()` - Browser context initialization
2. `getCurrentPage()` - Get current active page
3. `safeGoto()` - Safe navigation with URL validation  
4. `stopLoading()` - Stop page loading
5. `takeScreenshot()` - Capture page screenshots
6. `close()` - Close browser context
7. `isActive()` - Check if context is active
8. `getState()` - Get browser state
9. `getSession()` - Get session information
10. `removeHighlights()` - Remove element highlights
11. `resetContext()` - Reset browser session
12. `getSelectorMap()` - Get element selector map
13. `getPageStructure()` - Get page DOM structure
14. `getDomElementByIndex()` - Get DOM element by index
15. `getElementByIndex()` - Get element handle by index
16. `goBack()` - Navigate back in history
17. `goForward()` - Navigate forward in history
18. `_updateState()` - Update browser state
19. `_handleDisallowedNavigation()` - Handle disallowed URLs
20. `_waitForPageAndFramesLoad()` - Wait for page/frames to load
21. `_clickElementNode()` - Click DOM element
22. `_inputTextElementNode()` - Input text to element
23. `_getUniqueFilename()` - Generate unique filenames
24. `_checkAndHandleNavigation()` - Check/handle navigation
25. `_enhancedCssSelectorForElement()` - Generate CSS selectors
26. `_convertSimpleXpathToCssSelector()` - Convert XPath to CSS
27. `_getTagName()` - Get element tag name
28. `_getParent()` - Get element parent
29. `_getHighlightIndex()` - Get element highlight index
30. `_toElementForSelector()` - Convert element for selector
31. `end()` - End browser session
32. `toDict()` - Serialize session to dictionary

## Existing Test Files Cover

- `_getTabsInfo()` - Has `getTabsInfoTest.ts`
- `_getScrollInfo()` - Has `getScrollInfoTest.ts`
- `getLocateElement()` - Has getLocateElementTest.ts
- `_isUrlAllowed()` - Has `urlAllowedTest.ts`
- `_waitForStableNetwork()` - Has `waitForStableNetworkTest.ts`

**Total: 32 methods without test files** out of approximately 37 total methods in the BrowserContext class.
