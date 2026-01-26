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
      
      // Add welcome message
      setMessages([{
        role: 'assistant',
        content: 'Ready to practice! Click "Start Recording" to begin.',
        timestamp: new Date()
      }]);
      
    } catch (e) {
      console.error('Microphone access error:', e);
      setError('Microphone access denied. Please allow microphone access to use voice chat.');
      setConnectionState('error');
    }
  }, [config]);

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
          
          // Add assistant message
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: result.responseText,
            emotion: result.emotionalTone,
            timestamp: new Date()
          }]);
          
          // Play voice response with emotion using TTS
          setConnectionState('speaking');
          await textToSpeechWithEmotion(result.responseText, result.emotionalTone);
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

  // Text-to-speech with emotion using Google Cloud TTS (with SSML prosody)
  const textToSpeechWithEmotion = async (
    text: string,
    emotion: string
  ): Promise<void> => {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_TTS_API_KEY;
    
    // Fallback to browser TTS if no API key
    if (!apiKey) {
      console.warn('No Google TTS API key found, using browser TTS');
      return textToSpeechBrowserFallback(text, emotion);
    }

    try {
      // Detect gender from persona for appropriate voice selection
      const persona = config?.persona || '';
      const isFemale = /\b(she|her|woman|female|girl|lady|ms\.|mrs\.|miss)\b/i.test(persona);
      const isMale = /\b(he|him|man|male|boy|gentleman|mr\.|sir)\b/i.test(persona);
      
      // Select voice based on persona gender
      let voiceName = 'en-US-Neural2-F'; // Default female
      
      if (isMale && !isFemale) {
        // Male persona detected
        voiceName = 'en-US-Neural2-J'; // Male, casual/friendly
      } else if (persona.toLowerCase().includes('professional') || persona.toLowerCase().includes('executive')) {
        // Professional context
        voiceName = isMale ? 'en-US-Neural2-A' : 'en-US-Neural2-F'; // Formal voices
      }
      
      console.log(`🎭 Detected persona: ${persona.slice(0, 50)}...`);
      console.log(`🔊 Selected voice: ${voiceName} (${isMale ? 'male' : 'female'})`);
      
      // Map emotion to SSML prosody attributes
      let rate = '100%'; // normal
      let pitch = '+0st'; // semitones
      let volume = 'medium';
      
      switch (emotion) {
        case 'impatient':
        case 'frustrated':
          rate = '110%';
          pitch = '+3st';
          volume = 'medium';
          break;
        case 'grateful':
        case 'friendly':
          rate = '95%';
          pitch = '+2st';
          volume = 'medium';
          break;
        case 'angry':
        case 'dismissive':
          rate = '105%';
          pitch = '-2st';
          volume = 'loud';
          break;
        case 'skeptical':
        case 'curious':
          rate = '92%';
          pitch = '-1st';
          volume = 'medium';
          break;
        default:
          rate = '100%';
          pitch = '+0st';
          volume = 'medium';
      }
      
      // Build SSML with prosody
      const ssml = `<speak><prosody rate="${rate}" pitch="${pitch}" volume="${volume}">${text}</prosody></speak>`;
      
      // Call Google Cloud TTS API
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { ssml },
            voice: {
              languageCode: 'en-US',
              name: voiceName, // Dynamic voice selection based on persona
            },
            audioConfig: {
              audioEncoding: 'MP3',
              speakingRate: 1.0,
              pitch: 0.0,
            },
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`TTS API error: ${response.status}`);
      }
      
      const data = await response.json();
      const audioContent = data.audioContent; // base64 encoded MP3
      
      // Convert base64 to blob and play
      const audioBlob = base64ToBlob(audioContent, 'audio/mp3');
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          console.log('🔊 Google TTS finished');
          resolve();
        };
        audio.onerror = (err) => {
          URL.revokeObjectURL(audioUrl);
          console.error('🔊 Audio playback error:', err);
          reject(err);
        };
        console.log('🔊 Playing Google TTS with emotion:', emotion);
        audio.play();
      });
      
    } catch (err) {
      console.error('🔊 Google TTS error, falling back to browser TTS:', err);
      return textToSpeechBrowserFallback(text, emotion);
    }
  };
  
  // Helper: Convert base64 to Blob
  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
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
