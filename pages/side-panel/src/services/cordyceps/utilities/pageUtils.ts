/**
 * Page utility functions extracted from page.ts for better code organization and reusability.
 *
 * This module contains pure functions and utilities that were extracted from the Page class
 * to improve code maintainability and enable better testing. The functions follow these patterns:
 *
 * 1. **Pure Functions**: Functions that don't have side effects and return consistent results
 * 2. **Utility Helpers**: Small, focused functions that handle specific tasks
 * 3. **Complex Operations**: More involved operations broken down into composable parts
 *
 * Extracted functions include:
 * - iframe content frame detection and lookup
 * - ARIA snapshot processing for AI consumption
 * - Frame reference and selector generation
 * - Snapshot line formatting and processing
 */

import { DEFAULTS } from './constants';
import type { Frame } from '../frame';
import type { Progress } from '../core/progress';
import type { FrameManager } from '../frameManager';

// #region Type Definitions

export interface FrameLookupOptions {
  /** Whether to include child frames in the search */
  includeChildren?: boolean;
  /** Maximum depth to search when includeChildren is true */
  maxDepth?: number;
}

export interface IFrameContext {
  /** The element handle reference */
  remoteObject: string;
  /** The frame execution context */
  context: {
    evaluate: (
      func: (handle: string) => unknown,
      world: chrome.scripting.ExecutionWorld,
      handle: string,
    ) => Promise<unknown>;
  };
}

// #endregion

// #region Pure Utility Functions

/**
 * Check if an error is a JavaScript error during evaluation.
 * This mimics Playwright's js.isJavaScriptErrorInEvaluate function.
 * Pure function that can be used independently for error classification.
 *
 * @param error The error to check
 * @returns True if the error is a JavaScript evaluation error
 */
export function isJavaScriptErrorInEvaluate(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // Check for common JavaScript evaluation errors
  const jsErrorPatterns = [
    'ReferenceError',
    'TypeError',
    'SyntaxError',
    'RangeError',
    'EvalError',
    'URIError',
  ];

  return jsErrorPatterns.some(
    pattern => error.name.includes(pattern) || error.message.includes(pattern),
  );
}

/**
 * Validate that only PNG screenshots are supported
 * Pure function for screenshot format validation
 *
 * @param format The format to validate
 * @returns True if format is supported
 * @throws Error if format is not supported
 */
export function validateScreenshotFormat(format: string): boolean {
  if (format !== DEFAULTS.SCREENSHOT_FORMAT) {
    throw new Error(`Only ${DEFAULTS.SCREENSHOT_FORMAT.toUpperCase()} screenshots are supported`);
  }
  return true;
}

/**
 * Extract the src attribute from an iframe element handle
 * This is a pure function that can be used independently
 *
 * @param handle The element handle to inspect
 * @returns Promise that resolves to the iframe src or null
 */
export async function extractIframeSrc(handle: IFrameContext): Promise<string | null> {
  const result = await handle.context.evaluate(
    (h: string) => {
      const injected = window.__cordyceps_handledInjectedScript;
      const element = injected.getElementByHandle(h);
      if (element && 'contentWindow' in element && (element as HTMLIFrameElement).contentWindow) {
        // Return the src of the iframe. We'll use this to find the frame.
        return (element as HTMLIFrameElement).src;
      }
      return null;
    },
    'ISOLATED',
    handle.remoteObject,
  );

  return result as string | null;
}

/**
 * Find a frame by URL in a frame manager
 * This is a pure utility function for frame lookup
 *
 * @param frameManager The frame manager to search in
 * @param url The URL to search for
 * @returns The matching frame or null
 */
export function findFrameByUrl(frameManager: FrameManager, url: string): Frame | null {
  const frames = frameManager.frames();
  return frames.find(f => f.url() === url) || null;
}

/**
 * Get content frame ID for an iframe element handle
 * This combines iframe src extraction with frame lookup
 *
 * @param handle The iframe element handle
 * @param frameManager The frame manager to search in
 * @returns Promise that resolves to the frame ID or null
 */
export async function getContentFrameId(
  handle: IFrameContext,
  frameManager: FrameManager,
): Promise<number | null> {
  const src = await extractIframeSrc(handle);

  if (!src) {
    return null;
  }

  const frame = findFrameByUrl(frameManager, src);
  return frame ? frame.frameId : null;
}

/**
 * Generate a reference prefix for frame snapshots based on ordinal
 *
 * @param frameOrdinal The ordinal number of the frame (0 for main frame)
 * @returns The reference prefix string
 */
export function generateFrameRefPrefix(frameOrdinal: number): string {
  return frameOrdinal ? `f${frameOrdinal}` : '';
}

/**
 * Parse iframe line from ARIA snapshot
 * Extracts leading whitespace and reference from iframe lines
 *
 * @param line The line to parse
 * @returns Parsed iframe information or null if not an iframe line
 */
