/**
 * RAG Agent
 *
 * Agentic RAG system using Ollama for intelligent retrieval decisions.
 * Implements multi-query strategy for better recall.
 */

import { ollamaChat, checkOllamaHealth } from './ollama';
import { generateEmbedding, searchVectors } from '../knowledge';
import type {
  AgentDecision,
  RAGContext,
  RAGResult,
  RAGSettings
} from './types';

// System prompt that guides the agent's decision-making
const AGENT_SYSTEM_PROMPT = `You are a RAG (Retrieval-Augmented Generation) decision agent. Your task is to analyze user queries and decide if knowledge base retrieval would help answer them.

## Your Responsibilities:
1. Determine if the query needs information from the user's knowledge base
2. If retrieval is needed, generate optimized search queries
3. ALWAYS rewrite the query to remove file/document references (cleaned_query)

## When to Retrieve (needs_retrieval: true):
- Questions about specific documents, files, or content the user has added
- Questions referencing "my notes", "my documents", "what I uploaded", "my files", etc.
- Questions that seem to require personal/private information the user may have stored
- Questions about topics the user has previously imported (Notion pages, PDFs, etc.)

## When NOT to Retrieve (needs_retrieval: false):
- General knowledge questions (e.g., "What is Python?", "Explain machine learning")
- Coding help without specific document references
- Casual conversation or greetings ("hello", "how are you")
- Creative writing requests
- Questions about Claude's capabilities or features
- Mathematical calculations
- Translation requests

## Query Strategies:
1. "direct" - Use when the original query is specific enough (1 query)
2. "multi_perspective" - Generate queries from different angles/synonyms (2-3 queries)
3. "decomposed" - Break complex queries into sub-questions (2-3 queries)

## Cleaned Query (IMPORTANT):
The cleaned_query removes ALL references to personal files/documents so the AI doesn't try to search again.
Examples:
- "what is MLP according to my files?" → "what is MLP?"
- "summarize my notes about React" → "summarize React"
- "what did I write about authentication?" → "explain authentication"
- "hello" → "hello" (no change needed)

## Output Requirements:
- Always return valid JSON matching the schema
- Generate 1-3 search queries when needs_retrieval is true
- Make queries semantic-search friendly (natural language, not keywords)
- Keep reasoning brief (1 sentence)
- ALWAYS provide cleaned_query (same as original if no file references)`;

/**
 * Run the RAG agent to decide on retrieval.
 * Calls Ollama with structured output to get a decision.
 */
export async function runRagAgent(
  userQuery: string,
  settings: RAGSettings
): Promise<AgentDecision> {
  const messages = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Analyze this user query and decide if knowledge base retrieval is needed.

User Query: "${userQuery}"

Return your decision as JSON with: needs_retrieval, reasoning, search_queries, query_strategy, cleaned_query`
    }
  ];

  return ollamaChat(settings.model, messages, userQuery);
}

/**
 * Execute multi-query search and deduplicate results.
 * Searches Qdrant with each query in parallel, then merges and ranks.
 */
export async function executeMultiQuerySearch(
  queries: string[],
  collectionName: string,
  settings: RAGSettings
): Promise<RAGContext[]> {
  // Map to deduplicate by content ID, keeping highest score
  const allResults = new Map<string, RAGContext>();

  // Limit queries to maxQueries setting
  const limitedQueries = queries.slice(0, settings.maxQueries);

  // Execute searches in parallel for speed
  const searchPromises = limitedQueries.map(async (query) => {
    try {
      console.log(`[RAG] Searching: "${query}"`);
      const queryVector = await generateEmbedding(query);
      const results = await searchVectors(
        collectionName,
        queryVector,
        settings.maxContextChunks  // Get enough results per query
      );
      return results;
    } catch (error) {
      console.error(`[RAG] Search failed for query: "${query}"`, error);
      return [];
    }
  });

  const searchResults = await Promise.all(searchPromises);

  // Merge and deduplicate results
  for (const results of searchResults) {
    for (const result of results) {
      const existing = allResults.get(result.id);

      // Only include if score meets threshold
      if (result.score >= settings.minRelevanceScore) {
        // Keep highest score if duplicate
        if (!existing || result.score > existing.score) {
          allResults.set(result.id, {
            content: result.content,
            source: result.metadata?.source || 'Unknown',
            score: result.score
          });
        }
      }
    }
  }

  // Sort by score (highest first) and limit to maxContextChunks
  const sortedResults = Array.from(allResults.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, settings.maxContextChunks);

  console.log(`[RAG] Retrieved ${sortedResults.length} unique chunks (from ${limitedQueries.length} queries)`);
  return sortedResults;
}

/**
 * Format RAG context for injection into Claude prompt.
 * Uses XML-like wrapper for clear delineation.
 */
export function formatContextForClaude(contexts: RAGContext[]): string {
  if (contexts.length === 0) return '';

  const contextBlocks = contexts.map((ctx, i) => {
    const sourceDisplay = ctx.source.length > 50
      ? '...' + ctx.source.slice(-47)
      : ctx.source;
    return `[Source ${i + 1}: ${sourceDisplay}]\n${ctx.content}`;
  }).join('\n\n---\n\n');

  return `<knowledge_context>
The following information was retrieved from the user's knowledge base and may be relevant to their question:

${contextBlocks}
</knowledge_context>

`;
}

/**
 * Main RAG processing pipeline.
 * Orchestrates the full flow: agent decision -> search -> format.
 *
 * @param userQuery - The user's message
 * @param collectionName - Qdrant collection to search
 * @param settings - RAG configuration
 * @returns RAGResult with decision, contexts, and timing
 */
export async function processRagQuery(
  userQuery: string,
  collectionName: string,
  settings: RAGSettings
): Promise<RAGResult> {
  const startTime = Date.now();

  try {
    // Step 1: Check if Ollama is available
    const health = await checkOllamaHealth(settings.model);
    if (!health.available) {
      console.log(`[RAG] Ollama not available: ${health.error}`);
      return {
        decision: {
          needs_retrieval: false,
          reasoning: 'Ollama not available',
          search_queries: [],
          query_strategy: 'direct',
          cleaned_query: userQuery  // Pass through original query
        },
        contexts: [],
        processingTimeMs: Date.now() - startTime,
        error: health.error
      };
    }

    // Step 2: Run the agent to decide on retrieval
    console.log('[RAG] Running agent decision...');
    const decision = await runRagAgent(userQuery, settings);
    console.log(`[RAG] Decision: needs_retrieval=${decision.needs_retrieval}, strategy=${decision.query_strategy}`);
    console.log(`[RAG] Reasoning: ${decision.reasoning}`);

    // Step 3: Execute retrieval if needed
    let contexts: RAGContext[] = [];
    if (decision.needs_retrieval && decision.search_queries.length > 0) {
      console.log(`[RAG] Executing search with ${decision.search_queries.length} queries...`);
      contexts = await executeMultiQuerySearch(
        decision.search_queries,
        collectionName,
        settings
      );
    }

    return {
      decision,
      contexts,
      processingTimeMs: Date.now() - startTime
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[RAG] Processing error:', errorMessage);

    // Return safe fallback - always allow message to proceed
    return {
      decision: {
        needs_retrieval: false,
        reasoning: 'Processing error occurred',
        search_queries: [],
        query_strategy: 'direct',
        cleaned_query: userQuery  // Pass through original query
      },
      contexts: [],
      processingTimeMs: Date.now() - startTime,
      error: errorMessage
    };
  }
}
