/**
 * Prompt Selector UI Logic
 *
 * Handles the floating prompt selector window:
 * - Search/filter prompts
 * - Category tabs
 * - Select prompt to insert into main chat
 * - Variable filling modal
 */

// Type definitions (mirrors backend types)
interface PromptVariable {
  name: string;
  defaultValue?: string;
  description?: string;
}

interface StoredPrompt {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: PromptVariable[];
  is_favorite: boolean;
  usage_count: number;
}

// Declare the claude API exposed by preload
declare const claude: {
  getPrompts: () => Promise<StoredPrompt[]>;
  selectPrompt: (promptContent: string) => Promise<void>;
  incrementPromptUsage: (id: string) => Promise<void>;
  closePromptSelector: () => void;
  // Improve mode functions
  improvePromptWithClaude: (content: string) => Promise<{ improved: string }>;
  onImproveStream: (callback: (data: { text: string }) => void) => void;
  onImproveComplete: (callback: (data: { improved: string }) => void) => void;
  onImproveError: (callback: (data: { error: string }) => void) => void;
  removeImproveListeners: () => void;
};

// DOM elements - Search mode
let searchInput: HTMLInputElement;
let promptsList: HTMLDivElement;
let emptyState: HTMLDivElement;
let categoryTabs: HTMLDivElement;
let variableModal: HTMLDivElement;
let variableInputs: HTMLDivElement;
let variableSubmitBtn: HTMLButtonElement;
let variableCloseBtn: HTMLButtonElement;
let closeBtn: HTMLButtonElement;

// DOM elements - Mode toggle
let modeTabs: HTMLDivElement;
let searchModeDiv: HTMLDivElement;
let improveModeDiv: HTMLDivElement;

// DOM elements - Improve mode
let improveInput: HTMLTextAreaElement;
let improveBtn: HTMLButtonElement;
let improveBtnText: HTMLSpanElement;
let improveBtnLoading: HTMLSpanElement;
let improveResultSection: HTMLDivElement;
let improveResultText: HTMLDivElement;
let improveUseBtn: HTMLButtonElement;
let improveCopyBtn: HTMLButtonElement;

// State
let allPrompts: StoredPrompt[] = [];
let filteredPrompts: StoredPrompt[] = [];
let selectedIndex = 0;
let activeCategory = 'all';
let selectedPrompt: StoredPrompt | null = null;

// Mode state: 'search' or 'improve'
let activeMode: 'search' | 'improve' = 'search';
let improvedPromptContent = ''; // Stores the improved prompt result
let isImproving = false; // Prevents double-clicks during improvement

/**
 * Initialize the prompt selector UI.
 */
async function init() {
  // Get DOM elements - Search mode
  searchInput = document.getElementById('search-input') as HTMLInputElement;
  promptsList = document.getElementById('prompts-list') as HTMLDivElement;
  emptyState = document.getElementById('empty-state') as HTMLDivElement;
  categoryTabs = document.getElementById('category-tabs') as HTMLDivElement;
  variableModal = document.getElementById('variable-modal') as HTMLDivElement;
  variableInputs = document.getElementById('variable-inputs') as HTMLDivElement;
  variableSubmitBtn = document.getElementById('variable-submit-btn') as HTMLButtonElement;
  variableCloseBtn = document.getElementById('variable-close-btn') as HTMLButtonElement;
  closeBtn = document.getElementById('close-btn') as HTMLButtonElement;

  // Get DOM elements - Mode toggle
  modeTabs = document.getElementById('mode-tabs') as HTMLDivElement;
  searchModeDiv = document.getElementById('search-mode') as HTMLDivElement;
  improveModeDiv = document.getElementById('improve-mode') as HTMLDivElement;

  // Get DOM elements - Improve mode
  improveInput = document.getElementById('improve-input') as HTMLTextAreaElement;
  improveBtn = document.getElementById('improve-btn') as HTMLButtonElement;
  improveBtnText = improveBtn.querySelector('.improve-btn-text') as HTMLSpanElement;
  improveBtnLoading = improveBtn.querySelector('.improve-btn-loading') as HTMLSpanElement;
  improveResultSection = document.getElementById('improve-result-section') as HTMLDivElement;
  improveResultText = document.getElementById('improve-result-text') as HTMLDivElement;
  improveUseBtn = document.getElementById('improve-use-btn') as HTMLButtonElement;
  improveCopyBtn = document.getElementById('improve-copy-btn') as HTMLButtonElement;

  // Load prompts
  await loadPrompts();

  // Setup event listeners
  setupEventListeners();

  // Setup improve mode listeners
  setupImproveListeners();

  // Focus search input
  searchInput.focus();
}

