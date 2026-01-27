/**
 * LearningPanel - Unified panel component for all learning modes
 * 
 * Consolidates TechnicalPanel, InteractionPanel, and OthersPanel
 * into a single component with mode-specific content.
 */

import React, { useState, useMemo } from 'react';
import { 
  AppMode, 
  LessonPlan, 
  StopPoint, 
  Evaluation, 
  SkillMode,
  isTechnicalPlan, 
  isSoftSkillsPlan,
  TechnicalLessonPlan,
  SoftSkillsLessonPlan,
  Component,
  Tool,
  BuildStep,
  DesignDecision,
} from '../types';
import { formatTimestamp, copyToClipboard } from '../utils';
import { evaluateAnswer } from '../services/geminiService';
import { FeedbackDisplay, LoadingSpinner } from './shared';
import SafetyBanner from './SafetyBanner';
import ContentWarningBanner from './ContentWarningBanner';
import NotesSection from './NotesSection';
import VideoChatSection from './VideoChatSection';
import KnowledgeGraph from './KnowledgeGraph';

// ============================================
// TYPES
// ============================================

interface LearningPanelProps {
  // Core props
  lessonPlan: LessonPlan;
  skillMode: SkillMode; // User's selected mode (should match lessonPlan.mode)
  mode: AppMode;
  
  // Q&A props
  currentStopPoint?: StopPoint | null;
  currentStopIndex?: number;
  onAnswerSubmit?: (answer: string, evaluation: Evaluation) => void;
  onContinue?: () => void;
  onSelectStopPoint?: (index: number) => void;
  onSeekToTimestamp?: (timestamp: number) => void;
  sessionHistory?: { question: string; answer: string; evaluation: Evaluation }[];
  answeredQuestionIds?: Set<string>;
  skipAnswered?: boolean;
  onToggleSkipAnswered?: () => void;
  
  // Completion state
  studyPack?: { markdown: string } | null;
  
  // Voice roleplay
  showVoiceRoleplayButton?: boolean;
  onStartVoiceRoleplay?: () => void;
  selectedScenario?: string;
  
  // Export/Auth
  googleAccessToken?: string | null;
  onRequestGoogleAuth?: () => void;
  
  // Regenerate Q&A only
  onRegenerateQuestionsOnly?: () => void;
  isRegenerating?: boolean;
}

type TabConfig = {
  id: string;
  label: string;
  icon: string;
  count?: number;
  modes: SkillMode[]; // Which modes show this tab
};

// ============================================
// MAIN COMPONENT
// ============================================

