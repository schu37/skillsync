/**
 * Shared utility functions for SkillSync
 * Centralized helpers to avoid code duplication across components
 */

/**
 * Format seconds into MM:SS timestamp string
 */
export const formatTimestamp = (seconds?: number): string => {
  if (seconds === undefined || seconds === null) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  // Handle YouTube Shorts
  const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (shortsMatch) return shortsMatch[1];
  
  // Handle standard URLs
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
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
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

/**
 * Debounce function for rate-limiting
 */
export const debounce = <T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