/**
 * Load prompts from backend.
 */
async function loadPrompts() {
  try {
    allPrompts = await claude.getPrompts();
    filterPrompts();
  } catch (err) {
    console.error('[PromptSelector] Failed to load prompts:', err);
    allPrompts = [];
    filterPrompts();
  }
}

/**
 * Filter prompts based on search query and category.
 */
function filterPrompts() {
  const query = searchInput.value.toLowerCase().trim();

  filteredPrompts = allPrompts.filter(prompt => {
    // Category filter
    if (activeCategory !== 'all' && prompt.category !== activeCategory) {
      return false;
    }

    // Search filter (fuzzy match on name and content)
    if (query) {
      const nameMatch = prompt.name.toLowerCase().includes(query);
      const contentMatch = prompt.content.toLowerCase().includes(query);
      return nameMatch || contentMatch;
    }

    return true;
  });

  // Sort: favorites first, then by usage count
  filteredPrompts.sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return b.usage_count - a.usage_count;
  });

  // Reset selection
  selectedIndex = 0;

  // Render
  renderPrompts();
}

/**
 * Render the prompts list.
 */
function renderPrompts() {
  // Clear existing items (except empty state)
  const existingItems = promptsList.querySelectorAll('.prompt-item');
  existingItems.forEach(item => item.remove());

  // Show/hide empty state
  if (filteredPrompts.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }

  emptyState.style.display = 'none';

  // Render each prompt
  filteredPrompts.forEach((prompt, index) => {
    const item = createPromptItem(prompt, index);
    promptsList.appendChild(item);
  });

  // Highlight selected
  updateSelection();
}

/**
 * Create a prompt item element.
 */
function createPromptItem(prompt: StoredPrompt, index: number): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'prompt-item';
  item.dataset.index = String(index);

  // Preview text (first 50 chars of content)
  const preview = prompt.content.substring(0, 60).replace(/\n/g, ' ') + (prompt.content.length > 60 ? '...' : '');

  item.innerHTML = `
    <span class="prompt-favorite ${prompt.is_favorite ? 'active' : ''}">${prompt.is_favorite ? '★' : '☆'}</span>
    <div class="prompt-info">
      <div class="prompt-name">${escapeHtml(prompt.name)}</div>
      <div class="prompt-preview">${escapeHtml(preview)}</div>
    </div>
    <span class="prompt-category-badge">${prompt.category}</span>
  `;

  // Click handler
  item.addEventListener('click', () => {
    selectedIndex = index;
    updateSelection();
    selectCurrentPrompt();
  });

  // Hover handler
  item.addEventListener('mouseenter', () => {
    selectedIndex = index;
    updateSelection();
  });

  return item;
}

/**
 * Update visual selection state.
 */
