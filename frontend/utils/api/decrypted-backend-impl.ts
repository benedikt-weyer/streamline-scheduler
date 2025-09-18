/**
 * Decrypted Backend Implementation
 * This class implements DecryptedBackendInterface by wrapping BackendInterface
 * and handling encryption/decryption automatically.
 */

import { DecryptedBackendInterface } from './decrypted-backend-interface';
import { BackendInterface } from './backend-interface';
import {
  CanDoItemDecrypted,
  CanDoItemEncrypted,
  ProjectDecrypted,
  ProjectEncrypted,
  CalendarDecrypted,
  CalendarEncrypted,
  CalendarEventDecrypted,
  CalendarEventEncrypted,
  CreateCanDoItemDecryptedRequest,
  UpdateCanDoItemDecryptedRequest,
  CreateProjectDecryptedRequest,
  UpdateProjectDecryptedRequest,
  CreateCalendarDecryptedRequest,
  UpdateCalendarDecryptedRequest,
  CreateCalendarEventDecryptedRequest,
  UpdateCalendarEventDecryptedRequest,
  CreateCanDoItemRequest,
  UpdateCanDoItemRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateCalendarRequest,
  UpdateCalendarRequest,
  CreateCalendarEventRequest,
  UpdateCalendarEventRequest,
  PaginatedResponse,
  ApiResponse,
  QueryOptions,
} from './types';
import {
  encryptData,
  decryptData,
  generateIV,
  generateSalt,
  deriveKeyFromPassword,
} from '../cryptography/encryption';

export class DecryptedBackendImpl implements DecryptedBackendInterface {
  constructor(
    private backend: BackendInterface,
    private encryptionKey: string
  ) {}

  // Helper methods for encryption/decryption
  private encryptItemData(data: any): { encrypted_data: string; iv: string; salt: string } {
    const salt = generateSalt();
    const iv = generateIV();
    const derivedKey = deriveKeyFromPassword(this.encryptionKey, salt);
    const encrypted_data = encryptData(data, derivedKey, iv);
    return { encrypted_data, iv, salt };
  }

  private decryptItemData<T>(encrypted: { encrypted_data: string; iv: string; salt: string }): T {
    const derivedKey = deriveKeyFromPassword(this.encryptionKey, encrypted.salt);
    return decryptData(encrypted.encrypted_data, derivedKey, encrypted.iv) as T;
  }

  private decryptCanDoItem(encrypted: CanDoItemEncrypted): CanDoItemDecrypted {
    const decryptedData = this.decryptItemData<{
      content: string;
      completed: boolean;
      due_date?: string;
      impact?: number;
      urgency?: number;
      tags?: string[];
      duration_minutes?: number;
    }>(encrypted);

    return {
      id: encrypted.id,
      user_id: encrypted.user_id,
      project_id: encrypted.project_id,
      display_order: encrypted.display_order,
      created_at: encrypted.created_at,
      updated_at: encrypted.updated_at,
      ...decryptedData,
    };
  }

  private decryptProject(encrypted: ProjectEncrypted): ProjectDecrypted {
    const decryptedData = this.decryptItemData<{
      name: string;
      description?: string;
      color?: string;
    }>(encrypted);

    return {
      id: encrypted.id,
      created_at: encrypted.created_at,
      updated_at: encrypted.updated_at,
      user_id: encrypted.user_id,
      parent_id: encrypted.parent_id,
      order: encrypted.order,
      collapsed: encrypted.collapsed,
      ...decryptedData,
    };
  }

  private decryptCalendar(encrypted: CalendarEncrypted): CalendarDecrypted {
    const decryptedData = this.decryptItemData<{
      name: string;
      color?: string;
      is_visible: boolean;
      type?: 'regular' | 'ics';
      ics_url?: string;
      last_sync?: string;
    }>(encrypted);

    return {
      id: encrypted.id,
      created_at: encrypted.created_at,
      updated_at: encrypted.updated_at,
      user_id: encrypted.user_id,
      is_default: encrypted.is_default,
      ...decryptedData,
    };
  }

  private decryptCalendarEvent(encrypted: CalendarEventEncrypted): CalendarEventDecrypted {
    const decryptedData = this.decryptItemData<{
      title: string;
      description?: string;
      location?: string;
      start_time: string;
      end_time: string;
      all_day: boolean;
      calendar_id: string;
      recurrence_rule?: string;
      recurrence_exception?: string[];
    }>(encrypted);

    return {
      id: encrypted.id,
      created_at: encrypted.created_at,
      updated_at: encrypted.updated_at,
      user_id: encrypted.user_id,
      ...decryptedData,
    };
  }

