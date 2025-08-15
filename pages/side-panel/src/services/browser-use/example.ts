import { BrowserWindow } from '../cordyceps/browserWindow';
import { ChatOpenAI } from '@langchain/openai';
import { Agent } from './agent/service';
import { BrowserContext } from './browser/context';

export const run = async (browser: BrowserWindow, apiKey: string): Promise<void> => {
  console.log('Browser initialized, running example with API key:', apiKey.slice(0, 8) + '...');

  try {
    const llm = new ChatOpenAI({
      apiKey, // or omit if the env var is set
      model: 'gpt-4o',
      temperature: 0,
      useResponsesApi: true, // force Responses API
    });

    // Create BrowserContext from the BrowserWindow
    const browserContext = new BrowserContext(browser);

    const task =
      // eslint-disable-next-line max-len
      'Navigate to the browser-use GitHub repository at https://github.com/browser-use/browser-use and find information about the project and its contributors';
    const agent = new Agent(task, llm, { browserContext });

    // Register progress callbacks before running the agent so they receive events
    agent.registerNewStepCallback = async (state, modelOutput, step) => {
      // state: BrowserState, modelOutput: AgentOutput, step: number
      console.log('New agent step:', state, modelOutput, step);
      // Optionally log compact state or modelOutput for debugging
      // console.log('State snapshot:', { url: state?.url, title: state?.title });
    };

    agent.registerDoneCallback = async history => {
      console.log('Agent done:', history);
    };

    await agent.run();
  } catch (error) {
    console.error('Failed to create new page:', error);
    throw error;
  }
};
