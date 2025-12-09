/**
 * Knowledge Panel Renderer
 *
 * UI logic for the knowledge management window.
 * Handles Qdrant connection, file/URL ingestion, and item management.
 */

const claude = (window as any).claude;

// Type definitions for knowledge items
interface KnowledgeMetadata {
  source: string;
  filename: string;
  type: 'txt' | 'md' | 'pdf' | 'url';
  chunkIndex: number;
  totalChunks: number;
  dateAdded: string;
}

interface KnowledgeItem {
  id: string;
  content: string;
  metadata: KnowledgeMetadata;
}

interface SearchResult extends KnowledgeItem {
  score: number;
}

// DOM Elements
const qdrantUrl = document.getElementById('qdrant-url') as HTMLInputElement;
const qdrantKey = document.getElementById('qdrant-key') as HTMLInputElement;
const testBtn = document.getElementById('test-connection') as HTMLButtonElement;
const connectionStatus = document.getElementById('connection-status') as HTMLElement;
const addFileBtn = document.getElementById('add-file') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const urlInput = document.getElementById('url-input') as HTMLInputElement;
const addUrlBtn = document.getElementById('add-url') as HTMLButtonElement;
const dropZone = document.getElementById('drop-zone') as HTMLElement;
const ingestStatus = document.getElementById('ingest-status') as HTMLElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const itemsList = document.getElementById('items-list') as HTMLElement;

// State
let isSearchMode = false;
let searchTimeout: number;

// Load settings from store
async function loadSettings() {
  const settings = await claude.knowledgeGetSettings();
  qdrantUrl.value = settings.qdrantUrl || 'http://localhost:6333';
  qdrantKey.value = settings.qdrantApiKey || '';
}

// Save settings to store
async function saveSettings() {
  await claude.knowledgeSaveSettings({
    qdrantUrl: qdrantUrl.value.trim(),
    qdrantApiKey: qdrantKey.value.trim() || undefined
  });
}

// Test Qdrant connection
async function testConnection() {
  testBtn.disabled = true;
  connectionStatus.textContent = 'Testing...';
  connectionStatus.className = 'status-text';

  await saveSettings();

  const result = await claude.knowledgeTestConnection();

  if (result.success) {
    connectionStatus.textContent = 'Connected!';
    connectionStatus.className = 'status-text success';
  } else {
    connectionStatus.textContent = `Error: ${result.error}`;
    connectionStatus.className = 'status-text error';
  }

  testBtn.disabled = false;
}

// Show ingest status
function showIngestStatus(message: string, type: 'loading' | 'success' | 'error') {
  ingestStatus.textContent = message;
  ingestStatus.className = `ingest-status ${type}`;
}

// Clear ingest status after delay
function clearIngestStatus(delay = 3000) {
  setTimeout(() => {
    ingestStatus.textContent = '';
    ingestStatus.className = 'ingest-status';
  }, delay);
}

// Ingest a file
async function ingestFile(filePath: string) {
  showIngestStatus(`Ingesting file...`, 'loading');

  const result = await claude.knowledgeIngestFile(filePath);

  if (result.success) {
    showIngestStatus(`Added ${result.chunksIngested} chunks`, 'success');
    clearIngestStatus();
    await loadItems();
  } else {
    showIngestStatus(`Error: ${result.error}`, 'error');
  }
}

// Ingest a URL
async function ingestUrl(url: string) {
  showIngestStatus(`Fetching URL...`, 'loading');

  const result = await claude.knowledgeIngestUrl(url);

  if (result.success) {
    showIngestStatus(`Added ${result.chunksIngested} chunks`, 'success');
    clearIngestStatus();
    await loadItems();
  } else {
    showIngestStatus(`Error: ${result.error}`, 'error');
  }
}

// Load and display all items (grouped by source)
async function loadItems() {
  const items: KnowledgeItem[] = await claude.knowledgeList();
  renderItems(items, false);
}

// Search items
async function searchItems(query: string) {
  if (!query.trim()) {
    isSearchMode = false;
    await loadItems();
    return;
  }

  isSearchMode = true;
  const results: SearchResult[] = await claude.knowledgeSearch(query, 20);
  renderItems(results, true);
}

// Render items list
function renderItems(items: (KnowledgeItem | SearchResult)[], showScores: boolean) {
  if (items.length === 0) {
    itemsList.innerHTML = `<div class="empty-state">${
      isSearchMode ? 'No results found' : 'No items yet. Add files or URLs above.'
    }</div>`;
    return;
  }

  // Group items by source
  const bySource = new Map<string, (KnowledgeItem | SearchResult)[]>();

  for (const item of items) {
    const source = item.metadata?.source || 'Unknown';
    if (!bySource.has(source)) {
      bySource.set(source, []);
    }
    bySource.get(source)!.push(item);
  }

  // Render grouped items
  itemsList.innerHTML = Array.from(bySource.entries())
    .map(([source, chunks]) => {
      const first = chunks[0];
      const avgScore = showScores
        ? (chunks.reduce((sum, c) => sum + ((c as SearchResult).score || 0), 0) / chunks.length)
        : 0;

      return `
        <div class="item-group" data-source="${escapeHtml(source)}">
          <div class="item-info">
            <div class="item-name">${escapeHtml(first.metadata?.filename || source)}</div>
            <div class="item-meta">
              <span class="item-type">${first.metadata?.type || 'file'}</span>
              <span class="item-chunks">${chunks.length} chunk${chunks.length !== 1 ? 's' : ''}</span>
              ${showScores ? `<span class="item-score">${(avgScore * 100).toFixed(1)}% match</span>` : ''}
            </div>
          </div>
          <button class="btn btn-danger delete-btn" data-source="${escapeHtml(source)}">Delete</button>
        </div>
      `;
    })
    .join('');

  // Attach delete handlers
  itemsList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const source = (e.target as HTMLElement).dataset.source;
      if (!source) return;

      // Find all IDs for this source
      const idsToDelete = items
        .filter(item => item.metadata?.source === source)
        .map(item => item.id);

      if (idsToDelete.length > 0) {
        await claude.knowledgeDelete(idsToDelete);
        await loadItems();
      }
    });
  });
}

// Escape HTML for safe rendering
function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Event Listeners

// Test connection button
testBtn.addEventListener('click', testConnection);

// Add file button
addFileBtn.addEventListener('click', () => {
  fileInput.click();
});

// File input change
fileInput.addEventListener('change', async () => {
  const files = fileInput.files;
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    // Get file path from Electron file object
    const filePath = (file as any).path;
    if (filePath) {
      await ingestFile(filePath);
    }
  }

  fileInput.value = '';  // Reset input
});

// Add URL button
addUrlBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) return;

  // Basic URL validation
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    showIngestStatus('Invalid URL - must start with http:// or https://', 'error');
    return;
  }

  await ingestUrl(url);
  urlInput.value = '';
});

// URL input enter key
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addUrlBtn.click();
  }
});

// Drag and drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');

  const files = e.dataTransfer?.files;
  if (!files || files.length === 0) return;

  for (const file of Array.from(files)) {
    const filePath = (file as any).path;
    if (filePath) {
      await ingestFile(filePath);
    }
  }
});

// Click on drop zone also triggers file picker
dropZone.addEventListener('click', () => {
  fileInput.click();
});

// Search input with debounce
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = window.setTimeout(async () => {
    await searchItems(searchInput.value);
  }, 300);
});

// Initialize on load
window.addEventListener('load', async () => {
  await loadSettings();
  await loadItems();
});