function updateSelection() {
  const items = promptsList.querySelectorAll('.prompt-item');
  items.forEach((item, index) => {
    if (index === selectedIndex) {
      item.classList.add('selected');
      // Scroll into view if needed
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else {
      item.classList.remove('selected');
    }
  });
}

/**
 * Select the current prompt (insert into chat).
 */
async function selectCurrentPrompt() {
  if (filteredPrompts.length === 0) return;

  const prompt = filteredPrompts[selectedIndex];
  if (!prompt) return;

  // Check if prompt has variables
  if (prompt.variables && prompt.variables.length > 0) {
    selectedPrompt = prompt;
    showVariableModal(prompt);
  } else {
    // No variables, insert directly
    await insertPrompt(prompt.content, prompt.id);
  }
}

/**
 * Show the variable filling modal.
 */
function showVariableModal(prompt: StoredPrompt) {
  variableInputs.innerHTML = '';

  prompt.variables.forEach(variable => {
    const group = document.createElement('div');
    group.className = 'variable-input-group';
    group.innerHTML = `
      <label for="var-${variable.name}">${variable.name}</label>
      <input
        type="text"
        id="var-${variable.name}"
        data-var="${variable.name}"
        placeholder="${variable.description || variable.name}"
        value="${variable.defaultValue || ''}"
      />
    `;
    variableInputs.appendChild(group);
  });

  variableModal.style.display = 'block';

  // Focus first input
  const firstInput = variableInputs.querySelector('input');
  if (firstInput) {
    (firstInput as HTMLInputElement).focus();
  }
}

/**
 * Hide the variable modal.
 */
function hideVariableModal() {
  variableModal.style.display = 'none';
  selectedPrompt = null;
  searchInput.focus();
}

/**
 * Submit variables and insert prompt.
 */
async function submitVariables() {
  if (!selectedPrompt) return;

  // Collect variable values
  const values: Record<string, string> = {};
  const inputs = variableInputs.querySelectorAll('input');
  inputs.forEach(input => {
    const varName = (input as HTMLInputElement).dataset.var;
    if (varName) {
      values[varName] = (input as HTMLInputElement).value;
    }
  });

  // Fill variables in content
  let content = selectedPrompt.content;
  for (const [key, value] of Object.entries(values)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  await insertPrompt(content, selectedPrompt.id);
  hideVariableModal();
}

/**
 * Insert prompt into main chat and close selector.
 */
async function insertPrompt(content: string, promptId: string) {
  try {
    // Copy to clipboard
    await navigator.clipboard.writeText(content);

    // Increment usage count (fire and forget)
    claude.incrementPromptUsage(promptId).catch(() => {});

    // Send to main chat
    await claude.selectPrompt(content);

    // Close window
    claude.closePromptSelector();
  } catch (err) {
    console.error('[PromptSelector] Failed to insert prompt:', err);
  }
}

/**
 * Setup event listeners.
 */
function setupEventListeners() {
  // Search input
  searchInput.addEventListener('input', () => {
    filterPrompts();
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', handleKeyDown);

  // Mode tabs (Search / Improve toggle)
  modeTabs.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('mode-tab')) {
      const mode = target.dataset.mode as 'search' | 'improve';
      if (mode && mode !== activeMode) {
        switchMode(mode);
      }
    }
  });

  // Category tabs
  categoryTabs.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('category-tab')) {
      // Update active tab
      categoryTabs.querySelectorAll('.category-tab').forEach(tab => {
        tab.classList.remove('active');
      });
      target.classList.add('active');

      // Filter by category
      activeCategory = target.dataset.category || 'all';
      filterPrompts();
    }
  });

  // Close button
  closeBtn.addEventListener('click', () => {
    claude.closePromptSelector();
  });

  // Variable modal close
  variableCloseBtn.addEventListener('click', hideVariableModal);

  // Variable modal submit
  variableSubmitBtn.addEventListener('click', submitVariables);

  // Enter in variable inputs
  variableInputs.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitVariables();
    }
    if (e.key === 'Escape') {
      hideVariableModal();
    }
  });

  // Global escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (variableModal.style.display !== 'none') {
        hideVariableModal();
      } else {
        claude.closePromptSelector();
      }
    }
  });
}

/**
 * Handle keyboard navigation in search input.
 */
function handleKeyDown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      if (selectedIndex < filteredPrompts.length - 1) {
        selectedIndex++;
        updateSelection();
      }
      break;

    case 'ArrowUp':
      e.preventDefault();
      if (selectedIndex > 0) {
        selectedIndex--;
        updateSelection();
      }
      break;

    case 'Enter':
      e.preventDefault();
      selectCurrentPrompt();
      break;

    case 'Tab':
      // Cycle through categories
      e.preventDefault();
      cycleCategory(e.shiftKey ? -1 : 1);
      break;
  }
}

/**
 * Cycle through category tabs.
 */
