/**
 * ExportModal - Unified export dialog for all learning modes
 * 
 * Features:
 * - Selectable content sections (Notes, Q&A, Chat, Parts, Steps, etc.)
 * - Multiple export formats (Download MD, Google Docs, Google Sheets)
 * - Mode-aware section display
 */

import React, { useState, useMemo, useEffect } from 'react';
import { 
  LessonPlan, 
  Evaluation,
  isTechnicalPlan, 
  isSoftSkillsPlan,
  TechnicalLessonPlan,
  SkillMode,
} from '../types';
import { 
  downloadAsMarkdown, 
  exportToGoogleDocs, 
  generateMarkdownContent 
} from '../services/exportService';
import { notesStorage } from '../services/storageService';

// ============================================
// TYPES
// ============================================

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessonPlan: LessonPlan;
  sessionHistory?: { question: string; answer: string; evaluation: Evaluation }[];
  studyPack?: { markdown: string } | null;
  chatMessages?: { role: 'user' | 'assistant'; content: string; timestamp: Date }[];
  videoUrl?: string; // For fetching notes from localStorage
  googleAccessToken?: string | null;
  onRequestGoogleAuth?: () => void;
}

type ExportSection = {
  id: string;
  label: string;
  icon: string;
  description: string;
  available: boolean;
};

// ============================================
// COMPONENT
// ============================================

