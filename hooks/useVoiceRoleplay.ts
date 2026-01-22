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
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Helper to get API key
const getApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

export const useVoiceRoleplay = (config: VoiceRoleplayConfig | null) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  // Initialize audio context
  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Play audio from base64 PCM data
  const playAudio = useCallback(async (base64Audio: string) => {
    try {
      const audioContext = await initAudioContext();
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Convert to Float32 (assuming 16-bit PCM)
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = audioContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      
      setIsSpeaking(true);
      source.onended = () => setIsSpeaking(false);
      source.start();
    } catch (e) {
      console.error('Audio playback error:', e);
    }
  }, [initAudioContext]);

  // Connect to Gemini Live API
  const connect = useCallback(async () => {
    if (!config) {
      setError('No roleplay configuration provided');
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      setError('Gemini API key not configured');
      return;
    }

    setConnectionState('connecting');
    setError(null);

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });
      mediaStreamRef.current = stream;

      // Connect to Gemini Live API via WebSocket
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🎙️ WebSocket connected');
        
        // Send setup message
        const setupMessage = {
          setup: {
            model: 'models/gemini-2.0-flash-live-001',
            generationConfig: {
              responseModalities: ['AUDIO', 'TEXT'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: 'Aoede' // Professional female voice
                  }
                }
              }
            },
            systemInstruction: {
              parts: [{
                text: `You are playing a character in a roleplay scenario for communication skills practice.

CHARACTER: ${config.persona}

SCENARIO CONTEXT: ${config.scenario}

VIDEO CONTEXT (what the user learned): ${config.videoContext}

INSTRUCTIONS:
- Stay in character throughout the conversation
- Be realistic but not hostile - push back appropriately
- After 3-5 exchanges, naturally conclude the conversation
- At the end, briefly break character to give feedback on how the user did
- Focus on: tone, persuasion techniques, active listening, handling objections

Speak naturally as your character would. Start with a greeting appropriate to the scenario.`
              }]
            }
          }
        };
        
        ws.send(JSON.stringify(setupMessage));
        setConnectionState('connected');
        
        // Add initial assistant message
        setMessages([{
          role: 'assistant',
          content: '(Connected - waiting for AI to start...)',
          timestamp: new Date()
        }]);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle server content (audio/text response)
          if (data.serverContent) {
            const parts = data.serverContent.modelTurn?.parts || [];
            
            for (const part of parts) {
              // Handle text response
              if (part.text) {
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant' && last.content.startsWith('(')) {
                    // Replace placeholder
                    return [...prev.slice(0, -1), {
                      role: 'assistant',
                      content: part.text,
                      timestamp: new Date()
                    }];
                  }
                  return [...prev, {
                    role: 'assistant',
                    content: part.text,
                    timestamp: new Date()
                  }];
                });
              }
              
              // Handle audio response
              if (part.inlineData?.mimeType?.includes('audio') && part.inlineData.data) {
                playAudio(part.inlineData.data);
              }
            }
            
            // Check if turn is complete
            if (data.serverContent.turnComplete) {
              setIsSpeaking(false);
            }
          }
          
          // Handle setup complete
          if (data.setupComplete) {
            console.log('🎙️ Setup complete, ready for voice input');
          }
        } catch (e) {
          console.error('WebSocket message parse error:', e);
        }
      };

      ws.onerror = (e) => {
        console.error('WebSocket error:', e);
        setError('Connection error. Please try again.');
        setConnectionState('error');
      };

      ws.onclose = () => {
        console.log('🎙️ WebSocket closed');
        setConnectionState('disconnected');
        setIsListening(false);
      };

    } catch (e) {
      console.error('Connection error:', e);
      setError(e instanceof Error ? e.message : 'Failed to connect');
      setConnectionState('error');
    }
  }, [config, playAudio]);

  // Start listening (send audio to API)
  const startListening = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }

    if (!mediaStreamRef.current) {
      setError('No microphone access');
      return;
    }

    try {
      const audioContext = await initAudioContext();
      const source = audioContext.createMediaStreamSource(mediaStreamRef.current);
      
      // Create a script processor for audio capture
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        if (!isListening || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Resample from audioContext.sampleRate to 16000
        const ratio = audioContext.sampleRate / 16000;
        const outputLength = Math.floor(inputData.length / ratio);
        const outputData = new Float32Array(outputLength);
        
        for (let i = 0; i < outputLength; i++) {
          outputData[i] = inputData[Math.floor(i * ratio)];
        }
        
        // Convert to 16-bit PCM
        const pcmData = new Int16Array(outputData.length);
        for (let i = 0; i < outputData.length; i++) {
          const s = Math.max(-1, Math.min(1, outputData[i]));
          pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const uint8Array = new Uint8Array(pcmData.buffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64Audio = btoa(binary);
        
        // Send audio chunk
        const message = {
          realtimeInput: {
            mediaChunks: [{
              mimeType: 'audio/pcm;rate=16000',
              data: base64Audio
            }]
          }
        };
        
        wsRef.current.send(JSON.stringify(message));
      };
      
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      audioWorkletRef.current = processor as any;
      setIsListening(true);
      setTranscript('');
      
    } catch (e) {
      console.error('Start listening error:', e);
      setError('Failed to start microphone');
    }
  }, [initAudioContext, isListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    setIsListening(false);
    
    if (audioWorkletRef.current) {
      audioWorkletRef.current.disconnect();
      audioWorkletRef.current = null;
    }
    
    // Add user message placeholder if we have a transcript
    if (transcript) {
      setMessages(prev => [...prev, {
        role: 'user',
        content: transcript || '(Voice message)',
        timestamp: new Date()
      }]);
      setTranscript('');
    }
  }, [transcript]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setConnectionState('disconnected');
    setIsListening(false);
    setIsSpeaking(false);
    setMessages([]);
    setError(null);
  }, []);

  // Send text message (fallback)
  const sendTextMessage = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected');
      return;
    }
    
    setMessages(prev => [...prev, {
      role: 'user',
      content: text,
      timestamp: new Date()
    }]);
    
    const message = {
      clientContent: {
        turns: [{
          role: 'user',
          parts: [{ text }]
        }],
        turnComplete: true
      }
    };
    
    wsRef.current.send(JSON.stringify(message));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connectionState,
    isListening,
    isSpeaking,
    messages,
    error,
    transcript,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendTextMessage,
  };
};
