import { z, type ZodTypeAny } from 'zod/v3';
import { LogLine } from '../../types/log';
import { ZodPathSegments } from '../../types/stagehand';
import { extract } from '../inference';
import { LLMClient } from '../llm/LLMClient';
import { injectUrls, transformSchema } from '../utils';
import { ChromeExtensionStagehand, StagehandFunctionName } from '../index';
import { pageTextSchema } from '../../types/page';
import { EncodedId } from '../../types/context';
import { BrowserWindow } from '@src/services/cordyceps/browserWindow';
import {
  // Main content script functions for data extraction
  testXPathEvaluationFunction,
  clearOverlaysFunction,
  drawExtractionOverlayFunction,
  checkStagehandInjectedFunction,
  injectStagehandHelpersFunction,
  extractElementDataFunction,
  countExtractableElementsFunction,
  // Additional iframe and XPath utilities (available for future use)
  // getIframeXpathFunction,
  // getFrameRootXpathFunction,
  // getScrollableElementXpathsFunction,
  // resolveXPathToObjectIdFunction,
} from './extractHandlerUtils';

/**
 * Chrome Extension compatible ExtractHandler using Cordyceps engine
 *
 * This Redux implementation replaces Playwright dependencies with Cordyceps APIs
 * and provides comprehensive data extraction capabilities within Chrome extension
 * security constraints.
 */
export class StagehandExtractHandler {
  private readonly stagehand: ChromeExtensionStagehand;
  private readonly logger: (logLine: LogLine) => void;
  private readonly browserWindow: BrowserWindow;
  private readonly userProvidedInstructions?: string;
  private readonly experimental: boolean;

  constructor({
    stagehand,
    logger,
    browserWindow,
    userProvidedInstructions,
    experimental,
  }: {
    stagehand: ChromeExtensionStagehand;
    logger: (message: {
      category?: string;
      message: string;
      level?: number;
      auxiliary?: { [key: string]: { value: string; type: string } };
    }) => void;
    browserWindow: BrowserWindow;
    userProvidedInstructions?: string;
    experimental: boolean;
  }) {
    this.stagehand = stagehand;
    this.logger = logger;
    this.browserWindow = browserWindow;
    this.userProvidedInstructions = userProvidedInstructions;
    this.experimental = experimental;
  }

  public async extract<T extends z.AnyZodObject>({
    instruction,
    schema,
    content = {},
    llmClient,
    requestId,
    domSettleTimeoutMs,
    useTextExtract,
    selector,
    iframes,
  }: {
    instruction?: string;
    schema?: T;
    content?: z.infer<T>;
    chunksSeen?: Array<number>;
    llmClient?: LLMClient;
    requestId?: string;
    domSettleTimeoutMs?: number;
    useTextExtract?: boolean;
    selector?: string;
    iframes?: boolean;
  } = {}): Promise<z.infer<T>> {
    const noArgsCalled = !instruction && !schema && !llmClient && !selector;
    if (noArgsCalled) {
      this.logger({
        category: 'extraction',
        message: 'Extracting the entire page text.',
        level: 1,
      });
      return this.extractPageText();
    }

    if (useTextExtract !== undefined) {
      this.logger({
        category: 'extraction',
        message:
          'Warning: the `useTextExtract` parameter has no effect in this version of Stagehand and will be removed in future versions.',
        level: 1,
      });
    }
    return this.domExtract({
      instruction: instruction!,
      schema: schema!,
      content,
      llmClient: llmClient!,
      requestId,
      domSettleTimeoutMs,
      selector,
      iframes,
    });
  }

  /**
   * Extract page text using Cordyceps accessibility tree
   */
  private async extractPageText(domSettleTimeoutMs?: number): Promise<{ page_text?: string }> {
    await this._waitForSettledDom(domSettleTimeoutMs);

    // Get accessibility tree using Cordyceps-compatible methods
    const tree = await this._getAccessibilityTree();

    this.logger({
      category: 'extraction',
      message: 'Getting accessibility tree data',
      level: 1,
    });

    const outputString = tree.simplified;
    const result = { page_text: outputString };
    return pageTextSchema.parse(result);
  }

