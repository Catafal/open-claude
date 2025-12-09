/**
 * Ingestion Pipeline
 *
 * Parses different file types and URLs to extract text content.
 * Supports: .txt, .md, .pdf, web URLs
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { ParsedDocument, KnowledgeMetadata } from './types';

/**
 * Parse a local file and extract text content.
 * Supports: .txt, .md, .pdf
 */
export async function parseFile(filePath: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);

  let content: string;
  let type: KnowledgeMetadata['type'];

  switch (ext) {
    case '.pdf':
      content = await parsePdf(filePath);
      type = 'pdf';
      break;

    case '.md':
      content = await fs.readFile(filePath, 'utf-8');
      type = 'md';
      break;

    case '.txt':
    default:
      content = await fs.readFile(filePath, 'utf-8');
      type = 'txt';
      break;
  }

  return {
    content: content.trim(),
    metadata: {
      source: filePath,
      filename,
      type
    }
  };
}

/**
 * Parse PDF file and extract text content.
 */
async function parsePdf(filePath: string): Promise<string> {
  // Dynamic import to avoid loading at startup
  const pdfParse = await import('pdf-parse');

  const buffer = await fs.readFile(filePath);
  const data = await pdfParse.default(buffer);

  return data.text;
}

/**
 * Fetch and parse a web URL.
 * Extracts main content, removing navigation, ads, etc.
 */
export async function parseUrl(url: string): Promise<ParsedDocument> {
  // Fetch the page
  const response = await fetch(url, {
    headers: {
      // Basic user agent to avoid blocks
      'User-Agent': 'Mozilla/5.0 (compatible; KnowledgeBot/1.0)'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  // Dynamic import cheerio
  const cheerio = await import('cheerio');
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, nav, footer, header, aside, noscript, iframe').remove();
  $('[role="navigation"], [role="banner"], [role="complementary"]').remove();
  $('.nav, .navbar, .menu, .sidebar, .footer, .header, .ads, .advertisement').remove();

  // Extract title
  const title = $('title').text().trim() || extractTitleFromUrl(url);

  // Try to find main content in order of preference
  let text = '';

  // Try article or main content first
  const mainContent = $('article, main, [role="main"], .content, .post, .article').first();
  if (mainContent.length) {
    text = mainContent.text();
  } else {
    // Fall back to body
    text = $('body').text();
  }

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .replace(/\n\s*\n/g, '\n\n')  // Normalize paragraph breaks
    .trim();

  return {
    content: text,
    metadata: {
      source: url,
      filename: title,
      type: 'url'
    }
  };
}

/**
 * Extract a readable title from URL if page title is missing.
 */
function extractTitleFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Use last path segment or hostname
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return decodeURIComponent(pathParts[pathParts.length - 1])
        .replace(/[-_]/g, ' ')
        .replace(/\.\w+$/, '');  // Remove file extension
    }
    return parsed.hostname;
  } catch {
    return url;
  }
}
