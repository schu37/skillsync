import React, { useState } from 'react';
import { SoftSkillsLessonPlan } from '../types';
import NotesSection from './NotesSection';
import VideoChatSection from './VideoChatSection';

interface OthersPanelProps {
  plan: SoftSkillsLessonPlan;
}

type TabId = 'notes' | 'chat';

const OthersPanel: React.FC<OthersPanelProps> = ({ plan }) => {
  const [activeTab, setActiveTab] = useState<TabId>('notes');

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Warning Banner */}
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

      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-1 text-xs font-bold text-slate-600 bg-slate-200 rounded-md uppercase tracking-wide">
            General Content
          </span>
        </div>
        <h2 className="text-lg font-bold text-slate-800 leading-tight">{plan.summary}</h2>
        {plan.videoContext && (
          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{plan.videoContext}</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50 px-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('notes')}
          className={`
            flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap
            border-b-2 transition-colors
            ${activeTab === 'notes'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'}
          `}
        >
          <span>📝</span>
          <span>Notes</span>
        </button>
        <button
          onClick={() => setActiveTab('chat')}
          className={`
            flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap
            border-b-2 transition-colors
            ${activeTab === 'chat'
              ? 'border-indigo-500 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'}
          `}
        >
          <span>💬</span>
          <span>Chat</span>
        </button>
      </div>

      {/* Content - Use hidden divs to preserve state across tab switches */}
      <div className="flex-1 overflow-hidden">
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

export default OthersPanel;
