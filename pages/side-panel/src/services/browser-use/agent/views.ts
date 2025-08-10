import { v4 as uuidv4 } from 'uuid';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ActionModel } from '../controller/registry/views';
import { BrowserStateHistory } from '../browser/views';
import { SelectorMap } from '../dom/views';

// Forward declarations to avoid circular imports
import { MessageManagerState } from './message_manager/views';

// Import types from DOM module
interface DOMElementNode {
  [key: string]: any;
}

interface DOMHistoryElement {
  [key: string]: any;
}

// Mock HistoryTreeProcessor for type compatibility
class HistoryTreeProcessor {
  static convertDomElementToHistoryElement(el: DOMElementNode): DOMHistoryElement {
    return el as unknown as DOMHistoryElement;
  }
}

export type ToolCallingMethod = 'function_calling' | 'json_mode' | 'raw' | 'auto';

// Define Zod schemas and classes for each model, similar to Pydantic in Python

// AgentSettings interface
export interface IAgentSettings {
  useVision: boolean;
  useVisionForPlanner: boolean;
  saveConversationPath: string | null;
  saveConversationPathEncoding: string | null;
  maxFailures: number;
  retryDelay: number;
  maxInputTokens: number;
  validateOutput: boolean;
  messageContext: string | null;
  generateGif: boolean | string;
  availableFilePaths: string[] | null;
  overrideSystemMessage: string | null;
  extendSystemMessage: string | null;
  includeAttributes: string[];
  maxActionsPerStep: number;
  toolCallingMethod: ToolCallingMethod | null;
  pageExtractionLlm: BaseChatModel | null;
  plannerLlm: BaseChatModel | null;
  plannerInterval: number;
}

// AgentSettings schema as a plain JavaScript object
export const AgentSettingsSchema = {
  type: 'object',
  properties: {
    useVision: { type: 'boolean', default: true },
    useVisionForPlanner: { type: 'boolean', default: false },
    saveConversationPath: { type: ['string', 'null'], default: null },
    saveConversationPathEncoding: { type: ['string', 'null'], default: 'utf-8' },
    maxFailures: { type: 'number', default: 3 },
    retryDelay: { type: 'number', default: 10 },
    maxInputTokens: { type: 'number', default: 128000 },
    validateOutput: { type: 'boolean', default: false },
    messageContext: { type: ['string', 'null'], default: null },
    generateGif: { type: ['boolean', 'string'], default: false },
    availableFilePaths: { type: ['array', 'null'], items: { type: 'string' }, default: null },
    overrideSystemMessage: { type: ['string', 'null'], default: null },
    extendSystemMessage: { type: ['string', 'null'], default: null },
    includeAttributes: {
      type: 'array',
      items: { type: 'string' },
      default: [
        'title',
        'type',
        'name',
        'role',
        'tabindex',
        'aria-label',
        'placeholder',
        'value',
        'alt',
        'aria-expanded',
      ],
    },
    maxActionsPerStep: { type: 'number', default: 10 },
    toolCallingMethod: {
      type: ['string', 'null'],
      enum: ['function_calling', 'json_mode', 'raw', 'auto'],
      default: 'auto',
    },
    pageExtractionLlm: { type: ['object', 'null'], default: null },
    plannerLlm: { type: ['object', 'null'], default: null },
    plannerInterval: { type: 'number', default: 1 },
  },
  required: [
    'useVision',
    'maxFailures',
    'retryDelay',
    'maxInputTokens',
    'validateOutput',
    'includeAttributes',
    'maxActionsPerStep',
  ],
};

