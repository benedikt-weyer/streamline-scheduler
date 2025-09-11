import { writable } from 'svelte/store';
import type { Project, CanDoItem, Calendar, CalendarEvent } from '$lib/api/client';
import { apiClient } from '$lib/api/client';
import { decryptDataWithStoredKey, getEncryptionKey } from '$lib/crypto/encryption';

export interface AppState {
	projects: Project[];
	canDoItems: CanDoItem[];
	calendars: Calendar[];
	calendarEvents: CalendarEvent[];
	isLoading: boolean;
	error: string | null;
	encryptionKey: string | null;
	wsConnection: WebSocket | null;
}

// Decrypted data interfaces
export interface DecryptedProject {
	id: string;
	name: string;
	color: string;
	description?: string;
	parent_id: string | null;
	display_order: number;
	is_collapsed: boolean;
	is_default: boolean;
	created_at: string;
	updated_at: string;
}

export interface DecryptedCanDoItem {
	id: string;
	title: string;
	completed: boolean;
	priority: 'low' | 'medium' | 'high';
	due_date?: string;
	description?: string;
	project_id: string | null;
	display_order: number;
	created_at: string;
	updated_at: string;
}

export interface DecryptedCalendar {
	id: string;
	name: string;
	color: string;
	description?: string;
	is_default: boolean;
	created_at: string;
	updated_at: string;
}

export interface DecryptedCalendarEvent {
	id: string;
	title: string;
	description?: string;
	start_time: string;
	end_time: string;
	all_day: boolean;
	calendar_id?: string;
	created_at: string;
	updated_at: string;
}

