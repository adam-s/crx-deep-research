import {
  type CoreMessage,
  generateObject,
  generateText,
  type LanguageModel,
  NoObjectGeneratedError,
} from 'ai';
import { CreateChatCompletionOptions, LLMClient } from './LLMClient';
import { LogLine } from '../../types/log';
import { AvailableModel } from '../../types/model';
import { type ChatCompletion } from 'openai/resources/chat/completions';
import { LLMCache } from '../cache/LLMCache';

export class AISdkClient extends LLMClient {
  public type = 'aisdk' as const;
  private model: LanguageModel;
  private logger?: (message: LogLine) => void;
  private cache: LLMCache | undefined;
  private enableCaching: boolean;

  constructor({
    model,
    logger,
    enableCaching = false,
    cache,
  }: {
    model: LanguageModel;
    logger?: (message: LogLine) => void;
    enableCaching?: boolean;
    cache?: LLMCache;
  }) {
    // Advanced TypeScript: Safe model ID extraction with type narrowing
    const modelId =
      typeof model === 'string'
        ? model
        : (model as { modelId?: string }).modelId || 'unknown-model';
    super(modelId as AvailableModel);
    this.model = model;
    this.logger = logger;
    this.cache = cache;
    this.enableCaching = enableCaching;
  }

  private getModelId(): string {
    return typeof this.model === 'string'
      ? this.model
      : (this.model as { modelId?: string }).modelId || 'unknown-model';
  }