export class AgentSettings implements IAgentSettings {
  /**
   * Options for the agent
   */
  useVision: boolean = true;
  useVisionForPlanner: boolean = false;
  saveConversationPath: string | null = null;
  saveConversationPathEncoding: string | null = 'utf-8';
  maxFailures: number = 3;
  retryDelay: number = 10;
  maxInputTokens: number = 128000;
  validateOutput: boolean = false;
  messageContext: string | null = null;
  generateGif: boolean | string = false;
  availableFilePaths: string[] | null = null;
  overrideSystemMessage: string | null = null;
  extendSystemMessage: string | null = null;
  includeAttributes: string[] = [
    'title',
    'type',
    'name',
    'role',
    'tabindex',
    'aria-label',
    'placeholder',
    'value',
    'alt',
    'aria-expanded',
  ];
  maxActionsPerStep: number = 10;
  toolCallingMethod: ToolCallingMethod | null = 'auto';
  pageExtractionLlm: BaseChatModel | null = null;
  plannerLlm: BaseChatModel | null = null;
  plannerInterval: number = 1; // Run planner every N steps

  static schema = AgentSettingsSchema;

  constructor(data?: Partial<IAgentSettings>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}

// AgentHistoryList class
export class AgentHistoryList {
  /**
   * List of agent history items
   */
  history: AgentHistory[] = [];

  totalDurationSeconds(): number {
    /**
     * Calculate total duration of all steps in seconds
     */
    return this.history.reduce((total, item) => {
      if (item.metadata) {
        return total + item.metadata.durationSeconds;
      }
      return total;
    }, 0);
  }

  averageDurationSeconds(): number {
    /**
     * Calculate average duration of steps in seconds
     */
    if (this.history.length === 0) {
      return 0;
    }
    const historyWithMetadata = this.history.filter(item => item.metadata !== null);
    if (historyWithMetadata.length === 0) {
      return 0;
    }
    return this.totalDurationSeconds() / historyWithMetadata.length;
  }

  totalInputTokens(): number {
    /**
     * Calculate total input tokens for all steps
     */
    return this.history.reduce((total, item) => {
      if (item.metadata) {
        return total + item.metadata.inputTokens;
      }
      return total;
    }, 0);
  }

  averageInputTokens(): number {
    /**
     * Calculate average input tokens per step
     */
    if (this.history.length === 0) {
      return 0;
    }
    const historyWithMetadata = this.history.filter(item => item.metadata !== null);
    if (historyWithMetadata.length === 0) {
      return 0;
    }
    return this.totalInputTokens() / historyWithMetadata.length;
  }

  isDone(): boolean {
    /**
     * Check if the agent has completed its task
     */
    if (this.history.length === 0) {
      return false;
    }

    // Check if the last action result indicates completion
    const lastHistory = this.history[this.history.length - 1];
    if (lastHistory && lastHistory.result && lastHistory.result.length > 0) {
      const lastResult = lastHistory.result[lastHistory.result.length - 1];
      return lastResult ? lastResult.isDone === true : false;
    }

    return false;
  }

  toJSON(): any[] {
    /**
     * Serialize history list to JSON
     */
    return this.history.map(item => item.toJSON());
  }
}

// AgentState interface
export interface IAgentState {
  agentId: string;
  nSteps: number;
  consecutiveFailures: number;
  lastResult: ActionResult[] | null;
  history: AgentHistoryList;
  lastPlan: string | null;
  paused: boolean;
  stopped: boolean;
  messageManagerState: MessageManagerState;
  errorHistory: Record<string, number>;
}

// AgentState schema as a plain JavaScript object
export const AgentStateSchema = {
  type: 'object',
  properties: {
    agentId: { type: 'string', default: uuidv4() },
    nSteps: { type: 'number', default: 1 },
    consecutiveFailures: { type: 'number', default: 0 },
    lastResult: { type: ['array', 'null'], default: null },
    history: { type: 'object', default: new AgentHistoryList() },
    lastPlan: { type: ['string', 'null'], default: null },
    paused: { type: 'boolean', default: false },
    stopped: { type: 'boolean', default: false },
    messageManagerState: { type: 'object', default: new MessageManagerState() },
    errorHistory: { type: 'object', default: {} },
  },
  required: [
    'agentId',
    'nSteps',
    'consecutiveFailures',
    'history',
    'paused',
    'stopped',
    'messageManagerState',
    'errorHistory',
  ],
};

export class AgentState implements IAgentState {
  /**
   * Holds all state information for an Agent
   */
  agentId: string = uuidv4();
  nSteps: number = 1;
  consecutiveFailures: number = 0;
  lastResult: ActionResult[] | null = null;
  history: AgentHistoryList = new AgentHistoryList();
  lastPlan: string | null = null;
  paused: boolean = false;
  stopped: boolean = false;
  messageManagerState: MessageManagerState = new MessageManagerState();
  errorHistory: Record<string, number> = {};