function cycleCategory(direction: number) {
  const tabs = Array.from(categoryTabs.querySelectorAll('.category-tab'));
  const currentIndex = tabs.findIndex(tab => tab.classList.contains('active'));
  let newIndex = currentIndex + direction;

  if (newIndex < 0) newIndex = tabs.length - 1;
  if (newIndex >= tabs.length) newIndex = 0;

  const newTab = tabs[newIndex] as HTMLElement;
  newTab.click();
}

/**
 * Escape HTML to prevent XSS.
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// IMPROVE MODE FUNCTIONS
// ============================================

/**
 * Switch between search and improve modes.
 */
function switchMode(mode: 'search' | 'improve') {
  activeMode = mode;

  // Update tab active states
  modeTabs.querySelectorAll('.mode-tab').forEach(tab => {
    const tabMode = (tab as HTMLElement).dataset.mode;
    if (tabMode === mode) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Show/hide mode views
  if (mode === 'search') {
    searchModeDiv.style.display = 'block';
    improveModeDiv.style.display = 'none';
    searchInput.focus();
  } else {
    searchModeDiv.style.display = 'none';
    improveModeDiv.style.display = 'block';
    improveInput.focus();
  }
}

/**
 * Setup improve mode event listeners.
 */
function setupImproveListeners() {
  // Improve button click
  improveBtn.addEventListener('click', () => {
    if (!isImproving) {
      improvePrompt();
    }
  });

  // Ctrl+Enter to improve
  improveInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isImproving) {
        improvePrompt();
      }
    }
  });

  // Use This button
  improveUseBtn.addEventListener('click', useImprovedPrompt);

  // Copy button
  improveCopyBtn.addEventListener('click', copyImprovedPrompt);

  // Setup streaming listeners from backend
  claude.onImproveStream((data) => {
    // data.text is already the full accumulated text from main process
    improvedPromptContent = data.text;
    improveResultText.textContent = improvedPromptContent;
    improveResultSection.style.display = 'block';
  });

  claude.onImproveComplete((data) => {
    // Final result received
    improvedPromptContent = data.improved;
    improveResultText.textContent = improvedPromptContent;
    improveResultSection.style.display = 'block';
    setImproveLoading(false);
  });

  claude.onImproveError((data) => {
    console.error('[PromptSelector] Improve error:', data.error);
    improveResultText.textContent = `Error: ${data.error}`;
    improveResultSection.style.display = 'block';
    setImproveLoading(false);
  });
}

/**
 * Start the prompt improvement process.
 */
async function improvePrompt() {
  const content = improveInput.value.trim();
  if (!content) {
    return; // Nothing to improve
  }

  // Reset result area
  improvedPromptContent = '';
  improveResultText.textContent = '';
  improveResultSection.style.display = 'none';

  // Show loading state
  setImproveLoading(true);

  try {
    // Call the backend to improve the prompt
    // Result will come via streaming events
    await claude.improvePromptWithClaude(content);
  } catch (err) {
    console.error('[PromptSelector] Failed to improve prompt:', err);
    improveResultText.textContent = `Error: ${(err as Error).message || 'Unknown error'}`;
    improveResultSection.style.display = 'block';
    setImproveLoading(false);
  }
}

/**
 * Set the loading state of the improve button.
 */
function setImproveLoading(loading: boolean) {
  isImproving = loading;
  improveBtn.disabled = loading;
  improveBtnText.style.display = loading ? 'none' : 'inline';
  improveBtnLoading.style.display = loading ? 'inline' : 'none';
}

/**
 * Use the improved prompt (insert into chat and close).
 */
async function useImprovedPrompt() {
  if (!improvedPromptContent) return;

  try {
    await claude.selectPrompt(improvedPromptContent);
    claude.closePromptSelector();
  } catch (err) {
    console.error('[PromptSelector] Failed to use improved prompt:', err);
  }
}

/**
 * Copy the improved prompt to clipboard.
 */
async function copyImprovedPrompt() {
  if (!improvedPromptContent) return;

  try {
    await navigator.clipboard.writeText(improvedPromptContent);
    // Brief visual feedback
    const originalText = improveCopyBtn.textContent;
    improveCopyBtn.textContent = 'Copied!';
    setTimeout(() => {
      improveCopyBtn.textContent = originalText;
    }, 1500);
  } catch (err) {
    console.error('[PromptSelector] Failed to copy:', err);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