  async createChatCompletion<T = ChatCompletion>({
    options,
  }: CreateChatCompletionOptions): Promise<T> {
    this.logger?.({
      category: 'aisdk',
      message: 'creating chat completion',
      level: 2,
      auxiliary: {
        options: {
          value: JSON.stringify({ ...options, image: undefined }),
          type: 'object',
        },
        modelName: {
          value: this.getModelId(),
          type: 'string',
        },
      },
    });

    const cacheOptions = {
      model: this.getModelId(),
      messages: options.messages,
      response_model: options.response_model,
    };

    if (this.enableCaching && this.cache) {
      const cachedResponse = await this.cache.get<T>(
        cacheOptions,
        options.requestId ?? crypto.randomUUID()
      );
      if (cachedResponse) {
        this.logger?.({
          category: 'llm_cache',
          message: 'LLM cache hit - returning cached response',
          level: 1,
          auxiliary: {
            requestId: {
              value: options.requestId ?? 'unknown',
              type: 'string',
            },
            cachedResponse: {
              value: JSON.stringify(cachedResponse),
              type: 'object',
            },
          },
        });
        return cachedResponse;
      } else {
        this.logger?.({
          category: 'llm_cache',
          message: 'LLM cache miss - no cached response found',
          level: 1,
          auxiliary: {
            requestId: {
              value: options.requestId ?? 'unknown',
              type: 'string',
            },
          },
        });
      }
    }

    const formattedMessages: CoreMessage[] = options.messages.map(message => {
      if (Array.isArray(message.content)) {
        if (message.role === 'system') {
          return {
            role: 'system',
            content: message.content.map(c => ('text' in c ? c.text : '')).join('\n'),
          };
        }

        const contentParts = message.content.map(content => {
          if ('image_url' in content) {
            // Advanced TypeScript: Type guard for safe property access
            if (!content.image_url?.url) {
              throw new Error('Invalid image URL content');
            }
            return {
              type: 'image' as const,
              image: content.image_url.url,
            };
          } else {
            return {
              type: 'text' as const,
              text: content.text ?? '',
            };
          }
        });

        if (message.role === 'user') {
          return {
            role: 'user',
            content: contentParts,
          };
        } else {
          const textOnlyParts = contentParts.map(part => ({
            type: 'text' as const,
            text: part.type === 'image' ? '[Image]' : part.text,
          }));
          return {
            role: 'assistant',
            content: textOnlyParts,
          };
        }
      }

      return {
        role: message.role,
        content: message.content,
      };
    });

    let objectResponse: Awaited<ReturnType<typeof generateObject>>;
    const isGPT5 = this.getModelId().includes('gpt-5');
    if (options.response_model) {
      try {
        objectResponse = await generateObject({
          model: this.model,
          messages: formattedMessages,
          schema: options.response_model.schema,
          temperature: options.temperature,
          providerOptions: isGPT5
            ? {
                openai: {
                  textVerbosity: 'low', // Making these the default for gpt-5 for now
                  reasoningEffort: 'minimal',
                },
              }
            : undefined,
        });
      } catch (err) {
        if (NoObjectGeneratedError.isInstance(err)) {
          this.logger?.({
            category: 'AISDK error',
            message: err.message,
            level: 0,
            auxiliary: {
              cause: {
                value: JSON.stringify(err.cause ?? {}),
                type: 'object',
              },
              text: {
                value: err.text ?? '',
                type: 'string',
              },
              response: {
                value: JSON.stringify(err.response ?? {}),
                type: 'object',
              },
              usage: {
                value: JSON.stringify(err.usage ?? {}),
                type: 'object',
              },
              finishReason: {
                value: err.finishReason ?? 'unknown',
                type: 'string',
              },
              requestId: {
                value: options.requestId ?? 'unknown',
                type: 'string',
              },
            },
          });

          throw err;
        }
        throw err;
      }

      const result = {
        data: objectResponse.object,
        usage: {
          prompt_tokens: objectResponse.usage.inputTokens ?? 0,
          completion_tokens: objectResponse.usage.outputTokens ?? 0,
          total_tokens: objectResponse.usage.totalTokens ?? 0,
        },
      } as T;

      if (this.enableCaching) {
        this.logger?.({
          category: 'llm_cache',
          message: 'caching response',
          level: 1,
          auxiliary: {
            requestId: {
              value: options.requestId ?? 'unknown',
              type: 'string',
            },
            cacheOptions: {
              value: JSON.stringify(cacheOptions),
              type: 'object',
            },
            response: {
              value: JSON.stringify(result),
              type: 'object',
            },
          },
        });
        this.cache?.set(cacheOptions, result, options.requestId ?? crypto.randomUUID());
      }

      this.logger?.({
        category: 'aisdk',
        message: 'response',
        level: 2,
        auxiliary: {
          response: {
            value: JSON.stringify(objectResponse),
            type: 'object',
          },
          requestId: {
            value: options.requestId ?? 'unknown',
            type: 'string',
          },
        },
      });

      return result;
    }

    const tools: Record<string, { description: string; parameters: unknown }> = {};

    for (const rawTool of options.tools ?? []) {
      tools[rawTool.name] = {
        description: rawTool.description,
        parameters: rawTool.parameters,
      };
    }

    const textResponse = await generateText({
      model: this.model,
      messages: formattedMessages,
      temperature: options.temperature,
      // Note: Tools disabled until proper AI SDK v5 tool structure is implemented
      // tools,
    });

    const result = {
      data: textResponse.text,
      usage: {
        prompt_tokens: textResponse.usage.inputTokens ?? 0,
        completion_tokens: textResponse.usage.outputTokens ?? 0,
        total_tokens: textResponse.usage.totalTokens ?? 0,
      },
    } as T;

    if (this.enableCaching) {
      this.logger?.({
        category: 'llm_cache',
        message: 'caching response',
        level: 1,
        auxiliary: {
          requestId: {
            value: options.requestId ?? 'unknown',
            type: 'string',
          },
          cacheOptions: {
            value: JSON.stringify(cacheOptions),
            type: 'object',
          },
          response: {
            value: JSON.stringify(result),
            type: 'object',
          },
        },
      });
      this.cache?.set(cacheOptions, result, options.requestId ?? crypto.randomUUID());
    }

    this.logger?.({
      category: 'aisdk',
      message: 'response',
      level: 2,
      auxiliary: {
        response: {
          value: JSON.stringify(textResponse),
          type: 'object',
        },
        requestId: {
          value: options.requestId ?? 'unknown',
          type: 'string',
        },
      },
    });

    return result;
  }
}
