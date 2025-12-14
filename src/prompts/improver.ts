/**
 * Prompt Improver Agent
 *
 * Uses Ollama to analyze and improve prompts based on best practices.
 * Evaluates clarity, specificity, and structure.
 */

import type { PromptAnalysis } from './types';

// System prompt for the improver agent
const IMPROVER_SYSTEM_PROMPT = `You are an expert prompt engineer. Analyze the given prompt and provide improvements.

Evaluate these dimensions (score 0-100):
1. CLARITY - Is it unambiguous? Easy to understand?
2. SPECIFICITY - Does it have clear constraints and requirements?
3. STRUCTURE - Is it well-organized with logical sections?

Provide your analysis as JSON with this exact structure:
{
  "clarity_score": <0-100>,
  "specificity_score": <0-100>,
  "structure_score": <0-100>,
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "improved_version": "the improved prompt text"
}

Best practices for improvements:
- Add role/persona if missing ("You are a...")
- Add output format specifications
- Add constraints and boundaries
- Use clear section headers if complex
- Remove vague words ("maybe", "try to", etc.)
- Be concise - remove unnecessary words
- Add examples if the task is complex`;

// JSON schema for structured output
const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    clarity_score: { type: 'number' },
    specificity_score: { type: 'number' },
    structure_score: { type: 'number' },
    issues: { type: 'array', items: { type: 'string' } },
    suggestions: { type: 'array', items: { type: 'string' } },
    improved_version: { type: 'string' }
  },
  required: ['clarity_score', 'specificity_score', 'structure_score', 'issues', 'suggestions', 'improved_version']
};

// Ollama URL (will be set from settings)
let ollamaUrl = 'http://localhost:11434';
let ollamaModel = 'llama3.2:3b';

/**
 * Initialize the improver with Ollama settings.
 */
export function initImprover(url: string, model: string): void {
  ollamaUrl = url.replace(/\/$/, '');
  ollamaModel = model;
  console.log(`[Improver] Initialized with ${ollamaUrl}, model: ${ollamaModel}`);
}

/**
 * Analyze and improve a prompt using Ollama.
 */
export async function analyzePrompt(promptContent: string): Promise<PromptAnalysis> {
  const messages = [
    { role: 'system', content: IMPROVER_SYSTEM_PROMPT },
    { role: 'user', content: `Analyze and improve this prompt:\n\n${promptContent}` }
  ];

  const request = {
    model: ollamaModel,
    messages,
    stream: false,
    format: ANALYSIS_SCHEMA,
    options: {
      temperature: 0.3,  // Slightly creative for improvements
      num_predict: 1024  // Longer output for improved version
    }
  };

  // 60s timeout for analysis (might be slow on weak hardware)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const analysis = JSON.parse(data.message.content) as PromptAnalysis;

    // Validate and clamp scores
    analysis.clarity_score = Math.min(100, Math.max(0, analysis.clarity_score || 0));
    analysis.specificity_score = Math.min(100, Math.max(0, analysis.specificity_score || 0));
    analysis.structure_score = Math.min(100, Math.max(0, analysis.structure_score || 0));
    analysis.issues = analysis.issues || [];
    analysis.suggestions = analysis.suggestions || [];
    analysis.improved_version = analysis.improved_version || promptContent;

    return analysis;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Improver] Request timeout (60s)');
      return createFallbackAnalysis(promptContent, 'Analysis timeout - try a smaller prompt');
    }

    // Handle connection errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Improver] Error:', errorMessage);
    return createFallbackAnalysis(promptContent, errorMessage);
  }
}

/**
 * Quick score calculation without full analysis (for UI display).
 */
export function quickScore(promptContent: string): number {
  let score = 50;  // Base score

  // Bonus for length (not too short, not too long)
  const words = promptContent.split(/\s+/).length;
  if (words >= 20 && words <= 200) score += 10;
  if (words < 10) score -= 20;

  // Bonus for structure indicators
  if (promptContent.includes('You are') || promptContent.includes('Act as')) score += 10;
  if (promptContent.includes(':') || promptContent.includes('-')) score += 5;
  if (/\d\./.test(promptContent)) score += 5;  // Numbered lists

  // Penalty for vague words
  const vagueWords = ['maybe', 'try to', 'could', 'might', 'perhaps', 'somehow'];
  for (const word of vagueWords) {
    if (promptContent.toLowerCase().includes(word)) score -= 5;
  }

  // Bonus for clear output format
  if (promptContent.toLowerCase().includes('format') || promptContent.toLowerCase().includes('output')) score += 10;

  return Math.min(100, Math.max(0, score));
}

/**
 * Create a fallback analysis when Ollama fails.
 */
function createFallbackAnalysis(promptContent: string, errorMessage: string): PromptAnalysis {
  const score = quickScore(promptContent);
  return {
    clarity_score: score,
    specificity_score: score,
    structure_score: score,
    issues: [`Analysis unavailable: ${errorMessage}`],
    suggestions: ['Ensure Ollama is running with: ollama serve'],
    improved_version: promptContent
  };
}
