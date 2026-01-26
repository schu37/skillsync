import React, { useState, useMemo } from 'react';
import { AppMode, LessonPlan, StopPoint, Evaluation, StudyPack } from '../types';
import { evaluateAnswer } from '../services/geminiService';
import { downloadAsMarkdown } from '../services/exportService';
import { QUESTION_TYPES } from '../constants';
import { formatTimestamp } from '../utils';
import { FeedbackDisplay, LoadingSpinner } from './shared';
import NotesSection from './NotesSection';
import VideoChatSection from './VideoChatSection';

interface InteractionPanelProps {
  mode: AppMode;
  lessonPlan: LessonPlan | null;
  currentStopPoint: StopPoint | null;
  currentStopIndex: number;
  onAnswerSubmit: (answer: string, evaluation: Evaluation) => void;
  onContinue: () => void;
  onSelectStopPoint: (index: number) => void;
  onExportToGoogleDocs?: () => void;
  onRegenerateQuestions?: () => void;
  onSeekToTimestamp?: (timestamp: number) => void; // NEW: seek video
  studyPack: StudyPack | null;
  sessionHistory?: { question: string; answer: string; evaluation: Evaluation }[];
  answeredQuestionIds?: Set<string>;
  skipAnswered?: boolean;
  onToggleSkipAnswered?: () => void;
  // NEW: Voice roleplay props
  showVoiceRoleplayButton?: boolean;
  onStartVoiceRoleplay?: () => void;
  // NEW: Selected scenario from dropdown
  selectedScenario?: string;
  googleAccessToken?: string | null;
  onRequestGoogleAuth?: () => void;
}

// Helper to get question type info
const getQuestionTypeInfo = (typeId: string) => {
  const typeKey = Object.keys(QUESTION_TYPES).find(
    k => QUESTION_TYPES[k as keyof typeof QUESTION_TYPES].id === typeId
  );
  if (!typeKey) return null;
  return QUESTION_TYPES[typeKey as keyof typeof QUESTION_TYPES];
};

type PanelTab = 'qa' | 'notes' | 'chat';

