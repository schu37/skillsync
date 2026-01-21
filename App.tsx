import React, { useState, useEffect } from 'react';
import { AppMode, LessonPlan, StopPoint, Evaluation, StudyPack, SkillMode, isTechnicalPlan } from './types';
import { generateLessonPlan, generateStudyPack } from './services/geminiService';
import { storage } from './services/storageService';
import { DEMO_VIDEO_ID, APP_TITLE, APP_DESCRIPTION } from './constants';
import VideoPlayer from './components/VideoPlayer';
import InteractionPanel from './components/InteractionPanel';
import ModeSelector from './components/ModeSelector';
import TechnicalPanel from './components/TechnicalPanel';

const App: React.FC = () => {
  // State
  const [mode, setMode] = useState<AppMode>(AppMode.IDLE);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<{ question: string; answer: string; evaluation: Evaluation }[]>([]);
  const [studyPack, setStudyPack] = useState<StudyPack | null>(null);
  
  // NEW: Skill mode state
  const [skillMode, setSkillMode] = useState<SkillMode>('soft');
  const [selectedPreset, setSelectedPreset] = useState('');
  
  // Video Player Controls
  const [isPlaying, setIsPlaying] = useState(false);

  // Load settings on mount
  useEffect(() => {
    storage.getSettings().then(settings => {
      setSkillMode(settings.preferredMode);
    });
  }, []);

  // Helper to extract ID (supports watch, shorts, youtu.be, embed)
  const extractVideoId = (url: string) => {
    // Handle YouTube Shorts
    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (shortsMatch) return shortsMatch[1];
    
    // Handle standard URLs
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const loadLesson = async (id: string) => {
    setVideoId(id);
    setMode(AppMode.LOADING_PLAN);
    setIsPlaying(false);
    
    try {
      // Gemini 3 analyzes the video with native video input
      const plan = await generateLessonPlan(id, skillMode, {
        scenarioPreset: skillMode === 'soft' ? selectedPreset : undefined,
        projectType: skillMode === 'technical' ? selectedPreset : undefined,
      });
      
      // Ensure robust stop points
      plan.stopPoints = plan.stopPoints.map((sp, i) => ({ ...sp, id: `sp-${i}` }));
      plan.stopPoints.sort((a, b) => a.timestamp - b.timestamp);
      
      setLessonPlan(plan);
      
      // Save to storage
      await storage.saveLessonPlan(plan);
      
      setMode(AppMode.PLAN_READY);
      
      // Auto-start after short delay
      setTimeout(() => {
          setMode(AppMode.PLAYING);
          setIsPlaying(true);
      }, 1500);

    } catch (e) {
      console.error(e);
      alert("Failed to analyze video. Please check the URL or API limits.");
      setMode(AppMode.IDLE);
    }
  };

  const handleStartDemo = () => {
    setVideoUrl(`https://www.youtube.com/watch?v=${DEMO_VIDEO_ID}`);
    loadLesson(DEMO_VIDEO_ID);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const id = extractVideoId(videoUrl);
      if (id) {
          loadLesson(id);
      } else {
          alert("Invalid YouTube URL");
      }
  };

  const handleTimeUpdate = (time: number) => {
    // Determine if we finished the video
  };

  const handleReachStopPoint = (index: number) => {
    setIsPlaying(false);
    setCurrentStopIndex(index);
    setMode(AppMode.PAUSED_INTERACTION);
  };

  const handleAnswerSubmit = (answer: string, evaluation: Evaluation) => {
    if (!lessonPlan) return;
    
    const currentStop = lessonPlan.stopPoints[currentStopIndex];
    setSessionHistory(prev => [...prev, {
        question: currentStop.question,
        answer,
        evaluation
    }]);
    
    setMode(AppMode.FEEDBACK);
  };

  const handleContinue = () => {
    if (!lessonPlan) return;
    
    const nextIndex = currentStopIndex + 1;
    if (nextIndex >= lessonPlan.stopPoints.length) {
       // Finished all questions
       finishSession();
    } else {
       setCurrentStopIndex(nextIndex);
       setMode(AppMode.PLAYING);
       setIsPlaying(true);
    }
  };

  const handleSelectStopPoint = (index: number) => {
    setCurrentStopIndex(index);
    setIsPlaying(false);
    setMode(AppMode.PAUSED_INTERACTION);
  };

  const finishSession = async () => {
     setMode(AppMode.GENERATING_PACK);
     if (lessonPlan) {
        try {
            const pack = await generateStudyPack(lessonPlan, sessionHistory);
            setStudyPack(pack);
            setMode(AppMode.PACK_READY);
        } catch (e) {
            console.error(e);
            alert("Could not generate study pack.");
            setMode(AppMode.COMPLETED); // Fallback
        }
     }
  };

  // derived state
  const currentStopPoint = lessonPlan ? lessonPlan.stopPoints[currentStopIndex] : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 gap-4 md:gap-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">S</div>
            <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{APP_TITLE}</h1>
                <p className="text-xs text-slate-500 hidden sm:block">{APP_DESCRIPTION}</p>
            </div>
        </div>
        
        {/* Input Bar + Mode Selector */}
        <div className="flex-1 max-w-2xl mx-4">
            {mode === AppMode.IDLE && (
                <div className="space-y-3">
                    {/* Mode Selector */}
                    <ModeSelector
                      skillMode={skillMode}
                      onModeChange={(m) => {
                        setSkillMode(m);
                        setSelectedPreset('');
                        storage.saveSettings({ preferredMode: m });
                      }}
                      selectedPreset={selectedPreset}
                      onPresetChange={setSelectedPreset}
                      disabled={mode !== AppMode.IDLE}
                    />
                    
                    {/* URL Input */}
                    <form onSubmit={handleUrlSubmit} className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Paste YouTube URL..." 
                            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={videoUrl}
                            onChange={(e) => setVideoUrl(e.target.value)}
                        />
                        <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors">
                            Load
                        </button>
                    </form>
                </div>
            )}
            
            {/* Show current mode when not idle */}
            {mode !== AppMode.IDLE && lessonPlan && (
              <div className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-1 rounded-md font-medium ${
                  lessonPlan.mode === 'technical' 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-indigo-100 text-indigo-700'
                }`}>
                  {lessonPlan.mode === 'technical' ? '🔧 Technical' : '💬 Soft Skills'}
                </span>
                <span className="text-slate-500 truncate max-w-xs">
                  {lessonPlan.summary.slice(0, 50)}...
                </span>
              </div>
            )}
            {mode !== AppMode.IDLE && (
                <button 
                   onClick={() => window.location.reload()}
                   className="text-slate-500 hover:text-slate-700 text-sm font-medium"
                >
                   Start Over
                </button>
            )}
        </div>
      </nav>

      {/* Main Layout */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 h-[calc(100vh-80px)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* Left Column: Video Player */}
          <div className="lg:col-span-7 flex flex-col h-full bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
             {videoId ? (
                 <VideoPlayer 
                    videoId={videoId}
                    stopPoints={lessonPlan?.stopPoints || []}
                    currentStopIndex={currentStopIndex}
                    onTimeUpdate={handleTimeUpdate}
                    onReachStopPoint={handleReachStopPoint}
                    onSeekToStopPoint={(idx, _ts) => {
                      setCurrentStopIndex(idx);
                      setIsPlaying(false);
                      setMode(AppMode.PAUSED_INTERACTION);
                    }}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                 />
             ) : (
                <div className="h-full flex flex-col items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>Enter a URL to begin</p>
                </div>
             )}
          </div>

          {/* Right Column: Interaction & Plan */}
          <div className="lg:col-span-5 h-full min-h-[500px]">
             {/* Show TechnicalPanel for technical mode in plan ready state */}
             {lessonPlan && isTechnicalPlan(lessonPlan) && mode === AppMode.PLAN_READY ? (
               <TechnicalPanel 
                 plan={lessonPlan}
                 onSeekToTimestamp={(ts) => {
                   // TODO: Implement seek in VideoPlayer
                   console.log('Seek to:', ts);
                 }}
               />
             ) : (
               <InteractionPanel 
                  mode={mode}
                  lessonPlan={lessonPlan}
                  currentStopPoint={currentStopPoint}
                  currentStopIndex={currentStopIndex}
                  onAnswerSubmit={handleAnswerSubmit}
                  onContinue={handleContinue}
                  onSelectStopPoint={handleSelectStopPoint}
                  onExportToGoogleDocs={() => {
                    // For now, show instructions. Full OAuth flow can be added.
                    alert('Google Docs export requires signing in with Google. This feature is coming soon!\n\nFor now, use "Download .md" and paste into Google Docs.');
                  }}
                  studyPack={studyPack}
                  sessionHistory={sessionHistory}
               />
             )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default App;
