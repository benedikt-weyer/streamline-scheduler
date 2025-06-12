import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';

/**
 * Hook for managing real-time subscriptions to can-do list changes
 */
export function useTaskSubscriptions(
  encryptionKey: string | null,
  taskLoadFn: (key: string) => Promise<void>
) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const skipNextTaskReloadRef = useRef<boolean>(false);

  useEffect(() => {
    if (!encryptionKey) {
      setIsSubscribed(false);
      return;
    }

    // Initialize Supabase client
    const supabase = createClient();
    
    // Subscribe to changes on the can_do_list table
    const subscription = supabase
      .channel('can_do_list_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'can_do_list' 
        }, 
        async (payload) => {
          // Skip reload if we're in the middle of a local update operation
          if (skipNextTaskReloadRef.current) {
            setTimeout(() => {
              skipNextTaskReloadRef.current = false;
            }, 500); // 500ms delay
            return;
          }
          
          // Reload tasks when a change is detected
          try {
            await taskLoadFn(encryptionKey);
          } catch (error) {
            console.error('Error reloading tasks after subscription update:', error);
          }
        }
      )
      .subscribe();

    setIsSubscribed(true);

    // Clean up the subscription when component unmounts or dependencies change
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
      setIsSubscribed(false);
    };
  }, [encryptionKey, taskLoadFn]);

  // Function to skip the next task reload (useful for local operations)
  const skipNextTaskReload = () => {
    skipNextTaskReloadRef.current = true;
  };

  return { isSubscribed, skipNextTaskReload };
}