const InteractionPanel: React.FC<InteractionPanelProps> = ({
  mode,
  lessonPlan,
  currentStopPoint,
  currentStopIndex,
  onAnswerSubmit,
  onContinue,
  onSelectStopPoint,
  onExportToGoogleDocs,
  onRegenerateQuestions,
  onSeekToTimestamp,
  studyPack,
  sessionHistory = [],
  answeredQuestionIds = new Set(),
  skipAnswered = false,
  onToggleSkipAnswered,
  showVoiceRoleplayButton = false,
  onStartVoiceRoleplay,
  selectedScenario,
  googleAccessToken,
  onRequestGoogleAuth,
}) => {
  const [answer, setAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<Evaluation | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>('qa');

  // Filter stop points based on skip setting
  const visibleStopPoints = useMemo(() => {
    if (!lessonPlan || !skipAnswered) return lessonPlan?.stopPoints || [];
    return lessonPlan.stopPoints.filter(sp => !answeredQuestionIds.has(sp.id));
  }, [lessonPlan, skipAnswered, answeredQuestionIds]);

  const handleSubmit = async () => {
    if (!currentStopPoint || !answer.trim() || !lessonPlan) return;
    
    setIsEvaluating(true);
    try {
      console.log('🔄 Submitting answer for evaluation...');
      const evaluation = await evaluateAnswer(currentStopPoint, answer, lessonPlan);
      console.log('✅ Evaluation received:', evaluation);
      
      // Validate the evaluation object
      if (!evaluation || typeof evaluation.score !== 'number') {
        throw new Error('Invalid evaluation response');
      }
      
      // Ensure arrays exist
      const safeEvaluation = {
        ...evaluation,
        strengths: evaluation.strengths || [],
        improvements: evaluation.improvements || [],
        evidence: evaluation.evidence || [],
        rewrittenAnswer: evaluation.rewrittenAnswer || 'No improved answer provided.',
      };
      
      setCurrentEvaluation(safeEvaluation);
      setIsEvaluating(false); // Clear loading state before transitioning
      onAnswerSubmit(answer, safeEvaluation);
    } catch (e) {
      console.error('❌ Evaluation error:', e);
      alert("Failed to evaluate. Please try again. Error: " + (e instanceof Error ? e.message : 'Unknown error'));
      setIsEvaluating(false);
    }
  };

  const handleContinue = () => {
    setAnswer("");
    setCurrentEvaluation(null);
    onContinue();
  };

  // Navigation helpers
  const totalQuestions = lessonPlan?.stopPoints.length || 0;
  const canGoPrev = currentStopIndex > 0;
  const canGoNext = currentStopIndex < totalQuestions - 1;

  const handleNavigate = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? currentStopIndex - 1 : currentStopIndex + 1;
    if (newIndex >= 0 && newIndex < totalQuestions) {
      onSelectStopPoint(newIndex);
      // Seek video to the new question's timestamp
      if (lessonPlan && onSeekToTimestamp) {
        onSeekToTimestamp(lessonPlan.stopPoints[newIndex].timestamp);
      }
    }
  };

  // Handle clicking a question - also seeks video
  const handleSelectQuestion = (index: number) => {
    onSelectStopPoint(index);
    if (lessonPlan && onSeekToTimestamp) {
      onSeekToTimestamp(lessonPlan.stopPoints[index].timestamp);
    }
  };

  // Show tabs only when we have a lesson plan
  const showTabs = lessonPlan && mode !== AppMode.IDLE && mode !== AppMode.LOADING_PLAN;

  if (mode === AppMode.IDLE || mode === AppMode.LOADING_PLAN) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center bg-white rounded-xl shadow-sm border border-slate-100">
        {mode === AppMode.LOADING_PLAN ? (
           <div className="flex flex-col items-center gap-4">
             <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
             <p className="font-medium text-lg text-slate-700">Analyzing video content...</p>
             <p className="text-sm">Gemini is watching the video and generating questions.</p>
           </div>
        ) : (
          <>
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-lg font-medium">Ready to start</p>
            <p className="text-sm mt-2">Enter a YouTube video URL above to begin. <span className="text-slate-400">(Only YouTube is supported)</span></p>
          </>
        )}
      </div>
    );
  }

  // Render tab content - keep all tabs mounted to preserve state
  const renderTabContent = () => {
    if (!lessonPlan) return null;

    return (
      <>
        {/* Notes Tab - hidden when not active */}
        <div className={activeTab === 'notes' ? 'flex flex-col h-full' : 'hidden'}>
          <NotesSection lessonPlan={lessonPlan} />
        </div>
        
        {/* Chat Tab - hidden when not active */}
        <div className={activeTab === 'chat' ? 'flex flex-col h-full' : 'hidden'}>
          <VideoChatSection 
            lessonPlan={lessonPlan} 
            selectedScenario={selectedScenario} 
            onStartVoiceRoleplay={onStartVoiceRoleplay}
            googleAccessToken={googleAccessToken}
            onRequestGoogleAuth={onRequestGoogleAuth}
          />
        </div>
        
        {/* Q&A Tab - hidden when not active */}
        <div className={activeTab === 'qa' ? 'flex flex-col h-full' : 'hidden'}>
          {renderQAContent()}
        </div>
      </>
    );
  };

  // Extract existing Q&A rendering into a function
  const renderQAContent = () => {
    // Question Interaction State
    if (mode === AppMode.PAUSED_INTERACTION || mode === AppMode.EVALUATING || mode === AppMode.FEEDBACK) {
      // Handle missing stop point gracefully
      if (!currentStopPoint) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
            <p className="text-lg font-medium">Loading question...</p>
          </div>
        );
      }

      const questionTypeInfo = getQuestionTypeInfo(currentStopPoint.questionType);
      const isAlreadyAnswered = answeredQuestionIds.has(currentStopPoint.id);

      // Get answered status for prev/next questions
      const prevAnswered = canGoPrev && lessonPlan 
        ? answeredQuestionIds.has(lessonPlan.stopPoints[currentStopIndex - 1].id) 
        : false;
      const nextAnswered = canGoNext && lessonPlan 
        ? answeredQuestionIds.has(lessonPlan.stopPoints[currentStopIndex + 1].id) 
        : false;

      return (
        <div className="flex flex-col h-full">
          {/* Header with Navigation */}
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            {/* Navigation Row */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => handleNavigate('prev')}
                disabled={!canGoPrev}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  canGoPrev
                    ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="hidden sm:inline">Prev</span>
                {canGoPrev && prevAnswered && (
                  <span className="text-green-500 text-xs">✓</span>
                )}
              </button>

              {/* Question Progress Indicator */}
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {lessonPlan?.stopPoints.map((sp, idx) => (
                    <button
                      key={sp.id}
                      onClick={() => handleSelectQuestion(idx)}
                      className={`w-2.5 h-2.5 rounded-full transition-all ${
                        idx === currentStopIndex
                          ? 'bg-indigo-600 ring-2 ring-indigo-200 scale-125'
                          : answeredQuestionIds.has(sp.id)
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-slate-300 hover:bg-slate-400'
                      }`}
                      title={`Q${idx + 1}: ${sp.question.slice(0, 50)}...${answeredQuestionIds.has(sp.id) ? ' (Answered)' : ''}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-slate-600">
                  {currentStopIndex + 1}/{totalQuestions}
                </span>
              </div>

              <button
                onClick={() => handleNavigate('next')}
                disabled={!canGoNext}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  canGoNext
                    ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {canGoNext && nextAnswered && (
                  <span className="text-green-500 text-xs">✓</span>
                )}
                <span className="hidden sm:inline">Next</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Question Info */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
               <span className="px-2 py-1 text-xs font-bold text-indigo-600 bg-indigo-100 rounded-md uppercase tracking-wide">
                 Q{currentStopIndex + 1}
               </span>
               {questionTypeInfo && (
                 <span 
                   className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-md"
                   title={questionTypeInfo.description}
                 >
                   {questionTypeInfo.name}
                 </span>
               )}
               {isAlreadyAnswered && (
                 <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-md flex items-center gap-1">
                   <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                   </svg>
                   Answered
                 </span>
               )}
               <button
                 onClick={() => onSeekToTimestamp?.(currentStopPoint.timestamp)}
                 className="text-xs text-slate-500 font-mono ml-auto hover:text-indigo-600 flex items-center gap-1"
                 title="Click to seek video to this point"
               >
                 <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                 </svg>
                 {new Date(currentStopPoint.timestamp * 1000).toISOString().slice(14, 19)}
               </button>
            </div>
            <h2 className="text-lg font-bold text-slate-800 leading-tight">{currentStopPoint.question}</h2>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {/* Show loading during evaluation */}
            {isEvaluating && (
              <LoadingSpinner 
                message="Evaluating your answer..."
                subMessage="Gemini is analyzing your response"
                size="lg"
              />
            )}
            
            {/* Show feedback after evaluation */}
            {!isEvaluating && mode === AppMode.FEEDBACK && currentEvaluation ? (
              <FeedbackDisplay 
                evaluation={currentEvaluation}
                showContinueButton={false}
              />
            ) : !isEvaluating ? (
              /* Input Form */
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg text-slate-600 text-sm italic">
                  {currentStopPoint.contextSummary}
                </div>
                
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-slate-700">Your Answer</label>
                  <span className={`text-xs font-mono ${answer.length > 450 ? (answer.length >= 500 ? 'text-red-500' : 'text-amber-500') : 'text-slate-400'}`}>
                    {answer.length}/500
                  </span>
                </div>
                <textarea
                  className="w-full h-48 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-slate-700 bg-white"
                  placeholder="Type your answer here..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value.slice(0, 500))}
                  maxLength={500}
                  disabled={isEvaluating}
                />
              </div>
            ) : null}
          </div>

          {/* Footer Actions - Add navigation here too */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center gap-3">
            {/* Left: Quick nav for answered users */}
            <div className="flex gap-2">
              {canGoPrev && (
                <button
                  onClick={() => handleNavigate('prev')}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Previous question"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              {canGoNext && mode !== AppMode.FEEDBACK && (
                <button
                  onClick={() => handleNavigate('next')}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Skip to next question"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>

            {/* Right: Main actions */}
            <div className="flex gap-3">
              {mode === AppMode.FEEDBACK && currentEvaluation ? (
                <>
                  {canGoNext ? (
                    <button
                      onClick={() => handleNavigate('next')}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      Next Question
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={handleContinue}
                      className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                    >
                      Finish Session
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                </>
              ) : isEvaluating ? (
                <div className="px-6 py-2 text-slate-500 font-medium flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Evaluating...
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!answer.trim()}
                  className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                    !answer.trim()
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  Submit Answer
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Study Pack State
    if (mode === AppMode.PACK_READY && studyPack) {
      return (
          <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
               <div className="p-6 border-b border-slate-100 bg-slate-50">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold text-slate-800">Study Pack</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => {
                         const blob = new Blob([studyPack.markdown], { type: "text/markdown" });
                         const url = URL.createObjectURL(blob);
                         const a = document.createElement("a");
                         a.href = url;
                         a.download = "StudyPack.md";
                         a.click();
                      }}
                      className="text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg shadow-sm flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download .md
                    </button>
                    
                    {lessonPlan && (
                      <button 
                        onClick={() => downloadAsMarkdown(lessonPlan, sessionHistory)}
                        className="text-sm bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-2 rounded-lg shadow-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Full Session .md
                      </button>
                    )}
                    
                    {onExportToGoogleDocs && (
                      <button 
                        onClick={onExportToGoogleDocs}
                        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg shadow-sm flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zM20 22.364H4.91V1.636h7.273v6.545h6.545v14.182h1.273zM4 0h10v2H4z"/>
                        </svg>
                        Open in Google Docs
                      </button>
                    )}
                  </div>
               </div>
               <div className="p-8 overflow-y-auto prose prose-indigo max-w-none text-sm">
                  <pre className="whitespace-pre-wrap font-sans text-slate-600">
                      {studyPack.markdown}
                  </pre>
               </div>
          </div>
      )
    }

    // Playing State (Default View showing Lesson Plan)
    if (lessonPlan) {
      const answeredCount = answeredQuestionIds.size;
      const totalCount = lessonPlan.stopPoints.length;

      return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
           <div className="p-6 border-b border-slate-100 bg-slate-50">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-xl font-bold text-slate-800">Lesson Plan</h2>
                {/* Export buttons - available as soon as lesson plan is ready */}
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => downloadAsMarkdown(lessonPlan, sessionHistory)}
                    className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-2 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5"
                    title="Download lesson plan and answers as Markdown"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export .md
                  </button>
                  
                  {onExportToGoogleDocs && (
                    <button 
                      onClick={onExportToGoogleDocs}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5"
                      title="Export to Google Docs"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14.727 6.727H14V0H4.91c-.905 0-1.637.732-1.637 1.636v20.728c0 .904.732 1.636 1.636 1.636h14.182c.904 0 1.636-.732 1.636-1.636V6.727h-6zM20 22.364H4.91V1.636h7.273v6.545h6.545v14.182h1.273zM4 0h10v2H4z"/>
                      </svg>
                      Google Docs
                    </button>
                  )}
                </div>
              </div>
              
              {/* Progress and controls row */}
              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-200">
                {/* Progress indicator */}
                <div className="text-sm text-slate-600">
                  <span className="font-medium">{answeredCount}</span>
                  <span className="text-slate-400">/{totalCount} answered</span>
                </div>
                
                {/* Skip answered toggle */}
                {onToggleSkipAnswered && answeredCount > 0 && (
                  <button
                    onClick={onToggleSkipAnswered}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                      skipAnswered 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {skipAnswered ? '✓ Skipping answered' : 'Skip answered'}
                  </button>
                )}
                
                {/* Regenerate questions button */}
                {onRegenerateQuestions && (
                  <button
                    onClick={onRegenerateQuestions}
                    className="text-xs px-2 py-1 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center gap-1"
                    title="Generate different questions for this video"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    New Questions
                  </button>
                )}
              </div>
              
              <div className="flex gap-2 mt-2">
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded uppercase">
                      Suitability: {lessonPlan.suitabilityScore}%
                  </span>
                  {lessonPlan.skillsDetected.slice(0, 3).map(skill => (
                      <span key={skill} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded truncate max-w-[100px]">
                          {skill}
                      </span>
                  ))}
              </div>
           </div>
           <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg text-slate-600 text-sm italic">
                  {lessonPlan.summary}
              </div>
              
              {/* Question Types Legend */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h4 className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-2">Question Types</h4>
                <div className="flex flex-wrap gap-2">
                  {['factual', 'prediction', 'diagnostic', 'synthesis', 'open-ended'].map(typeId => {
                    const info = getQuestionTypeInfo(typeId);
                    if (!info) return null;
                    return (
                      <span 
                        key={typeId}
                        className="text-xs px-2 py-1 bg-white rounded border border-blue-200 text-blue-700"
                        title={info.description}
                      >
                        {info.name}
                      </span>
                    );
                  })}
                </div>
              </div>
              
              <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Video Stop Points</h3>
                  <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-2">
                      {(skipAnswered ? visibleStopPoints : lessonPlan.stopPoints).map((sp) => {
                          const actualIdx = lessonPlan.stopPoints.findIndex(s => s.id === sp.id);
                          const isPast = actualIdx < currentStopIndex;
                          const isCurrent = currentStopIndex === actualIdx && (mode === AppMode.PAUSED_INTERACTION || mode === AppMode.FEEDBACK);
                          const isAnswered = answeredQuestionIds.has(sp.id);
                          const typeInfo = getQuestionTypeInfo(sp.questionType);
                          
                          return (
                              <div key={sp.id} className="ml-6 relative">
                                  <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white shadow-sm 
                                      ${isCurrent ? 'bg-indigo-600 ring-4 ring-indigo-100' : isAnswered ? 'bg-green-500' : isPast ? 'bg-amber-400' : 'bg-slate-300'}`} 
                                  />
                                  <button
                                      onClick={() => handleSelectQuestion(actualIdx)}
                                      className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${isCurrent ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-300 hover:bg-indigo-50'}`}
                                  >
                                      <div className="flex justify-between items-start mb-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-indigo-600 uppercase">Q{actualIdx + 1}</span>
                                            {typeInfo && (
                                              <span className="text-xs text-slate-500">{typeInfo.name}</span>
                                            )}
                                            {isAnswered && (
                                              <span className="text-xs text-green-600">✓</span>
                                            )}
                                          </div>
                                          <span className="text-xs font-mono text-slate-400">{new Date(sp.timestamp * 1000).toISOString().slice(14, 19)}</span>
                                      </div>
                                      <p className="text-sm text-slate-800 font-medium">{sp.question}</p>
                                      {!isAnswered && mode !== AppMode.PAUSED_INTERACTION && mode !== AppMode.FEEDBACK && (
                                          <p className="text-xs text-indigo-500 mt-2">Click to answer →</p>
                                      )}
                                      {isAnswered && (
                                          <p className="text-xs text-green-600 mt-2">Click to review or re-answer →</p>
                                      )}
                                  </button>
                              </div>
                          );
                      })}
                  </div>
              </div>

              {/* Voice Roleplay Button - Inside the scrollable area */}
              {showVoiceRoleplayButton && onStartVoiceRoleplay && (
                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={onStartVoiceRoleplay}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    🎙️ Practice with Voice Roleplay
                  </button>
                  <p className="text-xs text-center text-slate-500 mt-2">
                    Have a voice conversation with an AI playing a character from the video
                  </p>
                </div>
              )}
            </div>
          </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tab Navigation - Only show when lesson plan exists */}
      {showTabs && (
        <div className="sticky top-0 z-10 flex gap-1 p-2 bg-white rounded-t-xl border border-b-0 border-slate-100 shadow-sm">
          <button
            onClick={() => setActiveTab('qa')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'qa'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Q&A
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'notes'
                ? 'bg-amber-100 text-amber-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Notes
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'chat'
                ? 'bg-purple-100 text-purple-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className={`flex-1 ${showTabs ? 'rounded-t-none' : ''}`}>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default InteractionPanel;
