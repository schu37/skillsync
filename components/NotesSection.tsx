import React, { useState, useEffect, useCallback } from 'react';
import { LessonPlan } from '../types';
import { generateVideoNotes } from '../services/geminiService';
import { notesStorage } from '../services/storageService';

interface NotesSectionProps {
  lessonPlan: LessonPlan;
}

const NotesSection: React.FC<NotesSectionProps> = ({ lessonPlan }) => {
  const [aiNotes, setAiNotes] = useState('');
  const [userNotes, setUserNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'ai' | 'user'>('ai');
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved notes on mount
  useEffect(() => {
    const saved = notesStorage.get(lessonPlan.videoUrl, lessonPlan.mode);
    if (saved) {
      setAiNotes(saved.aiGeneratedNotes);
      setUserNotes(saved.userNotes);
    }
  }, [lessonPlan.videoUrl, lessonPlan.mode]);

  // Auto-generate notes if none exist
  useEffect(() => {
    const saved = notesStorage.get(lessonPlan.videoUrl, lessonPlan.mode);
    if (!saved?.aiGeneratedNotes && !isGenerating) {
      handleGenerateNotes();
    }
  }, [lessonPlan.videoUrl]);

  const handleGenerateNotes = async () => {
    setIsGenerating(true);
    try {
      const notes = await generateVideoNotes(lessonPlan);
      setAiNotes(notes);
      notesStorage.updateAINotes(lessonPlan.videoUrl, lessonPlan.mode, notes);
    } catch (e) {
      console.error('Failed to generate notes:', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUserNotesChange = (value: string) => {
    setUserNotes(value);
    setHasChanges(true);
  };

  const handleSaveUserNotes = useCallback(() => {
    notesStorage.updateUserNotes(lessonPlan.videoUrl, lessonPlan.mode, userNotes);
    setHasChanges(false);
  }, [lessonPlan.videoUrl, lessonPlan.mode, userNotes]);

  // Auto-save user notes after 2 seconds of inactivity
  useEffect(() => {
    if (!hasChanges) return;
    const timer = setTimeout(handleSaveUserNotes, 2000);
    return () => clearTimeout(timer);
  }, [userNotes, hasChanges, handleSaveUserNotes]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notes
          </h2>
          {activeTab === 'ai' && (
            <button
              onClick={handleGenerateNotes}
              disabled={isGenerating}
              className="text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 disabled:opacity-50 flex items-center gap-1"
            >
              {isGenerating ? (
                <>
                  <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </>
              )}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('ai')}
            className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'ai'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            🤖 AI Notes
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'user'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            ✏️ My Notes
            {hasChanges && <span className="w-2 h-2 bg-amber-400 rounded-full" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'ai' ? (
          isGenerating ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
              <p>Generating notes from video content...</p>
            </div>
          ) : aiNotes ? (
            <div className="prose prose-sm prose-slate max-w-none">
              <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                {aiNotes}
              </div>
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              <p>No AI notes yet.</p>
              <button
                onClick={handleGenerateNotes}
                className="mt-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium"
              >
                Generate Notes
              </button>
            </div>
          )
        ) : (
          <div className="h-full flex flex-col">
            <textarea
              value={userNotes}
              onChange={(e) => handleUserNotesChange(e.target.value)}
              placeholder="Add your own notes here...&#10;&#10;• Key insights&#10;• Questions to revisit&#10;• Personal action items"
              className="flex-1 w-full p-3 border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm text-slate-700"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-slate-500">
              <span>{userNotes.length} characters</span>
              {hasChanges ? (
                <span className="text-amber-600">Unsaved changes (auto-saves)</span>
              ) : userNotes ? (
                <span className="text-green-600">✓ Saved</span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesSection;
