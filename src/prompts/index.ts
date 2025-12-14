/**
 * Prompts Module - Re-exports
 *
 * Central export point for all prompt-related functionality.
 */

// Types
export type {
  PromptCategory,
  PromptVariable,
  StoredPrompt,
  CreatePromptInput,
  UpdatePromptInput,
  PromptAnalysis,
} from './types';

export { CATEGORY_INFO, ALL_CATEGORIES } from './types';

// Supabase operations
export {
  initPromptsSupabaseClient,
  testPromptsConnection,
  getPrompts,
  getPromptsByCategory,
  createPrompt,
  updatePrompt,
  deletePrompt,
  toggleFavorite,
  incrementUsageCount,
  fillPromptVariables,
} from './supabase';

// Improver
export {
  initImprover,
  analyzePrompt,
  quickScore,
} from './improver';
