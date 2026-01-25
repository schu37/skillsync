import React, { useState } from 'react';
import { TechnicalLessonPlan, Component, Tool, BuildStep, DesignDecision, StopPoint, Evaluation, AppMode } from '../types';
import SafetyBanner from './SafetyBanner';
import NotesSection from './NotesSection';
import VideoChatSection from './VideoChatSection';

interface TechnicalPanelProps {
  plan: TechnicalLessonPlan;
  onSeekToTimestamp?: (timestamp: number) => void;
  // Q&A props
  currentStopPoint?: StopPoint | null;
  currentStopIndex?: number;
  onAnswerSubmit?: (answer: string, evaluation: Evaluation) => void;
  onContinue?: () => void;
  onSelectStopPoint?: (index: number) => void;
  mode?: AppMode;
  sessionHistory?: { question: string; answer: string; evaluation: Evaluation }[];
}

type TabId = 'overview' | 'parts' | 'tools' | 'steps' | 'design' | 'qa' | 'notes' | 'chat';

const TechnicalPanel: React.FC<TechnicalPanelProps> = ({ 
  plan, 
  onSeekToTimestamp,
  currentStopPoint,
  currentStopIndex = 0,
  onAnswerSubmit,
  onContinue,
  onSelectStopPoint,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [answer, setAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'parts', label: 'Parts', icon: '📦', count: plan.components.length },
    { id: 'tools', label: 'Tools', icon: '🛠️', count: plan.tools.length },
    { id: 'steps', label: 'Steps', icon: '📝', count: plan.buildSteps.length },
    { id: 'design', label: 'Why?', icon: '🧠', count: plan.designDecisions.length },
    { id: 'qa', label: 'Q&A', icon: '❓', count: plan.stopPoints?.length || 0 },
    { id: 'notes', label: 'Notes', icon: '📝' },
    { id: 'chat', label: 'Chat', icon: '💬' },
  ];

  const formatTimestamp = (seconds?: number): string => {
    if (seconds === undefined) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Safety Banner */}
      <SafetyBanner plan={plan} />

      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-1 text-xs font-bold text-emerald-600 bg-emerald-100 rounded-md uppercase tracking-wide">
            {plan.projectType}
          </span>
          <span className={`px-2 py-1 text-xs font-medium rounded-md ${
            plan.difficultyLevel === 'beginner' ? 'bg-green-100 text-green-700' :
            plan.difficultyLevel === 'intermediate' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {plan.difficultyLevel}
          </span>
          {plan.estimatedBuildTime && (
            <span className="text-xs text-slate-500">⏱️ {plan.estimatedBuildTime}</span>
          )}
        </div>
        <h2 className="text-lg font-bold text-slate-800 leading-tight">{plan.summary}</h2>
      </div>

      {/* Tabs - Scrollable with better mobile support */}
      <div className="flex border-b border-slate-100 bg-slate-50 px-2 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-2 sm:px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap
              border-b-2 transition-colors flex-shrink-0
              ${activeTab === tab.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'}
            `}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count !== undefined && (
              <span className="px-1.5 py-0.5 text-xs bg-slate-200 text-slate-600 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content - Use hidden divs to preserve state across tab switches */}
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === 'overview' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
          <OverviewTab plan={plan} />
        </div>
        <div className={activeTab === 'parts' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
          <PartsTab components={plan.components} />
        </div>
        <div className={activeTab === 'tools' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
          <ToolsTab tools={plan.tools} />
        </div>
        <div className={activeTab === 'steps' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
          <StepsTab steps={plan.buildSteps} onSeek={onSeekToTimestamp} formatTimestamp={formatTimestamp} />
        </div>
        <div className={activeTab === 'design' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
          <DesignTab decisions={plan.designDecisions} onSeek={onSeekToTimestamp} formatTimestamp={formatTimestamp} />
        </div>
        <div className={activeTab === 'qa' ? 'h-full overflow-y-auto p-4' : 'hidden'}>
          <QATab 
            plan={plan}
            currentStopPoint={currentStopPoint}
            currentStopIndex={currentStopIndex}
            onAnswerSubmit={onAnswerSubmit}
            onContinue={onContinue}
            onSelectStopPoint={onSelectStopPoint}
            onSeekToTimestamp={onSeekToTimestamp}
            mode={mode}
            sessionHistory={sessionHistory}
          />
        </div>
        <div className={activeTab === 'notes' ? 'h-full' : 'hidden'}>
          <NotesSection lessonPlan={plan} />
        </div>
        <div className={activeTab === 'chat' ? 'h-full' : 'hidden'}>
          <VideoChatSection lessonPlan={plan} />
        </div>
      </div>
    </div>
  );
};

// ============================================
// TAB COMPONENTS
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
      <p className="text-sm text-slate-600 leading-relaxed">{plan.videoContext.slice(0, 500)}...</p>
    </div>
  </div>
);

const PartsTab: React.FC<{ components: Component[] }> = ({ components }) => {
  const [copied, setCopied] = useState(false);

  const copyPartsList = async () => {
    const partsList = components.map((part, i) => {
      let text = `${i + 1}. ${part.name}`;
      if (part.quantity) text += ` (×${part.quantity})`;
      if (part.specifications) text += `\n   Specs: ${part.specifications}`;
      if (part.purpose) text += `\n   Purpose: ${part.purpose}`;
      if (part.estimatedCost) text += `\n   Cost: ${part.estimatedCost}`;
      if (part.alternatives && part.alternatives.length > 0) {
        text += `\n   Alternatives: ${part.alternatives.join(', ')}`;
      }
      return text;
    }).join('\n\n');

    try {
      await navigator.clipboard.writeText(partsList);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
                    ×{part.quantity}
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
        onClick={copyPartsList}
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

const QATab: React.FC<{
  plan: TechnicalLessonPlan;
  currentStopPoint?: StopPoint | null;
  currentStopIndex?: number;
  onAnswerSubmit?: (answer: string, evaluation: Evaluation) => void;
  onContinue?: () => void;
  onSelectStopPoint?: (index: number) => void;
  onSeekToTimestamp?: (timestamp: number) => void;
  mode?: AppMode;
  sessionHistory?: { question: string; answer: string; evaluation: Evaluation }[];
}> = ({ 
  plan, 
  currentStopPoint, 
  currentStopIndex = 0,
  onAnswerSubmit,
  onContinue,
  onSelectStopPoint,
  onSeekToTimestamp,
  mode,
  sessionHistory = []
}) => {
  const [answer, setAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<Evaluation | null>(null);

  if (!plan.stopPoints || plan.stopPoints.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-medium text-lg">No Q&A questions available</p>
        <p className="text-sm mt-2">This video doesn't have comprehension questions.</p>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!currentStopPoint || !answer.trim() || !onAnswerSubmit) return;
    
    setIsEvaluating(true);
    try {
      const { evaluateAnswer } = await import('../services/geminiService');
      const evaluation = await evaluateAnswer(currentStopPoint, answer, plan);
      
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

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Question List */}
      <div className="bg-slate-50 p-3 rounded-lg">
        <h3 className="text-sm font-bold text-slate-700 mb-2">Questions ({plan.stopPoints.length})</h3>
        <div className="space-y-1">
          {plan.stopPoints.map((sp, idx) => (
            <button
              key={sp.id}
              onClick={() => {
                onSelectStopPoint?.(idx);
                onSeekToTimestamp?.(sp.timestamp);
              }}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                idx === currentStopIndex
                  ? 'bg-indigo-100 text-indigo-700 font-medium'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
            >
              <span className="font-mono text-xs mr-2">{formatTimestamp(sp.timestamp)}</span>
              Q{idx + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Current Question */}
      {currentStopPoint && (
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
              Question {currentStopIndex + 1} of {plan.stopPoints.length}
            </span>
            <button
              onClick={() => onSeekToTimestamp?.(currentStopPoint.timestamp)}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
            >
              📺 {formatTimestamp(currentStopPoint.timestamp)}
            </button>
          </div>
          
          <p className="text-slate-800 font-medium mb-3">{currentStopPoint.question}</p>
          
          {/* Show evaluation loading or feedback */}
          {isEvaluating ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-lg font-medium text-slate-700">Evaluating your answer...</p>
              <p className="text-sm text-slate-500">Gemini is analyzing your response</p>
            </div>
          ) : mode === AppMode.FEEDBACK && currentEvaluation ? (
            <div className="space-y-4">
              {/* Score */}
              <div className="flex items-center gap-4">
                <div className={`text-4xl font-bold ${
                  currentEvaluation.score >= 4 ? 'text-green-500' : 
                  currentEvaluation.score >= 3 ? 'text-amber-500' : 'text-red-500'
                }`}>
                  {currentEvaluation.score}/5
                </div>
                <div className="flex-1">
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${
                        currentEvaluation.score >= 4 ? 'bg-green-500' : 
                        currentEvaluation.score >= 3 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${(currentEvaluation.score / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Feedback */}
              <div className="grid grid-cols-1 gap-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <h3 className="text-sm font-bold text-green-800 mb-2">✓ Strengths</h3>
                  <ul className="text-sm text-green-700 list-disc list-inside space-y-1">
                    {currentEvaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <h3 className="text-sm font-bold text-amber-800 mb-2">⚡ Improvements</h3>
                  <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                    {currentEvaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>

              {/* Better Answer */}
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <h3 className="text-sm font-bold text-indigo-900 mb-2">Better Answer</h3>
                <p className="text-sm text-indigo-800 italic">"{currentEvaluation.rewrittenAnswer}"</p>
              </div>

              {/* Continue Button */}
              <button
                onClick={handleContinue}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Continue to Next Question
              </button>
            </div>
          ) : (
            // Show answer form when not evaluating and no feedback
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
    </div>
  );
};

export default TechnicalPanel;
