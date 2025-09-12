/**
 * Backend API interface for all data operations
 * This interface defines the contract for backend communication
 * without implementation details
 */

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

export interface BackendInterface {
  // Authentication methods
  auth: {
    /**
     * Sign up a new user
     */
    signUp(request: SignUpRequest): Promise<AuthResponse>;

    /**
     * Sign in an existing user
     */
    signIn(request: SignInRequest): Promise<AuthResponse>;

    /**
     * Sign out the current user
     */
    signOut(): Promise<{ error: string | null }>;

    /**
     * Get the current session
     */
    getSession(): Promise<{ data: { session: AuthSession | null }, error: string | null }>;

    /**
     * Get the current user
     */
    getUser(): Promise<{ data: { user: AuthUser | null }, error: string | null }>;

    /**
     * Update the current user's password
     */
    updatePassword(request: UpdatePasswordRequest): Promise<{ error: string | null }>;

    /**
     * Send a password reset email
     */
    resetPasswordForEmail(request: ResetPasswordRequest): Promise<{ error: string | null }>;

    /**
     * Listen for authentication state changes
     */
    onAuthStateChange(callback: (event: string, session: AuthSession | null) => void): {
      data: { subscription: { unsubscribe: () => void } }
    };
  };

  // Can-do list methods
  canDoList: {
    /**
     * Get all can-do items for the current user
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<CanDoItem>>;

    /**
     * Get a single can-do item by ID
     */
    getById(id: string): Promise<ApiResponse<CanDoItem>>;

    /**
     * Create a new can-do item
     */
    create(request: CreateCanDoItemRequest): Promise<ApiResponse<CanDoItem>>;

    /**
     * Update an existing can-do item
     */
    update(request: UpdateCanDoItemRequest): Promise<ApiResponse<CanDoItem>>;

    /**
     * Delete a can-do item
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for can-do items
     */
    subscribe(callback: (payload: RealtimeMessage<CanDoItem>) => void): RealtimeSubscription;
  };

  // Project methods
  projects: {
    /**
     * Get all projects for the current user
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<Project>>;

    /**
     * Get a single project by ID
     */
    getById(id: string): Promise<ApiResponse<Project>>;

    /**
     * Create a new project
     */
    create(request: CreateProjectRequest): Promise<ApiResponse<Project>>;

    /**
     * Update an existing project
     */
    update(request: UpdateProjectRequest): Promise<ApiResponse<Project>>;

    /**
     * Delete a project
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for projects
     */
    subscribe(callback: (payload: RealtimeMessage<Project>) => void): RealtimeSubscription;
  };

  // Calendar methods
  calendars: {
    /**
     * Get all calendars for the current user
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<Calendar>>;

    /**
     * Get a single calendar by ID
     */
    getById(id: string): Promise<ApiResponse<Calendar>>;

    /**
     * Create a new calendar
     */
    create(request: CreateCalendarRequest): Promise<ApiResponse<Calendar>>;

    /**
     * Update an existing calendar
     */
    update(request: UpdateCalendarRequest): Promise<ApiResponse<Calendar>>;

    /**
     * Delete a calendar
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for calendars
     */
    subscribe(callback: (payload: RealtimeMessage<Calendar>) => void): RealtimeSubscription;
  };

  // Calendar event methods
  calendarEvents: {
    /**
     * Get all calendar events for the current user
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<CalendarEvent>>;

    /**
     * Get calendar events within a date range
     */
    getByDateRange(
      startDate: string,
      endDate: string,
      calendarIds?: string[]
    ): Promise<PaginatedResponse<CalendarEvent>>;

    /**
     * Get a single calendar event by ID
     */
    getById(id: string): Promise<ApiResponse<CalendarEvent>>;

    /**
     * Create a new calendar event
     */
    create(request: CreateCalendarEventRequest): Promise<ApiResponse<CalendarEvent>>;

    /**
     * Update an existing calendar event
     */
    update(request: UpdateCalendarEventRequest): Promise<ApiResponse<CalendarEvent>>;

    /**
     * Delete a calendar event
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for calendar events
     */
    subscribe(callback: (payload: RealtimeMessage<CalendarEvent>) => void): RealtimeSubscription;
  };
}

/**
 * Global backend instance
 * This will be initialized with the actual implementation
 */
export let backend: BackendInterface;

/**
 * Initialize the backend with a specific implementation
 */
export function initializeBackend(implementation: BackendInterface): void {
  backend = implementation;
}

/**
 * Get the current backend instance
 */
export function getBackend(): BackendInterface {
  if (!backend) {
    throw new Error('Backend not initialized. Call initializeBackend() first.');
  }
  return backend;
}
