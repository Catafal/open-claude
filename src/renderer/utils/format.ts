/**
 * Formatting Utility Functions
 *
 * Common functions for formatting data for display.
 */

/**
 * Formats bytes into human-readable file size.
 * Examples: 1024 -> "1 KB", 1536 -> "1.5 KB"
 */
export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${sizes[i]}`;
}

/**
 * Formats a date string into relative time.
 * Examples: "Today", "Yesterday", "3 days ago", "Jan 15, 2024"
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

/**
 * Formats a timestamp into a human-readable time string.
 */
export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}
