import { z } from 'zod';
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

  public async extract<T extends z.ZodObject<z.ZodRawShape>>({
    instruction,
    schema,
    content = {} as z.infer<T>,
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
      return this.extractPageText() as z.infer<T>;
    }

    if (useTextExtract !== undefined) {
      this.logger({
        category: 'extraction',
        message:
          'Warning: the `useTextExtract` parameter has no effect in this version of Stagehand and will be removed in future versions.',
        level: 1,
      });
    }

    // If instruction is provided but no schema, use a default schema for unstructured text extraction
    const effectiveSchema = schema || (z.object({ extractedContent: z.string() }) as unknown as T);

    return this.domExtract({
      instruction: instruction!,
      schema: effectiveSchema,
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
   * Extract structured data using DOM and LLM inference with intelligent chunking
   */
  private async domExtract<T extends z.ZodObject<z.ZodRawShape>>({
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

    // Check content size and apply chunking if needed
    const contentSizeKB = Math.round(outputString.length / 1024);
    const maxContentSizeKB = 100; // Conservative limit for GPT-4o context window

    this.logger({
      category: 'extraction',
      message: `Content size: ${contentSizeKB}KB`,
      level: 1,
      auxiliary: {
        contentSize: {
          value: contentSizeKB.toString(),
          type: 'integer',
        },
        requiresChunking: {
          value: (contentSizeKB > maxContentSizeKB).toString(),
          type: 'boolean',
        },
      },
    });

    let extractionResponse;

    if (contentSizeKB > maxContentSizeKB) {
      // Use chunking approach for large content
      extractionResponse = await this._extractWithChunking({
        instruction,
        outputString,
        schema,
        llmClient,
        requestId: requestId || 'extract-request',
      });
    } else {
      // Use single extraction for smaller content
      const [transformedSchema] = transformUrlStringsToNumericIds(schema);

      extractionResponse = await extract({
        instruction,
        domElements: outputString,
        schema: transformedSchema,
        chunksSeen: 1,
        chunksTotal: 1,
        llmClient,
        requestId: requestId || 'extract-request',
        userProvidedInstructions: this.userProvidedInstructions,
        logger: this.logger,
        logInferenceToFile: false,
      });
    }

    const {
      metadata: { completed },
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      inference_time_ms: inferenceTimeMs,
      ...output
    } = extractionResponse;

    this.stagehand.updateMetrics(
      StagehandFunctionName.EXTRACT,
      promptTokens || 0,
      completionTokens || 0,
      inferenceTimeMs || 0
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
    const [, urlFieldPaths] = transformUrlStringsToNumericIds(schema);
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
   * Extract data using intelligent chunking for large content
   */
  private async _extractWithChunking<T extends z.ZodObject<z.ZodRawShape>>({
    instruction,
    outputString,
    schema,
    llmClient,
    requestId,
  }: {
    instruction: string;
    outputString: string;
    schema: T;
    llmClient: LLMClient;
    requestId: string;
  }): Promise<{
    metadata: { completed: boolean };
    prompt_tokens?: number;
    completion_tokens?: number;
    inference_time_ms?: number;
    [key: string]: unknown;
  }> {
    this.logger({
      category: 'extraction',
      message: 'Using chunking approach for large content',
      level: 1,
    });

    // Transform schema for chunking
    const [transformedSchema] = transformUrlStringsToNumericIds(schema);

    // Start with conservative 20KB chunks to avoid rate limits
    // If we hit rate limits, we'll handle retries with delays
    const chunkSize = 20 * 1024; // 20KB chunks

    // Create intelligent chunks by looking for natural breakpoints
    const chunks = this._createIntelligentChunks(outputString, chunkSize);

    // Limit to maximum 10 chunks to prevent excessive API usage and costs
    const maxChunks = 10;
    const chunksToProcess = chunks.slice(0, maxChunks);

    if (chunks.length > maxChunks) {
      this.logger({
        category: 'extraction',
        message: `Content has ${chunks.length} chunks, processing first ${maxChunks} to avoid excessive API usage`,
        level: 1,
      });
    }

    this.logger({
      category: 'extraction',
      message: `Created ${chunks.length} chunks, processing ${chunksToProcess.length} chunks for extraction`,
      level: 1,
      auxiliary: {
        totalChunks: {
          value: chunks.length.toString(),
          type: 'integer',
        },
        processingChunks: {
          value: chunksToProcess.length.toString(),
          type: 'integer',
        },
      },
    });

    // Initialize result accumulator
    const results: Array<Partial<z.infer<T>>> = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalInferenceTime = 0;

    // Process each chunk
    for (let i = 0; i < chunksToProcess.length; i++) {
      const chunk = chunksToProcess[i];
      const chunkInstruction = `${instruction}\n\nNote: This is chunk ${i + 1} of ${chunksToProcess.length}. Extract relevant information from this section of the page.`;

      try {
        this.logger({
          category: 'extraction',
          message: `Processing chunk ${i + 1}/${chunksToProcess.length} (${Math.round(chunk.length / 1024)}KB)`,
          level: 1,
        });

        const chunkResponse = await extract({
          instruction: chunkInstruction,
          domElements: chunk,
          schema: transformedSchema,
          chunksSeen: i + 1,
          chunksTotal: chunksToProcess.length,
          llmClient,
          requestId: `${requestId}_chunk_${i + 1}`,
          userProvidedInstructions: this.userProvidedInstructions,
          logger: this.logger,
          logInferenceToFile: false,
        });

        // Add delay between chunks to avoid rate limiting (except for last chunk)
        if (i < chunksToProcess.length - 1) {
          this.logger({
            category: 'extraction',
            message: 'Waiting 2 seconds to avoid rate limiting',
            level: 1,
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Accumulate tokens and timing
        totalPromptTokens += chunkResponse.prompt_tokens || 0;
        totalCompletionTokens += chunkResponse.completion_tokens || 0;
        totalInferenceTime += chunkResponse.inference_time_ms || 0;

        // Extract the content (exclude metadata and token counts)
        const chunkResult = Object.fromEntries(
          Object.entries(chunkResponse).filter(
            ([key]) =>
              !['metadata', 'prompt_tokens', 'completion_tokens', 'inference_time_ms'].includes(key)
          )
        );

        results.push(chunkResult as unknown as Partial<z.infer<T>>);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if it's a rate limit error
        if (errorMessage.includes('rate_limit_exceeded') || errorMessage.includes('Rate limit')) {
          this.logger({
            category: 'extraction',
            message: `Rate limit hit on chunk ${i + 1}, waiting 10 seconds before retrying`,
            level: 1,
          });

          // Wait longer for rate limit errors
          await new Promise(resolve => setTimeout(resolve, 10000));

          // Retry this chunk once
          try {
            this.logger({
              category: 'extraction',
              message: `Retrying chunk ${i + 1}/${chunksToProcess.length} after rate limit`,
              level: 1,
            });

            const retryResponse = await extract({
              instruction: chunkInstruction,
              domElements: chunk,
              schema: transformedSchema,
              chunksSeen: i + 1,
              chunksTotal: chunksToProcess.length,
              llmClient,
              requestId: `${requestId}_chunk_${i + 1}_retry`,
              userProvidedInstructions: this.userProvidedInstructions,
              logger: this.logger,
              logInferenceToFile: false,
            });

            totalPromptTokens += retryResponse.prompt_tokens || 0;
            totalCompletionTokens += retryResponse.completion_tokens || 0;
            totalInferenceTime += retryResponse.inference_time_ms || 0;

            const retryResult = Object.fromEntries(
              Object.entries(retryResponse).filter(
                ([key]) =>
                  !['metadata', 'prompt_tokens', 'completion_tokens', 'inference_time_ms'].includes(
                    key
                  )
              )
            );

            results.push(retryResult as unknown as Partial<z.infer<T>>);
          } catch (retryError) {
            this.logger({
              category: 'extraction',
              message: `Failed to retry chunk ${i + 1} after rate limit: ${retryError}`,
              level: 1,
            });
            // Continue with other chunks
          }
        } else {
          this.logger({
            category: 'extraction',
            message: `Failed to process chunk ${i + 1}: ${errorMessage}`,
            level: 1,
          });
          // Continue with other chunks
        }
      }
    }

    // Merge results intelligently
    const mergedResult = this._mergeChunkResults(results, schema);

    this.logger({
      category: 'extraction',
      message: `Chunked extraction completed. Processed ${results.length}/${chunks.length} chunks successfully`,
      level: 1,
      auxiliary: {
        successfulChunks: {
          value: results.length.toString(),
          type: 'integer',
        },
        totalChunks: {
          value: chunks.length.toString(),
          type: 'integer',
        },
      },
    });

    return {
      ...mergedResult,
      metadata: { completed: results.length > 0 },
      prompt_tokens: totalPromptTokens,
      completion_tokens: totalCompletionTokens,
      inference_time_ms: totalInferenceTime,
    };
  }

  /**
   * Create intelligent chunks by finding natural breakpoints
   */
  private _createIntelligentChunks(content: string, maxChunkSize: number): string[] {
    if (content.length <= maxChunkSize) {
      return [content];
    }

    const chunks: string[] = [];
    let currentPos = 0;

    while (currentPos < content.length) {
      let chunkEnd = Math.min(currentPos + maxChunkSize, content.length);

      // If not at the end, try to find a natural breakpoint
      if (chunkEnd < content.length) {
        // Look for natural breakpoints in order of preference
        const breakpoints = [
          '\n\n', // Paragraph breaks
          '\n', // Line breaks
          '. ', // Sentence breaks
          ', ', // Clause breaks
          ' ', // Word breaks
        ];

        let bestBreakpoint = chunkEnd;

        for (const breakpoint of breakpoints) {
          const lastBreakpoint = content.lastIndexOf(breakpoint, chunkEnd);
          if (lastBreakpoint > currentPos + maxChunkSize * 0.7) {
            // At least 70% of max size
            bestBreakpoint = lastBreakpoint + breakpoint.length;
            break;
          }
        }

        chunkEnd = bestBreakpoint;
      }

      const chunk = content.slice(currentPos, chunkEnd).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      currentPos = chunkEnd;
    }

    return chunks;
  }

  /**
   * Merge results from multiple chunks intelligently
   */
  private _mergeChunkResults<T extends z.ZodObject<z.ZodRawShape>>(
    results: Array<Partial<z.infer<T>>>,
    schema: T
  ): Partial<z.infer<T>> {
    if (results.length === 0) {
      return {};
    }

    if (results.length === 1) {
      return results[0];
    }

    const merged: Record<string, unknown> = {};

    // Get schema shape to understand field types
    const schemaShape = schema.shape;

    for (const key in schemaShape) {
      const values = results
        .map(r => r[key])
        .filter(v => v !== undefined && v !== null && v !== '');

      if (values.length === 0) {
        merged[key] = '';
        continue;
      }

      // For all fields, try to concatenate unique non-empty values
      // This works well for string fields and provides reasonable fallback for others
      if (values.length > 1) {
        const stringValues = values.map(v => String(v)).filter(v => v.trim().length > 0);
        const uniqueValues = [...new Set(stringValues)];
        merged[key] = uniqueValues.join(' ').trim();
      } else {
        merged[key] = values[0];
      }
    }

    return merged as Partial<z.infer<T>>;
  }

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
      const page = await this.browserWindow.getCurrentPage();

      // Get AI-formatted accessibility snapshot with aria-ref identifiers
      const aiSnapshot = await page.snapshotForAI();

      this.logger({
        category: 'extraction',
        message: `Retrieved accessibility tree data${targetXpath ? ` for xpath: ${targetXpath}` : ''}: ${aiSnapshot.length} characters`,
        level: 1,
        auxiliary: {
          snapshotLength: {
            value: aiSnapshot.length.toString(),
            type: 'integer',
          },
          targetXpath: {
            value: targetXpath || 'none',
            type: 'string',
          },
        },
      });

      // Extract aria-ref mappings from the snapshot for URL injection
      const idToUrl: Record<string, string> = {};

      // Parse aria-ref identifiers from snapshot (e.g., [ref=e123], [ref=f1e45])
      const ariaRefMatches = aiSnapshot.match(/\[ref=([ef]\d+e?\d*)\]/g);
      if (ariaRefMatches) {
        ariaRefMatches.forEach(match => {
          const refId = match.match(/ref=([ef]\d+e?\d*)/)?.[1];
          if (refId) {
            // For now, we don't have URL mappings, but preserve the structure
            idToUrl[refId] = '';
          }
        });
      }

      // Extract iframe information from frame references (refs starting with 'f')
      const iframes: Array<{ nodeId: string }> = [];
      const frameRefMatches = aiSnapshot.match(/\[ref=(f\d+e?\d*)\]/g);
      if (frameRefMatches) {
        frameRefMatches.forEach((match, index) => {
          const frameRefId = match.match(/ref=(f\d+e?\d*)/)?.[1];
          if (frameRefId) {
            iframes.push({
              nodeId: index.toString(),
            });
          }
        });
      }

      return {
        simplified: aiSnapshot,
        idToUrl,
        iframes,
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
      const page = await this.browserWindow.getCurrentPage();

      // Get AI-formatted accessibility snapshot with aria-ref identifiers
      const aiSnapshot = await page.snapshotForAI();

      this.logger({
        category: 'extraction',
        message: `Retrieved accessibility tree with frames${targetXpath ? ` for xpath: ${targetXpath}` : ''}: ${aiSnapshot.length} characters`,
        level: 1,
        auxiliary: {
          snapshotLength: {
            value: aiSnapshot.length.toString(),
            type: 'integer',
          },
          targetXpath: {
            value: targetXpath || 'none',
            type: 'string',
          },
          frameAware: {
            value: 'true',
            type: 'boolean',
          },
        },
      });

      // Extract aria-ref mappings from the snapshot
      const combinedUrlMap: Record<EncodedId, string> = {};
      const combinedXpathMap: Record<EncodedId, string> = {};

      // Parse aria-ref identifiers from snapshot (e.g., [ref=e123], [ref=f1e45])
      const ariaRefMatches = aiSnapshot.match(/\[ref=([ef]\d+e?\d*)\]/g);
      if (ariaRefMatches) {
        ariaRefMatches.forEach(match => {
          const refId = match.match(/ref=([ef]\d+e?\d*)/)?.[1];
          if (refId) {
            // For now, we don't have URL mappings, but preserve the structure
            combinedUrlMap[refId as EncodedId] = '';
            combinedXpathMap[refId as EncodedId] = `aria-ref=${refId}`;
          }
        });
      }

      // Extract iframe information from frame references (refs starting with 'f')
      const discoveredIframes: Array<{ nodeId: string }> = [];
      const frameRefMatches = aiSnapshot.match(/\[ref=(f\d+e?\d*)\]/g);
      if (frameRefMatches) {
        frameRefMatches.forEach((match, index) => {
          const frameRefId = match.match(/ref=(f\d+e?\d*)/)?.[1];
          if (frameRefId) {
            discoveredIframes.push({
              nodeId: index.toString(),
            });
          }
        });

        this.logger({
          category: 'extraction',
          message: `Discovered ${discoveredIframes.length} iframe references in accessibility tree`,
          level: 1,
        });
      }

      return {
        combinedTree: aiSnapshot,
        combinedUrlMap,
        combinedXpathMap,
        discoveredIframes,
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
  const shape = schema._def.shape as Record<string, z.ZodTypeAny>;
  const newShape: Record<string, z.ZodTypeAny> = {};
  const urlPaths: ZodPathSegments[] = [];
  let changed = false;

  for (const [key, value] of Object.entries(shape)) {
    const [childTransformed, childPaths] = transformSchema(value as z.ZodTypeAny, [key]);
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
