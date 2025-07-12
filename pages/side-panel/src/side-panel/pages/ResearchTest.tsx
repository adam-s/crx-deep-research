import React, { useState, useEffect } from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  Card,
  CardHeader,
  Spinner,
  makeStyles,
  tokens,
  Badge,
  Text,
} from '@fluentui/react-components';
import { PlayRegular, StopRegular, ArrowSyncRegular } from '@fluentui/react-icons';
import { useService } from '../hooks/useService';
import { IResearchOrchestratorService } from '../../services/research/research-orchestrator.service';
import { autorun } from 'vs/base/common/observable';
import type { InteractiveElement } from '../../../../../packages/shared/src/markers/types';
import type { LLMDecision } from '../../../../../packages/shared/src/services/research/llm.service';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px',
    height: '100%',
  },
  testSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  actionRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  elementsList: {
    maxHeight: '200px',
    overflowY: 'auto',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: '8px',
  },
  elementItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: tokens.borderRadiusSmall,
    '&:hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  statusArea: {
    padding: '12px',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    minHeight: '100px',
  },
  stepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    borderRadius: tokens.borderRadiusSmall,
  },
  stepPending: {
    backgroundColor: tokens.colorNeutralBackground3,
  },
  stepExecuting: {
    backgroundColor: tokens.colorBrandBackground2,
  },
  stepCompleted: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
  },
  stepError: {
    backgroundColor: tokens.colorPaletteRedBackground2,
  },
});

