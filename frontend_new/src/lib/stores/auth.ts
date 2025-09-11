import { writable } from 'svelte/store';
import type { User, Session } from '$lib/api/client';
import { apiClient } from '$lib/api/client';

export interface AuthState {
	user: User | null;
	session: Session | null;
	isLoading: boolean;
	error: string | null;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		session: null,
		isLoading: true,
		error: null,
	});

	return {
		subscribe,
		
		async initialize() {
			update(state => ({ ...state, isLoading: true, error: null }));
			
			try {
				const { session, error } = await apiClient.getSession();
				
				if (error) {
					update(state => ({ ...state, isLoading: false, error: error.message }));
					return;
				}
				
				update(state => ({
					...state,
					user: session?.user || null,
					session,
					isLoading: false,
					error: null
				}));
			} catch (error) {
				console.error('Auth initialization error:', error);
				update(state => ({
					...state,
					isLoading: false,
					error: error instanceof Error ? error.message : 'Authentication failed'
				}));
			}
		},
		
		async signIn(email: string, password: string) {
			update(state => ({ ...state, isLoading: true, error: null }));
			
			try {
				const authResponse = await apiClient.signIn(email, password);
				
				const session: Session = {
					access_token: authResponse.access_token,
					expires_at: Date.now() + (authResponse.expires_in * 1000),
					user: authResponse.user
				};
				
				update(state => ({
					...state,
					user: authResponse.user,
					session,
					isLoading: false,
					error: null
				}));
				
				return authResponse;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Sign in failed';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));
				throw error;
			}
		},
		
		async signUp(email: string, password: string) {
			update(state => ({ ...state, isLoading: true, error: null }));
			
			try {
				const authResponse = await apiClient.signUp(email, password);
				
				const session: Session = {
					access_token: authResponse.access_token,
					expires_at: Date.now() + (authResponse.expires_in * 1000),
					user: authResponse.user
				};
				
				update(state => ({
					...state,
					user: authResponse.user,
					session,
					isLoading: false,
					error: null
				}));
				
				return authResponse;
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Sign up failed';
				update(state => ({
					...state,
					isLoading: false,
					error: errorMessage
				}));
				throw error;
			}
		},
		
		signOut() {
			apiClient.signOut();
			set({
				user: null,
				session: null,
				isLoading: false,
				error: null
			});
		},
		
		clearError() {
			update(state => ({ ...state, error: null }));
		}
	};
}

export const authStore = createAuthStore();