  // Can-do list methods implementation
  canDoList = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CanDoItemDecrypted>> => {
      const response = await this.backend.canDoList.getAll(options);
      return {
        ...response,
        data: response.data.map(item => this.decryptCanDoItem(item)),
      };
    },

    getById: async (id: string): Promise<ApiResponse<CanDoItemDecrypted>> => {
      const response = await this.backend.canDoList.getById(id);
      return {
        ...response,
        data: response.data ? this.decryptCanDoItem(response.data) : null,
      };
    },

    create: async (request: CreateCanDoItemDecryptedRequest): Promise<ApiResponse<CanDoItemDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptItemData({
        content: request.content,
        completed: request.completed ?? false,
        due_date: request.due_date,
        impact: request.impact,
        urgency: request.urgency,
        tags: request.tags,
        duration_minutes: request.duration_minutes,
      });

      const encryptedRequest: CreateCanDoItemRequest = {
        project_id: request.project_id,
        display_order: request.display_order ?? 0,
        encrypted_data,
        iv,
        salt,
      };

      const response = await this.backend.canDoList.create(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCanDoItem(response.data) : null,
      };
    },

    update: async (request: UpdateCanDoItemDecryptedRequest): Promise<ApiResponse<CanDoItemDecrypted>> => {
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let salt: string | undefined;

      // Only encrypt if we have content to update
      if (request.content !== undefined || request.completed !== undefined || 
          request.due_date !== undefined || request.impact !== undefined || 
          request.urgency !== undefined || request.tags !== undefined || 
          request.duration_minutes !== undefined) {
        const encrypted = this.encryptItemData({
          content: request.content,
          completed: request.completed,
          due_date: request.due_date,
          impact: request.impact,
          urgency: request.urgency,
          tags: request.tags,
          duration_minutes: request.duration_minutes,
        });
        encryptedData = encrypted.encrypted_data;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const encryptedRequest: UpdateCanDoItemRequest = {
        id: request.id,
        project_id: request.project_id,
        display_order: request.display_order,
        encrypted_data: encryptedData,
        iv,
        salt,
      };

      const response = await this.backend.canDoList.update(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCanDoItem(response.data) : null,
      };
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      return this.backend.canDoList.delete(id);
    },
  };

  // Project methods implementation
  projects = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<ProjectDecrypted>> => {
      const response = await this.backend.projects.getAll(options);
      return {
        ...response,
        data: response.data.map(item => this.decryptProject(item)),
      };
    },

    getById: async (id: string): Promise<ApiResponse<ProjectDecrypted>> => {
      const response = await this.backend.projects.getById(id);
      return {
        ...response,
        data: response.data ? this.decryptProject(response.data) : null,
      };
    },

    create: async (request: CreateProjectDecryptedRequest): Promise<ApiResponse<ProjectDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptItemData({
        name: request.name,
        description: request.description,
        color: request.color,
      });

      const encryptedRequest: CreateProjectRequest = {
        parent_id: request.parent_id,
        order: request.order ?? 0,
        collapsed: request.collapsed ?? false,
        encrypted_data,
        iv,
        salt,
      };

      const response = await this.backend.projects.create(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptProject(response.data) : null,
      };
    },

    update: async (request: UpdateProjectDecryptedRequest): Promise<ApiResponse<ProjectDecrypted>> => {
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let salt: string | undefined;

      // Only encrypt if we have content to update
      if (request.name !== undefined || request.description !== undefined || request.color !== undefined) {
        const encrypted = this.encryptItemData({
          name: request.name,
          description: request.description,
          color: request.color,
        });
        encryptedData = encrypted.encrypted_data;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const encryptedRequest: UpdateProjectRequest = {
        id: request.id,
        parent_id: request.parent_id,
        order: request.order,
        collapsed: request.collapsed,
        encrypted_data: encryptedData,
        iv,
        salt,
      };

      const response = await this.backend.projects.update(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptProject(response.data) : null,
      };
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      return this.backend.projects.delete(id);
    },
  };

  // Calendar methods implementation
  calendars = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CalendarDecrypted>> => {
      const response = await this.backend.calendars.getAll(options);
      return {
        ...response,
        data: response.data.map(item => this.decryptCalendar(item)),
      };
    },

    getById: async (id: string): Promise<ApiResponse<CalendarDecrypted>> => {
      const response = await this.backend.calendars.getById(id);
      return {
        ...response,
        data: response.data ? this.decryptCalendar(response.data) : null,
      };
    },

    create: async (request: CreateCalendarDecryptedRequest): Promise<ApiResponse<CalendarDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptItemData({
        name: request.name,
        color: request.color,
        is_visible: request.is_visible ?? true,
        type: request.type ?? 'regular',
        ics_url: request.ics_url,
      });

      const encryptedRequest: CreateCalendarRequest = {
        is_default: request.is_default,
        encrypted_data,
        iv,
        salt,
      };

      const response = await this.backend.calendars.create(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCalendar(response.data) : null,
      };
    },

    update: async (request: UpdateCalendarDecryptedRequest): Promise<ApiResponse<CalendarDecrypted>> => {
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let salt: string | undefined;

      // Only encrypt if we have content to update
      if (request.name !== undefined || request.color !== undefined || 
          request.is_visible !== undefined || request.type !== undefined || request.ics_url !== undefined) {
        const encrypted = this.encryptItemData({
          name: request.name,
          color: request.color,
          is_visible: request.is_visible,
          type: request.type,
          ics_url: request.ics_url,
        });
        encryptedData = encrypted.encrypted_data;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const encryptedRequest: UpdateCalendarRequest = {
        id: request.id,
        is_default: request.is_default,
        encrypted_data: encryptedData,
        iv,
        salt,
      };

      const response = await this.backend.calendars.update(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCalendar(response.data) : null,
      };
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      return this.backend.calendars.delete(id);
    },
  };

  // Calendar event methods implementation
  calendarEvents = {
    getAll: async (options?: QueryOptions): Promise<PaginatedResponse<CalendarEventDecrypted>> => {
      const response = await this.backend.calendarEvents.getAll(options);
      return {
        ...response,
        data: response.data.map(item => this.decryptCalendarEvent(item)),
      };
    },

    getByDateRange: async (
      startDate: string,
      endDate: string,
      calendarIds?: string[]
    ): Promise<PaginatedResponse<CalendarEventDecrypted>> => {
      const response = await this.backend.calendarEvents.getByDateRange(startDate, endDate, calendarIds);
      return {
        ...response,
        data: response.data.map(item => this.decryptCalendarEvent(item)),
      };
    },

    getById: async (id: string): Promise<ApiResponse<CalendarEventDecrypted>> => {
      const response = await this.backend.calendarEvents.getById(id);
      return {
        ...response,
        data: response.data ? this.decryptCalendarEvent(response.data) : null,
      };
    },

    create: async (request: CreateCalendarEventDecryptedRequest): Promise<ApiResponse<CalendarEventDecrypted>> => {
      const { encrypted_data, iv, salt } = this.encryptItemData({
        title: request.title,
        description: request.description,
        location: request.location,
        start_time: request.start_time,
        end_time: request.end_time,
        all_day: request.all_day ?? false,
        calendar_id: request.calendar_id,
        recurrence_rule: request.recurrence_rule,
      });

      const encryptedRequest: CreateCalendarEventRequest = {
        encrypted_data,
        iv,
        salt,
      };

      const response = await this.backend.calendarEvents.create(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCalendarEvent(response.data) : null,
      };
    },

    update: async (request: UpdateCalendarEventDecryptedRequest): Promise<ApiResponse<CalendarEventDecrypted>> => {
      let encryptedData: string | undefined;
      let iv: string | undefined;
      let salt: string | undefined;

      // Only encrypt if we have content to update
      if (request.title !== undefined || request.description !== undefined || 
          request.location !== undefined || request.start_time !== undefined ||
          request.end_time !== undefined || request.all_day !== undefined ||
          request.calendar_id !== undefined || request.recurrence_rule !== undefined ||
          request.recurrence_exception !== undefined) {
        const encrypted = this.encryptItemData({
          title: request.title,
          description: request.description,
          location: request.location,
          start_time: request.start_time,
          end_time: request.end_time,
          all_day: request.all_day,
          calendar_id: request.calendar_id,
          recurrence_rule: request.recurrence_rule,
          recurrence_exception: request.recurrence_exception,
        });
        encryptedData = encrypted.encrypted_data;
        iv = encrypted.iv;
        salt = encrypted.salt;
      }

      const encryptedRequest: UpdateCalendarEventRequest = {
        id: request.id,
        encrypted_data: encryptedData,
        iv,
        salt,
      };

      const response = await this.backend.calendarEvents.update(encryptedRequest);
      return {
        ...response,
        data: response.data ? this.decryptCalendarEvent(response.data) : null,
      };
    },

    delete: async (id: string): Promise<{ error: string | null }> => {
      return this.backend.calendarEvents.delete(id);
    },
  };
}
