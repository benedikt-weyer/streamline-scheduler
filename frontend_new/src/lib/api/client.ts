interface ApiResponse<T> {
	data: T;
	message?: string;
}

export interface User {
	id: string;
	email: string;
	email_confirmed_at: string | null;
	created_at: string;
	updated_at: string;
	app_metadata: Record<string, any>;
	user_metadata: Record<string, any>;
}

export interface AuthResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	user: User;
}

export interface Session {
	access_token: string;
	expires_at: number;
	user: User;
}

export interface Project {
	id: string;
	user_id: string;
	encrypted_data: string;
	iv: string;
	salt: string;
	is_default: boolean;
	parent_id: string | null;
	display_order: number;
	is_collapsed: boolean;
	created_at: string;
	updated_at: string;
}

export interface CanDoItem {
	id: string;
	user_id: string;
	project_id: string | null;
	encrypted_data: string;
	iv: string;
	salt: string;
	display_order: number;
	created_at: string;
	updated_at: string;
}

export interface Calendar {
	id: string;
	user_id: string;
	encrypted_data: string;
	iv: string;
	salt: string;
	is_default: boolean;
	created_at: string;
	updated_at: string;
}

export interface CalendarEvent {
	id: string;
	user_id: string;
	encrypted_data: string;
	iv: string;
	salt: string;
	created_at: string;
	updated_at: string;
}

class ApiClient {
	private baseUrl: string;
	private accessToken: string | null = null;

