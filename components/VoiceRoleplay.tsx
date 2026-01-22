import React, { useState, useRef, useEffect } from 'react';
import { useVoiceRoleplay, VoiceRoleplayConfig, ConnectionState } from '../hooks/useVoiceRoleplay';
import { SoftSkillsLessonPlan } from '../types';

interface VoiceRoleplayProps {
  lessonPlan: SoftSkillsLessonPlan;
  onClose: () => void;
}

const VoiceRoleplay: React.FC<VoiceRoleplayProps> = ({ lessonPlan, onClose }) => {
  const [textInput, setTextInput] = useState('');
  const [useTextMode, setUseTextMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Build config from lesson plan
  const config: VoiceRoleplayConfig = {
    persona: lessonPlan.rolePlayPersona || 'A professional colleague who is skeptical but fair',
    scenario: lessonPlan.scenarioPreset || 'Professional conversation practice',
    videoContext: lessonPlan.videoContext || lessonPlan.summary,
  };

  const {
    connectionState,
    isListening,
    isSpeaking,
    messages,
    error,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendTextMessage,
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

  const getStatusIcon = (state: ConnectionState) => {
    switch (state) {
      case 'connected':
        return <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />;
      case 'connecting':
        return <span className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />;
      case 'error':
        return <span className="w-3 h-3 bg-red-500 rounded-full" />;
      default:
        return <span className="w-3 h-3 bg-slate-400 rounded-full" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-500 to-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Voice Roleplay Practice</h2>
                <p className="text-sm text-white/80 truncate max-w-xs">{config.persona.slice(0, 50)}...</p>
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
          <div className="flex items-center gap-2 mt-3">
            {getStatusIcon(connectionState)}
            <span className="text-sm text-white/90 capitalize">{connectionState}</span>
            {isSpeaking && (
              <span className="text-sm text-white/90 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                AI Speaking...
              </span>
            )}
            {isListening && (
              <span className="text-sm text-white/90 flex items-center gap-1">
                <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                Listening...
              </span>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
          {connectionState === 'disconnected' && messages.length === 0 && (
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
              <div className="bg-white p-4 rounded-lg border border-slate-200 text-left max-w-sm mx-auto">
                <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Your Practice Partner:</p>
                <p className="text-sm text-slate-700">{config.persona}</p>
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
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
                <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))}
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-slate-100 bg-white">
          {connectionState === 'disconnected' ? (
            <div className="space-y-3">
              <button
                onClick={connect}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Start Session
              </button>
              <p className="text-xs text-center text-slate-500">
                Requires microphone access. Make sure your speakers are on.
              </p>
            </div>
          ) : connectionState === 'connecting' ? (
            <div className="flex items-center justify-center gap-2 py-3 text-slate-500">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Connecting...
            </div>
          ) : (
            <div className="space-y-3">
              {/* Voice controls */}
              <div className="flex items-center gap-3">
                <button
                  onMouseDown={startListening}
                  onMouseUp={stopListening}
                  onMouseLeave={stopListening}
                  onTouchStart={startListening}
                  onTouchEnd={stopListening}
                  disabled={isSpeaking}
                  className={`flex-1 py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    isListening
                      ? 'bg-red-500 text-white scale-105'
                      : isSpeaking
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  <svg className={`w-6 h-6 ${isListening ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  {isListening ? 'Listening... (Release to send)' : isSpeaking ? 'AI Speaking...' : 'Hold to Speak'}
                </button>
                
                <button
                  onClick={() => setUseTextMode(!useTextMode)}
                  className="p-3 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                  title="Switch to text input"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </button>
                
                <button
                  onClick={disconnect}
                  className="p-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                  title="End session"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
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
                    disabled={isSpeaking}
                  />
                  <button
                    type="submit"
                    disabled={!textInput.trim() || isSpeaking}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-colors"
                  >
                    Send
                  </button>
                </form>
              )}
              
              <p className="text-xs text-center text-slate-500">
                Hold the button to speak, release to send. AI will respond with voice.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceRoleplay;
