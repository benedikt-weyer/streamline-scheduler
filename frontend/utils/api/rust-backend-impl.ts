/**
 * Implementation of BackendInterface that communicates with the Rust backend
 * using both HTTP requests and WebSocket connections
 */

import { BackendInterface } from './backend-interface';
import {
  AuthUser,
  AuthSession,
  AuthResponse,
  SignUpRequest,
  SignInRequest,
  ResetPasswordRequest,
  UpdatePasswordRequest,
  CanDoItem,
  CreateCanDoItemRequest,
  UpdateCanDoItemRequest,
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  Calendar,
  CreateCalendarRequest,
  UpdateCalendarRequest,
  CalendarEvent,
  CreateCalendarEventRequest,
  UpdateCalendarEventRequest,
  RealtimeMessage,
  RealtimeSubscription,
  ApiResponse,
  PaginatedResponse,
  QueryOptions
} from './types';

interface WebSocketMessage {
  type: 'subscription' | 'auth_change' | 'error';
  table?: string;
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE';
  schema?: string;
  commit_timestamp?: string;
  new?: any;
  old?: any;
  error?: string;
  event?: string;
  session?: AuthSession | null;
}

class RustBackendImpl implements BackendInterface {
  private baseUrl: string;
  private wsUrl: string;
  private ws: WebSocket | null = null;
  private authToken: string | null = null;
  private subscriptions: Map<string, (payload: RealtimeMessage<any>) => void> = new Map();
  private authStateCallbacks: Set<(event: string, session: AuthSession | null) => void> = new Set();
  private wsReconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(baseUrl: string = 'http://localhost:3001', wsUrl: string = 'ws://localhost:3001') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.wsUrl = wsUrl.replace(/\/$/, '');
    
    // Try to restore auth token from localStorage or cookies
    this.restoreAuthToken();
    
