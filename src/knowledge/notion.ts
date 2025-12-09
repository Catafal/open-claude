/**
 * Notion Client
 *
 * Handles Notion API interactions for knowledge ingestion.
 * Fetches pages and extracts text content for embedding.
 */

import { Client } from '@notionhq/client';
import type {
  BlockObjectResponse,
  PageObjectResponse,
  PartialBlockObjectResponse,
  RichTextItemResponse
} from '@notionhq/client/build/src/api-endpoints';

// Singleton client instance
let client: Client | null = null;

/**
 * Initialize the Notion client with an integration token.
 */
export function initNotionClient(token: string): Client {
  client = new Client({ auth: token });
  console.log('[Notion] Client initialized');
  return client;
}

/**
 * Get the current Notion client instance.
 * Throws if not initialized.
 */
export function getNotionClient(): Client {
  if (!client) {
    throw new Error('Notion client not initialized. Call initNotionClient first.');
  }
  return client;
}

/**
 * Test if the connection is valid by listing users.
 */
export async function testNotionConnection(): Promise<boolean> {
  const notion = getNotionClient();
  // Simple API call to verify token works
  await notion.users.me({});
  return true;
}

/**
 * List all accessible pages in the workspace.
 * Returns page IDs and titles.
 */
export async function listNotionPages(): Promise<Array<{ id: string; title: string; url: string }>> {
  const notion = getNotionClient();
  const pages: Array<{ id: string; title: string; url: string }> = [];

  let cursor: string | undefined = undefined;

  do {
    const response = await notion.search({
      filter: { property: 'object', value: 'page' },
      start_cursor: cursor,
      page_size: 100
    });

    for (const result of response.results) {
      if (result.object === 'page') {
        const page = result as PageObjectResponse;
        const title = extractPageTitle(page);
        const url = `https://notion.so/${page.id.replace(/-/g, '')}`;
        pages.push({ id: page.id, title, url });
      }
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  console.log(`[Notion] Found ${pages.length} accessible pages`);
  return pages;
}

/**
 * Extract page ID from a Notion URL or raw ID.
 * Handles formats: notion.so/Page-abc123, notion.so/workspace/Page-abc123, raw 32-char hex
 */
export function extractPageIdFromUrl(urlOrId: string): string {
  const input = urlOrId.trim();

  // Already a raw ID (32 hex chars or UUID format)
  if (/^[a-f0-9]{32}$/i.test(input) || /^[a-f0-9-]{36}$/i.test(input)) {
    return input.replace(/-/g, '');
  }

  // Extract from URL: last segment before query params, last 32 chars
  const urlMatch = input.match(/([a-f0-9]{32})(?:\?|$)/i);
  if (urlMatch) return urlMatch[1];

  // Try extracting from page title format: "Page-Title-abc123def456..."
  const titleMatch = input.match(/[a-f0-9]{32}$/i);
  if (titleMatch) return titleMatch[0];

  throw new Error(`Invalid Notion page URL or ID: ${urlOrId}`);
}

/**
 * Fetch a single page with its metadata.
 * Returns page object including last_edited_time.
 */
export async function fetchPageMeta(pageId: string): Promise<{
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
}> {
  const notion = getNotionClient();
  const page = await notion.pages.retrieve({ page_id: pageId }) as PageObjectResponse;

  return {
    id: page.id.replace(/-/g, ''),
    title: extractPageTitle(page),
    url: `https://notion.so/${page.id.replace(/-/g, '')}`,
    lastEditedTime: page.last_edited_time
  };
}

/**
 * Fetch child pages (subpages) of a parent page.
 * Looks for child_page blocks within the page.
 */
export async function fetchChildPages(pageId: string): Promise<Array<{
  id: string;
  title: string;
  url: string;
  lastEditedTime: string;
}>> {
  const notion = getNotionClient();
  const children: Array<{ id: string; title: string; url: string; lastEditedTime: string }> = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      start_cursor: cursor,
      page_size: 100
    });

    for (const block of response.results) {
      if (!isFullBlock(block)) continue;

      // Found a child page block
      if (block.type === 'child_page') {
        const meta = await fetchPageMeta(block.id);
        children.push(meta);
        // Rate limit: 350ms delay
        await new Promise(r => setTimeout(r, 350));
      }
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  console.log(`[Notion] Found ${children.length} child pages for ${pageId}`);
  return children;
}

/**
 * Extract title from a page object.
 */
export function extractPageTitle(page: PageObjectResponse): string {
  const props = page.properties;

  // Try common title property names
  for (const key of ['title', 'Title', 'Name', 'name']) {
    const prop = props[key];
    if (prop && prop.type === 'title' && prop.title.length > 0) {
      return prop.title.map((t: RichTextItemResponse) => t.plain_text).join('');
    }
  }

  // Fallback: check all properties for a title type
  for (const prop of Object.values(props)) {
    if (prop.type === 'title' && prop.title.length > 0) {
      return prop.title.map((t: RichTextItemResponse) => t.plain_text).join('');
    }
  }

  return 'Untitled';
}

/**
 * Fetch all content from a page as plain text.
 * Recursively fetches nested blocks.
 */
export async function fetchPageContent(pageId: string): Promise<string> {
  const notion = getNotionClient();
  const blocks = await fetchAllBlocks(notion, pageId);
  return extractTextFromBlocks(blocks);
}

/**
 * Fetch all blocks from a page/block, including nested children.
 */
async function fetchAllBlocks(
  notion: Client,
  blockId: string
): Promise<BlockObjectResponse[]> {
  const blocks: BlockObjectResponse[] = [];
  let cursor: string | undefined = undefined;

  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100
    });

    for (const block of response.results) {
      // Skip partial blocks (deleted/unavailable)
      if (!isFullBlock(block)) continue;

      blocks.push(block);

      // Recursively fetch children if block has them
      // BUT skip child_page blocks - those are separate pages, not nested content
      if (block.has_children && block.type !== 'child_page') {
        const children = await fetchAllBlocks(notion, block.id);
        blocks.push(...children);
      }
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return blocks;
}

