/**
 * Types for Prompt Base System
 *
 * Defines interfaces for prompts, categories, and variables.
 */

// Prompt categories for organization
export type PromptCategory = 'coding' | 'writing' | 'analysis' | 'research' | 'creative' | 'system';

// Variable placeholder in prompt templates (e.g., {{language}})
export interface PromptVariable {
  name: string;
  defaultValue?: string;
  description?: string;
}

// Prompt as stored in Supabase
export interface StoredPrompt {
  id: string;
  user_id: string;
  name: string;
  category: PromptCategory;
  content: string;
  variables: PromptVariable[];
  is_favorite: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// Prompt for creation (without auto-generated fields)
export interface CreatePromptInput {
  name: string;
  category: PromptCategory;
  content: string;
  variables?: PromptVariable[];
  is_favorite?: boolean;
}

// Prompt for updates (all fields optional)
export interface UpdatePromptInput {
  name?: string;
  category?: PromptCategory;
  content?: string;
  variables?: PromptVariable[];
  is_favorite?: boolean;
}

// Analysis result from prompt improver
export interface PromptAnalysis {
  clarity_score: number;      // 0-100
  specificity_score: number;  // 0-100
  structure_score: number;    // 0-100
  issues: string[];           // Identified problems
  suggestions: string[];      // Improvement recommendations
  improved_version: string;   // The enhanced prompt
}

// Category metadata for UI display
export const CATEGORY_INFO: Record<PromptCategory, { label: string; icon: string }> = {
  coding: { label: 'Coding', icon: '💻' },
  writing: { label: 'Writing', icon: '✍️' },
  analysis: { label: 'Analysis', icon: '📊' },
  research: { label: 'Research', icon: '🔍' },
  creative: { label: 'Creative', icon: '🎨' },
  system: { label: 'System', icon: '⚙️' },
};

// All available categories
export const ALL_CATEGORIES: PromptCategory[] = [
  'coding', 'writing', 'analysis', 'research', 'creative', 'system'
];
