/**
 * Storage Service - Abstraction layer for data persistence
 * 
 * Currently uses localStorage for MVP.
 * Can be swapped to Supabase by implementing SupabaseStorageService.
 */

import { LessonPlan, SavedLessonPlan, UserSession, SkillMode, VideoSession, AnsweredQuestion, Evaluation, TechnicalLessonPlan, SoftSkillsLessonPlan } from '../types';

// ============================================
// STORAGE INTERFACE
// ============================================

export interface StorageService {
  // User
  getUser(): Promise<StoredUser | null>;
  saveUser(user: StoredUser): Promise<void>;
  clearUser(): Promise<void>;

  // Lesson Plans
  getLessonPlans(): Promise<SavedLessonPlan[]>;
  getLessonPlan(id: string): Promise<SavedLessonPlan | null>;
  saveLessonPlan(plan: LessonPlan): Promise<SavedLessonPlan>;
  deleteLessonPlan(id: string): Promise<void>;

  // Sessions
  getSession(lessonPlanId: string): Promise<UserSession | null>;
  saveSession(session: UserSession): Promise<void>;

  // Settings
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: Partial<AppSettings>): Promise<void>;
}

export interface StoredUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface AppSettings {
  preferredMode: SkillMode;
  autoPlay: boolean;
  showSafetyBanners: boolean;
  voiceEnabled: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  preferredMode: 'soft',
  autoPlay: true,
  showSafetyBanners: true,
  voiceEnabled: true,
};

// ============================================
// LOCALSTORAGE IMPLEMENTATION
// ============================================

const STORAGE_KEYS = {
  USER: 'skillsync_user',
  LESSON_PLANS: 'skillsync_lesson_plans',
  SESSIONS: 'skillsync_sessions',
  SETTINGS: 'skillsync_settings',
  VIDEO_CACHE: 'skillsync_video_cache',
} as const;

// ============================================
// VIDEO CACHING
// ============================================

interface CachedVideo {
  url: string;
  mode: SkillMode;
  plan: LessonPlan;
  cachedAt: string;
  expiresAt: string;
}

const CACHE_TTL_DAYS = 7;

const getCacheKey = (url: string, mode: string): string => {
  // Normalize URL and create consistent key
  const normalizedUrl = url.toLowerCase().trim();
  return `${normalizedUrl}_${mode}`;
};

export const videoCache = {
  get(url: string, mode: SkillMode): LessonPlan | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VIDEO_CACHE);
      if (!data) return null;
      
      const cache: Record<string, CachedVideo> = JSON.parse(data);
      const key = getCacheKey(url, mode);
      const cached = cache[key];
      
      if (!cached) return null;
      
      // Check expiration
      if (new Date(cached.expiresAt) < new Date()) {
        // Expired, remove it
        delete cache[key];
        localStorage.setItem(STORAGE_KEYS.VIDEO_CACHE, JSON.stringify(cache));
        return null;
      }
      
      console.log('📦 Cache HIT for:', url.slice(0, 50));
      return cached.plan;
    } catch {
      return null;
    }
  },

  set(url: string, mode: SkillMode, plan: LessonPlan): void {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VIDEO_CACHE);
      const cache: Record<string, CachedVideo> = data ? JSON.parse(data) : {};
      
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
      
      const key = getCacheKey(url, mode);
      cache[key] = {
        url,
        mode,
        plan,
        cachedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      
      // Limit cache size (keep 10 most recent)
      const entries = Object.entries(cache);
      if (entries.length > 10) {
        entries.sort((a, b) => 
          new Date(b[1].cachedAt).getTime() - new Date(a[1].cachedAt).getTime()
        );
        const trimmed = Object.fromEntries(entries.slice(0, 10));
        localStorage.setItem(STORAGE_KEYS.VIDEO_CACHE, JSON.stringify(trimmed));
      } else {
        localStorage.setItem(STORAGE_KEYS.VIDEO_CACHE, JSON.stringify(cache));
      }
      
      console.log('💾 Cached lesson plan for:', url.slice(0, 50));
    } catch (e) {
      console.warn('Failed to cache video:', e);
    }
  },

  clear(): void {
    localStorage.removeItem(STORAGE_KEYS.VIDEO_CACHE);
    console.log('🗑️ Video cache cleared');
  },

  clearUrl(url: string, mode: SkillMode): void {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.VIDEO_CACHE);
      if (!data) return;
      
      const cache: Record<string, CachedVideo> = JSON.parse(data);
      const key = getCacheKey(url, mode);
      delete cache[key];
      localStorage.setItem(STORAGE_KEYS.VIDEO_CACHE, JSON.stringify(cache));
    } catch {}
  }
};

// ============================================
// SESSION STORAGE (Answered Questions)
// ============================================