const LearningPanel: React.FC<LearningPanelProps> = ({
  lessonPlan,
  skillMode,
  mode,
  currentStopPoint,
  currentStopIndex = 0,
  onAnswerSubmit,
  onContinue,
  onSelectStopPoint,
  onSeekToTimestamp,
  sessionHistory = [],
  answeredQuestionIds = new Set(),
  skipAnswered = false,
  onToggleSkipAnswered,
  studyPack,
  showVoiceRoleplayButton = false,
  onStartVoiceRoleplay,
  selectedScenario,
  googleAccessToken,
  onRequestGoogleAuth,
  onRegenerateQuestionsOnly,
  isRegenerating = false,
}) => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  
  // Use lessonPlan.mode as the source of truth for mode-specific behavior
  const planMode = lessonPlan.mode;
  
  // Build tab configuration based on mode
  const tabs = useMemo((): TabConfig[] => {
    const baseTabs: TabConfig[] = [];
    
    if (isTechnicalPlan(lessonPlan)) {
      baseTabs.push(
        { id: 'overview', label: 'Overview', icon: '📋', modes: ['technical'] },
        { id: 'parts', label: 'Parts', icon: '📦', count: lessonPlan.components.length, modes: ['technical'] },
        { id: 'tools', label: 'Tools', icon: '🛠️', count: lessonPlan.tools.length, modes: ['technical'] },
        { id: 'steps', label: 'Steps', icon: '📝', count: lessonPlan.buildSteps.length, modes: ['technical'] },
        { id: 'design', label: 'Why?', icon: '🧠', count: lessonPlan.designDecisions.length, modes: ['technical'] },
      );
    }
    
    // Q&A tab for all modes that have questions
    if (lessonPlan.stopPoints?.length > 0) {
      baseTabs.push({
        id: 'qa',
        label: 'Q&A',
        icon: '❓',
        count: lessonPlan.stopPoints.length,
        modes: ['technical', 'soft', 'others'],
      });
    }
    
    // Knowledge graph tab (all modes)
    baseTabs.push({
      id: 'graph',
      label: 'Graph',
      icon: '🕸️',
      modes: ['technical', 'soft', 'others'],
    });
    
    // Common tabs (all modes)
    baseTabs.push(
      { id: 'notes', label: 'Notes', icon: '📝', modes: ['technical', 'soft', 'others'] },
      { id: 'chat', label: 'Chat', icon: '💬', modes: ['technical', 'soft', 'others'] },
    );
    
    // Filter to only show tabs for current mode
    return baseTabs.filter(tab => tab.modes.includes(planMode));
  }, [lessonPlan, planMode]);

  // Set default tab based on mode
  React.useEffect(() => {
    if (planMode === 'technical') {
      setActiveTab('overview');
    } else if (planMode === 'soft') {
      setActiveTab(lessonPlan.stopPoints?.length > 0 ? 'qa' : 'notes');
    } else {
      // 'others' mode - show Q&A if available, else notes
      setActiveTab(lessonPlan.stopPoints?.length > 0 ? 'qa' : 'notes');
    }
  }, [planMode, lessonPlan]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Mode-specific banners */}
      {planMode === 'technical' && isTechnicalPlan(lessonPlan) && (
        <SafetyBanner plan={lessonPlan} />
      )}
      
      {planMode === 'others' && (
        <div className="bg-amber-50 border-b border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h4 className="font-bold text-amber-800 mb-1">General Content Mode</h4>
              <p className="text-amber-700 text-sm">
                This video wasn't classified as structured educational content. You can still use AI tools to explore it, 
                but questions and analysis may be limited.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Content Warning Banner - shows for any suspicious/fake/misleading content */}
      {lessonPlan.contentWarning?.hasConcerns && (
        <ContentWarningBanner warning={lessonPlan.contentWarning} />
      )}

      {/* Header */}
      <PanelHeader lessonPlan={lessonPlan} skillMode={planMode} />

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50 px-1 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.label}
            className={`
              flex items-center gap-1 px-2 py-2.5 text-xs font-medium whitespace-nowrap
              border-b-2 transition-colors flex-shrink-0
              ${activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}
            `}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] bg-slate-200 text-slate-600 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content - Use hidden divs to preserve state across tab switches */}
      <div className="flex-1 overflow-hidden">
        {/* Technical-specific tabs */}
        {isTechnicalPlan(lessonPlan) && (
          <>
            <div className={activeTab === 'overview' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
              <OverviewTab plan={lessonPlan} />
            </div>
            <div className={activeTab === 'parts' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
              <PartsTab components={lessonPlan.components} />
            </div>
            <div className={activeTab === 'tools' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
              <ToolsTab tools={lessonPlan.tools} />
            </div>
            <div className={activeTab === 'steps' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
              <StepsTab 
                steps={lessonPlan.buildSteps} 
                onSeek={onSeekToTimestamp} 
                formatTimestamp={formatTimestamp} 
              />
            </div>
            <div className={activeTab === 'design' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
              <DesignTab 
                decisions={lessonPlan.designDecisions} 
                onSeek={onSeekToTimestamp} 
                formatTimestamp={formatTimestamp} 
              />
            </div>
          </>
        )}

        {/* Q&A tab (shared between technical and soft) */}
        <div className={activeTab === 'qa' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
          <QATab
            lessonPlan={lessonPlan}
            currentStopPoint={currentStopPoint}
            currentStopIndex={currentStopIndex}
            onAnswerSubmit={onAnswerSubmit}
            onContinue={onContinue}
            onSelectStopPoint={onSelectStopPoint}
            onSeekToTimestamp={onSeekToTimestamp}
            mode={mode}
            sessionHistory={sessionHistory}
            answeredQuestionIds={answeredQuestionIds}
            showVoiceRoleplayButton={showVoiceRoleplayButton && planMode === 'soft'}
            onStartVoiceRoleplay={onStartVoiceRoleplay}
            onRegenerateQuestionsOnly={onRegenerateQuestionsOnly}
            isRegenerating={isRegenerating}
          />
        </div>

        {/* Knowledge Graph tab */}
        <div className={activeTab === 'graph' ? 'h-full overflow-y-auto' : 'hidden'}>
          <KnowledgeGraph lessonPlan={lessonPlan} onSeekToTimestamp={onSeekToTimestamp} />
        </div>

        {/* Common tabs */}
        <div className={activeTab === 'notes' ? 'h-full' : 'hidden'}>
          <NotesSection lessonPlan={lessonPlan} />
        </div>
        <div className={activeTab === 'chat' ? 'h-full' : 'hidden'}>
          <VideoChatSection
            lessonPlan={lessonPlan}
            selectedScenario={selectedScenario}
            onStartVoiceRoleplay={onStartVoiceRoleplay}
            googleAccessToken={googleAccessToken}
            onRequestGoogleAuth={onRequestGoogleAuth}
            skillMode={skillMode}
          />
        </div>
      </div>
    </div>
  );
};

// ============================================
// HEADER COMPONENT
// ============================================

const PanelHeader: React.FC<{ lessonPlan: LessonPlan; skillMode: SkillMode }> = ({ 
  lessonPlan, 
  skillMode 
}) => {
  const getBadgeColor = () => {
    switch (skillMode) {
      case 'technical': return 'text-emerald-600 bg-emerald-100';
      case 'soft': return 'text-purple-600 bg-purple-100';
      default: return 'text-slate-600 bg-slate-200';
    }
  };

  const getLabel = () => {
    if (isTechnicalPlan(lessonPlan)) return lessonPlan.projectType;
    if (isSoftSkillsPlan(lessonPlan)) return lessonPlan.scenarioPreset || 'Soft Skills';
    return 'General Content';
  };

  return (
    <div className="p-4 border-b border-slate-100 bg-slate-50">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`px-2 py-1 text-xs font-bold rounded-md uppercase tracking-wide ${getBadgeColor()}`}>
          {getLabel()}
        </span>
        
        {isTechnicalPlan(lessonPlan) && (
          <>
            <span className={`px-2 py-1 text-xs font-medium rounded-md ${
              lessonPlan.difficultyLevel === 'beginner' ? 'bg-green-100 text-green-700' :
              lessonPlan.difficultyLevel === 'intermediate' ? 'bg-amber-100 text-amber-700' :
              'bg-red-100 text-red-700'
            }`}>
              {lessonPlan.difficultyLevel}
            </span>
            {lessonPlan.estimatedBuildTime && (
              <span className="text-xs text-slate-500">⏱️ {lessonPlan.estimatedBuildTime}</span>
            )}
          </>
        )}
      </div>
      <h2 className="text-lg font-bold text-slate-800 leading-tight">{lessonPlan.summary}</h2>
      {lessonPlan.videoContext && (
        <details className="mt-2">
          <summary className="text-sm text-slate-600 cursor-pointer hover:text-indigo-600">
            {lessonPlan.videoContext.slice(0, 100)}... <span className="text-indigo-500 text-xs">(click to expand)</span>
          </summary>
          <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{lessonPlan.videoContext}</p>
        </details>
      )}
    </div>
  );
};

// ============================================
// TECHNICAL TAB COMPONENTS
// ============================================

const OverviewTab: React.FC<{ plan: TechnicalLessonPlan }> = ({ plan }) => (
  <div className="space-y-4">
    <div>
      <h3 className="text-sm font-bold text-slate-700 mb-2">Skills You'll Learn</h3>
      <div className="flex flex-wrap gap-2">
        {plan.skillsDetected.map((skill, i) => (
          <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">
            {skill}
          </span>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div className="bg-slate-50 p-3 rounded-lg text-center">
        <div className="text-2xl font-bold text-slate-800">{plan.components.length}</div>
        <div className="text-xs text-slate-500">Parts</div>
      </div>
      <div className="bg-slate-50 p-3 rounded-lg text-center">
        <div className="text-2xl font-bold text-slate-800">{plan.tools.length}</div>
        <div className="text-xs text-slate-500">Tools</div>
      </div>
      <div className="bg-slate-50 p-3 rounded-lg text-center">
        <div className="text-2xl font-bold text-slate-800">{plan.buildSteps.length}</div>
        <div className="text-xs text-slate-500">Steps</div>
      </div>
    </div>

    <div>
      <h3 className="text-sm font-bold text-slate-700 mb-2">Video Context</h3>
      <details>
        <summary className="text-sm text-slate-600 cursor-pointer hover:text-indigo-600">
          {plan.videoContext.slice(0, 200)}... <span className="text-indigo-500 text-xs">(click to expand)</span>
        </summary>
        <p className="text-sm text-slate-600 leading-relaxed mt-2 whitespace-pre-wrap">{plan.videoContext}</p>
      </details>
    </div>
  </div>
);

const PartsTab: React.FC<{ components: Component[] }> = ({ components }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyPartsList = () => {
    const partsList = components.map((part, i) => {
      let text = `${i + 1}. ${part.name}`;
      if (part.quantity) text += ` (${part.quantity})`;
      if (part.specifications) text += `\n   Specs: ${part.specifications}`;
      if (part.purpose) text += `\n   Purpose: ${part.purpose}`;
      if (part.estimatedCost) text += `\n   Cost: ${part.estimatedCost}`;
      if (part.alternatives && part.alternatives.length > 0) {
        text += `\n   Alternatives: ${part.alternatives.join(', ')}`;
      }
      return text;
    }).join('\n\n');

    copyToClipboard(partsList, () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-3">
      {components.map((part, i) => (
        <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{part.name}</span>
                {part.quantity && (
                  <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-xs rounded">
                    {part.quantity}
                  </span>
                )}
              </div>
              {part.specifications && (
                <p className="text-xs text-slate-500 mt-1 font-mono">{part.specifications}</p>
              )}
              {part.purpose && (
                <p className="text-sm text-slate-600 mt-1">{part.purpose}</p>
              )}
            </div>
            {part.estimatedCost && (
              <span className="text-sm text-green-600 font-medium">{part.estimatedCost}</span>
            )}
          </div>
          {part.alternatives && part.alternatives.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-500">Alternatives: </span>
              <span className="text-xs text-slate-600">{part.alternatives.join(', ')}</span>
            </div>
          )}
        </div>
      ))}
      
      <button 
        onClick={handleCopyPartsList}
        className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
      >
        {copied ? '✓ Copied!' : '📋 Copy Parts List'}
      </button>
    </div>
  );
};

const ToolsTab: React.FC<{ tools: Tool[] }> = ({ tools }) => {
  const required = tools.filter(t => t.required);
  const optional = tools.filter(t => !t.required);

  return (
    <div className="space-y-4">
      {required.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            Required
          </h3>
          <div className="space-y-2">
            {required.map((tool, i) => (
              <ToolItem key={i} tool={tool} />
            ))}
          </div>
        </div>
      )}

      {optional.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-slate-400 rounded-full"></span>
            Optional
          </h3>
          <div className="space-y-2">
            {optional.map((tool, i) => (
              <ToolItem key={i} tool={tool} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ToolItem: React.FC<{ tool: Tool }> = ({ tool }) => (
  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
    <div className="flex items-center gap-2">
      <input type="checkbox" className="w-4 h-4 rounded border-slate-300" />
      <span className="font-medium text-slate-800">{tool.name}</span>
    </div>
    <p className="text-sm text-slate-600 mt-1 ml-6">{tool.purpose}</p>
    {tool.safetyNotes && (
      <p className="text-xs text-amber-600 mt-1 ml-6 flex items-center gap-1">
        ⚠️ {tool.safetyNotes}
      </p>
    )}
  </div>
);

const StepsTab: React.FC<{ 
  steps: BuildStep[];
  onSeek?: (ts: number) => void;
  formatTimestamp: (ts?: number) => string;
}> = ({ steps, onSeek, formatTimestamp }) => (
  <div className="space-y-4">
    {steps.map((step, i) => (
      <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
            {step.stepNumber}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-slate-800">{step.title}</h4>
              {step.timestamp !== undefined && (
                <button
                  onClick={() => onSeek?.(step.timestamp!)}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                >
                  📺 {formatTimestamp(step.timestamp)}
                </button>
              )}
              {step.duration && (
                <span className="text-xs text-slate-500">⏱️ {step.duration}</span>
              )}
            </div>
            <p className="text-sm text-slate-600">{step.description}</p>

            {step.tips && step.tips.length > 0 && (
              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                <span className="text-xs font-medium text-blue-700">💡 Tips:</span>
                <ul className="text-xs text-blue-600 mt-1 list-disc list-inside">
                  {step.tips.map((tip, j) => <li key={j}>{tip}</li>)}
                </ul>
              </div>
            )}

            {step.safetyWarnings && step.safetyWarnings.length > 0 && (
              <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-100">
                <span className="text-xs font-medium text-amber-700">⚠️ Safety:</span>
                <ul className="text-xs text-amber-600 mt-1 list-disc list-inside">
                  {step.safetyWarnings.map((warn, j) => <li key={j}>{warn}</li>)}
                </ul>
              </div>
            )}

            {step.checkpoints && step.checkpoints.length > 0 && (
              <div className="mt-2 p-2 bg-green-50 rounded border border-green-100">
                <span className="text-xs font-medium text-green-700">✓ Verify:</span>
                <ul className="text-xs text-green-600 mt-1 space-y-1">
                  {step.checkpoints.map((cp, j) => (
                    <li key={j} className="flex items-center gap-2">
                      <input type="checkbox" className="w-3 h-3 rounded" />
                      {cp}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    ))}
  </div>
);

const DesignTab: React.FC<{
  decisions: DesignDecision[];
  onSeek?: (ts: number) => void;
  formatTimestamp: (ts?: number) => string;
}> = ({ decisions, onSeek, formatTimestamp }) => (
  <div className="space-y-4">
    <p className="text-sm text-slate-600 mb-4">
      Understanding <em>why</em> certain choices were made helps you adapt the project to your needs.
    </p>
    {decisions.map((decision, i) => (
      <div key={i} className="p-4 bg-slate-50 rounded-lg border border-slate-100">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-lg">🤔</span>
          <div className="flex-1">
            <h4 className="font-medium text-slate-800">{decision.question}</h4>
            {decision.timestamp !== undefined && (
              <button
                onClick={() => onSeek?.(decision.timestamp!)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-mono mt-1"
              >
                📺 {formatTimestamp(decision.timestamp)}
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-slate-600 ml-7">{decision.answer}</p>
        {decision.tradeoffs && (
          <p className="text-xs text-slate-500 ml-7 mt-2">
            <strong>Tradeoffs:</strong> {decision.tradeoffs}
          </p>
        )}
        {decision.alternatives && (
          <p className="text-xs text-slate-500 ml-7 mt-1">
            <strong>Alternatives:</strong> {decision.alternatives}
          </p>
        )}
      </div>
    ))}
  </div>
);

// ============================================
// Q&A TAB COMPONENT (Shared)
// ============================================

interface QATabProps {
  lessonPlan: LessonPlan;
  currentStopPoint?: StopPoint | null;
  currentStopIndex?: number;
  onAnswerSubmit?: (answer: string, evaluation: Evaluation) => void;
  onContinue?: () => void;
  onSelectStopPoint?: (index: number) => void;
  onSeekToTimestamp?: (timestamp: number) => void;
  mode?: AppMode;
  sessionHistory?: { question: string; answer: string; evaluation: Evaluation }[];
  answeredQuestionIds?: Set<string>;
  showVoiceRoleplayButton?: boolean;
  onStartVoiceRoleplay?: () => void;
  onRegenerateQuestionsOnly?: () => void;
  isRegenerating?: boolean;
}

const QATab: React.FC<QATabProps> = ({
  lessonPlan,
  currentStopPoint,
  currentStopIndex = 0,
  onAnswerSubmit,
  onContinue,
  onSelectStopPoint,
  onSeekToTimestamp,
  mode,
  sessionHistory = [],
  answeredQuestionIds = new Set(),
  showVoiceRoleplayButton,
  onStartVoiceRoleplay,
  onRegenerateQuestionsOnly,
  isRegenerating = false,
}) => {
  const [answer, setAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<Evaluation | null>(null);

  const stopPoints = lessonPlan.stopPoints || [];

  if (stopPoints.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-medium text-lg">No Q&A questions available</p>
        <p className="text-sm mt-2">This video doesn't have comprehension questions.</p>
        
        {showVoiceRoleplayButton && onStartVoiceRoleplay && (
          <button
            onClick={onStartVoiceRoleplay}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            🎭 Start Voice Roleplay Instead
          </button>
        )}
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!currentStopPoint || !answer.trim() || !onAnswerSubmit) return;
    
    setIsEvaluating(true);
    try {
      const evaluation = await evaluateAnswer(currentStopPoint, answer, lessonPlan);
      setCurrentEvaluation(evaluation);
      onAnswerSubmit(answer, evaluation);
      setAnswer('');
    } catch (e) {
      console.error('Evaluation error:', e);
      alert('Failed to evaluate. Please try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleContinue = () => {
    setAnswer('');
    setCurrentEvaluation(null);
    onContinue?.();
  };

  const handleSelectQuestion = (idx: number) => {
    setCurrentEvaluation(null);
    onSelectStopPoint?.(idx);
    if (stopPoints[idx]) {
      onSeekToTimestamp?.(stopPoints[idx].timestamp);
    }
  };

  // Check if all questions are completed
  const allCompleted = mode === AppMode.COMPLETED || mode === AppMode.PACK_READY || mode === AppMode.GENERATING_PACK;
  const answeredCount = answeredQuestionIds.size;
  const totalQuestions = stopPoints.length;

  // Show completion state
  if (allCompleted) {
    return (
      <div className="space-y-4">
        {/* Completion Banner */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🎉</span>
          </div>
          <h3 className="text-xl font-bold text-emerald-800 mb-2">Session Complete!</h3>
          <p className="text-emerald-700 text-sm mb-4">
            You answered {answeredCount} of {totalQuestions} questions.
          </p>
          
          {/* Score summary if we have session history */}
          {sessionHistory.length > 0 && (
            <div className="bg-white/60 rounded-lg p-4 mb-4 inline-block">
              <div className="text-3xl font-bold text-emerald-600">
                {sessionHistory.reduce((acc, h) => acc + (h.evaluation.score || 0), 0)} / {sessionHistory.length * 5}
              </div>
              <div className="text-sm text-emerald-600">Total Score</div>
            </div>
          )}
          
          <p className="text-sm text-slate-600 italic">
            Use the Export button to download your session notes and Q&A history.
          </p>
          
          {/* Regenerate Questions Button for more practice */}
          {onRegenerateQuestionsOnly && (
            <button
              onClick={onRegenerateQuestionsOnly}
              disabled={isRegenerating}
              className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
            >
              {isRegenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Generating...
                </>
              ) : (
                <>🔄 Practice More (New Questions)</>
              )}
            </button>
          )}
        </div>

        {/* Session History */}
        {sessionHistory.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-bold text-slate-700 mb-3">📝 Your Answers</h4>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {sessionHistory.map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-slate-100">
                  <div className="flex items-start gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded">Q{idx + 1}</span>
                    <p className="text-sm text-slate-700 flex-1">{item.question}</p>
                  </div>
                  <div className="ml-6 space-y-1">
                    <p className="text-sm text-slate-600"><span className="font-medium">Your answer:</span> {item.answer}</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-bold rounded ${
                        item.evaluation.score >= 4 ? 'bg-green-100 text-green-700' :
                        item.evaluation.score >= 3 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.evaluation.score}/5
                      </span>
                      {item.evaluation.strengths?.[0] && (
                        <span className="text-xs text-slate-500">{item.evaluation.strengths[0]}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voice Roleplay option for soft skills */}
        {showVoiceRoleplayButton && onStartVoiceRoleplay && (
          <button
            onClick={onStartVoiceRoleplay}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            🎭 Continue with Voice Roleplay
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Question List */}
      <div className="bg-slate-50 p-3 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-700">Questions ({stopPoints.length})</h3>
          {onRegenerateQuestionsOnly && (
            <button
              onClick={onRegenerateQuestionsOnly}
              disabled={isRegenerating}
              className="text-xs px-2 py-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              title="Generate new practice questions (keeps other content)"
            >
              {isRegenerating ? (
                <>
                  <span className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></span>
                  Regenerating...
                </>
              ) : (
                <>🔄 New Questions</>
              )}
            </button>
          )}
        </div>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {stopPoints.map((sp, idx) => {
            const isAnswered = answeredQuestionIds.has(sp.id);
            return (
              <button
                key={sp.id}
                onClick={() => handleSelectQuestion(idx)}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                  idx === currentStopIndex
                    ? 'bg-indigo-100 text-indigo-700 font-medium'
                    : 'hover:bg-slate-100 text-slate-600'
                }`}
              >
                <span className="font-mono text-xs">{formatTimestamp(sp.timestamp)}</span>
                <span>Q{idx + 1}</span>
                {isAnswered && <span className="text-green-500 text-xs">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current Question */}
      {currentStopPoint && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
              Question {currentStopIndex + 1} of {stopPoints.length}
            </span>
            <button
              onClick={() => onSeekToTimestamp?.(currentStopPoint.timestamp)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
            >
              📺 {formatTimestamp(currentStopPoint.timestamp)}
            </button>
            {answeredQuestionIds.has(currentStopPoint.id) && (
              <span className="text-xs text-green-600 font-medium">✓ Answered</span>
            )}
          </div>
          
          <p className="text-slate-800 font-medium mb-3">{currentStopPoint.question}</p>
          
          {/* Context if available */}
          {currentStopPoint.contextSummary && (
            <div className="bg-blue-50 p-3 rounded-lg text-slate-600 text-sm italic mb-3">
              {currentStopPoint.contextSummary}
            </div>
          )}
          
          {/* Show evaluation loading or feedback */}
          {isEvaluating ? (
            <LoadingSpinner 
              message="Evaluating your answer..."
              subMessage="Gemini is analyzing your response"
            />
          ) : mode === AppMode.FEEDBACK && currentEvaluation ? (
            <FeedbackDisplay 
              evaluation={currentEvaluation}
              onContinue={handleContinue}
              compact={true}
            />
          ) : (
            <>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                rows={4}
                disabled={isEvaluating}
              />
              
              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleSubmit}
                  disabled={!answer.trim() || isEvaluating}
                  className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isEvaluating ? 'Evaluating...' : 'Submit Answer'}
                </button>
                {onContinue && (
                  <button
                    onClick={handleContinue}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Skip
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Voice Roleplay Button */}
      {showVoiceRoleplayButton && onStartVoiceRoleplay && (
        <button
          onClick={onStartVoiceRoleplay}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
        >
          🎭 Start Voice Roleplay
        </button>
      )}
    </div>
  );
};

export default LearningPanel;