  static schema = AgentStateSchema;

  constructor(data?: Partial<IAgentState>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}

// AgentStepInfo interface
export interface IAgentStepInfo {
  stepNumber: number;
  maxSteps: number;
}

// AgentStepInfo schema as a plain JavaScript object
export const AgentStepInfoSchema = {
  type: 'object',
  properties: {
    stepNumber: { type: 'number' },
    maxSteps: { type: 'number' },
  },
  required: ['stepNumber', 'maxSteps'],
};

export class AgentStepInfo implements IAgentStepInfo {
  /**
   * Information about the current step
   */
  stepNumber: number;
  maxSteps: number;

  static schema = AgentStepInfoSchema;

  constructor(stepNumber: number, maxSteps: number) {
    this.stepNumber = stepNumber;
    this.maxSteps = maxSteps;
  }

  isLastStep(): boolean {
    /**
     * Check if this is the last step
     */
    return this.stepNumber >= this.maxSteps - 1;
  }
}

// ActionResult interface
export interface IActionResult {
  isDone: boolean | null;
  success: boolean | null;
  extractedContent: string | null;
  error?: string | null;
  includeInMemory: boolean;
}

// ActionResult schema as a plain JavaScript object
export const ActionResultSchema = {
  type: 'object',
  properties: {
    isDone: { type: ['boolean', 'null'], default: false },
    success: { type: ['boolean', 'null'], default: null },
    extractedContent: { type: ['string', 'null'], default: null },
    error: { type: ['string', 'null'] },
    includeInMemory: { type: 'boolean', default: false },
  },
  required: ['isDone', 'success', 'extractedContent', 'includeInMemory'],
};

export class ActionResult implements IActionResult {
  /**
   * Result of executing an action
   */
  isDone: boolean | null = false;
  success: boolean | null = null;
  extractedContent: string | null = null;
  error?: string | null = null;
  includeInMemory: boolean = false; // whether to include in past messages as context or not

  static schema = ActionResultSchema;

  constructor(params: Partial<IActionResult> = {}) {
    if (params.isDone !== undefined) this.isDone = params.isDone;
    if (params.success !== undefined) this.success = params.success;
    if (params.extractedContent !== undefined) this.extractedContent = params.extractedContent;
    if (params.error !== undefined) this.error = params.error;
    if (params.includeInMemory !== undefined) this.includeInMemory = params.includeInMemory;
  }
}

// StepMetadata interface
export interface IStepMetadata {
  stepStartTime: number;
  stepEndTime: number;
  inputTokens: number;
  stepNumber: number;
  readonly durationSeconds: number;
}

// StepMetadata schema as a plain JavaScript object
export const StepMetadataSchema = {
  type: 'object',
  properties: {
    stepStartTime: { type: 'number' },
    stepEndTime: { type: 'number' },
    inputTokens: { type: 'number' },
    stepNumber: { type: 'number' },
    durationSeconds: { type: 'number' },
  },
  required: ['stepStartTime', 'stepEndTime', 'inputTokens', 'stepNumber'],
};

export class StepMetadata implements IStepMetadata {
  /**
   * Metadata for a single step including timing and token information
   */
  stepStartTime: number;
  stepEndTime: number;
  inputTokens: number; // Approximate tokens from message manager for this step
  stepNumber: number;

  static schema = StepMetadataSchema;

