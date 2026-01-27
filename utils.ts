/**
 * Shared utility functions for SkillSync
 * Centralized helpers to avoid code duplication across components
 */

/**
 * Format seconds into MM:SS timestamp string
 */
export const formatTimestamp = (seconds?: number): string => {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '';
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Parse MM:SS timestamp string to seconds
 */
export const parseTimestamp = (timestamp: string): number | null => {
  const match = timestamp.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  const mins = parseInt(match[1], 10);
  const secs = parseInt(match[2], 10);
  if (secs >= 60) return null;
  return mins * 60 + secs;
};

/**
 * Copy text to clipboard with callback
 */
export const copyToClipboard = async (
  text: string, 
  onSuccess?: () => void,
  onError?: (error: Error) => void
): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    onSuccess?.();
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    onError?.(err instanceof Error ? err : new Error('Clipboard copy failed'));
    return false;
  }
};

/**
 * Simple markdown renderer for chat messages
 * Converts **bold**, *italic*, and `code` to HTML
 */
export const renderMarkdown = (text: string): string => {
  if (!text) return '';
  // Convert **bold** to <strong>
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Convert *italic* to <em>
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Convert `code` to <code>
  formatted = formatted.replace(/`(.*?)`/g, '<code class="bg-slate-100 px-1 rounded text-sm">$1</code>');
  return formatted;
};

/**
 * Extract YouTube video ID from various URL formats
 * Supports: watch, shorts, youtu.be, embed
 */
export const extractVideoId = (url: string): string | null => {
  if (!url || typeof url !== 'string') return null;
  
  // Handle YouTube Shorts
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  
  // Handle standard URLs
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

/**
 * Check if a string is a valid YouTube URL
 */
export const isValidYouTubeUrl = (url: string): boolean => {
  return extractVideoId(url) !== null;
};

/**
 * Get score color class based on evaluation score
 */
export const getScoreColor = (score: number): { text: string; bg: string; bar: string } => {
  if (score >= 4) {
    return { text: 'text-green-500', bg: 'bg-green-500', bar: 'bg-green-500' };
  } else if (score >= 3) {
    return { text: 'text-amber-500', bg: 'bg-amber-500', bar: 'bg-amber-500' };
  } else {
    return { text: 'text-red-500', bg: 'bg-red-500', bar: 'bg-red-500' };
  }
};

/**
 * Get score label based on evaluation score
 */
export const getScoreLabel = (score: number): string => {
  if (score >= 5) return 'Excellent';
  if (score >= 4) return 'Great';
  if (score >= 3) return 'Good';
  if (score >= 2) return 'Fair';
  if (score >= 1) return 'Needs Work';
  return 'Incomplete';
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength) + '...';
};

/**
 * Debounce function for rate-limiting
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Safely parse JSON with a fallback value
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return crypto.randomUUID();
};

/**
 * Sanitize filename by removing invalid characters
 */
export const sanitizeFilename = (name: string): string => {
  return name
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 200);
};

/**
 * Sleep for a given number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Clamp a number between min and max
 */
export const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};