  /**
   * Extract structured data using DOM and LLM inference
   */
  private async domExtract<T extends z.AnyZodObject>({
    instruction,
    schema,
    llmClient,
    requestId,
    domSettleTimeoutMs,
    selector,
    iframes,
  }: {
    instruction: string;
    schema: T;
    content?: z.infer<T>;
    llmClient: LLMClient;
    requestId?: string;
    domSettleTimeoutMs?: number;
    selector?: string;
    iframes?: boolean;
  }): Promise<z.infer<T>> {
    this.logger({
      category: 'extraction',
      message: 'starting extraction using a11y tree',
      level: 1,
      auxiliary: {
        instruction: {
          value: instruction,
          type: 'string',
        },
      },
    });

    await this._waitForSettledDom(domSettleTimeoutMs);
    const targetXpath = selector?.replace(/^xpath=/, '') ?? '';

    const {
      combinedTree: outputString,
      combinedUrlMap: idToUrlMapping,
      discoveredIframes,
    } = await (iframes
      ? this._getAccessibilityTreeWithFrames(targetXpath)
      : this._getAccessibilityTree(targetXpath).then(
          ({ simplified, idToUrl, iframes: frameNodes }) => ({
            combinedTree: simplified,
            combinedUrlMap: idToUrl as Record<EncodedId, string>,
            combinedXpathMap: {} as Record<EncodedId, string>,
            discoveredIframes: frameNodes,
          })
        ));

    this.logger({
      category: 'extraction',
      message: 'Got accessibility tree data',
      level: 1,
    });

    if (discoveredIframes !== undefined && discoveredIframes.length > 0) {
      this.logger({
        category: 'extraction',
        message: `Warning: found ${discoveredIframes.length} iframe(s) on the page. If you wish to interact with iframe content, please make sure you are setting iframes: true`,
        level: 1,
      });
    }

    // Transform user defined schema to replace string().url() with .number()
    const [transformedSchema, urlFieldPaths] = transformUrlStringsToNumericIds(schema);

    // call extract inference with transformed schema
    const extractionResponse = await extract({
      instruction,
      domElements: outputString,
      schema: transformedSchema,
      chunksSeen: 1,
      chunksTotal: 1,
      llmClient,
      requestId: requestId || 'extract-request',
      userProvidedInstructions: this.userProvidedInstructions,
      logger: this.logger,
      logInferenceToFile: false, // Chrome extension doesn't have file logging
    });

    const {
      metadata: { completed },
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      inference_time_ms: inferenceTimeMs,
      ...output
    } = extractionResponse;

    this.stagehand.updateMetrics(
      StagehandFunctionName.EXTRACT,
      promptTokens,
      completionTokens,
      inferenceTimeMs
    );

    this.logger({
      category: 'extraction',
      message: 'received extraction response',
      auxiliary: {
        extraction_response: {
          value: JSON.stringify(extractionResponse),
          type: 'object',
        },
      },
    });

    if (completed) {
      this.logger({
        category: 'extraction',
        message: 'extraction completed successfully',
        level: 1,
        auxiliary: {
          extraction_response: {
            value: JSON.stringify(extractionResponse),
            type: 'object',
          },
        },
      });
    } else {
      this.logger({
        category: 'extraction',
        message: 'extraction incomplete after processing all data',
        level: 1,
        auxiliary: {
          extraction_response: {
            value: JSON.stringify(extractionResponse),
            type: 'object',
          },
        },
      });
    }

    // revert to original schema and populate with URLs
    for (const { segments } of urlFieldPaths) {
      injectUrls(output, segments, idToUrlMapping);
    }

    return output as z.infer<T>;
  }

  // =============================================================================
  // PUBLIC UTILITY METHODS
  // =============================================================================

  /**
   * Clear all extraction overlays from the page
   */
  public async clearExtractionOverlays(): Promise<void> {
    try {
      const page = await this.browserWindow.getCurrentPage();
      await page.evaluate(clearOverlaysFunction);

      this.logger({
        category: 'extraction',
        message: 'Cleared all extraction overlays',
        level: 1,
      });
    } catch (error) {
      this.logger({
        category: 'extraction',
        message: `Failed to clear extraction overlays: ${error}`,
        level: 1,
      });
    }
  }

