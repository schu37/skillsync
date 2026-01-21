import React, { useState } from 'react';
import { AppMode, LessonPlan, StopPoint, Evaluation, StudyPack } from '../types';
import { evaluateAnswer } from '../services/geminiService';
import { downloadAsMarkdown } from '../services/exportService';

interface InteractionPanelProps {
  mode: AppMode;
  lessonPlan: LessonPlan | null;
  currentStopPoint: StopPoint | null;
  currentStopIndex: number;
  onAnswerSubmit: (answer: string, evaluation: Evaluation) => void;
  onContinue: () => void;
  onSelectStopPoint: (index: number) => void;
  onExportToGoogleDocs?: () => void;
  studyPack: StudyPack | null;
  sessionHistory?: { question: string; answer: string; evaluation: Evaluation }[];
}

const InteractionPanel: React.FC<InteractionPanelProps> = ({
  mode,
  lessonPlan,
  currentStopPoint,
  currentStopIndex,
  onAnswerSubmit,
  onContinue,
  onSelectStopPoint,
  onExportToGoogleDocs,
  studyPack,
  sessionHistory = [],
}) => {
  const [answer, setAnswer] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [currentEvaluation, setCurrentEvaluation] = useState<Evaluation | null>(null);

  const handleSubmit = async () => {
    if (!currentStopPoint || !answer.trim() || !lessonPlan) return;
    
    setIsEvaluating(true);
    try {
      const evaluation = await evaluateAnswer(currentStopPoint, answer, lessonPlan);
      setCurrentEvaluation(evaluation);
      onAnswerSubmit(answer, evaluation);
    } catch (e) {
      alert("Failed to evaluate. Please try again.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleContinue = () => {
    setAnswer("");
    setCurrentEvaluation(null);
    onContinue();
  };

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
            <p className="text-sm mt-2">Enter a YouTube URL above to begin.</p>
          </>
        )}
      </div>
    );
  }

  // Question Interaction State
  if (mode === AppMode.PAUSED_INTERACTION || mode === AppMode.EVALUATING || mode === AppMode.FEEDBACK) {
    if (!currentStopPoint) return null;

    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 mb-2">
             <span className="px-2 py-1 text-xs font-bold text-indigo-600 bg-indigo-100 rounded-md uppercase tracking-wide">
               Check Point
             </span>
             <span className="text-xs text-slate-500 font-mono">
               {new Date(currentStopPoint.timestamp * 1000).toISOString().substr(14, 5)}
             </span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 leading-tight">{currentStopPoint.question}</h2>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {mode === AppMode.FEEDBACK && currentEvaluation ? (
            <div className="space-y-6 animate-fadeIn">
              {/* Score */}
              <div className="flex items-center gap-4">
                 <div className={`text-4xl font-bold ${currentEvaluation.score >= 4 ? 'text-green-500' : currentEvaluation.score >= 3 ? 'text-amber-500' : 'text-red-500'}`}>
                   {currentEvaluation.score}/5
                 </div>
                 <div className="flex-1">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${currentEvaluation.score >= 4 ? 'bg-green-500' : currentEvaluation.score >= 3 ? 'bg-amber-500' : 'bg-red-500'}`} 
                        style={{ width: `${(currentEvaluation.score / 5) * 100}%` }} 
                      />
                    </div>
                 </div>
              </div>

              {/* Feedback */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                  <h3 className="text-sm font-bold text-green-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Strengths
                  </h3>
                  <ul className="text-sm text-green-700 list-disc list-inside space-y-1">
                    {currentEvaluation.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <h3 className="text-sm font-bold text-amber-800 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Improvements
                  </h3>
                  <ul className="text-sm text-amber-700 list-disc list-inside space-y-1">
                    {currentEvaluation.improvements.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </div>

              {/* Better Answer */}
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                 <h3 className="text-sm font-bold text-indigo-900 mb-2">Better Answer</h3>
                 <p className="text-sm text-indigo-800 italic">"{currentEvaluation.rewrittenAnswer}"</p>
              </div>
              
              {/* Evidence */}
              {currentEvaluation.evidence.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2">Supporting Evidence</h3>
                  <div className="space-y-2">
                    {currentEvaluation.evidence.map((ev, i) => (
                      <div key={i} className="text-xs bg-slate-50 p-2 rounded border-l-2 border-slate-300 text-slate-600">
                        <span className="font-mono font-bold mr-2 text-slate-400">
                          {new Date(ev.timestamp * 1000).toISOString().substr(14, 5)}
                        </span>
                        "{ev.text}"
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Input Form */
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mb-4">
                <strong>Context:</strong> {currentStopPoint.contextSummary}
              </div>
              
              <label className="block text-sm font-medium text-slate-700">Your Answer</label>
              <textarea
                className="w-full h-48 p-4 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-slate-700 bg-white"
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isEvaluating}
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          {mode === AppMode.FEEDBACK ? (
            <button
              onClick={handleContinue}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              Continue Video
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isEvaluating || !answer.trim()}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                isEvaluating || !answer.trim()
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isEvaluating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Evaluating...
                </>
              ) : (
                'Submit Answer'
              )}
            </button>
          )}
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
    return (
      <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h2 className="text-xl font-bold text-slate-800">Lesson Plan</h2>
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
            
            <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Video Stop Points</h3>
                <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-2">
                    {lessonPlan.stopPoints.map((sp, idx) => {
                        const isPast = idx < currentStopIndex;
                        const isCurrent = currentStopIndex === idx && (mode === AppMode.PAUSED_INTERACTION || mode === AppMode.FEEDBACK);
                        
                        return (
                            <div key={sp.id} className="ml-6 relative">
                                <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white shadow-sm 
                                    ${isCurrent ? 'bg-indigo-600 ring-4 ring-indigo-100' : isPast ? 'bg-green-500' : 'bg-slate-300'}`} 
                                />
                                <button
                                    onClick={() => onSelectStopPoint(idx)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${isCurrent ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100 hover:border-indigo-300 hover:bg-indigo-50'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-bold text-indigo-600 uppercase">Question {idx + 1}</span>
                                        <span className="text-xs font-mono text-slate-400">{new Date(sp.timestamp * 1000).toISOString().substr(14, 5)}</span>
                                    </div>
                                    <p className="text-sm text-slate-800 font-medium">{sp.question}</p>
                                    {mode !== AppMode.PAUSED_INTERACTION && mode !== AppMode.FEEDBACK && (
                                        <p className="text-xs text-indigo-500 mt-2">Click to answer →</p>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
         </div>
      </div>
    );
  }

  return null;
};

export default InteractionPanel;
