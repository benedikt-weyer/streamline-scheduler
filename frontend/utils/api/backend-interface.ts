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
  CanDoItemDecrypted,
  CanDoItemEncrypted,
  CreateCanDoItemRequest,
  UpdateCanDoItemRequest,
  ProjectDecrypted,
  ProjectEncrypted,
  CreateProjectRequest,
  UpdateProjectRequest,
  CalendarDecrypted,
  CalendarEncrypted,
  CreateCalendarRequest,
  UpdateCalendarRequest,
  CalendarEventDecrypted,
  CalendarEventEncrypted,
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
    getAll(options?: QueryOptions): Promise<PaginatedResponse<CanDoItemEncrypted>>;

    /**
     * Get a single can-do item by ID
     */
    getById(id: string): Promise<ApiResponse<CanDoItemEncrypted>>;

    /**
     * Create a new can-do item
     */
    create(request: CreateCanDoItemRequest): Promise<ApiResponse<CanDoItemEncrypted>>;

    /**
     * Update an existing can-do item
     */
    update(request: UpdateCanDoItemRequest): Promise<ApiResponse<CanDoItemEncrypted>>;

    /**
     * Delete a can-do item
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for can-do items
     */
    subscribe(callback: (payload: RealtimeMessage<CanDoItemEncrypted>) => void): RealtimeSubscription;
  };

  // Project methods
  projects: {
    /**
     * Get all projects for the current user
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<ProjectEncrypted>>;

    /**
     * Get a single project by ID
     */
    getById(id: string): Promise<ApiResponse<ProjectEncrypted>>;

    /**
     * Create a new project
     */
    create(request: CreateProjectRequest): Promise<ApiResponse<ProjectEncrypted>>;

    /**
     * Update an existing project
     */
    update(request: UpdateProjectRequest): Promise<ApiResponse<ProjectEncrypted>>;

    /**
     * Delete a project
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for projects
     */
    subscribe(callback: (payload: RealtimeMessage<ProjectEncrypted>) => void): RealtimeSubscription;
  };

  // Calendar methods
  calendars: {
    /**
     * Get all calendars for the current user
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<CalendarEncrypted>>;

    /**
     * Get a single calendar by ID
     */
    getById(id: string): Promise<ApiResponse<CalendarEncrypted>>;

    /**
     * Create a new calendar
     */
    create(request: CreateCalendarRequest): Promise<ApiResponse<CalendarEncrypted>>;

    /**
     * Update an existing calendar
     */
    update(request: UpdateCalendarRequest): Promise<ApiResponse<CalendarEncrypted>>;

    /**
     * Delete a calendar
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for calendars
     */
    subscribe(callback: (payload: RealtimeMessage<CalendarEncrypted>) => void): RealtimeSubscription;
  };

  // Calendar event methods
  calendarEvents: {
    /**
     * Get all calendar events for the current user
     */
    getAll(options?: QueryOptions): Promise<PaginatedResponse<CalendarEventEncrypted>>;

    /**
     * Get calendar events within a date range
     */
    getByDateRange(
      startDate: string,
      endDate: string,
      calendarIds?: string[]
    ): Promise<PaginatedResponse<CalendarEventEncrypted>>;

    /**
     * Get a single calendar event by ID
     */
    getById(id: string): Promise<ApiResponse<CalendarEventEncrypted>>;

    /**
     * Create a new calendar event
     */
    create(request: CreateCalendarEventRequest): Promise<ApiResponse<CalendarEventEncrypted>>;

    /**
     * Update an existing calendar event
     */
    update(request: UpdateCalendarEventRequest): Promise<ApiResponse<CalendarEventEncrypted>>;

    /**
     * Delete a calendar event
     */
    delete(id: string): Promise<{ error: string | null }>;

    /**
     * Subscribe to real-time changes for calendar events
     */
    subscribe(callback: (payload: RealtimeMessage<CalendarEventEncrypted>) => void): RealtimeSubscription;
  };

  // Data import/export methods
  dataManagement?: {
    /**
     * Export all user data
     */
    exportUserData(): Promise<any>;

    /**
     * Import user data
     */
    importUserData(data: any): Promise<void>;

    /**
     * Clear all user data
     */
    clearAllUserData(): Promise<void>;
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