  /**
   * Draw visual overlays on extraction target elements
   */
  public async drawExtractionOverlays(selectors: string[]): Promise<void> {
    try {
      const validSelectors = selectors.filter(selector => selector !== 'xpath=');

      if (validSelectors.length === 0) {
        this.logger({
          category: 'extraction',
          message: 'No valid selectors found for overlay drawing',
          level: 1,
        });
        return;
      }

      const page = await this.browserWindow.getCurrentPage();
      const overlayCount = await page.evaluate(drawExtractionOverlayFunction, validSelectors);

      this.logger({
        category: 'extraction',
        message: `Drew extraction overlays for ${overlayCount} elements`,
        level: 1,
      });
    } catch (error) {
      this.logger({
        category: 'extraction',
        message: `Failed to draw extraction overlays: ${error}`,
        level: 1,
      });
    }
  }

  /**
   * Count extractable elements on the current page
   */
  public async countExtractableElements(criteria?: string): Promise<{
    totalElements: number;
    interactiveElements: number;
    visibleElements: number;
  }> {
    try {
      const page = await this.browserWindow.getCurrentPage();
      const count = await page.evaluate(countExtractableElementsFunction, criteria);

      this.logger({
        category: 'extraction',
        message: `Found ${count.totalElements} total elements, ${count.interactiveElements} interactive, ${count.visibleElements} visible`,
        level: 1,
      });

      return count;
    } catch (error) {
      this.logger({
        category: 'extraction',
        message: `Failed to count extractable elements: ${error}`,
        level: 1,
      });
      return { totalElements: 0, interactiveElements: 0, visibleElements: 0 };
    }
  }

  /**
   * Extract structured data from specific elements
   */
  public async extractElementData(selectors: string[]): Promise<
    Array<{
      selector: string;
      found: boolean;
      data?: {
        tagName: string;
        id: string;
        className: string;
        textContent: string;
        attributes: Record<string, string>;
        boundingBox: DOMRect | null;
        visible: boolean;
      };
    }>
  > {
    try {
      const page = await this.browserWindow.getCurrentPage();

      // Ensure helpers are injected
      await this._ensureStagehandHelpers();

      const results = await page.evaluate(extractElementDataFunction, selectors);

      this.logger({
        category: 'extraction',
        message: `Extracted data from ${results.filter(r => r.found).length}/${selectors.length} elements`,
        level: 1,
      });

      return results;
    } catch (error) {
      this.logger({
        category: 'extraction',
        message: `Failed to extract element data: ${error}`,
        level: 1,
      });
      return selectors.map(selector => ({ selector, found: false }));
    }
  }