function createDataStore() {
	const { subscribe, set, update } = writable<AppState>({
		projects: [],
		canDoItems: [],
		calendars: [],
		calendarEvents: [],
		isLoading: false,
		error: null,
		encryptionKey: null,
		wsConnection: null,
	});

	let currentEncryptionKey: string | null = null;

	// Helper function to decrypt data
	function decryptItem<T>(
		item: { encrypted_data: string; iv: string; salt: string },
		defaultValue: T
	): T {
		// Use the stored encryption key from localStorage
		const encryptionKey = getEncryptionKey();
		if (!encryptionKey) {
			console.warn('No encryption key available for decryption');
			return defaultValue;
		}
		
		try {
			const decryptedJson = decryptDataWithStoredKey(
				item.encrypted_data,
				item.iv,
				item.salt
			);
			
			if (!decryptedJson) {
				console.error('Decryption returned null');
				return defaultValue;
			}
			
			return JSON.parse(decryptedJson);
		} catch (error) {
			console.error('Decryption failed:', error, {
				hasKey: !!encryptionKey,
				dataLength: item.encrypted_data?.length,
				ivLength: item.iv?.length,
				saltLength: item.salt?.length
			});
			return defaultValue;
		}
	}

	// WebSocket message handler
	function handleWebSocketMessage(event: MessageEvent) {
		try {
			const message = JSON.parse(event.data);
			
			if (message.type === 'auth_success') {
				console.log('WebSocket authenticated successfully');
				return;
			}
			
			if (message.type === 'auth_error') {
				console.error('WebSocket authentication failed');
				return;
			}
			
			// Handle real-time updates
			if (message.event_type && message.table) {
				update(state => {
					const newState = { ...state };
					
					switch (message.table) {
						case 'projects':
							if (message.event_type === 'INSERT') {
								newState.projects = [...newState.projects, message.data];
							} else if (message.event_type === 'UPDATE') {
								newState.projects = newState.projects.map(p => 
									p.id === message.record_id ? { ...p, ...message.data } : p
								);
							} else if (message.event_type === 'DELETE') {
								newState.projects = newState.projects.filter(p => p.id !== message.record_id);
							}
							break;
							
						case 'can_do_list':
							if (message.event_type === 'INSERT') {
								newState.canDoItems = [...newState.canDoItems, message.data];
							} else if (message.event_type === 'UPDATE') {
								newState.canDoItems = newState.canDoItems.map(item => 
									item.id === message.record_id ? { ...item, ...message.data } : item
								);
							} else if (message.event_type === 'DELETE') {
								newState.canDoItems = newState.canDoItems.filter(item => item.id !== message.record_id);
							}
							break;
							
						case 'calendars':
							if (message.event_type === 'INSERT') {
								newState.calendars = [...newState.calendars, message.data];
							} else if (message.event_type === 'UPDATE') {
								newState.calendars = newState.calendars.map(cal => 
									cal.id === message.record_id ? { ...cal, ...message.data } : cal
								);
							} else if (message.event_type === 'DELETE') {
								newState.calendars = newState.calendars.filter(cal => cal.id !== message.record_id);
							}
							break;
							
						case 'calendar_events':
							if (message.event_type === 'INSERT') {
								newState.calendarEvents = [...newState.calendarEvents, message.data];
							} else if (message.event_type === 'UPDATE') {
								newState.calendarEvents = newState.calendarEvents.map(event => 
									event.id === message.record_id ? { ...event, ...message.data } : event
								);
							} else if (message.event_type === 'DELETE') {
								newState.calendarEvents = newState.calendarEvents.filter(event => event.id !== message.record_id);
							}
							break;
					}
					
					return newState;
				});
			}
		} catch (error) {
			console.error('Error handling WebSocket message:', error);
		}
	}

	return {
		subscribe,
		
		setEncryptionKey(key: string) {
			currentEncryptionKey = key;
			update(state => ({ ...state, encryptionKey: key }));
		},
		
		async connectWebSocket() {
			update(state => {
				if (state.wsConnection) {
					state.wsConnection.close();
				}
				
				const ws = apiClient.createWebSocketConnection();
				if (ws) {
					ws.onmessage = handleWebSocketMessage;
					ws.onclose = () => {
						console.log('WebSocket connection closed');
						// Attempt to reconnect after 5 seconds
						setTimeout(() => this.connectWebSocket(), 5000);
					};
					ws.onerror = (error) => {
						console.error('WebSocket error:', error);
					};
				}
				
				return { ...state, wsConnection: ws };
			});
		},
		
		disconnectWebSocket() {
			update(state => {
				if (state.wsConnection) {
					state.wsConnection.close();
				}
				return { ...state, wsConnection: null };
			});
		},
		
		async loadAll() {
			update(state => ({ ...state, isLoading: true, error: null }));
			
			try {
				const [projects, canDoItems, calendars, calendarEvents] = await Promise.all([
					apiClient.getProjects(),
					apiClient.getCanDoItems(),
					apiClient.getCalendars(),
					apiClient.getCalendarEvents(),
				]);
				
				update(state => ({
					...state,
					projects,
					canDoItems,
					calendars,
					calendarEvents,
					isLoading: false,
					error: null
				}));
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Failed to load data';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));
				throw error;
			}
		},
		
		// Decrypt and return data
		getDecryptedProjects(): DecryptedProject[] {
			let projects: Project[] = [];
			update(state => {
				projects = state.projects;
				return state;
			});
			
			return projects.map(project => ({
				...decryptItem(project, { name: 'Untitled Project', color: '#3b82f6', description: '' }),
				id: project.id,
				parent_id: project.parent_id,
				display_order: project.display_order,
				is_collapsed: project.is_collapsed,
				is_default: project.is_default,
				created_at: project.created_at,
				updated_at: project.updated_at,
			}));
		},
		
		getDecryptedCanDoItems(): DecryptedCanDoItem[] {
			let canDoItems: CanDoItem[] = [];
			update(state => {
				canDoItems = state.canDoItems;
				return state;
			});
			
			return canDoItems.map(item => ({
				...decryptItem(item, { 
					title: 'Untitled Task', 
					completed: false, 
					priority: 'medium' as const,
					description: ''
				}),
				id: item.id,
				project_id: item.project_id,
				display_order: item.display_order,
				created_at: item.created_at,
				updated_at: item.updated_at,
			}));
		},
		
		getDecryptedCalendars(): DecryptedCalendar[] {
			let calendars: Calendar[] = [];
			update(state => {
				calendars = state.calendars;
				return state;
			});
			
			return calendars.map(calendar => ({
				...decryptItem(calendar, { name: 'Untitled Calendar', color: '#3b82f6', description: '' }),
				id: calendar.id,
				is_default: calendar.is_default,
				created_at: calendar.created_at,
				updated_at: calendar.updated_at,
			}));
		},
		
		getDecryptedCalendarEvents(): DecryptedCalendarEvent[] {
			let calendarEvents: CalendarEvent[] = [];
			update(state => {
				calendarEvents = state.calendarEvents;
				return state;
			});
			
			return calendarEvents.map(event => ({
				...decryptItem(event, { 
					title: 'Untitled Event', 
					description: '',
					start_time: new Date().toISOString(),
					end_time: new Date(Date.now() + 3600000).toISOString(),
					all_day: false
				}),
				id: event.id,
				created_at: event.created_at,
				updated_at: event.updated_at,
			}));
		},
		
		clearError() {
			update(state => ({ ...state, error: null }));
		}
	};
}

export const dataStore = createDataStore();