const SESSION_PREFIX = 'skillsync_session_';
const SESSION_TTL_DAYS = 30; // Keep sessions for 30 days

const getSessionKey = (videoUrl: string, mode: SkillMode): string => {
  return `${SESSION_PREFIX}${btoa(videoUrl)}_${mode}`;
};

export const sessionStorage = {
  get(videoUrl: string, mode: SkillMode): VideoSession | null {
    try {
      const key = getSessionKey(videoUrl, mode);
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const session: VideoSession = JSON.parse(stored);
      
      // Check if expired (30 days)
      const lastAccess = new Date(session.lastAccessedAt);
      const now = new Date();
      const daysDiff = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > SESSION_TTL_DAYS) {
        localStorage.removeItem(key);
        return null;
      }
      
      return session;
    } catch {
      return null;
    }
  },
  
  set(videoUrl: string, mode: SkillMode, lessonPlanId: string): VideoSession {
    const key = getSessionKey(videoUrl, mode);
    const existing = this.get(videoUrl, mode);
    
    const session: VideoSession = existing || {
      videoUrl,
      mode,
      lessonPlanId,
      answeredQuestions: [],
      lastAccessedAt: new Date().toISOString(),
      regenerationCount: 0,
    };
    
    session.lastAccessedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(session));
    return session;
  },
  
  addAnswer(
    videoUrl: string, 
    mode: SkillMode, 
    stopPointId: string,
    question: string,
    userAnswer: string, 
    evaluation: Evaluation
  ): void {
    const key = getSessionKey(videoUrl, mode);
    const session = this.get(videoUrl, mode);
    if (!session) return;
    
    // Remove existing answer for this question (if re-answering)
    session.answeredQuestions = session.answeredQuestions.filter(
      aq => aq.stopPointId !== stopPointId
    );
    
    // Add new answer
    session.answeredQuestions.push({
      stopPointId,
      question,
      userAnswer,
      evaluation,
      answeredAt: new Date().toISOString(),
    });
    
    session.lastAccessedAt = new Date().toISOString();
    localStorage.setItem(key, JSON.stringify(session));
  },
  
  getAnsweredIds(videoUrl: string, mode: SkillMode): Set<string> {
    const session = this.get(videoUrl, mode);
    if (!session) return new Set();
    return new Set(session.answeredQuestions.map(aq => aq.stopPointId));
  },
  
  clearAnswers(videoUrl: string, mode: SkillMode): void {
    const session = this.get(videoUrl, mode);
    if (!session) return;
    
    session.answeredQuestions = [];
    session.lastAccessedAt = new Date().toISOString();
    const key = getSessionKey(videoUrl, mode);
    localStorage.setItem(key, JSON.stringify(session));
  },
  
  incrementRegeneration(videoUrl: string, mode: SkillMode): number {
    const session = this.get(videoUrl, mode);
    if (!session) return 0;
    
    session.regenerationCount += 1;
    session.lastAccessedAt = new Date().toISOString();
    const key = getSessionKey(videoUrl, mode);
    localStorage.setItem(key, JSON.stringify(session));
    return session.regenerationCount;
  },
};

// ============================================
// NOTES STORAGE
// ============================================

interface VideoNotes {
  videoUrl: string;
  mode: SkillMode;
  aiGeneratedNotes: string;
  userNotes: string;
  updatedAt: string;
}

const NOTES_PREFIX = 'skillsync_notes_';
const NOTES_TTL_DAYS = 90; // Keep notes for 90 days

export const notesStorage = {
  getKey(url: string, mode: SkillMode): string {
    return `${NOTES_PREFIX}${btoa(url)}_${mode}`;
  },

  get(url: string, mode: SkillMode): VideoNotes | null {
    try {
      const key = this.getKey(url, mode);
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const notes: VideoNotes = JSON.parse(stored);

      // Check TTL
      const updatedDate = new Date(notes.updatedAt);
      const now = new Date();
      const daysDiff = (now.getTime() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff > NOTES_TTL_DAYS) {
        localStorage.removeItem(key);
        return null;
      }

      return notes;
    } catch {
      return null;
    }
  },

  save(url: string, mode: SkillMode, aiNotes: string, userNotes: string): void {
    try {
      const key = this.getKey(url, mode);
      const notes: VideoNotes = {
        videoUrl: url,
        mode,
        aiGeneratedNotes: aiNotes,
        userNotes,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(notes));
    } catch (e) {
      console.warn('Failed to save notes:', e);
    }
  },

  updateUserNotes(url: string, mode: SkillMode, userNotes: string): void {
    const existing = this.get(url, mode);
    this.save(url, mode, existing?.aiGeneratedNotes || '', userNotes);
  },

  updateAINotes(url: string, mode: SkillMode, aiNotes: string): void {
    const existing = this.get(url, mode);
    this.save(url, mode, aiNotes, existing?.userNotes || '');
  },
};