export function parseIframeLine(line: string): {
  leadingSpace: string;
  ref: string;
} | null {
  const match = line.match(/^(\s*)- iframe (?:\[active\] )?\[ref=(.*)\]/);
  if (!match) {
    return null;
  }

  return {
    leadingSpace: match[1],
    ref: match[2],
  };
}

/**
 * Generate frame selectors for iframe navigation
 *
 * @param ref The iframe reference
 * @returns Object containing frame and body selectors
 */
export function generateFrameSelectors(ref: string): {
  frameSelector: string;
  frameBodySelector: string;
} {
  const frameSelector = `aria-ref=${ref} >> internal:control=enter-frame`;
  const frameBodySelector = `${frameSelector} >> body`;

  return {
    frameSelector,
    frameBodySelector,
  };
}

/**
 * Format child snapshot lines with proper indentation
 *
 * @param childSnapshot The child snapshot lines
 * @param leadingSpace The leading whitespace to preserve
 * @returns Formatted lines with proper indentation
 */
export function formatChildSnapshotLines(childSnapshot: string[], leadingSpace: string): string[] {
  return childSnapshot.map(l => leadingSpace + '  ' + l);
}

/**
 * Process a single iframe line in the snapshot
 * This is a pure function that handles the logic for processing iframe entries
 *
 * @param line The current line being processed
 * @param childSnapshot The snapshot of the child frame (if successful)
 * @returns Formatted lines to add to the result
 */
export function processIframeLine(line: string, childSnapshot?: string[]): string[] {
  const parsed = parseIframeLine(line);

  if (!parsed || !childSnapshot) {
    return [line];
  }

  const formattedChildLines = formatChildSnapshotLines(childSnapshot, parsed.leadingSpace);
  return [line + ':', ...formattedChildLines];
}

// #endregion

// #region Advanced Snapshot Processing

/**
 * Core snapshot processing function for AI consumption
 * This function handles the recursive processing of frame snapshots
 *
 * @param progress Progress tracker
 * @param frame The frame to snapshot
 * @param frameOrdinal The ordinal number of this frame
 * @param frameIds Array to track frame IDs during processing
 * @returns Promise that resolves to an array of snapshot lines
 */
export async function snapshotFrameForAI(
  progress: Progress,
  frame: Frame,
  frameOrdinal: number,
  frameIds: number[],
): Promise<string[]> {
  // Only await the topmost navigations, inner frames will be empty when racing.
  const snapshot = await frame._retryWithProgressAndTimeouts<string>(
    progress,
    [1000, 2000, 4000, 8000],
    async continuePolling => {
      try {
        const context = frame.context;
        const refPrefix = generateFrameRefPrefix(frameOrdinal);
        const forAI = true;
        const snapshotOrRetry = await progress.race(
          context.ariaSnapshot(forAI, refPrefix, 'ISOLATED'),
        );
        if (typeof snapshotOrRetry === 'boolean') return continuePolling;
        return snapshotOrRetry;
      } catch (e) {
        if (e instanceof Error && frame.isNonRetriableError(e)) throw e;
        return continuePolling;
      }
    },
  );

  const lines = snapshot.split('\n');
  const result = [];

  for (const line of lines) {
    const iframeInfo = parseIframeLine(line);
    if (!iframeInfo) {
      result.push(line);
      continue;
    }

    const { ref } = iframeInfo;
    const { frameBodySelector } = generateFrameSelectors(ref);

    const child = await progress.race(
      frame.selectors.resolveFrameForSelector(frameBodySelector, { strict: true }),
    );

    if (!child) {
      result.push(line);
      continue;
    }

    const newFrameOrdinal = frameIds.length + 1;
    frameIds.push(child.frame.frameId);

    try {
      const childSnapshot = await snapshotFrameForAI(
        progress,
        child.frame,
        newFrameOrdinal,
        frameIds,
      );
      const processedLines = processIframeLine(line, childSnapshot);
      result.push(...processedLines);
    } catch {
      result.push(line);
    }
  }

  return result;
}

// #endregion

// #region Convenience Functions

/**
 * Create a complete snapshot for AI consumption from a page's main frame
 *
 * @param progress Progress tracker
 * @param mainFrame The main frame to start the snapshot from
 * @param frameIds Optional array to collect frame IDs during processing
 * @returns Promise that resolves to a complete AI snapshot string
 */
export async function createPageSnapshotForAI(
  progress: Progress,
  mainFrame: Frame,
  frameIds?: number[],
): Promise<string> {
  const frameIdsArray = frameIds || [];
  const snapshot = await snapshotFrameForAI(progress, mainFrame, 0, frameIdsArray);
  return snapshot.join('\n');
}

// #endregion
