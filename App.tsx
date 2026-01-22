import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { AppMode, LessonPlan, Evaluation, StudyPack, SkillMode, isTechnicalPlan, isSoftSkillsPlan } from './types';
import { generateLessonPlan, generateStudyPack, regenerateQuestionsOnly } from './services/geminiService';
import { storage, sessionStorage } from './services/storageService';
import { exportToGoogleDocs } from './services/exportService';
import { DEMO_VIDEO_ID, APP_TITLE, APP_DESCRIPTION } from './constants';
import VideoPlayer from './components/VideoPlayer';
import InteractionPanel from './components/InteractionPanel';
import ModeSelector from './components/ModeSelector';
import TechnicalPanel from './components/TechnicalPanel';
import VoiceRoleplay from './components/VoiceRoleplay';
import DisclaimerModal, { hasAcceptedTerms } from './components/DisclaimerModal';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';

const App: React.FC = () => {
  // State
  const [mode, setMode] = useState<AppMode>(AppMode.IDLE);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoId, setVideoId] = useState('');
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<{ question: string; answer: string; evaluation: Evaluation }[]>([]);
  const [studyPack, setStudyPack] = useState<StudyPack | null>(null);
  const [skillMode, setSkillMode] = useState<SkillMode>('soft');
  const [selectedPreset, setSelectedPreset] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());
  const [skipAnswered, setSkipAnswered] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [seekTimestamp, setSeekTimestamp] = useState<number | null>(null);
  const [showVoiceRoleplay, setShowVoiceRoleplay] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  
  // Google OAuth configuration
  const isGoogleOAuthConfigured = !!(import.meta as any).env?.VITE_GOOGLE_CLIENT_ID;
  
  // Google OAuth login hook
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleAccessToken(tokenResponse.access_token);
      // Trigger export after successful login
      if (lessonPlan) {
        await handleGoogleDocsExport(tokenResponse.access_token);
      }
    },
    onError: (error) => {
      console.error('Google OAuth error:', error);
      alert('Failed to sign in with Google. Please try again.');
    },
    scope: 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file',
  });

  // Handle Google Docs export
  const handleGoogleDocsExport = async (token?: string) => {
    const accessToken = token || googleAccessToken;
    
    if (!lessonPlan) {
      alert('No lesson plan to export.');
      return;
    }
    
    // Check if OAuth is configured
    if (!isGoogleOAuthConfigured) {
      alert('Google Docs export requires setup.\n\n1. Get a Google OAuth Client ID from Google Cloud Console\n2. Add VITE_GOOGLE_CLIENT_ID to your .env.local file\n3. Restart the dev server\n\nFor now, use "Download .md" instead.');
      return;
    }
    
    if (!accessToken) {
      // Need to login first
      googleLogin();
      return;
    }
    
    setIsExporting(true);
    try {
      const result = await exportToGoogleDocs(lessonPlan, accessToken, sessionHistory);
      window.open(result.documentUrl, '_blank');
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Show the detailed error message
      alert(`Export failed:\n\n${errorMessage}`);
      
      // Clear token if it might be expired
      if (errorMessage.includes('401') || errorMessage.includes('expired')) {
        setGoogleAccessToken(null);
      }
    } finally {
      setIsExporting(false);
    }
  };

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
    // Track video progress
  };

  const handleReachStopPoint = (index: number) => {
    setIsPlaying(false);
    setCurrentStopIndex(index);
    setMode(AppMode.PAUSED_INTERACTION);
  };

  const handleAnswerSubmit = (answer: string, evaluation: Evaluation) => {
    if (!lessonPlan) return;
    
    const currentStop = lessonPlan.stopPoints[currentStopIndex];
    
    // Save to session history (existing)
    setSessionHistory(prev => [...prev, {
        question: currentStop.question,
        answer,
        evaluation
    }]);
    
    // Save to persistent storage
    sessionStorage.addAnswer(
      lessonPlan.videoUrl,
      skillMode,
      currentStop.id,
      currentStop.question,
      answer,
      evaluation
    );
    
    // Update answered IDs
    setAnsweredQuestionIds(prev => new Set([...prev, currentStop.id]));
    
    setMode(AppMode.FEEDBACK);
  };

  // Handle continuing to next question or finishing session
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

  // Finish session and generate study pack
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
        setMode(AppMode.COMPLETED);
      }
    }
  };

  // Regenerate questions for the current lesson
  const handleRegenerateQuestions = async () => {
    if (!videoId || isRegenerating) return;
    
    setIsRegenerating(true);
    setMode(AppMode.LOADING_PLAN);
    
    try {
      // Use lightweight regeneration (no video re-analysis)
      const plan = await regenerateQuestionsOnly(videoId, skillMode, {
        scenarioPreset: skillMode === 'soft' ? selectedPreset : undefined,
        projectType: skillMode === 'technical' ? selectedPreset : undefined,
      });
      
      // Ensure robust stop points with unique IDs
      plan.stopPoints = plan.stopPoints.map((sp, i) => ({ ...sp, id: `sp-${i}-${Date.now()}` }));
      plan.stopPoints.sort((a, b) => a.timestamp - b.timestamp);
      
      setLessonPlan(plan);
      setCurrentStopIndex(0);
      setSessionHistory([]);
      setAnsweredQuestionIds(new Set());
      
      // Clear previous answers
      sessionStorage.clearAnswers(plan.videoUrl, skillMode);
      await storage.saveLessonPlan(plan);
      
      setMode(AppMode.PLAN_READY);
      setTimeout(() => {
        setMode(AppMode.PLAYING);
        setIsPlaying(true);
      }, 1000);
    } catch (e) {
      console.error('Failed to regenerate questions:', e);
      alert('Failed to generate new questions. Please try again.');
      setMode(AppMode.PLAYING);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Load answered questions when lesson plan loads
  useEffect(() => {
    if (lessonPlan && lessonPlan.videoUrl) {
      const session = sessionStorage.get(lessonPlan.videoUrl, skillMode);
      if (session) {
        setAnsweredQuestionIds(new Set(session.answeredQuestions.map(aq => aq.stopPointId)));
      }
    }
  }, [lessonPlan, skillMode]);

  // Load lesson plan on video ID change
  useEffect(() => {
    if (videoId) {
      setMode(AppMode.LOADING_PLAN);
      loadLesson(videoId);
    }
  }, [videoId]);

  // Check if on a legal page
  const isLegalPage = window.location.pathname === '/terms' || window.location.pathname === '/privacy';

  // Check terms acceptance on mount
  useEffect(() => {
    if (!isLegalPage && !hasAcceptedTerms()) {
      setShowDisclaimer(true);
    }
  }, [isLegalPage]);

  // Handle simple routing for legal pages
  if (window.location.pathname === '/terms') {
    return <TermsOfService />;
  }
  
  if (window.location.pathname === '/privacy') {
    return <PrivacyPolicy />;
  }

  // Handle seeking video to a timestamp
  const handleSeekToTimestamp = (timestamp: number) => {
    setSeekTimestamp(timestamp);
    // Clear after a short delay to allow re-seeking to same timestamp
    setTimeout(() => setSeekTimestamp(null), 100);
  };

  // Update handleSelectStopPoint to also seek
  const handleSelectStopPoint = (index: number) => {
    setCurrentStopIndex(index);
    setIsPlaying(false);
    setMode(AppMode.PAUSED_INTERACTION);
    
    // Seek video to the stop point's timestamp
    if (lessonPlan) {
      handleSeekToTimestamp(lessonPlan.stopPoints[index].timestamp);
    }
  };

  // derived state
  const currentStopPoint = lessonPlan ? lessonPlan.stopPoints[currentStopIndex] : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <DisclaimerModal onAccept={() => setShowDisclaimer(false)} />
      )}

      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center sticky top-0 z-50 gap-4 md:gap-0">
        <div className="flex items-center gap-3">
            {/* Logo: try to load public/logo.png, fall back to letter S */}
            {logoLoaded ? (
              <img
                src="/logo.png"
                alt="SkillSync logo"
                className="w-10 h-10 rounded-lg object-cover"
                onError={() => setLogoLoaded(false)}
              />
            ) : (
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">S</div>
            )}
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
      <main className="max-w-7xl mx-auto p-4 md:p-6 min-h-[calc(100vh-140px)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Video Player */}
          <div className="lg:col-span-7 flex flex-col bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
             {videoId ? (
                 <VideoPlayer 
                    videoId={videoId}
                    stopPoints={lessonPlan?.stopPoints || []}
                    currentStopIndex={currentStopIndex}
                    onTimeUpdate={handleTimeUpdate}
                    onReachStopPoint={handleReachStopPoint}
                    onSeekToStopPoint={(idx, _ts) => {
                      handleSelectStopPoint(idx);
                    }}
                    isPlaying={isPlaying}
                    setIsPlaying={setIsPlaying}
                    seekToTimestamp={seekTimestamp} // NEW prop
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
          <div className="lg:col-span-5 flex flex-col gap-4">
             {/* Show TechnicalPanel for technical mode in plan ready state */}
             {lessonPlan && isTechnicalPlan(lessonPlan) && mode === AppMode.PLAN_READY ? (
               <TechnicalPanel 
                 plan={lessonPlan}
                 onSeekToTimestamp={handleSeekToTimestamp}
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
                  onExportToGoogleDocs={() => handleGoogleDocsExport()}
                  onRegenerateQuestions={handleRegenerateQuestions}
                  onSeekToTimestamp={handleSeekToTimestamp}
                  studyPack={studyPack}
                  sessionHistory={sessionHistory}
                  answeredQuestionIds={answeredQuestionIds}
                  skipAnswered={skipAnswered}
                  onToggleSkipAnswered={() => setSkipAnswered(!skipAnswered)}
                  // Pass voice roleplay props
                  showVoiceRoleplayButton={!!(lessonPlan && isSoftSkillsPlan(lessonPlan) && lessonPlan.rolePlayPersona)}
                  onStartVoiceRoleplay={() => setShowVoiceRoleplay(true)}
               />
             )}
          </div>

        </div>
      </main>

      {/* Footer with legal links */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t border-slate-100 py-2 px-4 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>AI-generated content may contain errors. Verify important information.</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
            <span className="text-slate-300">|</span>
            <a href="/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
            <span className="text-slate-300">|</span>
            <span>© 2026 SkillSync</span>
          </div>
        </div>
      </footer>

      {/* Add padding at bottom for footer */}
      <div className="h-10" />

      {/* Voice Roleplay Modal */}
      {showVoiceRoleplay && lessonPlan && isSoftSkillsPlan(lessonPlan) && (
        <VoiceRoleplay
          lessonPlan={lessonPlan}
          onClose={() => setShowVoiceRoleplay(false)}
        />
      )}
    </div>
  );
};

export default App;
