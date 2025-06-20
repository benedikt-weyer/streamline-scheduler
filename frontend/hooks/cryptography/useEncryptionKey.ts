import { useState, useEffect } from 'react';
import { hashPassword } from '@/utils/cryptography/encryption';
import { createClientBrowser } from '@/utils/supabase/client';

export function useEncryptionKey() {
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('[useEncryptionKey] Hook initialized');
    console.log('[useEncryptionKey] Supabase config:', {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKeyPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    });
    const supabase = createClientBrowser();
    
    async function loadEncryptionKey() {
      console.log('[useEncryptionKey] Loading initial encryption key...');
      try {
        // Add a small delay to ensure cookies are properly hydrated
        console.log('[useEncryptionKey] Waiting for cookie hydration...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('[useEncryptionKey] Getting session from Supabase...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        console.log('[useEncryptionKey] Session data:', {
          session: session ? {
            userId: session.user.id,
            email: session.user.email,
            expiresAt: session.expires_at,
            accessToken: session.access_token ? 'present' : 'missing'
          } : null,
          error: error
        });
        
        // Also try getUser() as an alternative
        console.log('[useEncryptionKey] Also trying getUser() as alternative...');
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('[useEncryptionKey] User data:', {
          user: user ? {
            userId: user.id,
            email: user.email,
            createdAt: user.created_at
          } : null,
          userError: userError
        });
        
        // Also check if there are any stored auth tokens
        console.log('[useEncryptionKey] Checking localStorage for auth tokens...');
        const localStorageKeys = Object.keys(localStorage).filter(key => 
          key.includes('supabase') || key.includes('auth')
        );
        console.log('[useEncryptionKey] LocalStorage auth-related keys:', localStorageKeys);
        
        // Check cookies as well
        console.log('[useEncryptionKey] Checking document.cookie for auth tokens...');
        const cookies = document.cookie.split(';').map(c => c.trim()).filter(c => 
          c.includes('supabase') || c.includes('auth')
        );
        console.log('[useEncryptionKey] Auth-related cookies:', cookies.map(c => c.split('=')[0]));
        
        // Use session if available, otherwise try user
        const finalSession = session;
        const finalUser = session?.user || user;
        
        if (finalSession || finalUser) {
          const userId = finalUser?.id;
          const userEmail = finalUser?.email;
          console.log('[useEncryptionKey] Final user found - ID:', userId, 'Email:', userEmail ? 'present' : 'missing');
          
          if (userEmail) {
            // Generate a key based on the user's email
            console.log('[useEncryptionKey] Generating encryption key from email...');
            const key = hashPassword(userEmail);
            setEncryptionKey(key);
            console.log('[useEncryptionKey] Encryption key generated and set');
          } else {
            console.warn('[useEncryptionKey] No email found in session or user');
          }
        } else {
          // No session, clear the encryption key
          console.log('[useEncryptionKey] No session or user found, clearing encryption key');
          setEncryptionKey(null);
        }
      } catch (error) {
        console.error('[useEncryptionKey] Error getting encryption key:', error);
        setEncryptionKey(null);
      } finally {
        console.log('[useEncryptionKey] Initial loading complete, setting isLoading to false');
        setIsLoading(false);
      }
    }
    
    // Load initial encryption key
    loadEncryptionKey();

    // Listen for authentication state changes
    console.log('[useEncryptionKey] Setting up auth state change listener...');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[useEncryptionKey] Auth state changed:', event, session ? `session exists (user: ${session.user.id})` : 'no session');
        
        if (event === 'SIGNED_IN' && session) {
          // User signed in, generate encryption key
          console.log('[useEncryptionKey] SIGNED_IN event - generating encryption key');
          const userEmail = session.user.email;
          console.log('[useEncryptionKey] User email for SIGNED_IN:', userEmail ? 'present' : 'missing');
          if (userEmail) {
            const key = hashPassword(userEmail);
            setEncryptionKey(key);
            console.log('[useEncryptionKey] Encryption key set for user:', userEmail);
          } else {
            console.warn('[useEncryptionKey] No email found during SIGNED_IN');
          }
        } else if (event === 'SIGNED_OUT') {
          // User signed out, clear encryption key
          console.log('[useEncryptionKey] SIGNED_OUT event - clearing encryption key');
          setEncryptionKey(null);
          console.log('[useEncryptionKey] Encryption key cleared');
        } else if (event === 'INITIAL_SESSION') {
          // Initial session check - handle like a session state
          console.log('[useEncryptionKey] INITIAL_SESSION event - checking for existing session');
          if (session) {
            console.log('[useEncryptionKey] INITIAL_SESSION with session - generating encryption key');
            const userEmail = session.user.email;
            console.log('[useEncryptionKey] User email for INITIAL_SESSION:', userEmail ? 'present' : 'missing');
            if (userEmail) {
              const key = hashPassword(userEmail);
              setEncryptionKey(key);
              console.log('[useEncryptionKey] Encryption key set for user:', userEmail);
            } else {
              console.warn('[useEncryptionKey] No email found during INITIAL_SESSION');
            }
          } else {
            console.log('[useEncryptionKey] INITIAL_SESSION with no session - clearing encryption key');
            setEncryptionKey(null);
          }
        } else if (event === 'TOKEN_REFRESHED' && session) {
          // Token refreshed, ensure we still have the encryption key
          console.log('[useEncryptionKey] TOKEN_REFRESHED event - checking encryption key');
          const userEmail = session.user.email;
          console.log('[useEncryptionKey] Current encryptionKey state:', encryptionKey ? 'present' : 'null');
          console.log('[useEncryptionKey] User email for TOKEN_REFRESHED:', userEmail ? 'present' : 'missing');
          if (userEmail && !encryptionKey) {
            console.log('[useEncryptionKey] Restoring encryption key after token refresh');
            const key = hashPassword(userEmail);
            setEncryptionKey(key);
            console.log('[useEncryptionKey] Encryption key restored after token refresh:', userEmail);
          } else if (encryptionKey) {
            console.log('[useEncryptionKey] Encryption key already present, no action needed');
          }
        } else {
          console.log('[useEncryptionKey] Unhandled auth event:', event);
        }
        console.log('[useEncryptionKey] Setting isLoading to false after auth state change');
        setIsLoading(false);
      }
    );

    // Cleanup subscription on unmount
    return () => {
      console.log('[useEncryptionKey] Cleaning up auth state change subscription');
      subscription.unsubscribe();
      console.log('[useEncryptionKey] Hook cleanup complete');
    };
  }, [encryptionKey]); // Add encryptionKey as dependency for TOKEN_REFRESHED handling

  console.log('[useEncryptionKey] Returning state - encryptionKey:', encryptionKey ? 'present' : 'null', ', isLoading:', isLoading);
  return { encryptionKey, isLoading };
}
