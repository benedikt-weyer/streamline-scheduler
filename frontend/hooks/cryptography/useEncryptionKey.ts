import { useState, useEffect } from 'react';
import { hashPassword } from '@/utils/cryptography/encryption';
import { createClient } from '@/utils/supabase/client';

export function useEncryptionKey() {
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadEncryptionKey() {
      setIsLoading(true);
      
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          // Get the user's email which is used as the base for the encryption key
          const userEmail = session.user.email;
          
          if (userEmail) {
            // Generate a key based on the user's email
            const key = hashPassword(userEmail);
            setEncryptionKey(key);
          }
        }
      } catch (error) {
        console.error('Error getting encryption key:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadEncryptionKey();
  }, []);

  return { encryptionKey, isLoading };
}
