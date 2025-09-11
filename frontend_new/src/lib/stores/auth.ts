import { writable } from 'svelte/store';
import type { User, Session } from '$lib/api/client';
import { apiClient } from '$lib/api/client';
import { deriveAuthHash, deriveEncryptionKey } from '$lib/crypto/encryption';

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
				// Derive authentication hash for server authentication
				const authHash = deriveAuthHash(password, email);
				const authResponse = await apiClient.signIn(email, authHash);
				
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
		
		async signUp(email: string, authHash: string, encryptionKey: string) {
			update(state => ({ ...state, isLoading: true, error: null }));
			
			try {
				// Register with the authentication hash
				const authResponse = await apiClient.signUp(email, authHash);
				
				const session: Session = {
					access_token: authResponse.access_token,
					expires_at: Date.now() + (authResponse.expires_in * 1000),
					user: authResponse.user
				};
				
				// Store the encryption key locally for data encryption/decryption
				if (typeof window !== 'undefined') {
					localStorage.setItem('encryption_key', encryptionKey);
				}
				
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
			
			// Clear the encryption key from local storage
			if (typeof window !== 'undefined') {
				localStorage.removeItem('encryption_key');
			}
			
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
