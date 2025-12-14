/**
 * Memory Maintenance
 *
 * Handles periodic maintenance tasks:
 * - Decay: Lower importance of unused memories over time
 * - Pruning: Delete low-importance stale memories
 * - Cleanup: Remove expired temporal memories
 */

import { decayImportance, pruneMemories, cleanupExpiredMemories } from './supabase';

// Maintenance result
export interface MaintenanceResult {
  decayed: number;
  pruned: number;
  expiredCleaned: number;
}

/**
 * Run all maintenance tasks.
 * Called periodically (daily) from main.ts.
 *
 * @param decayFactor - Multiplier for importance decay (default 0.95)
 * @param minImportance - Delete memories below this importance (default 0.1)
 * @param staleDays - Consider stale if not accessed in this many days (default 90)
 */
export async function runMaintenance(
  decayFactor: number = 0.95,
  minImportance: number = 0.1,
  staleDays: number = 90
): Promise<MaintenanceResult> {
  console.log('[Memory Maintenance] Starting maintenance...');

  const result: MaintenanceResult = {
    decayed: 0,
    pruned: 0,
    expiredCleaned: 0
  };

  try {
    // 1. Cleanup expired temporal memories first
    result.expiredCleaned = await cleanupExpiredMemories();

    // 2. Decay importance of unused memories (not accessed in 7 days)
    result.decayed = await decayImportance(decayFactor);

    // 3. Prune low-importance stale memories
    result.pruned = await pruneMemories(minImportance, staleDays);

    console.log(
      `[Memory Maintenance] Complete - Decayed: ${result.decayed}, ` +
      `Pruned: ${result.pruned}, Expired cleaned: ${result.expiredCleaned}`
    );
  } catch (error: unknown) {
    console.error('[Memory Maintenance] Error during maintenance:', error);
  }

  return result;
}