  constructor(stepStartTime: number, stepEndTime: number, inputTokens: number, stepNumber: number) {
    this.stepStartTime = stepStartTime;
    this.stepEndTime = stepEndTime;
    this.inputTokens = inputTokens;
    this.stepNumber = stepNumber;
  }

  get durationSeconds(): number {
    /**
     * Calculate step duration in seconds
     */
    return this.stepEndTime - this.stepStartTime;
  }
}

// AgentBrain interface
export interface IAgentBrain {
  evaluation_previous_goal: string;
  memory: string;
  next_goal: string;
}

// AgentBrain schema as a plain JavaScript object
export const AgentBrainSchema = {
  type: 'object',
  properties: {
    evaluation_previous_goal: { type: 'string' },
    memory: { type: 'string' },
    next_goal: { type: 'string' },
  },
  required: ['evaluation_previous_goal', 'memory', 'next_goal'],
};

export class AgentBrain {
  /**
   * Current state of the agent
   */
  evaluationPreviousGoal: string;
  memory: string;
  nextGoal: string;

  static schema = AgentBrainSchema;

  constructor(evaluationPreviousGoal: string, memory: string, nextGoal: string) {
    this.evaluationPreviousGoal = evaluationPreviousGoal;
    this.memory = memory;
    this.nextGoal = nextGoal;
  }
}

// AgentOutput interface
export interface IAgentOutput {
  current_state: IAgentBrain;
  action: ActionModel[];
}

// AgentOutput schema as a plain JavaScript object
export const AgentOutputSchema = {
  type: 'object',
  properties: {
    current_state: AgentBrainSchema,
    action: {
      type: 'array',
      items: {
        type: 'object',
      },
      description: 'List of actions to execute (at least one action is required)',
    },
  },
  required: ['current_state', 'action'],
};

// DoneAgentOutput interface
export interface IDoneAgentOutput {
  current_state: IAgentBrain;
  action: Array<{
    done: {
      text: string;
      success: boolean;
    };
  }>;
}

// DoneAgentOutput schema as a plain JavaScript object
export const DoneAgentOutputSchema = {
  type: 'object',
  properties: {
    current_state: AgentBrainSchema,
    action: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          done: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              success: { type: 'boolean' },
            },
            required: ['text', 'success'],
          },
        },
        required: ['done'],
      },
      description: 'Done action with text and success properties',
    },
  },
  required: ['current_state', 'action'],
};

export class AgentOutput implements IAgentOutput {
  /**
   * Output model for agent
   *
   * @dev note: this model is extended with custom actions in AgentService. You can also use some fields that are not in this model as provided by the linter, as long as they are registered in the DynamicActions model.
   */
  currentState: AgentBrain;
  action: ActionModel[];

  // Schema definition for structured output
  static schema = AgentOutputSchema;

  constructor(data: any) {
    this.currentState = new AgentBrain(
      data.current_state?.evaluation_previous_goal || '',
      data.current_state?.memory || '',
      data.current_state?.next_goal || '',
    );
    // Convert action array to ActionModel instances
    this.action = (data.action || []).map((actionData: any) => {
      return new ActionModel(actionData);
    });
  }

  static typeWithCustomActions(_customActions: typeof ActionModel): typeof AgentOutput {
    /**
     * Extend actions with custom actions
     */
    return AgentOutput;
  }

  // Getter for current_state to match interface
  get current_state(): IAgentBrain {
    return {
      evaluation_previous_goal: this.currentState.evaluationPreviousGoal,
      memory: this.currentState.memory,
      next_goal: this.currentState.nextGoal,
    };
  }
}

export class DoneAgentOutput implements IDoneAgentOutput {
  /**
   * Output model for agent when it's done
   */
  currentState: AgentBrain;
  action: Array<{
    done: {
      text: string;
      success: boolean;
    };
  }>;
  done: true = true;
  reason?: string;

  // Schema definition for structured output
  static schema = DoneAgentOutputSchema;

