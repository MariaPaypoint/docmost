import { useEffect, useState } from 'react';
import { ClickUpApi } from './clickup-api';

// Global registry of ongoing requests
const pendingRequests = new Map<string, Promise<any>>();

export type ClickUpTask = {
  id: string;
  name: string;
  status: {
    status: string;
    color: string;
  };
};

/**
 * Centralized manager for ClickUp task data fetching
 * Ensures only one request per task ID is made at a time
 */
export const ClickUpTaskManager = {
  /**
   * Extract task ID from ClickUp URL
   * @param url ClickUp URL
   * @returns Task ID or null if not a valid ClickUp URL
   */
  extractTaskId(url: string): string | null {
    // Match task URLs like https://app.clickup.com/t/86c2kr675
    const taskMatch = url.match(/clickup\.com\/t\/([a-z0-9]+)/i);
    
    // Match doc URLs like https://doc.clickup.com/3z2pm5g/p/h/3z2pm5g-298/ff29bc89f6231b3/3z2pm5g-3537
    const docMatch = url.match(/clickup\.com\/[\w-]+\/p\/[\w\/.-]+\/([\w-]+)/i);
    
    return taskMatch ? taskMatch[1] : docMatch ? docMatch[1] : null;
  },
  /**
   * Get task data with deduplication of requests
   * @param taskId ClickUp task ID
   * @returns Promise with task data
   */
  getTask(taskId: string): Promise<ClickUpTask> {
    // Return existing promise if this task is already being fetched
    if (pendingRequests.has(taskId)) {
      return pendingRequests.get(taskId)!;
    }
    
    // Create new promise for this task
    const taskPromise = ClickUpApi.getTask(taskId)
      .then(data => {
        // Request completed successfully, remove from pending
        pendingRequests.delete(taskId);
        return data;
      })
      .catch(error => {
        // Request failed, remove from pending
        pendingRequests.delete(taskId);
        throw error;
      });
    
    // Store the promise
    pendingRequests.set(taskId, taskPromise);
    
    return taskPromise;
  }
};

/**
 * React hook for using ClickUp task data
 * @param taskId Task ID to fetch
 * @returns Object with task data, loading state and error
 */
export function useClickUpTask(taskId: string | null) {
  const [task, setTask] = useState<ClickUpTask | null>(null);
  const [loading, setLoading] = useState(taskId !== null);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Reset state when taskId changes
    setTask(null);
    setError(null);
    
    if (!taskId) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    ClickUpTaskManager.getTask(taskId)
      .then(data => {
        setTask(data);
        setError(null);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Error fetching task');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [taskId]);
  
  return { task, loading, error };
}