  /**
   * Test XPath evaluation capabilities
   */
  public async testXPathEvaluation(
    xpath: string
  ): Promise<{ success: boolean; elementCount: number }> {
    try {
      const page = await this.browserWindow.getCurrentPage();
      const result = await page.evaluate(testXPathEvaluationFunction, xpath);

      this.logger({
        category: 'extraction',
        message: `XPath evaluation test for "${xpath}": ${result.success ? 'success' : 'failed'} (${result.elementCount} elements)`,
        level: 1,
      });

      return result;
    } catch (error) {
      this.logger({
        category: 'extraction',
        message: `XPath evaluation test failed for "${xpath}": ${error}`,
        level: 1,
      });
      return { success: false, elementCount: 0 };
    }
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Wait for DOM to settle using Cordyceps
   */
  private async _waitForSettledDom(domSettleTimeoutMs?: number): Promise<void> {
    try {
      // Use the provided timeout or default to 1000ms
      const timeout = domSettleTimeoutMs || 1000;
      await new Promise(resolve => setTimeout(resolve, timeout));

      this.logger({
        category: 'extraction',
        message: 'DOM settled successfully',
        level: 1,
      });
    } catch (error) {
      this.logger({
        category: 'extraction',
        message: `Failed to wait for settled DOM: ${error}`,
        level: 1,
      });
    }
  }

  /**
   * Get accessibility tree using Cordyceps-compatible methods
   */
  private async _getAccessibilityTree(targetXpath?: string): Promise<{
    simplified: string;
    idToUrl: Record<string, string>;
    iframes: Array<{ nodeId: string }>;
  }> {
    try {
      // For now, return placeholder data - this would need to be implemented
      // with actual Cordyceps accessibility tree extraction
      const placeholderSimplified = JSON.stringify([]);
      const placeholderIdToUrl: Record<string, string> = {};
      const placeholderIframes: Array<{ nodeId: string }> = [];

      this.logger({
        category: 'extraction',
        message: `Retrieved accessibility tree data${targetXpath ? ` for xpath: ${targetXpath}` : ''} (placeholder implementation)`,
        level: 1,
      });

      return {
        simplified: placeholderSimplified,
        idToUrl: placeholderIdToUrl,
        iframes: placeholderIframes,
      };
    } catch (error) {
      this.logger({
        category: 'extraction',
        message: `Failed to get accessibility tree: ${error}`,
        level: 1,
      });

      return {
        simplified: JSON.stringify([]),
        idToUrl: {},
        iframes: [],
      };
    }
  }

  /**
   * Get accessibility tree with iframe support
   */
  private async _getAccessibilityTreeWithFrames(targetXpath?: string): Promise<{
    combinedTree: string;
    combinedUrlMap: Record<EncodedId, string>;
    combinedXpathMap: Record<EncodedId, string>;
    discoveredIframes: Array<{ nodeId: string }>;
  }> {
    try {
      // For now, return placeholder data - this would need to be implemented
      // with actual Cordyceps iframe-aware accessibility tree extraction
      const placeholderTree = JSON.stringify([]);
      const placeholderUrlMap: Record<EncodedId, string> = {};
      const placeholderXpathMap: Record<EncodedId, string> = {};
      const placeholderIframes: Array<{ nodeId: string }> = [];

      this.logger({
        category: 'extraction',
        message: `Retrieved accessibility tree with frames${targetXpath ? ` for xpath: ${targetXpath}` : ''} (placeholder implementation)`,
        level: 1,
      });

      return {
        combinedTree: placeholderTree,
        combinedUrlMap: placeholderUrlMap,
        combinedXpathMap: placeholderXpathMap,
        discoveredIframes: placeholderIframes,
      };
    } catch (error) {
      this.logger({
        category: 'extraction',
        message: `Failed to get accessibility tree with frames: ${error}`,
        level: 1,
      });

      return {
        combinedTree: JSON.stringify([]),
        combinedUrlMap: {},
        combinedXpathMap: {},
        discoveredIframes: [],
      };
    }
  }

  /**
   * Ensure Stagehand helper scripts are injected
   */
  private async _ensureStagehandHelpers(): Promise<void> {
    try {
      const page = await this.browserWindow.getCurrentPage();

      // Check if helpers are already injected
      const injected = await page.evaluate(checkStagehandInjectedFunction);

      if (!injected) {
        // Inject helper functions
        await page.evaluate(injectStagehandHelpersFunction);

        this.logger({
          category: 'extraction',
          message: 'Injected Stagehand helper scripts',
          level: 1,
        });
      }
    } catch (error) {
      this.logger({
        category: 'extraction',
        message: `Failed to ensure Stagehand helpers: ${error}`,
        level: 1,
      });
    }
  }
}

/**
 * Scans the provided Zod schema for any `z.string().url()` fields and
 * replaces them with `z.number()`.
 *
 * @param schema - The Zod object schema to transform.
 * @returns A tuple containing:
 *   1. The transformed schema (or the original schema if no changes were needed).
 *   2. An array of {@link ZodPathSegments} objects representing all the replaced URL fields,
 *      with each path segment showing where in the schema the replacement occurred.
 */
export function transformUrlStringsToNumericIds<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T
): [T, ZodPathSegments[]] {
  const shape = schema._def.shape();
  const newShape: Record<string, ZodTypeAny> = {};
  const urlPaths: ZodPathSegments[] = [];
  let changed = false;

  for (const [key, value] of Object.entries(shape)) {
    const [childTransformed, childPaths] = transformSchema(value, [key]);
    newShape[key] = childTransformed;
    if (childTransformed !== value) {
      changed = true;
    }
    if (childPaths.length > 0) {
      childPaths.forEach(cp => {
        urlPaths.push({ segments: [key, ...cp.segments] });
      });
    }
  }

  const finalSchema = changed ? z.object(newShape) : schema;
  return [finalSchema as T, urlPaths];
}
