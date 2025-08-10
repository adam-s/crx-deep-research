/**
 * Cordyceps utilities index - centralized exports for all utility modules.
 *
 * This index file provides a single import point for all utility functions,
 * constants, and types across the Cordyceps framework. This promotes
 * consistency and makes it easy to access common functionality.
 *
 * Usage:
 * ```typescript
 * import { TIMEOUTS, createElementNotFoundError, validateSelector } from './utils';
 * ```
 */

// #region Constants
export * from './constants';

// #endregion

// #region Error Utilities
export * from './errorUtils';

// #endregion

// #region Buffer Utilities
export * from './bufferUtils';

// #endregion

// #region Validation Utilities
export * from './validationUtils';

// #endregion

// #region Core Utility Re-exports

// Frame utilities - Type definitions and core functions
export type {
  DocumentLifecycle,
  FrameType,
  TabStatus,
  FrameConfiguration,
  Position,
  BoundingBox,
} from './frameUtils';

export {
  createFrameConfiguration,
  getFrame,
  calculateCenterPosition,
  describeBoundingBox,
  isValidWaitState,
  createSelectorWaitMessage,
  createBoundingBoxError,
  createFrameEnterSelector,
  createFrameNthSelector,
  testIdAttributeName,
  setTestIdAttribute,
} from './frameUtils';

// Locator utilities
export {
  executeProgressElementOperation,
  buildSelectorWithOptions,
  executeElementMethodWithProgress,
  DEFAULT_LOCATOR_TIMEOUT,
} from './locatorUtils';

// Page utilities
export {
  isJavaScriptErrorInEvaluate,
  validateScreenshotFormat,
  extractIframeSrc,
} from './pageUtils';

// Element handle utilities - Key functions
export {
  isOperationSuccessful,
  isResultDisconnected,
  validateElementOperationResult,
  createDelayPromise,
  normalizeClickOptions,
  requiresEnhancedInteraction,
  createFillElementScript,
  createSelectOptionScript,
  createSelectTextScript,
  createKeyboardEventScript,
  isPrintableKey,
  validateSelectOption,
  normalizeSelectOptions,
  createElementOperationError,
  isSuccessfulOperation,
  isElementDisconnected,
  extractErrorMessage,
} from './elementHandleUtils';

// #endregion
