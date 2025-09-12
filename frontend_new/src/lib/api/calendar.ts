import type { EncryptedCalendar, EncryptedCalendarEvent } from '$lib/types/calendar';
import { get } from 'svelte/store';
import { authStore } from '$lib/stores/auth';

interface ApiResponse<T> {
  data: T;
  message?: string;
}

const BASE_URL = `${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'}/api`;

// Helper function to get auth token from auth store
function getAuthToken(): string | null {
  const auth = get(authStore);
  return auth.session?.access_token || null;
}

// Helper function for API requests
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(errorData.message || `HTTP ${response.status}`);
  }

  const data: ApiResponse<T> = await response.json();
  return data.data;
}

// Calendar API functions
export async function fetchCalendars(): Promise<EncryptedCalendar[]> {
  return apiRequest<EncryptedCalendar[]>('/calendars');
}

export async function createCalendar(
  encryptedData: string,
  iv: string,
  salt: string
): Promise<EncryptedCalendar> {
  return apiRequest<EncryptedCalendar>('/calendars', {
    method: 'POST',
    body: JSON.stringify({
      encrypted_data: encryptedData,
      iv,
      salt,
    }),
  });
}

export async function updateCalendar(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string,
  isDefault?: boolean
): Promise<EncryptedCalendar> {
  return apiRequest<EncryptedCalendar>(`/calendars/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      encrypted_data: encryptedData,
      iv,
      salt,
      is_default: isDefault,
    }),
  });
}

export async function deleteCalendar(id: string): Promise<void> {
  return apiRequest<void>(`/calendars/${id}`, {
    method: 'DELETE',
  });
}

// Calendar Events API functions
export async function fetchCalendarEvents(): Promise<EncryptedCalendarEvent[]> {
  return apiRequest<EncryptedCalendarEvent[]>('/calendar-events');
}

export async function createCalendarEvent(
  encryptedData: string,
  iv: string,
  salt: string
): Promise<EncryptedCalendarEvent> {
  return apiRequest<EncryptedCalendarEvent>('/calendar-events', {
    method: 'POST',
    body: JSON.stringify({
      encrypted_data: encryptedData,
      iv,
      salt,
    }),
  });
}

export async function updateCalendarEvent(
  id: string,
  encryptedData: string,
  iv: string,
  salt: string
): Promise<EncryptedCalendarEvent> {
  return apiRequest<EncryptedCalendarEvent>(`/calendar-events/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      encrypted_data: encryptedData,
      iv,
      salt,
    }),
  });
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  return apiRequest<void>(`/calendar-events/${id}`, {
    method: 'DELETE',
  });
}
