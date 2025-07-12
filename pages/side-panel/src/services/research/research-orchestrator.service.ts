import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { Disposable } from 'vs/base/common/lifecycle';
import { observableValue, IObservable } from 'vs/base/common/observable';
import { ILLMService, type LLMDecision } from './llm.service';
import { IElementDetectionService } from './element-detection.service';
import { IDOMActionService } from './dom-action.service';
import { InteractiveElement } from '@shared/markers';

export const IResearchOrchestratorService = createDecorator<IResearchOrchestratorService>(
  'researchOrchestratorService',
);

export interface ResearchStep {
  id: string;
  type:
    | 'navigate'
    | 'detect-elements'
    | 'llm-decision'
    | 'dom-action'
    | 'extract-content'
    | 'evaluate';
  status: 'pending' | 'executing' | 'completed' | 'error';
  description: string;
  data?: any;
  error?: string;
  timestamp: number;
}

export interface ResearchState {
  isActive: boolean;
  currentTask: string | null;
  currentUrl: string | null;
  steps: ResearchStep[];
  currentStepIndex: number;
  elements: InteractiveElement[];
  lastAction: string | null;
  error: string | null;
  extractedContent: string[];
  researchComplete: boolean;
}

export interface IResearchOrchestratorService {
  readonly _serviceBrand: undefined;

  // Observable state for React components
  readonly researchState$: IObservable<ResearchState>;

  // Core research functions
  startSimpleResearch(query: string): Promise<void>;
  stopResearch(): Promise<void>;

  // Individual function testing (for quick testing phase)
  testElementDetection(): Promise<InteractiveElement[]>;
  testDOMAction(elementIndex: number, action: 'click' | 'type', value?: string): Promise<void>;
  testLLMDecision(query: string, elements: InteractiveElement[]): Promise<LLMDecision>;
  testContentExtraction(): Promise<string>;

  // Manual step execution
  executeNextStep(): Promise<void>;
  retryCurrentStep(): Promise<void>;
}

