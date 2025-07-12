import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { Disposable } from 'vs/base/common/lifecycle';
import OpenAI from 'openai';
import { InteractiveElement } from '@shared/markers';
import { StorageKeys } from '@shared/storage/types/storage.types';

export const ILLMService = createDecorator<ILLMService>('llmService');

export interface LLMDecision {
  action: 'click' | 'type' | 'navigate' | 'extract' | 'wait' | 'complete';
  elementIndex?: number;
  value?: string;
  url?: string;
  reasoning: string;
  confidence: number;
}

export interface ILLMService {
  readonly _serviceBrand: undefined;

  makeDecision(
    query: string,
    elements: InteractiveElement[],
    pageContext?: string,
  ): Promise<LLMDecision>;
  extractContent(htmlContent: string, query?: string): Promise<string>;
  generateSearchQuery(topic: string): Promise<string>;
  evaluateCompletion(
    task: string,
    currentContent: string,
  ): Promise<{ completed: boolean; reason: string }>;
}

export class LLMService extends Disposable implements ILLMService {
  readonly _serviceBrand: undefined;
  private openai: OpenAI | null = null;

  constructor(@IStorageService private storageService: IStorageService) {
    super();
  }

  private async getOpenAIClient(): Promise<OpenAI> {
    if (!this.openai) {
      const apiKey = await this.storageService.get(StorageKeys.OPEN_AI_API_KEY);
      if (!apiKey) {
        throw new Error('OpenAI API key not found. Please set it in settings.');
      }
      this.openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    }
    return this.openai;
  }

  async makeDecision(
    query: string,
    elements: InteractiveElement[],
    pageContext?: string,
  ): Promise<LLMDecision> {
    const client = await this.getOpenAIClient();

    const elementsDescription = elements
      .slice(0, 20)
      .map(
        (el, i) =>
          `${i}: ${el.type} - "${el.description || el.text || 'No description'}" (${el.inViewport ? 'visible' : 'hidden'})`,
      )
      .join('\n');

    const prompt = `You are a web automation assistant. Given a task and available page elements, decide what action to take next.

Task: ${query}

Page Context: ${pageContext || 'Current webpage'}

Available Elements (showing first 20):
${elementsDescription}

Respond with a JSON object containing:
- action: 'click' | 'type' | 'navigate' | 'extract' | 'wait' | 'complete'
- elementIndex: number (if clicking/typing on an element)
- value: string (if typing text or navigating to URL)
- url: string (if navigating)
- reasoning: string (explain your decision)
- confidence: number (0.0 to 1.0)

Focus on visible elements when possible. If the task seems complete, use 'complete' action.`;

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      // Try to parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response format from LLM');
      }

      const decision = JSON.parse(jsonMatch[0]) as LLMDecision;

      // Validate the decision
      if (!['click', 'type', 'navigate', 'extract', 'wait', 'complete'].includes(decision.action)) {
        throw new Error(`Invalid action: ${decision.action}`);
      }

      return decision;
    } catch (error) {
      console.error('LLM decision error:', error);
      // Return a fallback decision
      return {
        action: 'wait',
        reasoning: `Error making decision: ${error}`,
        confidence: 0.1,
      };
    }
  }

  async extractContent(htmlContent: string, query?: string): Promise<string> {
    const client = await this.getOpenAIClient();

    const prompt = `Extract key information from the following HTML content.

${query ? `Specific focus: ${query}` : 'Extract the most important and relevant information.'}

HTML Content (truncated if needed):
${htmlContent.slice(0, 4000)}

Provide a concise summary of the key information found.`;

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      });

      return response.choices[0]?.message?.content || 'No content extracted';
    } catch (error) {
      console.error('Content extraction error:', error);
      return `Error extracting content: ${error}`;
    }
  }

  async generateSearchQuery(topic: string): Promise<string> {
    const client = await this.getOpenAIClient();

    const prompt = `Generate an effective search query for the topic: "${topic}"

Provide just the search query, no explanation.`;

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 100,
      });

      return response.choices[0]?.message?.content?.trim() || topic;
    } catch (error) {
      console.error('Search query generation error:', error);
      return topic;
    }
  }

  async evaluateCompletion(
    task: string,
    currentContent: string,
  ): Promise<{ completed: boolean; reason: string }> {
    const client = await this.getOpenAIClient();

    const prompt = `Evaluate if the following task has been completed based on the current page content.

Task: ${task}

Current Page Content:
${currentContent.slice(0, 3000)}

Respond with JSON containing:
- completed: boolean
- reason: string (explanation of your evaluation)`;

    try {
      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return { completed: false, reason: 'No response from LLM' };
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { completed: false, reason: 'Invalid response format' };
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Completion evaluation error:', error);
      return { completed: false, reason: `Error evaluating completion: ${error}` };
    }
  }
}

registerSingleton(ILLMService, LLMService, InstantiationType.Delayed);
