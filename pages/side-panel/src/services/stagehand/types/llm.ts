// Define a minimal LanguageModel interface locally to avoid relying on a non-existent export from 'ai'
export interface LanguageModel {
  /**
   * Generate a textual response from the model given a prompt.
   * Implementations may accept additional model-specific options.
   */
  generate(prompt: string, options?: Record<string, unknown>): Promise<string>;
}

export interface LLMTool {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export type AISDKProvider = (modelName: string) => LanguageModel;
// Represents a function that takes options (like apiKey) and returns an AISDKProvider
export type AISDKCustomProvider = (options: { apiKey: string }) => AISDKProvider;
