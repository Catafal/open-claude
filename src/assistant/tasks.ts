/**
 * Google Tasks Service
 *
 * Provides task retrieval for the Personal Assistant Agent.
 * All operations are readonly.
 */

import { google } from 'googleapis';
import { getAuthenticatedClient } from './google-client';
import type { GoogleAccount, TaskList, TaskItem } from './types';

// Default number of tasks to fetch per list
const DEFAULT_MAX_TASKS = 20;

// Max tasks to prevent context overflow
const MAX_TASKS_LIMIT = 50;

// =============================================================================
// Task Lists
// =============================================================================

/**
 * Get all task lists for an account.
 */
export async function getTaskLists(account: GoogleAccount): Promise<TaskList[]> {
  try {
    const auth = await getAuthenticatedClient(account);
    const tasks = google.tasks({ version: 'v1', auth });

    const response = await tasks.tasklists.list({
      maxResults: 100  // Get all task lists
    });

    const lists = response.data.items || [];
    console.log(`[Tasks] Found ${lists.length} task lists for ${account.email}`);

    return lists.map(list => ({
      id: list.id || '',
      title: list.title || 'Untitled List'
    }));
  } catch (error) {
    console.error(`[Tasks] Error fetching task lists for ${account.email}:`, error);
    throw error;
  }
}

// =============================================================================
// Tasks Retrieval
// =============================================================================

/**
 * Get tasks from a specific task list.
 *
 * @param account - Google account to query
 * @param listId - Task list ID
 * @param maxTasks - Maximum tasks to return
 * @param showCompleted - Include completed tasks (default: false)
 */
export async function getTasks(
  account: GoogleAccount,
  listId: string,
  maxTasks: number = DEFAULT_MAX_TASKS,
  showCompleted: boolean = false
): Promise<TaskItem[]> {
  try {
    const auth = await getAuthenticatedClient(account);
    const tasks = google.tasks({ version: 'v1', auth });

    // Get list title
    const listResponse = await tasks.tasklists.get({ tasklist: listId });
    const listTitle = listResponse.data.title || 'Untitled List';

    // Get tasks
    const response = await tasks.tasks.list({
      tasklist: listId,
      maxResults: Math.min(maxTasks, MAX_TASKS_LIMIT),
      showCompleted,
      showHidden: false
    });

    const taskItems = response.data.items || [];
    console.log(`[Tasks] Found ${taskItems.length} tasks in "${listTitle}" for ${account.email}`);

    return taskItems.map(task => formatTask(task, listId, listTitle));
  } catch (error) {
    console.error(`[Tasks] Error fetching tasks for ${account.email}:`, error);
    throw error;
  }
}

/**
 * Get all pending (incomplete) tasks across all lists.
 * Most useful for the assistant to know what's on the user's plate.
 */
export async function getPendingTasks(
  account: GoogleAccount,
  maxTasksPerList: number = DEFAULT_MAX_TASKS
): Promise<TaskItem[]> {
  try {
    // Get all task lists first
    const lists = await getTaskLists(account);

    // Fetch pending tasks from each list in parallel
    const taskPromises = lists.map(list =>
      getTasks(account, list.id, maxTasksPerList, false)
    );

    const taskArrays = await Promise.all(taskPromises);

    // Flatten and filter only incomplete tasks
    const allTasks = taskArrays.flat().filter(t => t.status === 'needsAction');

    console.log(`[Tasks] Found ${allTasks.length} pending tasks across ${lists.length} lists for ${account.email}`);

    // Sort by due date (tasks with due dates first, then by date)
    return allTasks.sort((a, b) => {
      if (a.due && b.due) return new Date(a.due).getTime() - new Date(b.due).getTime();
      if (a.due) return -1;  // Tasks with due dates first
      if (b.due) return 1;
      return 0;
    });
  } catch (error) {
    console.error(`[Tasks] Error fetching pending tasks for ${account.email}:`, error);
    throw error;
  }
}

/**
 * Get tasks due today.
 */
export async function getTasksDueToday(account: GoogleAccount): Promise<TaskItem[]> {
  const allPending = await getPendingTasks(account);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  return allPending.filter(task => {
    if (!task.due) return false;
    return task.due.startsWith(todayStr);
  });
}

/**
 * Get overdue tasks.
 */
export async function getOverdueTasks(account: GoogleAccount): Promise<TaskItem[]> {
  const allPending = await getPendingTasks(account);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return allPending.filter(task => {
    if (!task.due) return false;
    const dueDate = new Date(task.due);
    return dueDate < today;
  });
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Format Google Task to our simplified format.
 */
function formatTask(
  task: {
    id?: string | null;
    title?: string | null;
    notes?: string | null;
    due?: string | null;
    status?: string | null;
    completed?: string | null;
  },
  listId: string,
  listTitle: string
): TaskItem {
  return {
    id: task.id || '',
    listId,
    listTitle,
    title: task.title || '(No title)',
    notes: truncateNotes(task.notes),
    due: task.due || undefined,
    status: task.status === 'completed' ? 'completed' : 'needsAction',
    completed: task.completed || undefined
  };
}

/**
 * Truncate notes to prevent context overflow.
 */
function truncateNotes(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const maxLength = 150;
  if (notes.length <= maxLength) return notes;
  return notes.slice(0, maxLength) + '...';
}
