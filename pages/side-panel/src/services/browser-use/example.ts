import { BrowserWindow } from '../cordyceps/browserWindow';
import { ChatOpenAI } from '@langchain/openai';
import { Agent } from './agent/service';

export const run = async (browser: BrowserWindow, openAIApiKey: string): Promise<void> => {
  console.log(
    'Browser initialized, running example with API key:',
    openAIApiKey.slice(0, 8) + '...',
  );

  try {
    const llm = new ChatOpenAI({
      openAIApiKey,
      modelName: 'gpt-4o',
      temperature: 0.0,
    });

    const task =
      'Navigate to the browser-use GitHub repository at https://github.com/browser-use/browser-use and find information about the project and its contributors';
    const agent = new Agent(task, llm, { browser });
    await agent.run();
  } catch (error) {
    console.error('Failed to create new page:', error);
    throw error;
  }
};
