/**
 * Type definitions for backend API interactions
 */

// Authentication types
export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  updated_at?: string;
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export interface AuthResponse {
  session: AuthSession | null;
  user: AuthUser | null;
  error: string | null;
}

export interface SignUpRequest {
  email: string;
  password: string;
  emailRedirectTo?: string;
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface ResetPasswordRequest {
  email: string;
  redirectTo?: string;
}

export interface UpdatePasswordRequest {
  password: string;
}

// Can-do list types
export interface CanDoItem {
  id: string;
  content: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  duration_minutes?: number;
  project_id?: string;
  order: number;
  user_id: string;
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

export interface CreateCanDoItemRequest {
  content: string;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  duration_minutes?: number;
  project_id?: string;
  order: number;
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

export interface UpdateCanDoItemRequest {
  id: string;
  content?: string;
  completed?: boolean;
  due_date?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  duration_minutes?: number;
  project_id?: string;
  order?: number;
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  parent_id?: string;
  order: number;
  collapsed: boolean;
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
  parent_id?: string;
  order: number;
  collapsed?: boolean;
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

export interface UpdateProjectRequest {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  parent_id?: string;
  order?: number;
  collapsed?: boolean;
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

// Calendar types
export interface Calendar {
  id: string;
  name: string;
  color: string;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

export interface CreateCalendarRequest {
  name: string;
  color: string;
  is_visible?: boolean;
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

export interface UpdateCalendarRequest {
  id: string;
  name?: string;
  color?: string;
  is_visible?: boolean;
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  calendar_id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  recurrence_rule?: string;
  recurrence_exception?: string[];
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

export interface CreateCalendarEventRequest {
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  all_day?: boolean;
  calendar_id: string;
  recurrence_rule?: string;
  recurrence_exception?: string[];
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

export interface UpdateCalendarEventRequest {
  id: string;
  title?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  all_day?: boolean;
  calendar_id?: string;
  recurrence_rule?: string;
  recurrence_exception?: string[];
  // Encrypted fields
  encrypted_data?: string;
  iv?: string;
  salt?: string;
}

// Real-time subscription types
export interface RealtimeMessage<T = any> {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  schema: string;
  table: string;
  commit_timestamp: string;
  new?: T;
  old?: T;
}

export interface RealtimeSubscription {
  id: string;
  unsubscribe: () => void;
}

// API Response types
export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T = any> {
  data: T[];
  error: string | null;
  count: number | null;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

// Query filter types
export interface QueryFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'is' | 'not';
  value: any;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: {
    column: string;
    ascending?: boolean;
  }[];
  limit?: number;
  offset?: number;
  select?: string[];
}
