import React, { useState, useEffect, useCallback } from 'react';
import { LessonPlan } from '../types';
import { generateVideoNotes } from '../services/geminiService';
import { notesStorage } from '../services/storageService';

interface NotesSectionProps {
  lessonPlan: LessonPlan;
}

const NotesSection: React.FC<NotesSectionProps> = ({ lessonPlan }) => {
  const [notes, setNotes] = useState(''); // Single unified notes
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved notes on mount
  useEffect(() => {
    const saved = notesStorage.get(lessonPlan.videoUrl, lessonPlan.mode);
    if (saved) {
      // Merge AI notes and user notes, preferring user notes if they exist
      const combinedNotes = saved.userNotes || saved.aiGeneratedNotes || '';
      setNotes(combinedNotes);
    }
  }, [lessonPlan.videoUrl, lessonPlan.mode]);

  const handleGenerateNotes = async () => {
    // Show confirmation if there are existing notes
    if (notes.trim()) {
      const confirmed = window.confirm(
        'Regenerating notes will replace your current notes. This action cannot be undone. Are you sure you want to continue?'
      );
      if (!confirmed) {
        return; // User cancelled
      }
    }
    
    setIsGenerating(true);
    try {
      const generatedNotes = await generateVideoNotes(lessonPlan);
      setNotes(generatedNotes);
      notesStorage.updateAINotes(lessonPlan.videoUrl, lessonPlan.mode, generatedNotes);
      notesStorage.updateUserNotes(lessonPlan.videoUrl, lessonPlan.mode, generatedNotes);
      setHasChanges(false);
    } catch (e) {
      console.error('Failed to generate notes:', e);
      alert('Failed to generate notes. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    setHasChanges(true);
  };

  const handleSaveNotes = useCallback(() => {
    notesStorage.updateUserNotes(lessonPlan.videoUrl, lessonPlan.mode, notes);
    setHasChanges(false);
  }, [lessonPlan.videoUrl, lessonPlan.mode, notes]);

  // Auto-save notes after 2 seconds of inactivity
  useEffect(() => {
    if (!hasChanges) return;
    const timer = setTimeout(handleSaveNotes, 2000);
    return () => clearTimeout(timer);
  }, [notes, hasChanges, handleSaveNotes]);

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notes
          </h2>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></span>
                Auto-saving...
              </span>
            )}
            {!hasChanges && notes && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved
              </span>
            )}
            <button
              onClick={handleGenerateNotes}
              disabled={isGenerating}
              className="text-xs px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              title={notes ? 'Regenerate AI notes (will replace current notes)' : 'Generate AI notes'}
            >
              {isGenerating ? (
                <>
                  <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {notes ? 'Regenerate' : 'Generate AI Notes'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-hidden flex flex-col">
        {isGenerating ? (
          <div className="flex-1 flex flex-col items-center justify-center text-indigo-600">
            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium">Generating notes from video...</p>
            <p className="text-xs text-slate-500 mt-2">This may take a moment</p>
          </div>
        ) : (
          <>
            {!notes && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 mb-2">
                  <strong>💡 Tip:</strong> Click "Generate AI Notes" to get started with AI-generated notes, then edit them as needed.
                </p>
                <p className="text-xs text-blue-600">
                  Or start writing your own notes from scratch!
                </p>
              </div>
            )}
            <textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Click 'Generate AI Notes' to get AI-generated notes, or start writing your own...&#10;&#10;📝 Your notes will be automatically saved as you type.&#10;&#10;You can edit the AI-generated notes or write from scratch.&#10;&#10;• Key insights from the video&#10;• Questions to revisit&#10;• Personal action items&#10;• Ideas and reflections"
              className="flex-1 w-full p-4 border border-slate-200 rounded-lg resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm text-slate-700 leading-relaxed"
            />
            <div className="flex justify-between items-center mt-2 text-xs text-slate-400">
              <span>{notes.length} characters</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotesSection;
