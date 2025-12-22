/**
 * HTML Utility Functions
 *
 * Common functions for HTML string manipulation and sanitization.
 */

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * Uses DOM-based approach for reliable escaping.
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

/**
 * Alternative escapeHtml using string replacement.
 * Faster but less comprehensive than DOM-based approach.
 */
export function escapeHtmlFast(text: string): string {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
