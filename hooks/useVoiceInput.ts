/**
 * useVoiceInput - Hook for voice input using Web Speech API
 * 
 * Provides voice-to-text functionality for answering questions
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Type declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export interface UseVoiceInputOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
}

export interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
  error: string | null;
}

export const useVoiceInput = (options: UseVoiceInputOptions = {}): UseVoiceInputReturn => {
  const {
    onTranscript,
    onError,
    language = 'en-US',
    continuous = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check for browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = continuous;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = language;

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimText += result[0].transcript;
          }
        }

        if (finalTranscript) {
          setTranscript(prev => prev + finalTranscript);
          onTranscript?.(finalTranscript, true);
        }
        
        setInterimTranscript(interimText);
        if (interimText) {
          onTranscript?.(interimText, false);
        }
      };

      recognitionRef.current.onerror = (event) => {
        const errorMsg = event.error;
        setError(errorMsg);
        onError?.(errorMsg);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        setError(null);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [continuous, language, onTranscript, onError]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported');
      return;
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      // May throw if already started
      console.warn('Recognition start error:', e);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
    error,
  };
};

/**
 * useSpeechSynthesis - Hook for text-to-speech
 */
export interface UseSpeechSynthesisReturn {
  speak: (text: string, options?: { rate?: number; pitch?: number; voice?: string }) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
  voices: SpeechSynthesisVoice[];
}

export const useSpeechSynthesis = (): UseSpeechSynthesisReturn => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported('speechSynthesis' in window);

    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speak = useCallback((text: string, options: { rate?: number; pitch?: number; voice?: string } = {}) => {
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;

    if (options.voice) {
      const voice = voices.find(v => v.name === options.voice);
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [voices]);

  const stop = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    isSupported,
    voices,
  };
};

export default useVoiceInput;