class LocalStorageService implements StorageService {
  // --- User ---
  async getUser(): Promise<StoredUser | null> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async saveUser(user: StoredUser): Promise<void> {
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  }

  async clearUser(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.USER);
  }

  // --- Lesson Plans ---
  async getLessonPlans(): Promise<SavedLessonPlan[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LESSON_PLANS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  async getLessonPlan(id: string): Promise<SavedLessonPlan | null> {
    const plans = await this.getLessonPlans();
    return plans.find(p => p.id === id) || null;
  }

  async saveLessonPlan(plan: LessonPlan): Promise<SavedLessonPlan> {
    const plans = await this.getLessonPlans();
    
    const savedPlan: SavedLessonPlan = {
      id: plan.id,
      lessonPlan: plan,
      sessions: [],
      createdAt: plan.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = plans.findIndex(p => p.id === plan.id);
    if (existingIndex >= 0) {
      savedPlan.sessions = plans[existingIndex].sessions;
      plans[existingIndex] = savedPlan;
    } else {
      plans.unshift(savedPlan); // Add to beginning
    }

    // Keep only last 20 plans
    const trimmedPlans = plans.slice(0, 20);
    localStorage.setItem(STORAGE_KEYS.LESSON_PLANS, JSON.stringify(trimmedPlans));
    
    return savedPlan;
  }

  async deleteLessonPlan(id: string): Promise<void> {
    const plans = await this.getLessonPlans();
    const filtered = plans.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.LESSON_PLANS, JSON.stringify(filtered));
  }

  // --- Sessions ---
  async getSession(lessonPlanId: string): Promise<UserSession | null> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      const sessions: Record<string, UserSession> = data ? JSON.parse(data) : {};
      return sessions[lessonPlanId] || null;
    } catch {
      return null;
    }
  }

  async saveSession(session: UserSession): Promise<void> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      const sessions: Record<string, UserSession> = data ? JSON.parse(data) : {};
      sessions[session.lessonPlanId] = session;
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error('Failed to save session', e);
    }
  }

  // --- Settings ---
  async getSettings(): Promise<AppSettings> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
  }
}

// ============================================
// EXPORT SINGLETON
// ============================================

export const storage = new LocalStorageService();

// ============================================
// FUTURE: SUPABASE IMPLEMENTATION
// ============================================

/*
import { createClient, SupabaseClient } from '@supabase/supabase-js';

class SupabaseStorageService implements StorageService {
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.VITE_SUPABASE_ANON_KEY!
    );
  }

  async getUser(): Promise<StoredUser | null> {
    const { data } = await this.client.auth.getUser();
    if (!data.user) return null;
    
    return {
      id: data.user.id,
      email: data.user.email!,
      displayName: data.user.user_metadata.full_name || data.user.email!,
      avatarUrl: data.user.user_metadata.avatar_url,
      createdAt: data.user.created_at,
    };
  }

  async getLessonPlans(): Promise<SavedLessonPlan[]> {
    const user = await this.getUser();
    if (!user) return [];

    const { data } = await this.client
      .from('lesson_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return (data || []).map(row => ({
      id: row.id,
      lessonPlan: row.plan as LessonPlan,
      sessions: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // ... implement other methods
}

// To switch: export const storage = new SupabaseStorageService();
*/

// ============================================
// VIDEO CONTEXT CACHE (Separate from lesson plan)
// ============================================

interface CachedVideoContext {
  videoUrl: string;
  videoContext: string;
  summary: string;
  skillsDetected: string[];
  contentWarning?: {
    hasConcerns: boolean;
    isSuspicious: boolean;
    isMisinformation: boolean;
    isUnsafe: boolean;
    concerns: string[];
    recommendation: string;
  };
  cachedAt: string;
  // Technical mode extras
  projectType?: string;
  components?: any[];
  tools?: any[];
  buildSteps?: any[];
  designDecisions?: any[];
  safetyOverview?: string;
  requiredPrecautions?: string[];
  // Soft skills extras
  scenarioPreset?: string;
  rolePlayPersona?: string;
}

const VIDEO_CONTEXT_PREFIX = 'skillsync_video_context_';
const VIDEO_CONTEXT_TTL_DAYS = 30; // Context valid for 30 days

