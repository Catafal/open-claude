/**
 * IPC Handler Types
 *
 * Type definitions for the handler context and shared state.
 * All handlers receive this context to access shared dependencies.
 */

import type { BrowserWindow } from 'electron';
import type { KnowledgeSettings, NotionSettings } from '../knowledge';
import type { RAGSettings } from '../rag';
import type { MemorySettingsStore, AssistantSettingsStore, SettingsSchema, AutomationSettingsStore } from '../types';
import type { AutomationSettings } from '../automation';
import type { GeminiSettings } from '../gemini';

/**
 * Windows available in the app.
 */
export interface Windows {
  getMain: () => BrowserWindow | null;
  getSpotlight: () => BrowserWindow | null;
  getPromptSelector: () => BrowserWindow | null;
  createSpotlight: () => void;
  createPromptSelector: () => void;
}

/**
 * Settings state - all settings objects in the app.
 */
export interface SettingsState {
  knowledge: KnowledgeSettings;
  notion: NotionSettings;
  rag: RAGSettings;
  memory: MemorySettingsStore;
  assistant: AssistantSettingsStore;
  automation: AutomationSettings;
  gemini: GeminiSettings;
  // App settings
  getAppSettings: () => SettingsSchema;
  saveAppSettings: (settings: Partial<SettingsSchema>) => void;
}

/**
 * Mutable settings state updaters.
 */
export interface SettingsUpdaters {
  updateKnowledge: (settings: Partial<KnowledgeSettings>) => void;
  updateNotion: (settings: Partial<NotionSettings>) => void;
  updateRag: (settings: Partial<RAGSettings>) => void;
  updateMemory: (settings: Partial<MemorySettingsStore>) => void;
  updateAssistant: (settings: Partial<AssistantSettingsStore>) => void;
  updateAutomation: (settings: Partial<AutomationSettings>) => void;
  updateGemini: (settings: Partial<GeminiSettings>) => void;
}

/**
 * Handler context passed to all IPC handler registration functions.
 * This is the "dependency injection" for handlers.
 */
export interface HandlerContext {
  windows: Windows;
  settings: SettingsState;
  updaters: SettingsUpdaters;
}
