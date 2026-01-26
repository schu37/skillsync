import React, { useState, useRef, useEffect } from 'react';
import { LessonPlan, isSoftSkillsPlan } from '../types';
import { videoChatMessage, roleplayChat } from '../services/geminiService';
import { ROLEPLAY_PERSONAS, SOFT_SKILL_PRESETS } from '../constants';
import { renderMarkdown } from '../utils';
import { exportChatAsMarkdown, exportChatToGoogleDocs } from '../services/exportService';

interface VideoChatSectionProps {
  lessonPlan: LessonPlan;
  selectedScenario?: string; // NEW: user-selected scenario from dropdown
  onStartVoiceRoleplay?: () => void; // NEW: callback to open voice roleplay modal
  googleAccessToken?: string | null; // For Google Docs export
  onRequestGoogleAuth?: () => void; // Callback to trigger OAuth
  skillMode?: 'soft' | 'technical' | 'others'; // Current skill mode from UI
}

type ChatMode = 'discuss' | 'roleplay';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const VideoChatSection: React.FC<VideoChatSectionProps> = ({ 
  lessonPlan, 
  selectedScenario, 
  onStartVoiceRoleplay,
  googleAccessToken,
  onRequestGoogleAuth,
  skillMode
}) => {
  const [chatMode, setChatMode] = useState<ChatMode>('discuss');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasRoleplay = (skillMode === 'soft' || skillMode === undefined) && isSoftSkillsPlan(lessonPlan) && lessonPlan.rolePlayPersona;

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Reset messages when mode changes
  useEffect(() => {
    setMessages([]);
  }, [chatMode]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    setIsLoading(true);

    try {
      let response: string;

      if (chatMode === 'roleplay' && isSoftSkillsPlan(lessonPlan)) {
        // Use selected scenario if available, otherwise fall back to lesson plan
        const scenarioId = selectedScenario || lessonPlan.scenarioPreset || '';
        const personaData = ROLEPLAY_PERSONAS[scenarioId as keyof typeof ROLEPLAY_PERSONAS];
        const presetData = SOFT_SKILL_PRESETS.find(p => p.id === scenarioId);
        
        // Build persona description from ROLEPLAY_PERSONAS if available
        const persona = personaData 
          ? `${personaData.name}, ${personaData.role}. Style: ${personaData.style}. Initial position: ${personaData.initialPosition}`
          : lessonPlan.rolePlayPersona || 'Professional colleague';
        
        // Build scenario description
        const scenario = presetData
          ? `${presetData.label}: ${presetData.description}`
          : lessonPlan.scenarioPreset || 'Professional conversation';
        
        // Include the user's new message in history
        const historyWithNewMessage = [
          ...messages.map(m => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: userMessage }
        ];
        
        response = await roleplayChat(
          persona,
          scenario,
          lessonPlan.videoContext || lessonPlan.summary,
          historyWithNewMessage
        );
      } else {
        response = await videoChatMessage(
          lessonPlan,
          userMessage,
          messages.map(m => ({ role: m.role, content: m.content }))
        );
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response,
        timestamp: new Date(),
      }]);
    } catch (e) {
      console.error('Chat error:', e);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExportMarkdown = () => {
    exportChatAsMarkdown(messages, chatMode, lessonPlan.summary);
    setShowExportMenu(false);
  };

  const handleExportGoogleDocs = async () => {
    if (!googleAccessToken && onRequestGoogleAuth) {
      onRequestGoogleAuth();
      return;
    }

    if (!googleAccessToken) {
      alert('Please sign in with Google to export to Google Docs');
      return;
    }

    setIsExporting(true);
    setShowExportMenu(false);
    
    try {
      const result = await exportChatToGoogleDocs(
        messages,
        chatMode,
        lessonPlan.summary,
        googleAccessToken
      );
      window.open(result.documentUrl, '_blank');
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export to Google Docs. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header - Sticky */}
      <div className="sticky top-0 z-10 p-4 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Chat
          </h2>
          {messages.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Export Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  disabled={isExporting}
                  className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? 'Exporting...' : '📥 Export'}
                </button>
                
                {showExportMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-20">
                      <button
                        onClick={handleExportMarkdown}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span>📄</span>
                        <span>Download .md</span>
                      </button>
                      <button
                        onClick={handleExportGoogleDocs}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span>📝</span>
                        <span>Export to Google Docs</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              <button
                onClick={() => setMessages([])}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setChatMode('discuss')}
            className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
              chatMode === 'discuss'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            💬 Discuss Video
          </button>
          {hasRoleplay && (
            <button
              onClick={() => setChatMode('roleplay')}
              className={`flex-1 py-1.5 px-3 text-sm font-medium rounded-md transition-colors ${
                chatMode === 'roleplay'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-800'
              }`}
            >
              🎭 Roleplay
            </button>
          )}
        </div>

        {/* Mode description */}
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          {chatMode === 'discuss' 
            ? 'Ask questions about the video content and related topics only'
            : isSoftSkillsPlan(lessonPlan) 
              ? `Practice with: ${lessonPlan.rolePlayPersona}`
              : 'Text-based roleplay practice'
          }
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              {chatMode === 'discuss' ? '💬' : '🎭'}
            </div>
            <p className="text-sm">
              {chatMode === 'discuss'
                ? "Ask anything about the video content!"
                : "Start a roleplay conversation to practice your skills"
              }
            </p>
            
            {/* Voice Roleplay Button for roleplay mode */}
            {chatMode === 'roleplay' && hasRoleplay && onStartVoiceRoleplay && (
              <div className="mt-6">
                <button
                  onClick={onStartVoiceRoleplay}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 mx-auto shadow-lg hover:shadow-xl"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  Start Voice Roleplay
                </button>
                <p className="text-xs text-slate-400 mt-2">Practice with voice interaction (recommended)</p>
                <div className="mt-4 text-xs text-slate-400">
                  <p className="mb-2">Or use text chat below:</p>
                </div>
              </div>
            )}
            
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {chatMode === 'discuss' ? (
                <>
                  <button
                    onClick={() => setInput("What are the key takeaways?")}
                    className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full"
                  >
                    Key takeaways?
                  </button>
                  <button
                    onClick={() => setInput("Can you explain the main concept?")}
                    className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full"
                  >
                    Explain main concept
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setInput("Hello, I'd like to discuss something with you.")}
                    className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full"
                  >
                    Start conversation
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-100 text-slate-800 rounded-bl-sm'
              }`}
            >
              <div 
                className="text-sm whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
              <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-indigo-200' : 'text-slate-400'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 text-slate-800 rounded-2xl rounded-bl-sm p-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-100 bg-slate-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={chatMode === 'discuss' ? "Ask about the video..." : "Type your response..."}
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoChatSection;