export const videoContextCache = {
  getKey(url: string, mode: SkillMode): string {
    return `${VIDEO_CONTEXT_PREFIX}${btoa(url)}_${mode}`;
  },
  
  get(url: string, mode: SkillMode): CachedVideoContext | null {
    try {
      const key = this.getKey(url, mode);
      const stored = localStorage.getItem(key);
      if (!stored) return null;
      
      const cached: CachedVideoContext = JSON.parse(stored);
      
      // Check TTL
      const cachedDate = new Date(cached.cachedAt);
      const now = new Date();
      const daysDiff = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > VIDEO_CONTEXT_TTL_DAYS) {
        localStorage.removeItem(key);
        return null;
      }
      
      return cached;
    } catch {
      return null;
    }
  },
  
  set(url: string, mode: SkillMode, context: Omit<CachedVideoContext, 'cachedAt'>): void {
    try {
      const key = this.getKey(url, mode);
      const cached: CachedVideoContext = {
        ...context,
        cachedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(cached));
    } catch (e) {
      console.warn('Failed to cache video context:', e);
    }
  },
  
  // Extract context from a full lesson plan
  extractFromPlan(plan: LessonPlan): Omit<CachedVideoContext, 'cachedAt'> {
    const base = {
      videoUrl: plan.videoUrl,
      videoContext: plan.videoContext,
      summary: plan.summary,
      skillsDetected: plan.skillsDetected,
      contentWarning: plan.contentWarning,
    };
    
    if (plan.mode === 'technical') {
      const techPlan = plan as TechnicalLessonPlan;
      return {
        ...base,
        projectType: techPlan.projectType,
        components: techPlan.components,
        tools: techPlan.tools,
        buildSteps: techPlan.buildSteps,
        designDecisions: techPlan.designDecisions,
        safetyOverview: techPlan.safetyOverview,
        requiredPrecautions: techPlan.requiredPrecautions,
      };
    } else {
      const softPlan = plan as SoftSkillsLessonPlan;
      return {
        ...base,
        scenarioPreset: softPlan.scenarioPreset,
        rolePlayPersona: softPlan.rolePlayPersona,
      };
    }
  },
};

// ============================================
// PROGRESS PERSISTENCE (Resume Sessions)
// ============================================

export interface SavedProgress {
  videoUrl: string;
  videoId: string;
  skillMode: SkillMode;
  selectedPreset: string;
  lessonPlan: LessonPlan;
  currentStopIndex: number;
  sessionHistory: { question: string; answer: string; evaluation: Evaluation }[];
  answeredQuestionIds: string[];
  savedAt: string;
}

const PROGRESS_KEY = 'skillsync_saved_progress';
const PROGRESS_TTL_DAYS = 7; // Keep progress for 7 days

export const progressStorage = {
  /**
   * Save current learning progress
   */
  save(progress: Omit<SavedProgress, 'savedAt'>): void {
    try {
      const saved: SavedProgress = {
        ...progress,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(saved));
      console.log('💾 Progress saved');
    } catch (e) {
      console.warn('Failed to save progress:', e);
    }
  },

  /**
   * Get saved progress if it exists and is not expired
   */
  get(): SavedProgress | null {
    try {
      const stored = localStorage.getItem(PROGRESS_KEY);
      if (!stored) return null;

      const progress: SavedProgress = JSON.parse(stored);

      // Check TTL
      const savedDate = new Date(progress.savedAt);
      const now = new Date();
      const daysDiff = (now.getTime() - savedDate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysDiff > PROGRESS_TTL_DAYS) {
        this.clear();
        return null;
      }

      return progress;
    } catch {
      return null;
    }
  },

  /**
   * Check if there's resumable progress
   */
  hasResumableProgress(): boolean {
    return this.get() !== null;
  },

  /**
   * Get a summary of saved progress for display
   */
  getSummary(): { videoUrl: string; mode: SkillMode; questionsAnswered: number; savedAt: string } | null {
    const progress = this.get();
    if (!progress) return null;

    return {
      videoUrl: progress.videoUrl,
      mode: progress.skillMode,
      questionsAnswered: progress.answeredQuestionIds.length,
      savedAt: progress.savedAt,
    };
  },

  /**
   * Clear saved progress
   */
  clear(): void {
    localStorage.removeItem(PROGRESS_KEY);
    console.log('🗑️ Progress cleared');
  },

  /**
   * Update just the stop index (for quick saves during navigation)
   */
  updateStopIndex(index: number): void {
    const progress = this.get();
    if (!progress) return;

    progress.currentStopIndex = index;
    progress.savedAt = new Date().toISOString();
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  },

  /**
   * Add a new answer to the saved progress
   */
  addAnswer(questionId: string, question: string, answer: string, evaluation: Evaluation): void {
    const progress = this.get();
    if (!progress) return;

    // Add to history if not already there
    if (!progress.sessionHistory.some(h => h.question === question)) {
      progress.sessionHistory.push({ question, answer, evaluation });
    }

    // Add to answered IDs
    if (!progress.answeredQuestionIds.includes(questionId)) {
      progress.answeredQuestionIds.push(questionId);
    }

    progress.savedAt = new Date().toISOString();
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  },
};