  constructor(data: any) {
    this.currentState = new AgentBrain(
      data.current_state?.evaluation_previous_goal || '',
      data.current_state?.memory || '',
      data.current_state?.next_goal || '',
    );
    // Convert action array to ActionModel instances with done property
    this.action = (data.action || []).map((actionData: any) => {
      if (actionData instanceof ActionModel) {
        const actionObj = actionData.toJSON();
        return {
          done: {
            text: actionObj['done']?.text || '',
            success: actionObj['done']?.success || false,
          },
        };
      }
      return {
        done: {
          text: actionData['done']?.text || '',
          success: actionData['done']?.success || false,
        },
      };
    });
    if (data.reason) {
      this.reason = data.reason;
    }
  }

  static typeWithCustomActions(_customActions: typeof ActionModel): typeof DoneAgentOutput {
    /**
     * Extend actions with custom actions
     */
    return DoneAgentOutput;
  }

  // Getter for current_state to match interface
  get current_state(): IAgentBrain {
    return {
      evaluation_previous_goal: this.currentState.evaluationPreviousGoal,
      memory: this.currentState.memory,
      next_goal: this.currentState.nextGoal,
    };
  }
}

// Forward declare AgentHistory for use in AgentHistoryList
export class AgentHistory {
  /**
   * History item for agent actions
   */
  modelOutput: AgentOutput | null;
  result: ActionResult[];
  state: BrowserStateHistory;
  metadata: StepMetadata | null;

  constructor(
    modelOutput: AgentOutput | null,
    result: ActionResult[],
    state: BrowserStateHistory,
    metadata: StepMetadata | null = null,
  ) {
    this.modelOutput = modelOutput;
    this.result = result;
    this.state = state;
    this.metadata = metadata;
  }

  static getInteractedElement(
    modelOutput: AgentOutput,
    selectorMap: SelectorMap,
  ): (DOMHistoryElement | null)[] {
    const elements: (DOMHistoryElement | null)[] = [];
    for (const action of modelOutput.action) {
      const index = typeof action.getIndex === 'function' ? action.getIndex() : null;
      if (index !== null && index in selectorMap) {
        const el: DOMElementNode = selectorMap[index] as DOMElementNode;
        elements.push(HistoryTreeProcessor.convertDomElementToHistoryElement(el));
      } else {
        elements.push(null);
      }
    }
    return elements;
  }

  toJSON(): any {
    /**
     * Custom serialization handling circular references
     */
    let modelOutputDump = null;
    if (this.modelOutput) {
      const actionDump = this.modelOutput.action.map(action => {
        const actionObj: Record<string, any> = {};
        for (const key in action) {
          if (key !== 'undefined' && (action as Record<string, any>)[key] !== undefined) {
            actionObj[key] = (action as Record<string, any>)[key];
          }
        }
        return actionObj;
      });

      modelOutputDump = {
        currentState: this.modelOutput.currentState,
        action: actionDump,
      };
    }

    return {
      modelOutput: modelOutputDump,
      result: this.result.map(r => {
        const resultObj: Record<string, any> = {};
        for (const key in r) {
          if (
            (r as Record<string, any>)[key] !== undefined &&
            (r as Record<string, any>)[key] !== null
          ) {
            resultObj[key] = (r as Record<string, any>)[key];
          }
        }
        return resultObj;
      }),
      state: this.state.toDict(),
      metadata: this.metadata,
    };
  }
}

export class AgentError {
  /**
   * Container for agent error handling
   */
  static VALIDATION_ERROR = 'Invalid model output format. Please follow the correct schema.';
  static RATE_LIMIT_ERROR = 'Rate limit reached. Waiting before retry.';
  static NO_VALID_ACTION = 'No valid action found';

  static formatError(error: Error, includeTrace: boolean = false): string {
    /**
     * Format error message based on error type and optionally include trace
     */
    let message = error.message;
    if (includeTrace && error.stack) {
      message += '\n' + error.stack;
    }
    return message;
  }
}
