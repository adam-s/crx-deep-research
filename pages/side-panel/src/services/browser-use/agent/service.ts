import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { BrowserWindow } from '../../cordyceps/browserWindow';
import { Disposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { SimpleEventEmitter } from '@src/utils/SimpleEventEmitter';
import { EventMessage, Severity } from '@src/utils/types';

export interface AgentOptions {
  browser: BrowserWindow;
}

/**
 * Simplified Agent service with only essential properties
 */
export class Agent extends Disposable {
  task: string;
  llm: BaseChatModel;
  browser: BrowserWindow;

  readonly events = this._register(new SimpleEventEmitter<EventMessage>('BrowserUseAgent'));
  public readonly onEvent: Event<EventMessage> = this.events.event;

  constructor(task: string, llm: BaseChatModel, options: AgentOptions) {
    super();
    this.task = task;
    this.llm = llm;
    this.browser = options.browser;
  }

  /**
   * Run the agent - currently just logs that it ran
   */
  async run(): Promise<void> {
    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Info,
      message: 'Agent starting execution',
      details: {
        task: this.task,
        model: this.llm.constructor.name,
      },
    });

    this.events.emit({
      timestamp: Date.now(),
      severity: Severity.Success,
      message: 'Agent ran successfully',
      details: {
        task: this.task,
        model: this.llm.constructor.name,
      },
    });

    console.log('Agent ran successfully');
    console.log(`Task: ${this.task}`);
    console.log(`Model: ${this.llm.constructor.name}`);
    console.log('Browser:', this.browser);
  }
}
