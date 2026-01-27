import { useState, useRef, useCallback, useEffect } from 'react';

export interface VoiceRoleplayConfig {
  persona: string;
  scenario: string;
  videoContext: string;
}

export interface VoiceMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioBlob?: Blob;
  emotion?: string;
  prosodyAnalysis?: string;
}

export type ConnectionState = 'disconnected' | 'ready' | 'recording' | 'processing' | 'speaking' | 'error';

const MAX_RECORDING_TIME = 120; // 2 minutes in seconds
const MAX_CONVERSATION_ROUNDS = 8; // Maximum back-and-forth exchanges

export const useVoiceRoleplay = (config: VoiceRoleplayConfig | null) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [conversationRounds, setConversationRounds] = useState(0);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);
  const mediaStream = useRef<MediaStream | null>(null);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const sessionVoice = useRef<string | null>(null); // Fixed voice for entire session

  // Helper to convert blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Play audio
  const playAudio = useCallback(async (audioBlob: Blob) => {
    return new Promise<void>((resolve) => {
      const audio = new Audio(URL.createObjectURL(audioBlob));
      setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audio.src);
        resolve();
      };
      audio.play();
    });
  }, []);

  // Initialize connection (request mic access)
  const connect = useCallback(async () => {
    if (!config) {
      setError('No roleplay configuration provided');
      return;
    }

    setConnectionState('ready');
    setError(null);

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      mediaStream.current = stream;
      console.log('🎙️ Microphone access granted');
      
      // Generate an in-character opening line with voice
      await generateOpeningLine();
      
    } catch (e) {
      console.error('Microphone access error:', e);
      setError('Microphone access denied. Please allow microphone access to use voice chat.');
      setConnectionState('error');
    }
  }, [config]);
  
  // Generate an in-character opening line with TTS
  const generateOpeningLine = async () => {
    setConnectionState('processing');
    
    try {
      const { geminiTTS, selectVoiceForPersona } = await import('../services/geminiService');
      const { GoogleGenAI } = await import('@google/genai');
      
      // Select a voice for this session based on persona (ONCE)
      // This voice will be used for ALL rounds of conversation
      if (!sessionVoice.current) {
        sessionVoice.current = selectVoiceForPersona(config?.persona || '');
        console.log(`🎭 Session voice selected: ${sessionVoice.current} (will be used for all rounds)`);
      }
      
      // Get API key
      const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey });
      
      // Generate an in-character opening line
      const prompt = `You are playing this character in a roleplay scenario:
      
Character: ${config?.persona || 'A professional colleague'}
Scenario: ${config?.scenario || 'Professional conversation'}
Context: ${config?.videoContext?.slice(0, 200) || 'General practice'}

Generate a SHORT (1-2 sentences) opening line that this character would say to start the conversation. 
Stay completely in character. Don't break the fourth wall.
Make it natural and appropriate for the scenario.

Return ONLY the opening line, nothing else.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      const openingLine = response.text?.trim() || "Alright, let's get started. What did you want to discuss?";
      
      // Pre-generate the audio with the session voice
      const audioBlob = await geminiTTS({
        text: openingLine,
        voiceName: sessionVoice.current!, // Use fixed session voice
        emotion: 'neutral',
        persona: config?.persona,
        style: 'Speak naturally as if starting a conversation',
      });
      
      // Show message and play audio together
      setMessages([{
        role: 'assistant',
        content: openingLine,
        emotion: 'neutral',
        timestamp: new Date()
      }]);
      
      setConnectionState('speaking');
      await playAudioBlobInternal(audioBlob);
      setConnectionState('ready');
      
    } catch (e) {
      console.error('Failed to generate opening line:', e);
      // Fallback to static message without voice
      setMessages([{
        role: 'assistant',
        content: 'Ready to practice! Click "Start Recording" to begin.',
        timestamp: new Date()
      }]);
      setConnectionState('ready');
    }
  };
  
  // Internal helper to play audio blob (used before playAudioBlob is defined)
  const playAudioBlobInternal = async (audioBlob: Blob): Promise<void> => {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    setIsSpeaking(true);
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        resolve();
      };
      audio.onerror = (err) => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        reject(err);
      };
      audio.play();
    });
  };

  // Start recording
  const startRecording = useCallback(async () => {
    if (!mediaStream.current) {
      setError('No microphone access');
      return;
    }

    // Check if max rounds reached
    if (conversationRounds >= MAX_CONVERSATION_ROUNDS) {
      setError(`Reached maximum of ${MAX_CONVERSATION_ROUNDS} exchanges. Please end the session.`);
      return;
    }

    try {
      audioChunks.current = [];
      setRecordingTime(0);
      
      mediaRecorder.current = new MediaRecorder(mediaStream.current, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setConnectionState('recording');
      
      // Start timer
      timerInterval.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
      
      console.log('🎙️ Recording started');
    } catch (e) {
      console.error('Start recording error:', e);
      setError('Failed to start recording');
    }
  }, []);

  // Stop recording and process
  const stopRecording = useCallback(async () => {
    if (!mediaRecorder.current || !isRecording) return;

    return new Promise<void>((resolve) => {
      mediaRecorder.current!.onstop = async () => {
        // Clear timer
        if (timerInterval.current) {
          clearInterval(timerInterval.current);
          timerInterval.current = null;
        }
        
        setIsRecording(false);
        setConnectionState('processing');
        
        try {
          // Create audio blob
          const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
          console.log('🎙️ Audio recorded, size:', audioBlob.size);
          
          // Import the analysis function
          const { analyzeVoiceAndRespond } = await import('../services/geminiService');
          
          // Send to Gemini for analysis
          const result = await analyzeVoiceAndRespond(
            audioBlob,
            config!,
            messages
          );
          
          // Add user message
          setMessages(prev => [...prev, {
            role: 'user',
            content: result.userTranscript || '(Audio message)',
            audioBlob: audioBlob,
            prosodyAnalysis: result.prosodyAnalysis,
            timestamp: new Date()
          }]);
          
          // Generate TTS audio BEFORE showing assistant message
          // This prevents the 5s delay between message appearing and voice playing
          setConnectionState('speaking');
          const audioBlob2 = await generateTTSAudio(result.responseText, result.emotionalTone);
          
          // Now add assistant message and play audio simultaneously
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: result.responseText,
            emotion: result.emotionalTone,
            timestamp: new Date()
          }]);
          
          // Play the pre-generated audio immediately
          if (audioBlob2) {
            await playAudioBlob(audioBlob2);
          }
          setConnectionState('ready');
          
          // Increment conversation rounds
          setConversationRounds(prev => prev + 1);
          
          // Show warning when approaching limit
          if (conversationRounds + 1 >= MAX_CONVERSATION_ROUNDS - 1) {
            setTimeout(() => {
              setError(`Approaching conversation limit (${conversationRounds + 1}/${MAX_CONVERSATION_ROUNDS}). Consider wrapping up.`);
            }, 2000);
          }
          
        } catch (e) {
          console.error('Processing error:', e);
          setError('Failed to process audio. Please try again.');
          setConnectionState('error');
          setTimeout(() => setConnectionState('ready'), 3000);
        }
        
        resolve();
      };

      mediaRecorder.current!.stop();
      console.log('🎙️ Recording stopped');
    });
  }, [isRecording, config, messages, playAudio]);

  // Generate TTS audio blob without playing (for pre-generation)
  const generateTTSAudio = async (
    text: string,
    emotion: string
  ): Promise<Blob | null> => {
    try {
      const { geminiTTS } = await import('../services/geminiService');
      
      console.log(`🎭 Pre-generating Gemini TTS with emotion: ${emotion}, voice: ${sessionVoice.current}`);
      
      const audioBlob = await geminiTTS({
        text: text,
        voiceName: sessionVoice.current || undefined, // Use fixed session voice
        emotion: emotion,
        persona: config?.persona,
        style: getStyleForEmotion(emotion),
      });
      
      console.log(`🔊 Audio pre-generated, size: ${audioBlob.size}`);
      return audioBlob;
      
    } catch (err) {
      console.error('🔊 Gemini TTS generation error:', err);
      // Return null, caller will handle fallback
      return null;
    }
  };
  
  // Play an audio blob
  const playAudioBlob = async (audioBlob: Blob): Promise<void> => {
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    setIsSpeaking(true);
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        console.log('🔊 Audio playback finished');
        resolve();
      };
      audio.onerror = (err) => {
        URL.revokeObjectURL(audioUrl);
        setIsSpeaking(false);
        console.error('🔊 Audio playback error:', err);
        reject(err);
      };
      console.log('🔊 Playing audio immediately');
      audio.play();
    });
  };

  // Text-to-speech with emotion using Gemini TTS (legacy, still used for fallback)
  const textToSpeechWithEmotion = async (
    text: string,
    emotion: string
  ): Promise<void> => {
    try {
      // Import the Gemini TTS function
      const { geminiTTS } = await import('../services/geminiService');
      
      console.log(`🎭 Using Gemini TTS with emotion: ${emotion}, voice: ${sessionVoice.current}`);
      console.log(`🎭 Persona: ${config?.persona?.slice(0, 50)}...`);
      
      // Generate audio using Gemini TTS with emotion and persona context
      const audioBlob = await geminiTTS({
        text: text,
        voiceName: sessionVoice.current || undefined, // Use fixed session voice
        emotion: emotion,
        persona: config?.persona,
        style: getStyleForEmotion(emotion),
      });
      
      // Play the generated audio
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          console.log('🔊 Gemini TTS finished');
          resolve();
        };
        audio.onerror = (err) => {
          URL.revokeObjectURL(audioUrl);
          console.error('🔊 Audio playback error:', err);
          reject(err);
        };
        console.log('🔊 Playing Gemini TTS audio');
        audio.play();
      });
      
    } catch (err) {
      console.error('🔊 Gemini TTS error, falling back to browser TTS:', err);
      return textToSpeechBrowserFallback(text, emotion);
    }
  };
  
  // Get style direction for the given emotion
  const getStyleForEmotion = (emotion: string): string => {
    const emotionLower = emotion.toLowerCase();
    
    if (emotionLower.includes('angry') || emotionLower.includes('furious')) {
      return 'Speak with intensity, sharper consonants, slightly raised volume';
    }
    if (emotionLower.includes('impatient') || emotionLower.includes('frustrated')) {
      return 'Speak quickly with clipped words, sighing undertones, slight irritation';
    }
    if (emotionLower.includes('friendly') || emotionLower.includes('warm')) {
      return 'Speak warmly with a smile in your voice, relaxed pace';
    }
    if (emotionLower.includes('skeptical') || emotionLower.includes('doubtful')) {
      return 'Speak with raised eyebrows tone, questioning inflection, slight pause before key words';
    }
    if (emotionLower.includes('dismissive')) {
      return 'Speak flatly with disinterest, trailing off at ends of sentences';
    }
    if (emotionLower.includes('encouraging')) {
      return 'Speak with enthusiasm, upward inflections, supportive warmth';
    }
    if (emotionLower.includes('sad') || emotionLower.includes('sympathetic')) {
      return 'Speak softly, slower pace, gentle and caring';
    }
    if (emotionLower.includes('excited') || emotionLower.includes('enthusiastic')) {
      return 'Speak with high energy, faster pace, animated delivery';
    }
    
    return 'Speak naturally and conversationally';
  };
  
  // Fallback: Browser TTS (lower quality)
  const textToSpeechBrowserFallback = async (
    text: string,
    emotion: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Detect gender for voice selection
      const persona = config?.persona || '';
      const isMale = /\b(he|him|man|male|boy|gentleman|mr\.|sir)\b/i.test(persona);
      
      // Select a better voice if available
      const voices = window.speechSynthesis.getVoices();
      let selectedVoice;
      
      if (isMale) {
        // Prefer male voices
        selectedVoice = voices.find(v => 
          v.lang.startsWith('en') && 
          (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('james'))
        ) || voices.find(v => 
          v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))
        );
      } else {
        // Prefer female voices
        selectedVoice = voices.find(v => 
          v.lang.startsWith('en') && 
          (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('zira'))
        ) || voices.find(v => 
          v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft'))
        );
      }
      
      if (!selectedVoice) {
        selectedVoice = voices.find(v => v.lang.startsWith('en'));
      }
      
      if (selectedVoice) {
        utterance.voice = selectedVoice;
        console.log(`🔊 Browser TTS voice: ${selectedVoice.name}`);
      }
      
      // Adjust prosody based on emotion - more dramatic variations for realism
      const emotionLower = emotion.toLowerCase();
      if (emotionLower.includes('angry') || emotionLower.includes('furious') || emotionLower.includes('rage')) {
        // ANGRY: Fast, loud, high pitch variation
        utterance.rate = 1.5;
        utterance.pitch = 1.3;
        utterance.volume = 1.0;
      } else if (emotionLower.includes('impatient') || emotionLower.includes('frustrated') || emotionLower.includes('annoyed') || emotionLower.includes('irritated')) {
        // IMPATIENT/FRUSTRATED: Fast, slightly louder, clipped
        utterance.rate = 1.4;
        utterance.pitch = 1.2;
        utterance.volume = 1.0;
      } else if (emotionLower.includes('dismissive') || emotionLower.includes('condescending') || emotionLower.includes('bored')) {
        // DISMISSIVE: Slightly fast, low pitch, lower volume (disinterested)
        utterance.rate = 1.2;
        utterance.pitch = 0.8;
        utterance.volume = 0.85;
      } else if (emotionLower.includes('excited') || emotionLower.includes('enthusiastic') || emotionLower.includes('happy')) {
        // EXCITED: Fast, high pitch, loud
        utterance.rate = 1.35;
        utterance.pitch = 1.25;
        utterance.volume = 1.0;
      } else if (emotionLower.includes('grateful') || emotionLower.includes('thankful') || emotionLower.includes('appreciative')) {
        // GRATEFUL: Warm, slower, gentle
        utterance.rate = 0.9;
        utterance.pitch = 1.15;
        utterance.volume = 0.95;
      } else if (emotionLower.includes('friendly') || emotionLower.includes('warm') || emotionLower.includes('welcoming')) {
        // FRIENDLY: Medium pace, slightly higher pitch
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        utterance.volume = 1.0;
      } else if (emotionLower.includes('skeptical') || emotionLower.includes('doubtful') || emotionLower.includes('suspicious')) {
        // SKEPTICAL: Slower, questioning tone
        utterance.rate = 0.85;
        utterance.pitch = 0.9;
        utterance.volume = 0.9;
      } else if (emotionLower.includes('curious') || emotionLower.includes('interested') || emotionLower.includes('intrigued')) {
        // CURIOUS: Slightly slower, rising intonation feel
        utterance.rate = 0.95;
        utterance.pitch = 1.1;
        utterance.volume = 0.95;
      } else if (emotionLower.includes('sad') || emotionLower.includes('disappointed') || emotionLower.includes('dejected')) {
        // SAD: Slow, low pitch, quiet
        utterance.rate = 0.75;
        utterance.pitch = 0.85;
        utterance.volume = 0.8;
      } else if (emotionLower.includes('nervous') || emotionLower.includes('anxious') || emotionLower.includes('worried')) {
        // NERVOUS: Slightly fast, higher pitch, softer
        utterance.rate = 1.15;
        utterance.pitch = 1.15;
        utterance.volume = 0.85;
      } else if (emotionLower.includes('confident') || emotionLower.includes('assertive') || emotionLower.includes('commanding')) {
        // CONFIDENT: Strong, clear, medium-slow
        utterance.rate = 0.95;
        utterance.pitch = 0.95;
        utterance.volume = 1.0;
      } else if (emotionLower.includes('sarcastic') || emotionLower.includes('mocking')) {
        // SARCASTIC: Slower with exaggerated pitch
        utterance.rate = 0.9;
        utterance.pitch = 1.2;
        utterance.volume = 0.95;
      } else if (emotionLower.includes('urgent') || emotionLower.includes('alarmed') || emotionLower.includes('panicked')) {
        // URGENT: Very fast, high, loud
        utterance.rate = 1.6;
        utterance.pitch = 1.35;
        utterance.volume = 1.0;
      } else {
        // NEUTRAL: Default
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
      }
      
      utterance.onend = () => {
        console.log('🔊 TTS finished');
        resolve();
      };
      
      utterance.onerror = (err) => {
        console.error('🔊 TTS error:', err);
        reject(err);
      };
      
      console.log('🔊 Speaking with emotion:', emotion);
      window.speechSynthesis.speak(utterance);
    });
  };

  // Disconnect
  const disconnect = useCallback(() => {
    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach(track => track.stop());
      mediaStream.current = null;
    }
    
    if (timerInterval.current) {
      clearInterval(timerInterval.current);
      timerInterval.current = null;
    }
    
    setConnectionState('disconnected');
    setIsRecording(false);
    setIsSpeaking(false);
    setMessages([]);
    setError(null);
    setRecordingTime(0);
    setConversationRounds(0);
  }, []);

  // Send text message (fallback)
  const sendTextMessage = useCallback(async (text: string) => {
    // Create the new user message
    const userMessage: VoiceMessage = {
      role: 'user',
      content: text,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Build conversation history including the new message
    const historyWithNewMessage = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: text }
    ];
    
    // Get AI response
    const { roleplayChat } = await import('../services/geminiService');
    const response = await roleplayChat(
      config!.persona,
      config!.scenario,
      config!.videoContext,
      historyWithNewMessage
    );
    
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: response,
      timestamp: new Date()
    }]);
  }, [config, messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    isRecording,
    isSpeaking,
    messages,
    error,
    recordingTime,
    maxRecordingTime: MAX_RECORDING_TIME,
    conversationRounds,
    maxConversationRounds: MAX_CONVERSATION_ROUNDS,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendTextMessage,
  };
};
