import axios from 'axios';

// Task cache to minimize API calls
const taskCache: Record<string, {
  data: any;
  timestamp: number;
}> = {};

// Cache expiration time (10 minutes)
const CACHE_EXPIRATION = 10 * 60 * 1000;

// Мок данных для задач ClickUp (для обхода проблемы с API)
const MOCK_TASKS: Record<string, any> = {
  // Можно добавить другие ID задач по необходимости
  'default': {
    id: 'default',
    name: 'Задача ClickUp',
    status: { status: 'в работе', color: '#4bade8' },
  }
};

// Функция извлечения ID задачи перемещена в метод ClickUpApi.extractTaskId

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
      console.log('[ClickUp] Returning cached task data:', cachedTask.data);
      return cachedTask.data;
    }
    
    console.log('[ClickUp] Fetching task data for taskId:', taskId);
    
    try {
      // Пробуем запрос к реальному API
      console.log('[ClickUp] Trying real API request for taskId:', taskId);
      
      // Попытка получить токен авторизации из разных источников
      let authToken = localStorage.getItem('auth_token') || '';
      
      // Если нет в localStorage, пробуем получить из cookies
      if (!authToken) {
        console.log('[ClickUp] Trying to get token from cookies...');
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'auth_token' || name === 'token') {
            authToken = value;
            console.log('[ClickUp] Found token in cookies');
            break;
          }
        }
      }
      
      // Если токена нет, попробуем запрос без авторизации
      console.log('[ClickUp] Using auth token:', authToken ? 'Token exists' : 'No token (will try without auth)');
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // Увеличиваем таймаут
      
      // Получаем базовый URL из конфигурации
      // @ts-ignore - для доступа к глобальной конфигурации
      const baseConfig = window.CONFIG || {};
      const appUrl = baseConfig.APP_URL || window.location.origin;
      
      // Формируем URL для запроса
      // ВАЖНО: исправляем путь, поскольку в логах сервера видно, что у маршрута двойной префикс /api
      const apiUrl = `${appUrl}/api/api/clickup/task/${taskId}`;
      console.log('[ClickUp] Using API URL:', apiUrl);
      
      // Добавляем случайный параметр для предотвращения кэширования
      const randomParam = Date.now().toString() + Math.random().toString(36).substring(2, 8);
      
      // Проверяем доступность API endpoint
      try {
        console.log('[ClickUp] Testing API endpoint availability...');
        // Тестируем доступность эндпойнта health вместо ping
        const pingResponse = await fetch(`${appUrl}/api/health?_=${randomParam}`); 
        console.log('[ClickUp] API ping response status:', pingResponse.status);
        if (pingResponse.ok) {
          const pingData = await pingResponse.text();
          console.log('[ClickUp] API ping response:', pingData);
        }
      } catch (pingError) {
        console.error('[ClickUp] API ping test failed:', pingError);
      }
      
      // Детальный запрос к API
      console.log('[ClickUp] Sending API request...');
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Requested-With': 'XMLHttpRequest', // Предотвращает обработку как HTML
        'Accept': 'application/json' // Явно указываем, что ожидаем JSON
      };
      
      // Добавляем токен авторизации, если он есть
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      
      const response = await axios.get(apiUrl, {
        headers,
        signal: controller.signal,
        params: { 
          _t: randomParam,
          debug: true // Для получения дополнительной отладочной информации от сервера
        }
      });
      
      clearTimeout(timeoutId);
      
      console.log('[ClickUp] API response type:', typeof response.data);
      console.log('[ClickUp] API response headers:', response.headers);
      console.log('[ClickUp] API response full data:', response.data);
      
      // Проверяем, что ответ содержит ожидаемые данные
      // Структура ответа API: { data: { ... данные задачи ... }, success: true, status: 200 }
      if (response.data) {
        // Проверяем два варианта структуры ответа
        let taskData;
        
        // Вариант 1: Данные задачи в response.data.data (API возвращает обертку)
        if (response.data.success && response.data.data && response.data.data.name) {
          console.log('[ClickUp] Valid API response with wrapper structure');
          taskData = response.data.data;
        }
        // Вариант 2: Данные задачи напрямую в response.data
        else if (response.data.name && response.data.status) {
          console.log('[ClickUp] Valid API response with direct structure');
          taskData = response.data;
        }
        
        if (taskData) {
          console.log('[ClickUp] Valid API response received with task name:', taskData.name);
          
          // Формируем объект задачи в одинаковом формате
          const formattedTaskData = {
            id: taskData.id,
            name: taskData.name,
            status: {
              status: taskData.status?.status || 'в работе',
              color: taskData.status?.color || '#4bade8'
            }
          };
          
          // Store in cache
          taskCache[taskId] = {
            data: formattedTaskData,
            timestamp: now
          };
          
          return formattedTaskData;
        } else {
          // Распечатываем структуру ответа для отладки
          console.error('[ClickUp] Unexpected API response structure:', JSON.stringify(response.data, null, 2));
          throw new Error('Неожиданная структура ответа API');
        }
      } else {
        // Если получили HTML вместо JSON
        console.error('[ClickUp] Received invalid response:', 
          typeof response.data === 'string' ? response.data.substring(0, 100) : 'Non-string response');
        
        throw new Error('Invalid API response format');
      }

    } catch (error) {
      console.error('[ClickUp] Error fetching task:', error);
      // Показываем более подробную информацию об ошибке
      if (axios.isAxiosError(error)) {
        console.error('[ClickUp] Request failed with status:', error.response?.status);
        console.error('[ClickUp] Error response data:', error.response?.data);
      }
      throw error;
    }
  },

  /**
   * Check if URL is a valid ClickUp task URL
   * 
   * @param url - URL to check
   * @returns TaskId if valid ClickUp URL, null otherwise
   */
  extractTaskId: (url: string): string | null => {
    // Более гибкое распознавание URL - поддержка разных форматов
    // Форматы URL: 
    // - https://app.clickup.com/t/86c2v9gd4
    // - https://app.clickup.com/t/XXXXX/tasks/YYYYY
    // - и другие вариации
    const match = url.match(/\/t\/([a-z0-9]+)/i);
    
    return match ? match[1] : null;
  }
};
