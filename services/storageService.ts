/**
 * Storage Service - Abstraction layer for data persistence
 * 
 * Currently uses localStorage for MVP.
 * Can be swapped to Supabase by implementing SupabaseStorageService.
 */

import { LessonPlan, SavedLessonPlan, UserSession } from '../types';

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
  preferredMode: 'soft' | 'technical';
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
  mode: 'soft' | 'technical';
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
  get(url: string, mode: 'soft' | 'technical'): LessonPlan | null {
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

  set(url: string, mode: 'soft' | 'technical', plan: LessonPlan): void {
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

  clearUrl(url: string, mode: 'soft' | 'technical'): void {
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