    // Initialize WebSocket connection
    this.initWebSocket();
  }

  private restoreAuthToken(): void {
    // Try localStorage first
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        this.authToken = token;
        return;
      }
    } catch (e) {
      // localStorage might not be available in SSR
    }

    // Try cookies as fallback
    try {
      const match = document.cookie.match(/auth_token=([^;]+)/);
      if (match) {
        this.authToken = match[1];
      }
    } catch (e) {
      // document might not be available in SSR
    }
  }

  private storeAuthToken(token: string): void {
    this.authToken = token;
    
    try {
      localStorage.setItem('auth_token', token);
    } catch (e) {
      // Fallback to cookies if localStorage fails
      document.cookie = `auth_token=${token};path=/;max-age=${60 * 60 * 24 * 30};SameSite=Strict`;
    }
  }

  private clearAuthToken(): void {
    this.authToken = null;
    
    try {
      localStorage.removeItem('auth_token');
    } catch (e) {
      // Clear cookie as fallback
      document.cookie = 'auth_token=;path=/;max-age=0';
    }
  }

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return response.json();
  }

  private initWebSocket(): void {
    if (typeof window === 'undefined') {
      // Skip WebSocket in SSR
      return;
    }

    try {
      const wsUrl = `${this.wsUrl}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[RustBackend] WebSocket connected');
        this.wsReconnectAttempts = 0;
        
        // Send auth token if available
        if (this.authToken) {
          this.ws?.send(JSON.stringify({
            type: 'auth',
            token: this.authToken
          }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('[RustBackend] Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('[RustBackend] WebSocket disconnected');
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[RustBackend] WebSocket error:', error);
      };
    } catch (error) {
      console.error('[RustBackend] Failed to initialize WebSocket:', error);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.wsReconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[RustBackend] Max WebSocket reconnection attempts reached');
      return;
    }

    this.wsReconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.wsReconnectAttempts - 1);
    
    setTimeout(() => {
      console.log(`[RustBackend] Attempting WebSocket reconnection (${this.wsReconnectAttempts}/${this.maxReconnectAttempts})`);
      this.initWebSocket();
    }, delay);
  }

  private handleWebSocketMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'subscription':
        if (message.table && message.eventType) {
          const callback = this.subscriptions.get(message.table);
          if (callback) {
            const realtimeMessage: RealtimeMessage = {
              eventType: message.eventType,
              schema: message.schema || 'public',
              table: message.table,
              commit_timestamp: message.commit_timestamp || new Date().toISOString(),
              new: message.new,
              old: message.old,
            };
            callback(realtimeMessage);
          }
        }
        break;
        
      case 'auth_change':
        if (message.event) {
          this.authStateCallbacks.forEach(callback => {
            callback(message.event!, message.session || null);
          });
        }
        break;
        
      case 'error':
        console.error('[RustBackend] WebSocket error:', message.error);
        break;
    }
  }

  private subscribe(table: string, callback: (payload: RealtimeMessage<any>) => void): RealtimeSubscription {
    const id = `${table}_${Date.now()}_${Math.random()}`;
    this.subscriptions.set(table, callback);
    
    // Send subscription message to WebSocket
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        table: table
      }));
    }

    return {
      id,
      unsubscribe: () => {
        this.subscriptions.delete(table);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'unsubscribe',
            table: table
          }));
        }
      }
    };
  }

  // Authentication methods
  auth = {
    signUp: async (request: SignUpRequest): Promise<AuthResponse> => {
      try {
        const response = await this.makeRequest<any>('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        
        // Handle the backend's response format
        if (response.data?.access_token) {
          this.storeAuthToken(response.data.access_token);
          return {
            session: {
              user: response.data.user,
              access_token: response.data.access_token,
              refresh_token: null,
              expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            },
            user: response.data.user,
            error: null
          };
        }
        
        return { session: null, user: null, error: null };
      } catch (error) {
        return { 
          session: null, 
          user: null, 
          error: error instanceof Error ? error.message : 'Sign up failed' 
        };
      }
    },

    signIn: async (request: SignInRequest): Promise<AuthResponse> => {
      try {
        const response = await this.makeRequest<any>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        
        // Handle the backend's response format
        if (response.data?.access_token) {
          this.storeAuthToken(response.data.access_token);
          return {
            session: {
              user: response.data.user,
              access_token: response.data.access_token,
              refresh_token: null,
              expires_at: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
            },
            user: response.data.user,
            error: null
          };
        }
        
        return { session: null, user: null, error: 'Invalid credentials' };
      } catch (error) {
        return { 
          session: null, 
          user: null, 
          error: error instanceof Error ? error.message : 'Sign in failed' 
        };
      }
    },

    signOut: async (): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest('/api/auth/logout', {
          method: 'POST',
        });
        this.clearAuthToken();
        return { error: null };
      } catch (error) {
        this.clearAuthToken(); // Clear token even if request fails
        return { error: error instanceof Error ? error.message : 'Sign out failed' };
      }
    },

    getSession: async (): Promise<{ data: { session: AuthSession | null }, error: string | null }> => {
      try {
        const response = await this.makeRequest<{ data: { session: AuthSession | null } }>('/api/auth/session');
        return { ...response, error: null };
      } catch (error) {
        return { 
          data: { session: null }, 
          error: error instanceof Error ? error.message : 'Failed to get session' 
        };
      }
    },

    getUser: async (): Promise<{ data: { user: AuthUser | null }, error: string | null }> => {
      try {
        const response = await this.makeRequest<{ data: { user: AuthUser | null } }>('/api/auth/me');
        return { ...response, error: null };
      } catch (error) {
        return { 
          data: { user: null }, 
          error: error instanceof Error ? error.message : 'Failed to get user' 
        };
      }
    },

    updatePassword: async (request: UpdatePasswordRequest): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest('/api/auth/update-password', {
          method: 'PUT',
          body: JSON.stringify(request),
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to update password' };
      }
    },

    resetPasswordForEmail: async (request: ResetPasswordRequest): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify(request),
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to reset password' };
      }
    },

    onAuthStateChange: (callback: (event: string, session: AuthSession | null) => void) => {
      this.authStateCallbacks.add(callback);
      
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              this.authStateCallbacks.delete(callback);
            }
          }
        }
      };
    }
  };

  // Can-do list methods
  canDoList = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CanDoItem>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      return this.makeRequest<PaginatedResponse<CanDoItem>>(`/api/can-do-list?${params}`);
    },

    getById: async (id: string): Promise<ApiResponse<CanDoItem>> => {
      return this.makeRequest<ApiResponse<CanDoItem>>(`/api/can-do-list/${id}`);
    },

    create: async (request: CreateCanDoItemRequest): Promise<ApiResponse<CanDoItem>> => {
      return this.makeRequest<ApiResponse<CanDoItem>>('/api/can-do-list', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    update: async (request: UpdateCanDoItemRequest): Promise<ApiResponse<CanDoItem>> => {
      return this.makeRequest<ApiResponse<CanDoItem>>(`/api/can-do-list/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/can-do-list/${id}`, {
          method: 'DELETE',
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete item' };
      }
    },

    subscribe: (callback: (payload: RealtimeMessage<CanDoItem>) => void): RealtimeSubscription => {
      return this.subscribe('can_do_list', callback);
    }
  };

  // Project methods
  projects = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<Project>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      return this.makeRequest<PaginatedResponse<Project>>(`/api/projects?${params}`);
    },

    getById: async (id: string): Promise<ApiResponse<Project>> => {
      return this.makeRequest<ApiResponse<Project>>(`/api/projects/${id}`);
    },

    create: async (request: CreateProjectRequest): Promise<ApiResponse<Project>> => {
      return this.makeRequest<ApiResponse<Project>>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    update: async (request: UpdateProjectRequest): Promise<ApiResponse<Project>> => {
      return this.makeRequest<ApiResponse<Project>>(`/api/projects/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/projects/${id}`, {
          method: 'DELETE',
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete project' };
      }
    },

    subscribe: (callback: (payload: RealtimeMessage<Project>) => void): RealtimeSubscription => {
      return this.subscribe('projects', callback);
    }
  };

  // Calendar methods
  calendars = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<Calendar>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      return this.makeRequest<PaginatedResponse<Calendar>>(`/api/calendars?${params}`);
    },

    getById: async (id: string): Promise<ApiResponse<Calendar>> => {
      return this.makeRequest<ApiResponse<Calendar>>(`/api/calendars/${id}`);
    },

    create: async (request: CreateCalendarRequest): Promise<ApiResponse<Calendar>> => {
      return this.makeRequest<ApiResponse<Calendar>>('/api/calendars', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    update: async (request: UpdateCalendarRequest): Promise<ApiResponse<Calendar>> => {
      return this.makeRequest<ApiResponse<Calendar>>(`/api/calendars/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/calendars/${id}`, {
          method: 'DELETE',
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete calendar' };
      }
    },

    subscribe: (callback: (payload: RealtimeMessage<Calendar>) => void): RealtimeSubscription => {
      return this.subscribe('calendars', callback);
    }
  };

  // Calendar event methods
  calendarEvents = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CalendarEvent>> => {
      const params = new URLSearchParams();
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.offset) params.append('offset', options.offset.toString());
      
      return this.makeRequest<PaginatedResponse<CalendarEvent>>(`/api/calendar-events?${params}`);
    },

    getByDateRange: async (
      startDate: string,
      endDate: string,
      calendarIds?: string[]
    ): Promise<PaginatedResponse<CalendarEvent>> => {
      const params = new URLSearchParams();
      params.append('start_date', startDate);
      params.append('end_date', endDate);
      if (calendarIds?.length) {
        params.append('calendar_ids', calendarIds.join(','));
      }
      
      return this.makeRequest<PaginatedResponse<CalendarEvent>>(`/api/calendar-events/range?${params}`);
    },

    getById: async (id: string): Promise<ApiResponse<CalendarEvent>> => {
      return this.makeRequest<ApiResponse<CalendarEvent>>(`/api/calendar-events/${id}`);
    },

    create: async (request: CreateCalendarEventRequest): Promise<ApiResponse<CalendarEvent>> => {
      return this.makeRequest<ApiResponse<CalendarEvent>>('/api/calendar-events', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    },

    update: async (request: UpdateCalendarEventRequest): Promise<ApiResponse<CalendarEvent>> => {
      return this.makeRequest<ApiResponse<CalendarEvent>>(`/api/calendar-events/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify(request),
      });
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      try {
        await this.makeRequest(`/api/calendar-events/${id}`, {
          method: 'DELETE',
        });
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'Failed to delete event' };
      }
    },

    subscribe: (callback: (payload: RealtimeMessage<CalendarEvent>) => void): RealtimeSubscription => {
      return this.subscribe('calendar_events', callback);
    }
  };
}

export default RustBackendImpl;
