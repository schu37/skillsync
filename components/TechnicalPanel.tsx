import React, { useState } from 'react';
import { TechnicalLessonPlan, Component, Tool, BuildStep, DesignDecision } from '../types';
import SafetyBanner from './SafetyBanner';

interface TechnicalPanelProps {
  plan: TechnicalLessonPlan;
  onSeekToTimestamp?: (timestamp: number) => void;
}

type TabId = 'overview' | 'parts' | 'tools' | 'steps' | 'design';

const TechnicalPanel: React.FC<TechnicalPanelProps> = ({ plan, onSeekToTimestamp }) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: 'overview', label: 'Overview', icon: '📋' },
    { id: 'parts', label: 'Parts', icon: '📦', count: plan.components.length },
    { id: 'tools', label: 'Tools', icon: '🛠️', count: plan.tools.length },
    { id: 'steps', label: 'Steps', icon: '📝', count: plan.buildSteps.length },
    { id: 'design', label: 'Why?', icon: '🧠', count: plan.designDecisions.length },
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

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50 px-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap
              border-b-2 transition-colors
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <OverviewTab plan={plan} />
        )}
        {activeTab === 'parts' && (
          <PartsTab components={plan.components} />
        )}
        {activeTab === 'tools' && (
          <ToolsTab tools={plan.tools} />
        )}
        {activeTab === 'steps' && (
          <StepsTab steps={plan.buildSteps} onSeek={onSeekToTimestamp} formatTimestamp={formatTimestamp} />
        )}
        {activeTab === 'design' && (
          <DesignTab decisions={plan.designDecisions} onSeek={onSeekToTimestamp} formatTimestamp={formatTimestamp} />
        )}
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

const PartsTab: React.FC<{ components: Component[] }> = ({ components }) => (
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
    
    <button className="w-full py-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
      📋 Copy Parts List
    </button>
  </div>
);

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

export default TechnicalPanel;
