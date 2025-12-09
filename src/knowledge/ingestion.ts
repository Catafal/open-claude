/**
 * Ingestion Pipeline
 *
 * Parses different file types and URLs to extract text content.
 * Supports: .txt, .md, .pdf, web URLs (via Firecrawl)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import FirecrawlApp from '@mendable/firecrawl-js';
import type { ParsedDocument, KnowledgeMetadata } from './types';

// Firecrawl client - lazy initialized when API key is provided
let firecrawlClient: FirecrawlApp | null = null;

/**
 * Initialize the Firecrawl client with API key.
 * Called when knowledge settings are loaded/saved.
 */
export function initFirecrawl(apiKey: string): void {
  if (apiKey) {
    firecrawlClient = new FirecrawlApp({ apiKey });
    console.log('[Firecrawl] Client initialized');
  } else {
    firecrawlClient = null;
  }
}

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
 * Fetch and parse a web URL using Firecrawl.
 * Returns clean markdown content, handles JS rendering.
 */
export async function parseUrl(url: string): Promise<ParsedDocument> {
  if (!firecrawlClient) {
    throw new Error('Firecrawl API key not configured. Add it in Knowledge settings.');
  }

  console.log(`[Firecrawl] Scraping: ${url}`);

  // Firecrawl scrape returns Document with markdown and metadata
  const result = await firecrawlClient.scrape(url, {
    formats: ['markdown']
  });

  // Extract title from metadata or fallback to URL
  const title = result.metadata?.title || extractTitleFromUrl(url);
  const content = result.markdown || '';

  if (!content) {
    throw new Error('No content extracted from URL');
  }

  console.log(`[Firecrawl] Extracted ${content.length} chars from "${title}"`);

  return {
    content,
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