	constructor() {
		this.baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
		
		// Try to load token from localStorage on client side
		if (typeof window !== 'undefined') {
			this.accessToken = localStorage.getItem('access_token');
		}
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<ApiResponse<T>> {
		const url = `${this.baseUrl}${endpoint}`;
		
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
			...options.headers,
		};

		if (this.accessToken) {
			headers.Authorization = `Bearer ${this.accessToken}`;
		}

		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`API Error: ${response.status} - ${errorText}`);
		}

		return response.json();
	}

	// Authentication methods
	async signUp(email: string, password: string): Promise<AuthResponse> {
		const response = await this.request<AuthResponse>('/api/auth/register', {
			method: 'POST',
			body: JSON.stringify({ email, password }),
		});
		
		this.setSession(response.data);
		return response.data;
	}

	async signIn(email: string, password: string): Promise<AuthResponse> {
		const response = await this.request<AuthResponse>('/api/auth/login', {
			method: 'POST',
			body: JSON.stringify({ email, password }),
		});
		
		this.setSession(response.data);
		return response.data;
	}

	async getUser(): Promise<User | null> {
		if (!this.accessToken) return null;

		try {
			const response = await this.request<User>('/api/auth/me');
			return response.data;
		} catch (error) {
			console.error('Error getting user:', error);
			this.signOut();
			return null;
		}
	}

	async getSession(): Promise<{ session: Session | null; error: Error | null }> {
		if (!this.accessToken) {
			return { session: null, error: null };
		}

		try {
			const user = await this.getUser();
			if (!user) {
				return { session: null, error: null };
			}

			// Parse JWT to get expiry (basic implementation)
			const tokenPayload = JSON.parse(atob(this.accessToken.split('.')[1]));
			const expiresAt = tokenPayload.exp * 1000; // Convert to milliseconds

			const session: Session = {
				access_token: this.accessToken,
				expires_at: expiresAt,
				user,
			};

			return { session, error: null };
		} catch (error) {
			return { session: null, error: error as Error };
		}
	}

	signOut(): void {
		this.accessToken = null;
		if (typeof window !== 'undefined') {
			localStorage.removeItem('access_token');
			localStorage.removeItem('user');
		}
	}

	private setSession(authResponse: AuthResponse): void {
		this.accessToken = authResponse.access_token;
		
		if (typeof window !== 'undefined') {
			localStorage.setItem('access_token', authResponse.access_token);
			localStorage.setItem('user', JSON.stringify(authResponse.user));
		}
	}

	// Project methods
	async getProjects(parentId?: string): Promise<Project[]> {
		const params = parentId ? `?parent_id=${parentId}` : '';
		const response = await this.request<Project[]>(`/api/projects${params}`);
		return response.data;
	}

	async createProject(data: {
		encrypted_data: string;
		iv: string;
		salt: string;
		parent_id?: string;
		display_order?: number;
		is_collapsed?: boolean;
	}): Promise<Project> {
		const response = await this.request<Project>('/api/projects', {
			method: 'POST',
			body: JSON.stringify(data),
		});
		return response.data;
	}

	async updateProject(id: string, data: any): Promise<Project> {
		const response = await this.request<Project>(`/api/projects/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		});
		return response.data;
	}

	async deleteProject(id: string): Promise<void> {
		await this.request(`/api/projects/${id}`, {
			method: 'DELETE',
		});
	}

	// Can-do list methods
	async getCanDoItems(projectId?: string): Promise<CanDoItem[]> {
		const params = projectId ? `?project_id=${projectId}` : '';
		const response = await this.request<CanDoItem[]>(`/api/can-do-list${params}`);
		return response.data;
	}

	async createCanDoItem(data: {
		encrypted_data: string;
		iv: string;
		salt: string;
		project_id?: string;
		display_order?: number;
	}): Promise<CanDoItem> {
		const response = await this.request<CanDoItem>('/api/can-do-list', {
			method: 'POST',
			body: JSON.stringify(data),
		});
		return response.data;
	}

	async updateCanDoItem(id: string, data: any): Promise<CanDoItem> {
		const response = await this.request<CanDoItem>(`/api/can-do-list/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		});
		return response.data;
	}

	async deleteCanDoItem(id: string): Promise<void> {
		await this.request(`/api/can-do-list/${id}`, {
			method: 'DELETE',
		});
	}

	// Calendar methods
	async getCalendars(): Promise<Calendar[]> {
		const response = await this.request<Calendar[]>('/api/calendars');
		return response.data;
	}

	async createCalendar(data: {
		encrypted_data: string;
		iv: string;
		salt: string;
	}): Promise<Calendar> {
		const response = await this.request<Calendar>('/api/calendars', {
			method: 'POST',
			body: JSON.stringify(data),
		});
		return response.data;
	}

	async updateCalendar(id: string, data: any): Promise<Calendar> {
		const response = await this.request<Calendar>(`/api/calendars/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		});
		return response.data;
	}

	async deleteCalendar(id: string): Promise<void> {
		await this.request(`/api/calendars/${id}`, {
			method: 'DELETE',
		});
	}

	// Calendar events methods
	async getCalendarEvents(): Promise<CalendarEvent[]> {
		const response = await this.request<CalendarEvent[]>('/api/calendar-events');
		return response.data;
	}

	async createCalendarEvent(data: {
		encrypted_data: string;
		iv: string;
		salt: string;
	}): Promise<CalendarEvent> {
		const response = await this.request<CalendarEvent>('/api/calendar-events', {
			method: 'POST',
			body: JSON.stringify(data),
		});
		return response.data;
	}

	async updateCalendarEvent(id: string, data: any): Promise<CalendarEvent> {
		const response = await this.request<CalendarEvent>(`/api/calendar-events/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		});
		return response.data;
	}

	async deleteCalendarEvent(id: string): Promise<void> {
		await this.request(`/api/calendar-events/${id}`, {
			method: 'DELETE',
		});
	}

	// WebSocket connection
	createWebSocketConnection(): WebSocket | null {
		if (typeof window === 'undefined' || !this.accessToken) return null;

		const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws';
		const ws = new WebSocket(wsUrl);

		ws.onopen = () => {
			// Send authentication token
			ws.send(JSON.stringify({
				token: this.accessToken,
			}));
		};

		return ws;
	}
}

// Export a singleton instance
export const apiClient = new ApiClient();
