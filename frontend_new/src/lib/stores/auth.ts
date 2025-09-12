import { writable } from 'svelte/store';
import type { User, Session } from '$lib/api/client';
import { apiClient } from '$lib/api/client';
import { deriveAuthHash, deriveEncryptionKey } from '$lib/crypto/encryption';

export interface AuthState {
	user: User | null;
	session: Session | null;
	isLoading: boolean;
	error: string | null;
	encryptionKey: string | null;
}

function createAuthStore() {
	const { subscribe, set, update } = writable<AuthState>({
		user: null,
		session: null,
		isLoading: true,
		error: null,
		encryptionKey: null,
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

				// Get encryption key from localStorage if available
				const encryptionKey = typeof window !== 'undefined' ? localStorage.getItem('encryption_key') : null;
				
				update(state => ({
					...state,
					user: session?.user || null,
					session,
					encryptionKey,
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
				// Send raw password to backend - it handles hashing internally
				const authResponse = await apiClient.signIn(email, password);
				
				// Derive and store encryption key for client-side data encryption
				const encryptionKey = deriveEncryptionKey(password, email);
				if (typeof window !== 'undefined') {
					localStorage.setItem('encryption_key', encryptionKey);
				}
				
				const session: Session = {
					access_token: authResponse.access_token,
					expires_at: Date.now() + (authResponse.expires_in * 1000),
					user: authResponse.user
				};
				
				update(state => ({
					...state,
					user: authResponse.user,
					session,
					encryptionKey,
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
				// Send raw password to backend - it handles hashing internally
				const authResponse = await apiClient.signUp(email, password);
				
				// Derive and store encryption key for client-side data encryption
				const encryptionKey = deriveEncryptionKey(password, email);
				if (typeof window !== 'undefined') {
					localStorage.setItem('encryption_key', encryptionKey);
				}
				
				const session: Session = {
					access_token: authResponse.access_token,
					expires_at: Date.now() + (authResponse.expires_in * 1000),
					user: authResponse.user
				};
				
				update(state => ({
					...state,
					user: authResponse.user,
					session,
					encryptionKey,
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
			
			// Clear the encryption key from local storage
			if (typeof window !== 'undefined') {
				localStorage.removeItem('encryption_key');
			}
			
			set({
				user: null,
				session: null,
				isLoading: false,
				error: null,
				encryptionKey: null
			});
		},
		
		clearError() {
			update(state => ({ ...state, error: null }));
		}
	};
}

export const authStore = createAuthStore();
