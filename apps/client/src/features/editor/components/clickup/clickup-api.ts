import axios from 'axios';

// Task cache to minimize API calls
const taskCache: Record<string, {
  data: any;
  timestamp: number;
}> = {};

// Cache expiration time (10 minutes)
const CACHE_EXPIRATION = 10 * 60 * 1000;

/**
 * API client for ClickUp task operations
 */
export const ClickUpApi = {
  /**
   * Fetch task data from ClickUp API with caching
   * 
   * @param taskId - ClickUp task ID
   * @returns Task data with name, status, and color
   */
  getTask: async (taskId: string) => {
    // Check cache first
    const cachedTask = taskCache[taskId];
    const now = Date.now();
    
    if (cachedTask && (now - cachedTask.timestamp) < CACHE_EXPIRATION) {
      return cachedTask.data;
    }
    
    try {
      // Try to get authorization token from different sources
      let authToken = localStorage.getItem('auth_token') || '';
      
      // If not in localStorage, try to get from cookies
      if (!authToken) {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'auth_token' || name === 'token') {
            authToken = value;
            break;
          }
        }
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout
      
      // Get base URL from configuration
      // @ts-ignore - for access to global configuration
      const baseConfig = window.CONFIG || {};
      const appUrl = baseConfig.APP_URL || window.location.origin;
      
      // Form URL for the request
      // Note: Path uses double /api prefix based on server routing
      const apiUrl = `${appUrl}/api/api/clickup/task/${taskId}`;
      
      // Add random parameter to prevent caching
      const randomParam = Date.now().toString() + Math.random().toString(36).substring(2, 8);
      
      // Headers for API request
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Requested-With': 'XMLHttpRequest', // Prevents processing as HTML
        'Accept': 'application/json' // Explicitly specify we expect JSON
      };
      
      // Add authorization token if available
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await axios.get(apiUrl, {
        headers,
        signal: controller.signal,
        params: { 
          _t: randomParam
        }
      });
      
      clearTimeout(timeoutId);
      
      // Process API response
      if (response.data) {
        // Check two possible response structures
        let taskData;
        
        // Option 1: Task data in response.data.data (API returns wrapper)
        if (response.data.success && response.data.data && response.data.data.name) {
          taskData = response.data.data;
        }
        // Option 2: Task data directly in response.data
        else if (response.data.name && response.data.status) {
          taskData = response.data;
        }
        
        if (taskData) {
          // Format task data consistently
          const formattedTaskData = {
            id: taskData.id || '',
            name: taskData.name || 'Untitled Task',
            // Handle status structure variations
            status: taskData.status ? (
              typeof taskData.status === 'object' ? 
                taskData.status : 
                { status: taskData.status, color: '#4bade8' }
            ) : { status: 'in progress', color: '#4bade8' },
            // Add priority information
            priority: taskData.priority || null,
            // Add assignees information
            assignees: taskData.assignees || [],
            assignee: taskData.assignee || null
          };
          
          // Для отладки выведем полные данные задачи
          console.log('ClickUp Raw Task Data:', taskData);
          
          // Save to cache
          taskCache[taskId] = {
            data: formattedTaskData,
            timestamp: now
          };
          
          return formattedTaskData;
        }
      }
      
      throw new Error('Invalid API response format (missing expected fields)');
    } catch (error: any) {
      console.error('[ClickUp] API request failed:', error.message);
      throw error;
    }
  },

  /**
   * Check if URL is a valid ClickUp task URL
   * 
   * @param url - URL to check
   * @returns TaskId if valid ClickUp URL, null otherwise
   */
  extractTaskId(url: string): string | null {
    if (!url) return null;
    
    // Check if URL contains ClickUp task ID
    try {
      // URL variants:
      // https://app.clickup.com/t/123abc
      // https://app.clickup.com/123/t/123abc
      // https://app.clickup.com/123/v/li/123abc
      const urlObj = new URL(url);
      if (urlObj.hostname !== 'app.clickup.com') return null;
      
      const pathParts = urlObj.pathname.split('/');
      // Check for /t/ID format
      if (pathParts.includes('t') && pathParts.length > pathParts.indexOf('t') + 1) {
        return pathParts[pathParts.indexOf('t') + 1];
      }
      // Check for /v/li/ID format
      if (pathParts.includes('li') && pathParts.length > pathParts.indexOf('li') + 1) {
        return pathParts[pathParts.indexOf('li') + 1];
      }
    } catch (e) {
      return null;
    }
    
    return null;
  }
};