export const ResearchTest: React.FC = () => {
  const styles = useStyles();
  const orchestrator = useService(IResearchOrchestratorService);
  
  const [elements, setElements] = useState<InteractiveElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<number>(0);
  const [actionType, setActionType] = useState<'click' | 'type'>('click');
  const [typeValue, setTypeValue] = useState<string>('');
  const [researchQuery, setResearchQuery] = useState<string>('');
  const [lastDecision, setLastDecision] = useState<LLMDecision | null>(null);
  const [isLoading, setIsLoading] = useState<{ [key: string]: boolean }>({});
  
  // Subscribe to research state changes
  const [researchState, setResearchState] = useState(orchestrator.researchState$.get());

  useEffect(() => {
    const disposer = autorun(reader => {
      const state = orchestrator.researchState$.read(reader);
      setResearchState(state);
      setElements(state.elements);
    });
    return () => disposer.dispose();
  }, [orchestrator]);

  const handleTestElementDetection = async () => {
    setIsLoading(prev => ({ ...prev, elements: true }));
    try {
      const result = await orchestrator.testElementDetection();
      setElements(result);
    } catch (error) {
      console.error('Element detection failed:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, elements: false }));
    }
  };

  const handleTestDOMAction = async () => {
    setIsLoading(prev => ({ ...prev, action: true }));
    try {
      await orchestrator.testDOMAction(
        selectedElement, 
        actionType, 
        actionType === 'type' ? typeValue : undefined
      );
    } catch (error) {
      console.error('DOM action failed:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, action: false }));
    }
  };

  const handleTestLLMDecision = async () => {
    setIsLoading(prev => ({ ...prev, llm: true }));
    try {
      const decision = await orchestrator.testLLMDecision(researchQuery || 'What should I do next?', elements);
      setLastDecision(decision);
    } catch (error) {
      console.error('LLM decision failed:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, llm: false }));
    }
  };

  const handleTestContentExtraction = async () => {
    setIsLoading(prev => ({ ...prev, content: true }));
    try {
      await orchestrator.testContentExtraction();
    } catch (error) {
      console.error('Content extraction failed:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, content: false }));
    }
  };

  const handleStartResearch = async () => {
    if (!researchQuery.trim()) return;
    
    setIsLoading(prev => ({ ...prev, research: true }));
    try {
      await orchestrator.startSimpleResearch(researchQuery);
    } catch (error) {
      console.error('Research failed:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, research: false }));
    }
  };

  const handleStopResearch = async () => {
    await orchestrator.stopResearch();
  };

  const handleExecuteNextStep = async () => {
    setIsLoading(prev => ({ ...prev, step: true }));
    try {
      await orchestrator.executeNextStep();
    } catch (error) {
      console.error('Step execution failed:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, step: false }));
    }
  };

  const handleRetryStep = async () => {
    setIsLoading(prev => ({ ...prev, retry: true }));
    try {
      await orchestrator.retryCurrentStep();
    } catch (error) {
      console.error('Step retry failed:', error);
    } finally {
      setIsLoading(prev => ({ ...prev, retry: false }));
    }
  };

  const getStepStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge appearance="filled" color="success">✓</Badge>;
      case 'executing':
        return <Badge appearance="filled" color="brand">⟳</Badge>;
      case 'error':
        return <Badge appearance="filled" color="danger">✗</Badge>;
      default:
        return <Badge appearance="outline">○</Badge>;
    }
  };

  return (
    <div className={styles.container}>
      <Card>
        <CardHeader>
          <Text weight="semibold" size={500}>Research Orchestrator Test</Text>
        </CardHeader>
        <div style={{ padding: '16px' }}>
          {/* Full Research Test */}
          <div className={styles.testSection}>
            <Label weight="semibold">Full Research Test</Label>
            <div className={styles.actionRow}>
              <Input
                value={researchQuery}
                onChange={(_, data) => setResearchQuery(data.value)}
                placeholder="Enter research query (e.g., 'Find information about AI safety')"
                style={{ flex: 1 }}
              />
              <Button
                appearance="primary"
                icon={researchState.isActive ? <StopRegular /> : <PlayRegular />}
                onClick={researchState.isActive ? handleStopResearch : handleStartResearch}
                disabled={isLoading.research || (!researchQuery.trim() && !researchState.isActive)}
              >
                {researchState.isActive ? 'Stop' : 'Start'} Research
              </Button>
            </div>

            {/* Research Steps */}
            {researchState.steps.length > 0 && (
              <div className={styles.stepsList}>
                {researchState.steps.map((step, index) => {
                  const statusClass = step.status === 'pending' ? styles.stepPending :
                                    step.status === 'executing' ? styles.stepExecuting :
                                    step.status === 'completed' ? styles.stepCompleted :
                                    step.status === 'error' ? styles.stepError : '';
                  return (
                  <div 
                    key={step.id} 
                    className={`${styles.step} ${statusClass}`}
                  >
                    {getStepStatusBadge(step.status)}
                    <Text size={300}>
                      {index + 1}. {step.description}
                    </Text>
                    {step.error && (
                      <Text size={200} color="danger">({step.error})</Text>
                    )}
                  </div>
                  );
                })}
                {researchState.isActive && (
                  <div className={styles.actionRow}>
                    <Button
                      size="small"
                      onClick={handleExecuteNextStep}
                      disabled={isLoading.step}
                      icon={isLoading.step ? <Spinner size="tiny" /> : undefined}
                    >
                      Next Step
                    </Button>
                    <Button
                      size="small"
                      appearance="secondary"
                      onClick={handleRetryStep}
                      disabled={isLoading.retry}
                      icon={isLoading.retry ? <Spinner size="tiny" /> : <ArrowSyncRegular />}
                    >
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Individual Tests */}
          <div className={styles.testSection}>
            <Label weight="semibold">Individual Function Tests</Label>
            
            {/* Element Detection Test */}
            <div className={styles.actionRow}>
              <Button
                onClick={handleTestElementDetection}
                disabled={isLoading.elements}
                icon={isLoading.elements ? <Spinner size="tiny" /> : undefined}
              >
                Detect Elements
              </Button>
              <Text size={200}>Found: {elements.length} elements</Text>
            </div>

            {/* Elements List */}
            {elements.length > 0 && (
              <div className={styles.elementsList}>
                {elements.slice(0, 10).map((el, i) => (
                  <div key={i} className={styles.elementItem}>
                    <Text size={300}>
                      {i}: {el.type} - "{el.description || el.text || 'No description'}"
                      {el.inViewport && <Badge size="small" color="success">Visible</Badge>}
                    </Text>
                  </div>
                ))}
                {elements.length > 10 && (
                  <Text size={200}>...and {elements.length - 10} more</Text>
                )}
              </div>
            )}

            {/* DOM Action Test */}
            {elements.length > 0 && (
              <>
                <div className={styles.actionRow}>
                  <Select
                    value={selectedElement.toString()}
                    onChange={(_, data) => setSelectedElement(parseInt(data.value))}
                  >
                    {elements.slice(0, 20).map((el, i) => (
                      <option key={i} value={i}>
                        {i}: {el.description || el.type}
                      </option>
                    ))}
                  </Select>
                  
                  <Select
                    value={actionType}
                    onChange={(_, data) => setActionType(data.value as 'click' | 'type')}
                  >
                    <option value="click">Click</option>
                    <option value="type">Type</option>
                  </Select>
                  
                  {actionType === 'type' && (
                    <Input 
                      value={typeValue} 
                      onChange={(_, data) => setTypeValue(data.value)}
                      placeholder="Text to type"
                    />
                  )}
                  
                  <Button
                    onClick={handleTestDOMAction}
                    disabled={isLoading.action}
                    icon={isLoading.action ? <Spinner size="tiny" /> : undefined}
                  >
                    Execute Action
                  </Button>
                </div>
              </>
            )}

            {/* LLM Decision Test */}
            <div className={styles.actionRow}>
              <Button
                onClick={handleTestLLMDecision}
                disabled={isLoading.llm || elements.length === 0}
                icon={isLoading.llm ? <Spinner size="tiny" /> : undefined}
              >
                Test LLM Decision
              </Button>
              <Button
                onClick={handleTestContentExtraction}
                disabled={isLoading.content}
                icon={isLoading.content ? <Spinner size="tiny" /> : undefined}
              >
                Extract Content
              </Button>
            </div>

            {/* LLM Decision Result */}
            {lastDecision && (
              <Card size="small">
                <div style={{ padding: '12px' }}>
                  <Text weight="semibold" size={300}>LLM Decision:</Text>
                  <Text size={300}>Action: {lastDecision.action}</Text>
                  {lastDecision.elementIndex !== undefined && (
                    <Text size={300}>Element: {lastDecision.elementIndex}</Text>
                  )}
                  {lastDecision.value && (
                    <Text size={300}>Value: {lastDecision.value}</Text>
                  )}
                  <Text size={300}>Reasoning: {lastDecision.reasoning}</Text>
                  <Text size={300}>Confidence: {(lastDecision.confidence * 100).toFixed(0)}%</Text>
                </div>
              </Card>
            )}
          </div>

          {/* Status Area */}
          <div className={styles.statusArea}>
            <Label weight="semibold">Status</Label>
            <Text size={300}>Current URL: {researchState.currentUrl || 'N/A'}</Text>
            <Text size={300}>Last Action: {researchState.lastAction || 'None'}</Text>
            {researchState.error && (
              <Text size={300} color="danger">Error: {researchState.error}</Text>
            )}
            {researchState.extractedContent.length > 0 && (
              <Text size={300}>
                Content Extracted: {researchState.extractedContent.length} pieces
              </Text>
            )}
            {researchState.researchComplete && (
              <Badge appearance="filled" color="success">Research Complete!</Badge>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};