const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  lessonPlan,
  sessionHistory = [],
  studyPack,
  chatMessages = [],
  videoUrl,
  googleAccessToken,
  onRequestGoogleAuth,
}) => {
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(['summary', 'notes']));
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [userNotes, setUserNotes] = useState<string>('');
  const [aiNotes, setAiNotes] = useState<string>('');

  const isTechnical = isTechnicalPlan(lessonPlan);
  const technicalPlan = lessonPlan as TechnicalLessonPlan;

  // Fetch notes from localStorage when modal opens
  useEffect(() => {
    if (isOpen && videoUrl) {
      const storedNotes = notesStorage.get(videoUrl, lessonPlan.mode as SkillMode);
      if (storedNotes) {
        setUserNotes(storedNotes.userNotes || '');
        setAiNotes(storedNotes.aiGeneratedNotes || '');
      }
    }
  }, [isOpen, videoUrl, lessonPlan.mode]);

  // Build available sections based on mode
  const sections: ExportSection[] = useMemo(() => {
    const base: ExportSection[] = [
      {
        id: 'summary',
        label: 'Summary',
        icon: '📋',
        description: 'Video summary and detected skills',
        available: true,
      },
      {
        id: 'notes',
        label: 'Personal Notes',
        icon: '📝',
        description: 'Your notes taken during the session',
        available: true,
      },
    ];

    if (isTechnical) {
      base.push(
        {
          id: 'parts',
          label: 'Parts List',
          icon: '📦',
          description: `${technicalPlan.components.length} components needed`,
          available: technicalPlan.components.length > 0,
        },
        {
          id: 'tools',
          label: 'Tools',
          icon: '🛠️',
          description: `${technicalPlan.tools.length} tools required`,
          available: technicalPlan.tools.length > 0,
        },
        {
          id: 'steps',
          label: 'Build Steps',
          icon: '📐',
          description: `${technicalPlan.buildSteps.length} build instructions`,
          available: technicalPlan.buildSteps.length > 0,
        },
        {
          id: 'design',
          label: 'Design Decisions',
          icon: '🧠',
          description: 'Why certain choices were made',
          available: technicalPlan.designDecisions.length > 0,
        }
      );
    }

    // Q&A section (all modes with questions)
    base.push({
      id: 'qa',
      label: 'Q&A Questions',
      icon: '❓',
      description: `${lessonPlan.stopPoints?.length || 0} practice questions`,
      available: (lessonPlan.stopPoints?.length || 0) > 0,
    });

    // Session history
    if (sessionHistory.length > 0) {
      base.push({
        id: 'session',
        label: 'Your Answers',
        icon: '✍️',
        description: `${sessionHistory.length} answered questions with scores`,
        available: true,
      });
    }

    // Chat history
    if (chatMessages.length > 0) {
      base.push({
        id: 'chat',
        label: 'Chat History',
        icon: '💬',
        description: `${chatMessages.length} messages from video chat`,
        available: true,
      });
    }

    // Study pack for soft skills
    if (studyPack && isSoftSkillsPlan(lessonPlan)) {
      base.push({
        id: 'studypack',
        label: 'Study Pack',
        icon: '📚',
        description: 'Generated summary for review',
        available: true,
      });
    }

    return base.filter(s => s.available);
  }, [lessonPlan, sessionHistory, studyPack, chatMessages, isTechnical, technicalPlan]);

  const toggleSection = (id: string) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedSections(new Set(sections.map(s => s.id)));
  };

  const selectNone = () => {
    setSelectedSections(new Set());
  };

  // Generate custom markdown based on selected sections
  const generateCustomMarkdown = (): string => {
    const parts: string[] = [];
    
    parts.push(`# ${lessonPlan.summary}\n`);
    parts.push(`**Mode:** ${isTechnical ? '🔧 Technical Skills' : '💬 Soft Skills'}`);
    parts.push(`**Generated:** ${new Date().toLocaleDateString()}\n`);
    parts.push('---\n');

    if (selectedSections.has('summary')) {
      parts.push('## 📋 Summary\n');
      parts.push(`**Skills:** ${lessonPlan.skillsDetected.join(', ')}`);
      parts.push(`**Educational Score:** ${lessonPlan.suitabilityScore}/100\n`);
      parts.push(lessonPlan.videoContext.slice(0, 1000));
      parts.push('\n---\n');
    }

    if (selectedSections.has('parts') && isTechnical) {
      parts.push('## 📦 Parts List\n');
      parts.push('| Component | Qty | Specifications | Purpose |');
      parts.push('|-----------|-----|----------------|---------|');
      technicalPlan.components.forEach(c => {
        parts.push(`| ${c.name} | ${c.quantity || '-'} | ${c.specifications || '-'} | ${c.purpose || '-'} |`);
      });
      parts.push('\n---\n');
    }

    if (selectedSections.has('tools') && isTechnical) {
      parts.push('## 🛠️ Tools Required\n');
      technicalPlan.tools.forEach(t => {
        parts.push(`- ${t.required ? '**[Required]**' : '[Optional]'} **${t.name}** - ${t.purpose}`);
        if (t.safetyNotes) parts.push(`  - ⚠️ ${t.safetyNotes}`);
      });
      parts.push('\n---\n');
    }

    if (selectedSections.has('steps') && isTechnical) {
      parts.push('## 📐 Build Instructions\n');
      technicalPlan.buildSteps.forEach(step => {
        parts.push(`### Step ${step.stepNumber}: ${step.title}\n`);
        parts.push(step.description);
        if (step.tips?.length) {
          parts.push('\n**💡 Tips:**');
          step.tips.forEach(t => parts.push(`- ${t}`));
        }
        if (step.safetyWarnings?.length) {
          parts.push('\n**⚠️ Safety:**');
          step.safetyWarnings.forEach(w => parts.push(`- ${w}`));
        }
        parts.push('');
      });
      parts.push('---\n');
    }

    if (selectedSections.has('design') && isTechnical) {
      parts.push('## 🧠 Design Decisions\n');
      technicalPlan.designDecisions.forEach(dd => {
        parts.push(`### ${dd.question}\n`);
        parts.push(dd.answer);
        if (dd.tradeoffs) parts.push(`\n**Tradeoffs:** ${dd.tradeoffs}`);
        parts.push('');
      });
      parts.push('---\n');
    }

    if (selectedSections.has('qa') && lessonPlan.stopPoints?.length) {
      parts.push('## ❓ Practice Questions\n');
      lessonPlan.stopPoints.forEach((sp, i) => {
        parts.push(`### Question ${i + 1}\n`);
        parts.push(`**Context:** ${sp.contextSummary}\n`);
        parts.push(`**Question:** ${sp.question}\n`);
        parts.push(`**Rubric:** ${sp.rubric}\n`);
        parts.push('<details><summary>Reference Answer</summary>\n');
        parts.push(sp.referenceAnswer);
        parts.push('</details>\n');
      });
      parts.push('---\n');
    }

    if (selectedSections.has('session') && sessionHistory.length > 0) {
      parts.push('## ✍️ Your Session Results\n');
      sessionHistory.forEach((item, i) => {
        parts.push(`### Q${i + 1}: ${item.question}\n`);
        parts.push(`**Your Answer:** ${item.answer}\n`);
        parts.push(`**Score:** ${item.evaluation.score}/5 ${'⭐'.repeat(item.evaluation.score)}\n`);
        parts.push('**Strengths:**');
        item.evaluation.strengths.forEach(s => parts.push(`- ✓ ${s}`));
        parts.push('\n**Areas for Improvement:**');
        item.evaluation.improvements.forEach(s => parts.push(`- → ${s}`));
        parts.push(`\n**Improved Answer:** ${item.evaluation.rewrittenAnswer}\n`);
      });
      parts.push('---\n');
    }

    if (selectedSections.has('studypack') && studyPack) {
      parts.push('## 📚 Study Pack\n');
      parts.push(studyPack.markdown);
      parts.push('\n---\n');
    }

    if (selectedSections.has('chat') && chatMessages.length > 0) {
      parts.push('## 💬 Chat History\n');
      chatMessages.forEach(msg => {
        const role = msg.role === 'user' ? '**You:**' : '**AI:**';
        parts.push(`${role} ${msg.content}\n`);
      });
      parts.push('---\n');
    }

    if (selectedSections.has('notes')) {
      parts.push('## 📝 Personal Notes\n');
      if (userNotes.trim()) {
        parts.push(userNotes);
        parts.push('\n');
      }
      if (aiNotes.trim()) {
        parts.push('\n### AI-Generated Notes\n');
        parts.push(aiNotes);
        parts.push('\n');
      }
      if (!userNotes.trim() && !aiNotes.trim()) {
        parts.push('*No notes saved for this session.*\n');
      }
      parts.push('---\n');
    }

    parts.push('\n---\n*Generated by SkillSync - Turn passive watching into active mastery.*');
    
    return parts.join('\n');
  };

  const handleDownloadMarkdown = () => {
    const markdown = generateCustomMarkdown();
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SkillSync-${lessonPlan.summary.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportToGoogleDocs = async () => {
    if (!googleAccessToken) {
      onRequestGoogleAuth?.();
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const result = await exportToGoogleDocs(
        lessonPlan, 
        googleAccessToken, 
        sessionHistory,
        { userNotes, aiNotes }
      );
      window.open(result.documentUrl, '_blank');
      onClose();
    } catch (error) {
      console.error('Export to Google Docs failed:', error);
      setExportError(error instanceof Error ? error.message : 'Failed to export to Google Docs');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <span className="text-xl">📥</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Export Session</h2>
                <p className="text-sm text-slate-500">Choose what to include in your export</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Selection */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Quick actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={selectAll}
              className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="text-xs px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Clear All
            </button>
          </div>

          {/* Section checkboxes */}
          <div className="space-y-2">
            {sections.map((section) => (
              <label
                key={section.id}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedSections.has(section.id)
                    ? 'border-indigo-300 bg-indigo-50/50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSections.has(section.id)}
                  onChange={() => toggleSection(section.id)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-lg">{section.icon}</span>
                <div className="flex-1">
                  <div className="font-medium text-slate-700">{section.label}</div>
                  <div className="text-xs text-slate-500">{section.description}</div>
                </div>
              </label>
            ))}
          </div>

          {/* Error message */}
          {exportError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {exportError}
            </div>
          )}
        </div>

        {/* Footer with export buttons */}
        <div className="p-6 border-t border-slate-100 bg-slate-50">
          <div className="flex flex-wrap gap-3">
            {/* Download Markdown */}
            <button
              onClick={handleDownloadMarkdown}
              disabled={selectedSections.size === 0 || isExporting}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 text-white rounded-lg font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download .md
            </button>

            {/* Google Docs */}
            <button
              onClick={handleExportToGoogleDocs}
              disabled={selectedSections.size === 0 || isExporting}
              className="flex-1 min-w-[140px] flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6z"/>
                </svg>
              )}
              {googleAccessToken ? 'Google Docs' : 'Sign in for Docs'}
            </button>

          </div>

          <p className="text-xs text-slate-400 text-center mt-3">
            {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} selected
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
