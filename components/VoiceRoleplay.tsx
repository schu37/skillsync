import React, { useState, useRef, useEffect } from 'react';
import { useVoiceRoleplay, VoiceRoleplayConfig, ConnectionState } from '../hooks/useVoiceRoleplay';
import { SoftSkillsLessonPlan } from '../types';
import { roleplayChat } from '../services/geminiService';

interface VoiceRoleplayProps {
  lessonPlan: SoftSkillsLessonPlan;
  selectedScenario?: string;  // Dynamic scenario from dropdown (overrides lessonPlan.scenarioPreset)
  onClose: () => void;
  onPauseVideo?: () => void;  // NEW: pause video when roleplay starts
}

const VoiceRoleplay: React.FC<VoiceRoleplayProps> = ({ lessonPlan, selectedScenario, onClose, onPauseVideo }) => {
  const [textInput, setTextInput] = useState('');
  const [useTextMode, setUseTextMode] = useState(false);
  const [useFallbackChat, setUseFallbackChat] = useState(false);
  const [fallbackMessages, setFallbackMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [isLoadingFallback, setIsLoadingFallback] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pause video when component mounts
  useEffect(() => {
    onPauseVideo?.();
  }, [onPauseVideo]);

  // Build config from lesson plan
  // Use selectedScenario from dropdown if provided, otherwise use detected scenarioPreset
  const config: VoiceRoleplayConfig = {
    persona: lessonPlan.rolePlayPersona || 'A professional colleague who is skeptical but fair',
    scenario: selectedScenario || lessonPlan.scenarioPreset || 'Professional conversation practice',
    videoContext: lessonPlan.videoContext || lessonPlan.summary,
  };

  const {
    connectionState,
    isRecording,
    isSpeaking,
    messages,
    error,
    recordingTime,
    maxRecordingTime,
    conversationRounds,
    maxConversationRounds,
    sessionFeedback,
    isGeneratingFeedback,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage,
    generateSessionFeedback,
  } = useVoiceRoleplay(config);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      sendTextMessage(textInput.trim());
      setTextInput('');
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (state: ConnectionState) => {
    switch (state) {
      case 'ready':
        return <span className="w-3 h-3 bg-green-500 rounded-full" />;
      case 'recording':
        return <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />;
      case 'processing':
        return <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />;
      case 'speaking':
        return <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />;
      case 'error':
        return <span className="w-3 h-3 bg-red-500 rounded-full" />;
      default:
        return <span className="w-3 h-3 bg-slate-400 rounded-full" />;
    }
  };

  // Handle fallback text chat submission
  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || isLoadingFallback) return;
    
    const userMessage = textInput.trim();
    setTextInput('');
    
    // Add user message
    setFallbackMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoadingFallback(true);
    
    try {
      const response = await roleplayChat(
        config.persona,
        config.scenario,
        config.videoContext,
        [...fallbackMessages, { role: 'user', content: userMessage }]
      );
      
      setFallbackMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (e) {
      console.error('Fallback chat error:', e);
      setFallbackMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setIsLoadingFallback(false);
    }
  };

  // Start fallback chat with initial greeting
  const startFallbackChat = async () => {
    setUseFallbackChat(true);
    setIsLoadingFallback(true);
    
    try {
      const response = await roleplayChat(
        config.persona,
        config.scenario,
        config.videoContext,
        [] // Empty messages to get initial greeting
      );
      
      setFallbackMessages([{ role: 'assistant', content: response }]);
    } catch (e) {
      console.error('Failed to start fallback chat:', e);
      setFallbackMessages([{ 
        role: 'assistant', 
        content: `Hello! I'm playing the role of ${config.persona}. How can I help you practice today?` 
      }]);
    } finally {
      setIsLoadingFallback(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-white">Voice Roleplay Practice</h2>
                <details className="group">
                  <summary className="text-sm text-white/80 cursor-pointer hover:text-white transition-colors">
                    <span className="line-clamp-1 inline">{config.persona.slice(0, 80)}{config.persona.length > 80 ? '...' : ''}</span>
                    <span className="text-xs ml-1 text-white/60 group-open:hidden">(click to expand)</span>
                  </summary>
                  <p className="text-sm text-white/90 mt-1 leading-relaxed">{config.persona}</p>
                </details>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Connection status */}
          {!useFallbackChat && (
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-2">
                {getStatusIcon(connectionState)}
                <span className="text-sm text-white/90 capitalize">
                  {connectionState === 'ready' ? 'Ready' : 
                   connectionState === 'recording' ? 'Recording' :
                   connectionState === 'processing' ? 'Processing' :
                   connectionState === 'speaking' ? 'AI Speaking' :
                   connectionState}
                </span>
              </div>
              
              {/* Round counter */}
              {connectionState !== 'disconnected' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70">
                    Round {conversationRounds}/{maxConversationRounds}
                  </span>
                </div>
              )}
              
              {isRecording && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-white/90 font-mono">
                    {formatTime(recordingTime)} / {formatTime(maxRecordingTime)}
                  </span>
                  {recordingTime >= maxRecordingTime - 10 && (
                    <span className="text-xs text-red-300 animate-pulse">
                      Time limit approaching!
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {useFallbackChat && (
            <div className="flex items-center gap-2 mt-3">
              <span className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-sm text-white/90">Text Chat Active</span>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
          {/* Show welcome screen */}
          {!useFallbackChat && connectionState === 'disconnected' && messages.length === 0 && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-slate-700 mb-2">Ready to Practice</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
                Click "Start Session" to begin a voice conversation with an AI character based on the video you watched.
              </p>
              <div className="bg-white p-4 rounded-lg border border-slate-200 text-left max-w-md mx-auto space-y-2">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Your Practice Partner:</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{config.persona}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Scenario:</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{config.scenario}</p>
                </div>
              </div>
            </div>
          )}

          {/* Fallback chat messages */}
          {useFallbackChat && fallbackMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Voice chat messages */}
          {!useFallbackChat && messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                {msg.prosodyAnalysis && (
                  <p className="text-xs mt-1 opacity-70 italic">
                    🎤 {msg.prosodyAnalysis}
                  </p>
                )}
                {msg.emotion && (
                  <p className="text-xs mt-1 opacity-70">
                    😊 Tone: {msg.emotion}
                  </p>
                )}
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {/* Loading indicator for fallback chat */}
          {isLoadingFallback && (
            <div className="flex justify-start">
              <div className="bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-bl-sm shadow-sm p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          {error && !useFallbackChat && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-slate-100 bg-white">
          {/* Fallback text chat controls */}
          {useFallbackChat ? (
            <div className="space-y-3">
              <form onSubmit={handleFallbackSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type your response..."
                  className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  disabled={isLoadingFallback}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!textInput.trim() || isLoadingFallback}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium rounded-xl transition-colors"
                >
                  Send
                </button>
              </form>
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">
                  Practice your communication skills with AI
                </p>
                <button
                  onClick={() => {
                    setUseFallbackChat(false);
                    setFallbackMessages([]);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  End Chat
                </button>
              </div>
            </div>
          ) : connectionState === 'disconnected' ? (
            <div className="space-y-3">
              {/* Show error with fallback option */}
              {error && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 p-3 rounded-lg text-sm mb-3">
                  <p className="font-medium mb-1">Voice chat unavailable</p>
                  <p className="text-xs">{error}</p>
                  <p className="text-xs mt-2">The Gemini Live API may require additional setup or may not be available in your region.</p>
                </div>
              )}
              
              <button
                onClick={connect}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                {error ? 'Try Voice Again' : 'Start Voice Session'}
              </button>
              
              <button
                onClick={startFallbackChat}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Use Text Chat Instead
              </button>
              
              <p className="text-xs text-center text-slate-500">
                Voice requires microphone access. Text chat works without it.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Session Feedback Display */}
              {sessionFeedback && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-4 mb-2 max-h-64 overflow-y-auto">
                  <h4 className="font-semibold text-indigo-800 mb-2 flex items-center gap-2 sticky top-0 bg-gradient-to-r from-indigo-50 to-purple-50 pb-2">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Session Feedback
                  </h4>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed prose prose-sm max-w-none">
                    {sessionFeedback.split('\n').map((line, i) => (
                      <p key={i} className={line.startsWith('**') ? 'font-semibold text-indigo-700 mt-3 first:mt-0' : 'mt-1'}>
                        {line.replace(/\*\*/g, '')}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Session Complete - Show Get Feedback button */}
              {conversationRounds >= maxConversationRounds && !sessionFeedback && (
                <button
                  onClick={generateSessionFeedback}
                  disabled={isGeneratingFeedback}
                  className="w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white disabled:opacity-50"
                >
                  {isGeneratingFeedback ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating Feedback...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Get Session Feedback
                    </>
                  )}
                </button>
              )}
              
              {/* Recording Button - hide when session is complete */}
              {conversationRounds < maxConversationRounds && (
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isSpeaking || connectionState === 'processing' || connectionState === 'speaking'}
                  className={`w-full py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-600 text-white scale-105'
                      : isSpeaking || connectionState === 'processing' || connectionState === 'speaking'
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <svg className={`w-6 h-6 ${isRecording ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  {isRecording ? 'Stop Recording' : 
                   isSpeaking || connectionState === 'speaking' ? 'AI Speaking...' :
                   connectionState === 'processing' ? 'Processing...' :
                   'Start Recording'}
                </button>
              )}
              
              {/* Text mode toggle */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setUseTextMode(!useTextMode)}
                  className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  {useTextMode ? 'Hide text input' : 'Use text input'}
                </button>
                
                <button
                  onClick={disconnect}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  End Session
                </button>
              </div>
              
              {/* Text input fallback */}
              {useTextMode && (
                <form onSubmit={handleTextSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type your response..."
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    disabled={isSpeaking || connectionState === 'processing' || connectionState === 'speaking'}
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim() || isSpeaking || connectionState === 'processing' || connectionState === 'speaking'}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-colors"
                  >
                    Send
                  </button>
                </form>
              )}
              
              <p className="text-xs text-center text-slate-500">
                Click to start recording. Maximum 2 minutes per message.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceRoleplay;