export class ResearchOrchestratorService
  extends Disposable
  implements IResearchOrchestratorService
{
  readonly _serviceBrand: undefined;

  private readonly _researchState = observableValue<ResearchState>('researchState', {
    isActive: false,
    currentTask: null,
    currentUrl: null,
    steps: [],
    currentStepIndex: -1,
    elements: [],
    lastAction: null,
    error: null,
    extractedContent: [],
    researchComplete: false,
  });

  public readonly researchState$ = this._researchState;

  constructor(
    @ILLMService private llmService: ILLMService,
    @IElementDetectionService private elementDetectionService: IElementDetectionService,
    @IDOMActionService private domActionService: IDOMActionService,
  ) {
    super();
  }

  async startSimpleResearch(query: string): Promise<void> {
    this.updateState(state => ({
      ...state,
      isActive: true,
      currentTask: query,
      steps: [
        {
          id: '1',
          type: 'detect-elements',
          status: 'pending',
          description: 'Detect interactive elements on page',
          timestamp: Date.now(),
        },
        {
          id: '2',
          type: 'llm-decision',
          status: 'pending',
          description: 'Get AI decision on next action',
          timestamp: Date.now(),
        },
      ],
      currentStepIndex: 0,
      error: null,
      lastAction: 'Research started',
    }));

    // Auto-execute first step
    await this.executeNextStep();
  }

  async stopResearch(): Promise<void> {
    this.updateState(state => ({
      ...state,
      isActive: false,
      lastAction: 'Research stopped',
    }));
  }

  async testElementDetection(): Promise<InteractiveElement[]> {
    try {
      const elements = await this.elementDetectionService.detectElements('final');
      this.updateState(state => ({
        ...state,
        elements,
        lastAction: `Detected ${elements.length} elements`,
      }));
      return elements;
    } catch (error) {
      this.updateState(state => ({
        ...state,
        error: `Element detection failed: ${error}`,
        lastAction: 'Element detection failed',
      }));
      throw error;
    }
  }

  async testDOMAction(
    elementIndex: number,
    action: 'click' | 'type',
    value?: string,
  ): Promise<void> {
    const state = this._researchState.get();
    const element = state.elements[elementIndex];

    if (!element) {
      throw new Error(`Element at index ${elementIndex} not found`);
    }

    try {
      if (action === 'click') {
        await this.domActionService.clickElement(element);
      } else if (action === 'type' && value) {
        await this.domActionService.typeInElement(element, value);
      }

      this.updateState(state => ({
        ...state,
        lastAction: `${action} action executed on element ${elementIndex}`,
      }));
    } catch (error) {
      this.updateState(state => ({
        ...state,
        error: `DOM action failed: ${error}`,
        lastAction: 'DOM action failed',
      }));
      throw error;
    }
  }

  async testLLMDecision(query: string, elements: InteractiveElement[]): Promise<LLMDecision> {
    try {
      const decision = await this.llmService.makeDecision(query, elements);
      this.updateState(state => ({
        ...state,
        lastAction: `LLM decision: ${decision.action} (confidence: ${Math.round(decision.confidence * 100)}%)`,
      }));
      return decision;
    } catch (error) {
      this.updateState(state => ({
        ...state,
        error: `LLM decision failed: ${error}`,
        lastAction: 'LLM decision failed',
      }));
      throw error;
    }
  }

  async testContentExtraction(): Promise<string> {
    try {
      const url = await this.elementDetectionService.getCurrentUrl();
      const content = await this.elementDetectionService.getPageContent();
      const extracted = await this.llmService.extractContent(content, 'Extract key information');

      this.updateState(state => ({
        ...state,
        extractedContent: [...state.extractedContent, extracted],
        lastAction: 'Content extracted successfully',
      }));

      return extracted;
    } catch (error) {
      this.updateState(state => ({
        ...state,
        error: `Content extraction failed: ${error}`,
        lastAction: 'Content extraction failed',
      }));
      throw error;
    }
  }

  async executeNextStep(): Promise<void> {
    const state = this._researchState.get();
    const currentStep = state.steps[state.currentStepIndex];

    if (!currentStep || currentStep.status === 'completed') {
      return;
    }

    this.updateStepStatus(currentStep.id, 'executing');

    try {
      switch (currentStep.type) {
        case 'detect-elements':
          await this.testElementDetection();
          break;
        case 'llm-decision':
          const elements = this._researchState.get().elements;
          await this.testLLMDecision(state.currentTask || 'What should I do next?', elements);
          break;
        default:
          throw new Error(`Unknown step type: ${currentStep.type}`);
      }

      this.updateStepStatus(currentStep.id, 'completed');

      // Move to next step
      this.updateState(state => ({
        ...state,
        currentStepIndex: state.currentStepIndex + 1,
      }));
    } catch (error) {
      this.updateStepStatus(currentStep.id, 'error', String(error));
      throw error;
    }
  }

  async retryCurrentStep(): Promise<void> {
    const state = this._researchState.get();
    const currentStep = state.steps[state.currentStepIndex];

    if (currentStep) {
      this.updateStepStatus(currentStep.id, 'pending');
      await this.executeNextStep();
    }
  }

  protected updateState(updater: (state: ResearchState) => ResearchState): void {
    this._researchState.set(updater(this._researchState.get()), undefined);
  }

  protected updateStepStatus(stepId: string, status: ResearchStep['status'], error?: string): void {
    this.updateState(state => ({
      ...state,
      steps: state.steps.map(step =>
        step.id === stepId ? { ...step, status, error, timestamp: Date.now() } : step,
      ),
    }));
  }

  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

registerSingleton(
  IResearchOrchestratorService,
  ResearchOrchestratorService,
  InstantiationType.Delayed,
);
