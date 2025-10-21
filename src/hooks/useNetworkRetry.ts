/**
 * Network Retry Hook
 * Monitors network state and retries queued messages when online
 * Should be used once at app level (in authenticated layout)
 */

import { getQueuedMessages, retryFailedMessage } from '@/services/message.service';
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';

export function useNetworkRetry() {
  useEffect(() => {
    let isRetrying = false;

    const unsubscribe = NetInfo.addEventListener(async (state) => {
      // Only retry if we're online and not already retrying
      if (state.isConnected && state.isInternetReachable && !isRetrying) {
        console.log('🌐 Network connected - checking for queued messages...');
        isRetrying = true;

        try {
          // Get all queued/failed messages
          const queuedMessages = await getQueuedMessages();
          
          if (queuedMessages.length > 0) {
            console.log(`📤 Retrying ${queuedMessages.length} queued messages...`);
            
            // Retry each message with a small delay between retries
            for (const message of queuedMessages) {
              try {
                await retryFailedMessage(message.id);
                console.log(`✅ Message ${message.id} retry successful`);
                
                // Small delay to avoid overwhelming Firestore
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (error) {
                console.error(`❌ Failed to retry message ${message.id}:`, error);
              }
            }
            
            console.log('✅ All queued messages processed');
            // Note: Firestore real-time listeners will update the UI automatically
          } else {
            console.log('✅ No queued messages to retry');
          }
        } catch (error) {
          console.error('❌ Error checking queued messages:', error);
        } finally {
          isRetrying = false;
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []); // Empty deps - set up once and leave running
}

