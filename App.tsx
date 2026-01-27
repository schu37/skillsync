import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { AppMode, LessonPlan, Evaluation, StudyPack, SkillMode, isTechnicalPlan, isSoftSkillsPlan } from './types';
import { generateLessonPlan, generateStudyPack, regenerateQuestionsOnly, detectVideoMode, ModeDetectionResult } from './services/geminiService';
import { storage, sessionStorage, progressStorage, videoCache } from './services/storageService';
import { exportToGoogleDocs } from './services/exportService';
import { DEMO_VIDEO_ID, APP_TITLE, APP_DESCRIPTION, SOFT_SKILL_PRESETS, TECHNICAL_PROJECT_TYPES } from './constants';
import { extractVideoId } from './utils';
import VideoPlayer from './components/VideoPlayer';
import InteractionPanel from './components/InteractionPanel';
import ModeSelector from './components/ModeSelector';
import LearningPanel from './components/LearningPanel';
import DisclaimerModal, { hasAcceptedTerms } from './components/DisclaimerModal';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import VoiceRoleplay from './components/VoiceRoleplay';
import ExportModal from './components/ExportModal';

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
  const [selectedPreset, setSelectedPreset] = useState('negotiation'); // Default to first soft skill preset
  const [isPlaying, setIsPlaying] = useState(false);
  const [logoLoaded, setLogoLoaded] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());
  const [skipAnswered, setSkipAnswered] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [seekTimestamp, setSeekTimestamp] = useState<number | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showVoiceRoleplay, setShowVoiceRoleplay] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showModeChangeWarning, setShowModeChangeWarning] = useState(false);
  const [pendingMode, setPendingMode] = useState<SkillMode | null>(null);
  const [pendingPreset, setPendingPreset] = useState<string | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedProgressSummary, setSavedProgressSummary] = useState<{
    videoUrl: string;
    mode: SkillMode;
    questionsAnswered: number;
    savedAt: string;
  } | null>(null);
  
  // Mode auto-detection state
  const [detectionResult, setDetectionResult] = useState<ModeDetectionResult | null>(null);
  const [isUserOverride, setIsUserOverride] = useState(false); // True if user manually changed mode
  const [loadingMode, setLoadingMode] = useState<SkillMode | null>(null); // Track which mode is being loaded
  
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
    
    // Check for resumable progress
    const summary = progressStorage.getSummary();
    if (summary) {
      setSavedProgressSummary(summary);
      setShowResumePrompt(true);
    }
  }, []);

  // Save progress when important state changes
  useEffect(() => {
    if (lessonPlan && videoId && mode !== AppMode.IDLE && mode !== AppMode.LOADING_PLAN) {
      progressStorage.save({
        videoUrl: lessonPlan.videoUrl,
        videoId,
        skillMode,
        selectedPreset,
        lessonPlan,
        currentStopIndex,
        sessionHistory,
        answeredQuestionIds: Array.from(answeredQuestionIds),
      });
    }
  }, [lessonPlan, currentStopIndex, sessionHistory, answeredQuestionIds]);

  // Handle resuming a session
  const handleResumeSession = () => {
    const saved = progressStorage.get();
    if (!saved) {
      setShowResumePrompt(false);
      return;
    }

    // Restore state
    setVideoUrl(saved.videoUrl);
    setVideoId(saved.videoId);
    setSkillMode(saved.skillMode);
    setSelectedPreset(saved.selectedPreset);
    setLessonPlan(saved.lessonPlan);
    setCurrentStopIndex(saved.currentStopIndex);
    setSessionHistory(saved.sessionHistory);
    setAnsweredQuestionIds(new Set(saved.answeredQuestionIds));
    setMode(AppMode.PLAN_READY);
    setShowResumePrompt(false);

    // Auto-start after brief delay
    setTimeout(() => {
      setMode(AppMode.PLAYING);
      setIsPlaying(true);
    }, 500);
  };

  // Handle declining to resume
  const handleDeclineResume = () => {
    progressStorage.clear();
    setShowResumePrompt(false);
    setSavedProgressSummary(null);
  };

  // Reset app to initial state
  const resetApp = () => {
    setMode(AppMode.IDLE);
    setVideoUrl('');
    setVideoId('');
    setLessonPlan(null);
    setCurrentStopIndex(0);
    setSessionHistory([]);
    setStudyPack(null);
    setSkillMode('soft'); // Reset to soft skills by default
    setSelectedPreset('negotiation'); // Reset to first preset
    setIsPlaying(false);
    setGoogleAccessToken(null);
    setAnsweredQuestionIds(new Set());
    setSkipAnswered(false);
    setSeekTimestamp(null);
    setShowVoiceRoleplay(false);
    setDetectionResult(null);
    setIsUserOverride(false);
    progressStorage.clear(); // Clear saved progress on reset
  };

  // Handle mode change confirmation
  const handleModeChangeConfirm = () => {
    if (pendingMode) {
      handleSmartModeSwitch(pendingMode, pendingPreset || undefined);
    } else {
      setShowModeChangeWarning(false);
      setPendingMode(null);
      setPendingPreset(null);
    }
  };

  // Handle mode change cancellation
  const handleModeChangeCancel = () => {
    setShowModeChangeWarning(false);
    setPendingMode(null);
    setPendingPreset(null);
  };

  // Smart mode switch: use cache if available, otherwise re-analyze
  const handleSmartModeSwitch = async (newMode: SkillMode, preset?: string) => {
    if (!videoId) return;
    
    setShowModeChangeWarning(false);
    setPendingMode(null);
    setPendingPreset(null);
    
    // Update mode and preset
    setSkillMode(newMode);
    setSelectedPreset(preset || '');
    setIsUserOverride(true);
    storage.saveSettings({ preferredMode: newMode });
    
    // Check if we have a cached plan for this mode
    const cachedPlan = videoCache.get(videoUrl, newMode);
    
    if (cachedPlan) {
      // Instant switch - use cached plan
      setLessonPlan(cachedPlan);
      setMode(AppMode.PLAN_READY);
      setCurrentStopIndex(0);
      setSessionHistory([]);
      
      // Auto-start for soft skills
      if (newMode === 'soft') {
        setTimeout(() => {
          setMode(AppMode.PLAYING);
          setIsPlaying(true);
        }, 500);
      }
    } else {
      // Need to re-analyze for this mode - pass newMode explicitly since setState is async
      loadLesson(videoId, false, newMode);
    }
  };

  const loadLesson = async (id: string, forceRefresh: boolean = false, overrideMode?: SkillMode) => {
    // Use overrideMode if provided, otherwise use current skillMode
    const modeToUse = overrideMode || skillMode;
    
    setVideoId(id);
    setMode(AppMode.LOADING_PLAN);
    setLoadingMode(modeToUse); // Track which mode we're loading
    setIsPlaying(false);
    
    // Clear old lesson plan to prevent showing stale content from wrong mode
    setLessonPlan(null);
    setCurrentStopIndex(0);
    setSessionHistory([]);
    
    try {
      // For soft skills, default to first preset if none selected
      const effectivePreset = modeToUse === 'soft' && !selectedPreset 
        ? 'negotiation' 
        : selectedPreset;
      
      // Gemini 3 analyzes the video with native video input
      const plan = await generateLessonPlan(id, modeToUse, {
        scenarioPreset: modeToUse === 'soft' ? effectivePreset : undefined,
        projectType: modeToUse === 'technical' ? effectivePreset : undefined,
        forceRefresh, // Pass through to bypass cache
      });
      
      // Ensure robust stop points with IDs
      plan.stopPoints = plan.stopPoints.map((sp, i) => ({ ...sp, id: `sp-${i}` }));
      
      // Validate timestamps - filter out any that exceed video duration (safety net)
      if (plan.videoDurationSeconds && plan.videoDurationSeconds > 0) {
        const maxTimestamp = plan.videoDurationSeconds - 1; // Leave 1 second buffer
        const originalCount = plan.stopPoints.length;
        plan.stopPoints = plan.stopPoints.filter(sp => sp.timestamp <= maxTimestamp);
        if (plan.stopPoints.length < originalCount) {
          console.warn(`Filtered ${originalCount - plan.stopPoints.length} stop points with invalid timestamps > ${maxTimestamp}s`);
        }
      }
      
      plan.stopPoints.sort((a, b) => a.timestamp - b.timestamp);
      
      setLessonPlan(plan);
      setLoadingMode(null); // Clear loading mode
      
      // Save to storage
      await storage.saveLessonPlan(plan);
      
      setMode(AppMode.PLAN_READY);
      
      // Don't auto-start for technical mode (users need to read safety banner)
      // For soft skills, auto-start after delay
      if (skillMode === 'soft') {
        setTimeout(() => {
          setMode(AppMode.PLAYING);
          setIsPlaying(true);
        }, 1500);
      }

    } catch (e) {
      console.error(e);
      setLoadingMode(null); // Clear loading mode on error
      const errorMessage = e instanceof Error ? e.message : "Failed to analyze video. Please check the URL or API limits.";
      alert(errorMessage);
      setMode(AppMode.IDLE);
    }
  };

  const handleStartDemo = () => {
    setVideoUrl(`https://www.youtube.com/watch?v=${DEMO_VIDEO_ID}`);
    // For demo, skip detection and use soft skills - pass 'soft' explicitly
    setSkillMode('soft');
    setIsUserOverride(false);
    loadLesson(DEMO_VIDEO_ID, false, 'soft');
  };

  // New flow: URL submit -> detect mode -> show detected -> user confirms -> load lesson
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = extractVideoId(videoUrl);
    if (!id) {
      alert("Invalid YouTube URL. Please enter a valid YouTube video link (e.g., youtube.com/watch?v=... or youtu.be/...)");
      return;
    }
    
    setVideoId(id);
    
    // Check if we have cached plans for any mode
    const cachedSoft = videoCache.get(videoUrl, 'soft');
    const cachedTechnical = videoCache.get(videoUrl, 'technical');
    const cachedOthers = videoCache.get(videoUrl, 'others');
    
    // If we have a cached plan from before, use its mode
    if (cachedSoft || cachedTechnical || cachedOthers) {
      const cached = cachedSoft || cachedTechnical || cachedOthers;
      if (cached) {
        setSkillMode(cached.mode);
        setDetectionResult({
          mode: cached.mode,
          confidence: 100,
          reasoning: 'Loaded from cache'
        });
        setIsUserOverride(false);
        setMode(AppMode.MODE_DETECTED);
        return;
      }
    }
    
    // No cache - run auto-detection
    setMode(AppMode.DETECTING_MODE);
    
    try {
      const detection = await detectVideoMode(id);
      setDetectionResult(detection);
      setSkillMode(detection.mode);
      setIsUserOverride(false);
      setMode(AppMode.MODE_DETECTED);
    } catch (e) {
      console.error('Detection failed, proceeding with user selection', e);
      // If detection fails, let user choose and proceed
      setDetectionResult(null);
      setMode(AppMode.MODE_DETECTED);
    }
  };

  // User confirms the detected/selected mode and proceeds to lesson
  const handleConfirmMode = () => {
    if (videoId) {
      // Pass skillMode explicitly to avoid any state timing issues
      loadLesson(videoId, false, skillMode);
    }
  };

  // User changes mode in MODE_DETECTED state
  const handleModeChangeInDetection = (newMode: SkillMode) => {
    setSkillMode(newMode);
    setIsUserOverride(true);
    
    // Check if there's a cached plan for this mode
    const cachedForNewMode = videoCache.get(videoUrl, newMode);
    if (cachedForNewMode) {
      // Update reasoning to show cache available
      setDetectionResult({
        mode: newMode,
        confidence: 100,
        reasoning: `Cached lesson plan available for ${newMode} mode`
      });
    } else {
      setDetectionResult({
        mode: newMode,
        confidence: 0,
        reasoning: `Will analyze video for ${newMode} mode (no cache)`
      });
    }
    
    // Reset preset when mode changes
    if (newMode === 'soft') {
      setSelectedPreset('negotiation');
    } else if (newMode === 'technical') {
      setSelectedPreset('electronics');
    } else {
      setSelectedPreset('');
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

  // Finish session - only generate study pack for soft skills mode
  const finishSession = async () => {
    if (!lessonPlan) return;
    
    // Only generate Study Pack for soft skills mode
    if (skillMode === 'soft') {
      setMode(AppMode.GENERATING_PACK);
      try {
        const pack = await generateStudyPack(lessonPlan, sessionHistory);
        setStudyPack(pack);
        setMode(AppMode.PACK_READY);
      } catch (e) {
        console.error(e);
        alert("Could not generate study pack.");
        setMode(AppMode.COMPLETED);
      }
    } else {
      // For technical/others mode, just go to completed
      setMode(AppMode.COMPLETED);
    }
  };

  // Regenerate questions for the current lesson
  const handleRegenerateQuestions = async () => {
    if (!videoId || isRegenerating) return;
    
    setIsRegenerating(true);
    setMode(AppMode.LOADING_PLAN);
    
    try {
      // For mode changes, force full regeneration (not just questions)
      const plan = await generateLessonPlan(videoId, skillMode, {
        scenarioPreset: skillMode === 'soft' ? selectedPreset : undefined,
        projectType: skillMode === 'technical' ? selectedPreset : undefined,
        forceRefresh: true, // Force fresh generation for mode changes
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

  // Regenerate ONLY Q&A questions, keeping other content (components, tools, etc.)
  const handleRegenerateQuestionsOnly = async () => {
    if (!videoId || !lessonPlan || isRegenerating) return;
    
    setIsRegenerating(true);
    
    try {
      // Use regenerateQuestionsOnly which preserves components, tools, build steps, etc.
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
      
      // Stay in current mode or transition smoothly
      if (mode === AppMode.COMPLETED || mode === AppMode.PACK_READY) {
        setMode(AppMode.PLAN_READY);
        setTimeout(() => {
          setMode(AppMode.PLAYING);
          setIsPlaying(true);
        }, 500);
      }
    } catch (e) {
      console.error('Failed to regenerate questions:', e);
      alert('Failed to generate new questions. Please try again.');
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

  // NOTE: Removed problematic useEffect that auto-loaded lessons on videoId change.
  // This was causing race conditions with the detection flow, loading lessons with stale skillMode.
  // The proper flow is: handleUrlSubmit -> detection -> handleConfirmMode -> loadLesson

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

      {/* Mode Change Warning Modal */}
      {showModeChangeWarning && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Switch Learning Mode?</h2>
            </div>
            
            <div className="space-y-3 text-slate-700">
              <p>
                {/* Show subcategory if switching within same mode, otherwise show mode */}
                {pendingMode === skillMode && pendingPreset ? (
                  <>
                    Switch to <strong>
                      {[...SOFT_SKILL_PRESETS, ...TECHNICAL_PROJECT_TYPES].find(p => p.id === pendingPreset)?.icon || ''}{' '}
                      {[...SOFT_SKILL_PRESETS, ...TECHNICAL_PROJECT_TYPES].find(p => p.id === pendingPreset)?.label || pendingPreset}
                    </strong> scenario for this video?
                  </>
                ) : (
                  <>
                    Switch to <strong>{pendingMode === 'technical' ? '🛠️ Technical' : pendingMode === 'soft' ? '🎭 Soft Skills' : '📋 General'}</strong> mode for this video?
                  </>
                )}
              </p>
              {videoCache.get(videoUrl, pendingMode || 'soft') ? (
                <p className="text-sm bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded flex items-center gap-2">
                  <span className="text-emerald-600">📦</span>
                  <span><strong>Cached plan available!</strong> This will switch instantly.</span>
                </p>
              ) : (
                <p className="text-sm bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
                  This will re-analyze the video for the new mode. Your current progress will be preserved in cache. You need to click "Re-analyze" again to load the new mode.
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleModeChangeCancel}
                className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleModeChangeConfirm}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                {videoCache.get(videoUrl, pendingMode || 'soft') ? 'Switch Now' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resume Session Prompt */}
      {showResumePrompt && savedProgressSummary && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-2xl">📚</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Resume Session?</h2>
            </div>
            
            <div className="space-y-3 text-slate-700">
              <p>
                You have a saved learning session from{' '}
                <strong>{new Date(savedProgressSummary.savedAt).toLocaleString()}</strong>
              </p>
              
              <div className="bg-slate-50 p-3 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Mode:</span>
                  <span className={`px-2 py-0.5 rounded font-medium ${
                    savedProgressSummary.mode === 'technical' ? 'bg-emerald-100 text-emerald-700' :
                    savedProgressSummary.mode === 'soft' ? 'bg-purple-100 text-purple-700' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {savedProgressSummary.mode === 'technical' ? '🛠️ Technical' :
                     savedProgressSummary.mode === 'soft' ? '🎭 Soft Skills' : '📋 General'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-500">Progress:</span>
                  <span className="font-medium">
                    {savedProgressSummary.questionsAnswered} questions answered
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {savedProgressSummary.videoUrl}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDeclineResume}
                className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-medium transition-colors"
              >
                Start Fresh
              </button>
              <button
                onClick={handleResumeSession}
                className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Resume
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navbar - Only shown when NOT in IDLE state */}
      {mode !== AppMode.IDLE && (
        <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-50">
          <div className="flex items-center gap-3 cursor-pointer" onClick={resetApp}>
            {logoLoaded ? (
              <img
                src="/icon.png"
                alt="SkillSync logo"
                className="w-8 h-8 rounded-lg object-contain"
                onError={() => setLogoLoaded(false)}
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">S</div>
            )}
            <h1 className="text-lg font-bold tracking-tight text-slate-900 hidden sm:block">{APP_TITLE}</h1>
          </div>
          
          {/* Center: Mode indicator + switcher */}
          <div className="flex items-center gap-2">
            {/* Current mode badge - show "Analyzing" during loading to avoid misleading users */}
            {mode === AppMode.LOADING_PLAN || mode === AppMode.DETECTING_MODE ? (
              <div className="px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 bg-slate-100 text-slate-600">
                <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                Analyzing...
              </div>
            ) : (
              <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${
                skillMode === 'technical' ? 'bg-emerald-100 text-emerald-700' :
                skillMode === 'soft' ? 'bg-purple-100 text-purple-700' :
                'bg-slate-200 text-slate-700'
              }`}>
                {skillMode === 'technical' ? '🛠️ Technical' :
                 skillMode === 'soft' ? '🎭 Soft Skills' : '📋 General'}
              </div>
            )}
            
            {/* Mode switcher dropdown - only when lesson is loaded */}
            {lessonPlan && mode !== AppMode.LOADING_PLAN && (
              <>
                <select
                  value={skillMode}
                  onChange={(e) => {
                    const newMode = e.target.value as SkillMode;
                    if (newMode !== skillMode) {
                      setPendingMode(newMode);
                      setPendingPreset(newMode === 'soft' ? 'negotiation' : '');
                      setShowModeChangeWarning(true);
                    }
                  }}
                  className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer hover:bg-slate-200"
                >
                  <option value="soft">🎭 Soft Skills</option>
                  <option value="technical">🛠️ Technical</option>
                  <option value="others">📋 General</option>
                </select>
                
                {/* Preset/Sub-category dropdown - only for soft/technical */}
                {skillMode !== 'others' && (
                  <select
                    value={selectedPreset}
                    onChange={(e) => {
                      const newPreset = e.target.value;
                      if (newPreset !== selectedPreset) {
                        setPendingMode(skillMode);
                        setPendingPreset(newPreset);
                        setShowModeChangeWarning(true);
                      }
                    }}
                    className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 cursor-pointer hover:bg-slate-200 max-w-[140px]"
                  >
                    {(skillMode === 'soft' ? SOFT_SKILL_PRESETS : TECHNICAL_PROJECT_TYPES).map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.icon} {preset.label}
                      </option>
                    ))}
                  </select>
                )}
                
                {/* Re-analyze button */}
                <button
                  onClick={() => loadLesson(videoId, true, skillMode)}
                  title="Re-analyze video with current settings"
                  className="text-xs px-2 py-1 bg-red-400 hover:bg-indigo-200 text-indigo-700 rounded-lg font-medium transition-colors flex items-center gap-1"
                >
                  🔄 Re-analyze
                </button>
              </>
            )}
          </div>
          
          {/* Right: Export + New Video buttons */}
          <div className="flex items-center gap-2">
            {/* Export button - only when lesson plan exists */}
            {lessonPlan && (
              <button 
                onClick={() => setShowExportModal(true)}
                className="text-sm px-3 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-lg font-medium transition-colors flex items-center gap-1.5"
              >
                📥 Export
              </button>
            )}
            
            <button 
              onClick={resetApp}
              disabled={mode === AppMode.LOADING_PLAN || isRegenerating}
              className="text-sm px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              ← New Video
            </button>
          </div>
        </nav>
      )}

      {/* IDLE State: Google-style Landing Page */}
      {mode === AppMode.IDLE && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 -mt-10">
          {/* Logo + Title */}
          <div className="text-center mb-8">
            {logoLoaded ? (
              <img
                src="/web-app-manifest-512x512.png"
                alt="SkillSync logo"
                className="w-24 h-24 mx-auto mb-4 rounded-2xl object-contain shadow-lg"
                onError={() => setLogoLoaded(false)}
              />
            ) : (
              <div className="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-4xl shadow-lg">S</div>
            )}
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">{APP_TITLE}</h1>
            <p className="text-lg text-slate-600">{APP_DESCRIPTION}</p>
          </div>

          {/* Search Box */}
          <form onSubmit={handleUrlSubmit} className="w-full max-w-2xl mb-8">
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Paste a YouTube video URL (only YouTube supported)..." 
                className="w-full px-6 py-4 text-lg border-2 border-slate-200 rounded-full shadow-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all group-hover:shadow-md"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value.trim())}
                autoFocus
              />
              <button 
                type="submit" 
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md"
              >
                🔍 Analyze
              </button>
            </div>
            <p className="text-center text-sm text-slate-500 mt-3">
              🤖 AI will auto-detect the best learning mode for your video
            </p>
          </form>

          {/* Quick Actions */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <button
              onClick={handleStartDemo}
              className="px-5 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 hover:bg-slate-50 hover:shadow-md transition-all"
            >
              ▶️ Try Demo Video
            </button>
          </div>

          </div>
      )}

      {/* DETECTING_MODE & MODE_DETECTED: Centered modal-style */}
      {(mode === AppMode.DETECTING_MODE || mode === AppMode.MODE_DETECTED) && (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 -mt-10">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full">
            {mode === AppMode.DETECTING_MODE && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <h2 className="text-xl font-semibold text-slate-900">Analyzing Video...</h2>
                <p className="text-slate-600">AI is detecting the best learning mode for your video</p>
              </div>
            )}
            
            {mode === AppMode.MODE_DETECTED && (
              <div className="space-y-5">
                <div className="text-center">
                  <h2 className="text-xl font-semibold text-slate-900 mb-1">Mode Detected</h2>
                  {isUserOverride && (
                    <span className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-full inline-block">
                      👤 User override
                    </span>
                  )}
                </div>
                
                <ModeSelector
                  skillMode={skillMode}
                  onModeChange={handleModeChangeInDetection}
                  selectedPreset={selectedPreset}
                  onPresetChange={setSelectedPreset}
                  disabled={false}
                />
                
                {detectionResult?.reasoning && (
                  <p className="text-sm text-slate-500 italic text-center">
                    💡 {detectionResult.reasoning}
                  </p>
                )}
                
                {videoCache.get(videoUrl, skillMode) && (
                  <div className="flex items-center justify-center gap-2 text-sm text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg">
                    <span>📦 Cached lesson available</span>
                    <button onClick={() => loadLesson(videoId, true, skillMode)} className="underline font-medium">Re-analyze</button>
                  </div>
                )}
                
                <div className="flex gap-3 pt-2">
                  <button onClick={resetApp} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors">
                    ← Cancel
                  </button>
                  <button onClick={handleConfirmMode} className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors">
                    {videoCache.get(videoUrl, skillMode) ? 'Load Cached →' : 'Start Learning →'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Learning Layout - Only shown when lesson is active */}
      {mode !== AppMode.IDLE && mode !== AppMode.DETECTING_MODE && mode !== AppMode.MODE_DETECTED && (
        <main className="max-w-7xl mx-auto p-4 md:p-6 min-h-[calc(100vh-140px)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Video Player */}
            <div className="lg:col-span-7 xl:col-span-7">
              <div className="lg:sticky lg:top-20">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
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
                         seekToTimestamp={seekTimestamp}
                      />
                  ) : (
                     <div className="aspect-video flex flex-col items-center justify-center bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                         <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                         <p>Loading video...</p>
                     </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Unified Learning Panel */}
            <div className="lg:col-span-5 xl:col-span-5 flex flex-col gap-4 min-h-[600px]">
               {lessonPlan && (mode === AppMode.PLAN_READY || mode === AppMode.PLAYING || mode === AppMode.PAUSED_INTERACTION || mode === AppMode.EVALUATING || mode === AppMode.FEEDBACK || mode === AppMode.COMPLETED || mode === AppMode.PACK_READY || mode === AppMode.GENERATING_PACK) ? (
                 <LearningPanel
                   lessonPlan={lessonPlan}
                   skillMode={skillMode}
                   mode={mode}
                   currentStopPoint={currentStopPoint}
                   currentStopIndex={currentStopIndex}
                   onAnswerSubmit={handleAnswerSubmit}
                   onContinue={handleContinue}
                   onSelectStopPoint={handleSelectStopPoint}
                   onSeekToTimestamp={handleSeekToTimestamp}
                   sessionHistory={sessionHistory}
                   answeredQuestionIds={answeredQuestionIds}
                   skipAnswered={skipAnswered}
                   onToggleSkipAnswered={() => setSkipAnswered(!skipAnswered)}
                   studyPack={studyPack}
                   showVoiceRoleplayButton={skillMode === 'soft' && isSoftSkillsPlan(lessonPlan) && !!lessonPlan.rolePlayPersona}
                   onStartVoiceRoleplay={() => setShowVoiceRoleplay(true)}
                   selectedScenario={selectedPreset}
                   googleAccessToken={googleAccessToken}
                   onRequestGoogleAuth={googleLogin}
                   onRegenerateQuestionsOnly={handleRegenerateQuestionsOnly}
                   isRegenerating={isRegenerating}
                 />
             ) : (
               // Fallback for IDLE/LOADING states - show InteractionPanel for loading UI
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
                  showVoiceRoleplayButton={false}
                  onStartVoiceRoleplay={() => setShowVoiceRoleplay(true)}
                  selectedScenario={selectedPreset}
                  googleAccessToken={googleAccessToken}
                  onRequestGoogleAuth={googleLogin}
               />
             )}
            </div>

          </div>
        </main>
      )}

      {/* Voice Roleplay Modal - Only for soft skills mode */}
      {showVoiceRoleplay && skillMode === 'soft' && lessonPlan && isSoftSkillsPlan(lessonPlan) && (
        <VoiceRoleplay
          lessonPlan={lessonPlan}          selectedScenario={selectedPreset}          onClose={() => setShowVoiceRoleplay(false)}
          onPauseVideo={() => setIsPlaying(false)}
        />
      )}

      {/* Export Modal */}
      {lessonPlan && (
        <ExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          lessonPlan={lessonPlan}
          sessionHistory={sessionHistory}
          studyPack={studyPack}
          videoUrl={lessonPlan.videoUrl}
          googleAccessToken={googleAccessToken}
          onRequestGoogleAuth={googleLogin}
        />
      )}

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
            <span>2026 SkillSync</span>
          </div>
        </div>
      </footer>

      {/* Add padding at bottom for footer */}
      <div className="h-10" />
    </div>
  );
};

export default App;
