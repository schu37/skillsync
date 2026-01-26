/**
 * KnowledgeGraph - Visualizes concept interconnections from the lesson plan
 * 
 * Shows key concepts as nodes and their relationships as connections.
 * Uses CSS/SVG for simple graph visualization without external dependencies.
 */

import React, { useMemo, useState } from 'react';
import { 
  LessonPlan, 
  isTechnicalPlan, 
  isSoftSkillsPlan,
  TechnicalLessonPlan,
  SoftSkillsLessonPlan,
} from '../types';
import { formatTimestamp } from '../utils';

interface KnowledgeGraphProps {
  lessonPlan: LessonPlan;
  onSeekToTimestamp?: (timestamp: number) => void;
}

interface ConceptNode {
  id: string;
  label: string;
  type: 'skill' | 'component' | 'tool' | 'step' | 'question' | 'concept';
  color: string;
  timestamp?: number;
  details?: string;
}

interface ConceptEdge {
  from: string;
  to: string;
  label?: string;
}

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  skill: { bg: 'bg-purple-100', border: 'border-purple-400', text: 'text-purple-700' },
  component: { bg: 'bg-blue-100', border: 'border-blue-400', text: 'text-blue-700' },
  tool: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-700' },
  step: { bg: 'bg-green-100', border: 'border-green-400', text: 'text-green-700' },
  question: { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-700' },
  concept: { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-700' },
};

const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ lessonPlan, onSeekToTimestamp }) => {
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Extract concepts from lesson plan
  const { nodes, edges } = useMemo(() => {
    const nodes: ConceptNode[] = [];
    const edges: ConceptEdge[] = [];

    // Add skills as central nodes
    if (lessonPlan.skillsDetected) {
      lessonPlan.skillsDetected.forEach((skill, i) => {
        nodes.push({
          id: `skill-${i}`,
          label: skill,
          type: 'skill',
          color: 'purple',
        });
      });
    }

    // Add questions as concept nodes
    if (lessonPlan.stopPoints) {
      lessonPlan.stopPoints.forEach((sp, i) => {
        const node: ConceptNode = {
          id: `q-${i}`,
          label: sp.question.length > 50 ? sp.question.slice(0, 50) + '...' : sp.question,
          type: 'question',
          color: 'indigo',
          timestamp: sp.timestamp,
          details: sp.contextSummary,
        };
        nodes.push(node);

        // Connect questions to related skills
        lessonPlan.skillsDetected?.forEach((skill, j) => {
          if (sp.question.toLowerCase().includes(skill.toLowerCase()) ||
              sp.contextSummary?.toLowerCase().includes(skill.toLowerCase())) {
            edges.push({ from: `skill-${j}`, to: `q-${i}`, label: 'tests' });
          }
        });
      });
    }

    // Add technical-specific nodes
    if (isTechnicalPlan(lessonPlan)) {
      // Components
      lessonPlan.components.forEach((comp, i) => {
        nodes.push({
          id: `comp-${i}`,
          label: comp.name,
          type: 'component',
          color: 'blue',
          details: comp.purpose,
        });
      });

      // Tools
      lessonPlan.tools.forEach((tool, i) => {
        nodes.push({
          id: `tool-${i}`,
          label: tool.name,
          type: 'tool',
          color: 'amber',
          details: tool.purpose,
        });
      });

      // Build steps
      lessonPlan.buildSteps.forEach((step, i) => {
        nodes.push({
          id: `step-${i}`,
          label: step.title,
          type: 'step',
          color: 'green',
          timestamp: step.timestamp,
          details: step.description,
        });

        // Connect steps in sequence
        if (i > 0) {
          edges.push({ from: `step-${i - 1}`, to: `step-${i}`, label: 'then' });
        }
      });

      // Connect components to steps that use them
      lessonPlan.buildSteps.forEach((step, stepIdx) => {
        lessonPlan.components.forEach((comp, compIdx) => {
          if (step.description.toLowerCase().includes(comp.name.toLowerCase())) {
            edges.push({ from: `comp-${compIdx}`, to: `step-${stepIdx}`, label: 'used in' });
          }
        });
      });
    }

    // Add soft skills concepts
    if (isSoftSkillsPlan(lessonPlan)) {
      // Add scenario info as a concept
      if (lessonPlan.scenarioPreset) {
        nodes.push({
          id: 'scenario-0',
          label: lessonPlan.scenarioPreset,
          type: 'concept',
          color: 'slate',
          details: `Scenario: ${lessonPlan.scenarioPreset}`,
        });
        
        // Connect scenario to skills
        lessonPlan.skillsDetected?.forEach((skill, j) => {
          edges.push({ from: `skill-${j}`, to: 'scenario-0' });
        });
      }
      
      // Add roleplay persona if available
      if (lessonPlan.rolePlayPersona) {
        nodes.push({
          id: 'persona-0',
          label: 'Roleplay Partner',
          type: 'concept',
          color: 'slate',
          details: lessonPlan.rolePlayPersona,
        });
      }
    }

    return { nodes, edges };
  }, [lessonPlan]);

  // Group nodes by type for the grid view
  const groupedNodes = useMemo((): Record<string, ConceptNode[]> => {
    const groups: Record<string, ConceptNode[]> = {};
    nodes.forEach(node => {
      if (!groups[node.type]) groups[node.type] = [];
      groups[node.type].push(node);
    });
    return groups;
  }, [nodes]);

  const typeLabels: Record<string, string> = {
    skill: '🎯 Skills',
    component: '📦 Components',
    tool: '🛠️ Tools',
    step: '📝 Build Steps',
    question: '❓ Questions',
    concept: '💡 Key Concepts',
  };

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl">🕸️</span>
        </div>
        <p className="font-medium">No knowledge graph available</p>
        <p className="text-sm mt-2 text-center">
          The video analysis didn't produce enough concepts to visualize.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800">Knowledge Graph</h3>
          <p className="text-xs text-slate-500">{nodes.length} concepts · {edges.length} connections</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === 'grid' 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              viewMode === 'list' 
                ? 'bg-indigo-100 text-indigo-700' 
                : 'bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Content - split layout when node selected */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main Graph Area */}
        <div className={`overflow-y-auto p-4 ${selectedNode ? 'flex-1' : 'w-full'}`}>
        {viewMode === 'grid' ? (
          <div className="space-y-6">
            {(Object.entries(groupedNodes) as [string, ConceptNode[]][]).map(([type, typeNodes]) => (
              <div key={type}>
                <h4 className="text-sm font-bold text-slate-700 mb-3">{typeLabels[type] || type}</h4>
                <div className="flex flex-wrap gap-2">
                  {typeNodes.map(node => {
                    const colors = TYPE_COLORS[node.type] || TYPE_COLORS.concept;
                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                        className={`
                          px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all cursor-pointer
                          ${colors.bg} ${colors.border} ${colors.text}
                          ${selectedNode?.id === node.id ? 'ring-2 ring-offset-2 ring-indigo-500 scale-105 shadow-lg' : ''}
                          hover:shadow-md hover:scale-102
                        `}
                      >
                        {node.label}
                        {node.timestamp !== undefined && (
                          <span className="ml-1 opacity-60 text-xs">
                            ({formatTimestamp(node.timestamp)})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {nodes.map(node => {
              const colors = TYPE_COLORS[node.type] || TYPE_COLORS.concept;
              const relatedEdges = edges.filter(e => e.from === node.id || e.to === node.id);
              
              return (
                <div
                  key={node.id}
                  className={`p-3 rounded-lg border ${colors.bg} ${colors.border} ${
                    selectedNode?.id === node.id ? 'ring-2 ring-indigo-500' : ''
                  }`}
                  onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold uppercase ${colors.text}`}>
                        {node.type}
                      </span>
                      <span className="font-medium text-slate-800">{node.label}</span>
                    </div>
                    {node.timestamp !== undefined && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSeekToTimestamp?.(node.timestamp!);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-mono"
                      >
                        📺 {formatTimestamp(node.timestamp)}
                      </button>
                    )}
                  </div>
                  {relatedEdges.length > 0 && (
                    <div className="mt-2 text-xs text-slate-500">
                      Connected to: {relatedEdges.length} other concepts
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        </div>

        {/* Selected Node Details - Sidebar Panel */}
        {selectedNode && (
          <div className="w-72 border-l border-slate-200 bg-white overflow-y-auto p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-800 text-lg">{selectedNode.label}</h4>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
              >
                ✕
              </button>
            </div>
            <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
              TYPE_COLORS[selectedNode.type]?.bg || 'bg-slate-100'
            } ${TYPE_COLORS[selectedNode.type]?.text || 'text-slate-700'}`}>
              {selectedNode.type}
            </span>
            {selectedNode.details && (
              <p className="mt-3 text-sm text-slate-600 leading-relaxed">{selectedNode.details}</p>
            )}
            {selectedNode.timestamp !== undefined && (
              <button
                onClick={() => onSeekToTimestamp?.(selectedNode.timestamp!)}
                className="mt-4 w-full px-3 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
              >
                📺 Jump to {formatTimestamp(selectedNode.timestamp)}
              </button>
            )}
            
            {/* Show connections */}
            {edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Connections ({edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length})</h5>
                <div className="space-y-2">
                  {edges
                    .filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
                    .map((edge, i) => {
                      const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                      const otherNode = nodes.find(n => n.id === otherId);
                      if (!otherNode) return null;
                      const otherColors = TYPE_COLORS[otherNode.type] || TYPE_COLORS.concept;
                      
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedNode(otherNode)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors flex items-center gap-2 ${otherColors.bg} ${otherColors.border} hover:shadow-sm`}
                        >
                          <span className="text-slate-500 text-xs">{edge.label || '→'}</span>
                          <span className={`font-medium ${otherColors.text}`}>{otherNode.label}</span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="p-3 border-t border-slate-100 bg-slate-50">
        <div className="flex flex-wrap gap-3 justify-center">
          {Object.entries(TYPE_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded ${colors.bg} ${colors.border} border`} />
              <span className="text-xs text-slate-500 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraph;
