import { useState, useEffect, useRef } from 'react';
import { getBackend } from '@/utils/api/backend-interface';

/**
 * Hook for managing real-time subscriptions to can-do list changes
 */
export function useTaskSubscriptions(
  encryptionKey: string | null,
  taskLoadFn: () => Promise<void>
) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const skipNextTaskReloadRef = useRef<boolean>(false);

  useEffect(() => {
    if (!encryptionKey) {
      setIsSubscribed(false);
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const setupSubscription = async () => {
      try {
        const backend = getBackend();
        
        // Subscribe to changes on the can_do_list table
        const subscription = backend.canDoList.subscribe(async (message) => {
          // Skip reload if we're in the middle of a local update operation
          if (skipNextTaskReloadRef.current) {
            setTimeout(() => {
              skipNextTaskReloadRef.current = false;
            }, 500); // 500ms delay
            return;
          }
          
          // Reload tasks when a change is detected
          try {
            await taskLoadFn();
          } catch (error) {
            console.error('Error reloading tasks after subscription update:', error);
          }
        });

        // Store the unsubscribe function
        unsubscribe = subscription.unsubscribe;
        setIsSubscribed(true);
      } catch (error) {
        console.error('Failed to setup WebSocket subscription:', error);
        setIsSubscribed(false);
      }
    };

    setupSubscription();

    // Clean up the subscription when component unmounts or dependencies change
    return () => {
      if (unsubscribe) {
        unsubscribe();
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