/**
 * Type guard to check if block is a full BlockObjectResponse.
 */
function isFullBlock(
  block: BlockObjectResponse | PartialBlockObjectResponse
): block is BlockObjectResponse {
  return 'type' in block;
}

/**
 * Extract plain text from an array of blocks.
 */
function extractTextFromBlocks(blocks: BlockObjectResponse[]): string {
  const textParts: string[] = [];

  for (const block of blocks) {
    const text = extractTextFromBlock(block);
    if (text) {
      textParts.push(text);
    }
  }

  return textParts.join('\n\n');
}

/**
 * Extract plain text from a single block based on its type.
 */
function extractTextFromBlock(block: BlockObjectResponse): string {
  const type = block.type;

  // Get the block's content object (e.g., block.paragraph, block.heading_1)
  const content = (block as Record<string, unknown>)[type] as Record<string, unknown> | undefined;
  if (!content) return '';

  // Most text-containing blocks have a rich_text array
  if ('rich_text' in content && Array.isArray(content.rich_text)) {
    const richText = content.rich_text as RichTextItemResponse[];
    const text = richText.map(rt => rt.plain_text).join('');

    // Add formatting hints for headings
    if (type === 'heading_1') return `# ${text}`;
    if (type === 'heading_2') return `## ${text}`;
    if (type === 'heading_3') return `### ${text}`;
    if (type === 'bulleted_list_item') return `• ${text}`;
    if (type === 'numbered_list_item') return `- ${text}`;
    if (type === 'to_do') {
      const checked = (content as { checked?: boolean }).checked;
      return `[${checked ? 'x' : ' '}] ${text}`;
    }
    if (type === 'quote') return `> ${text}`;
    if (type === 'callout') return `> ${text}`;
    if (type === 'toggle') return text;

    return text;
  }

  // Code blocks have a special structure
  if (type === 'code' && 'rich_text' in content) {
    const richText = (content as { rich_text: RichTextItemResponse[] }).rich_text;
    return richText.map(rt => rt.plain_text).join('');
  }

  // Table cells
  if (type === 'table_row' && 'cells' in content) {
    const cells = content.cells as RichTextItemResponse[][];
    return cells
      .map(cell => cell.map(rt => rt.plain_text).join(''))
      .join(' | ');
  }

  // Skip non-text blocks (images, embeds, dividers, etc.)
  return '';
}
