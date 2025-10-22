/**
 * Network Retry Hook
 * Monitors network state and retries queued messages with exponential backoff
 * Should be used once at app level (in authenticated layout)
 */

import { getQueuedMessages, retryFailedMessage } from '@/services/message.service';
import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';

// Check for messages to retry every 5 seconds
const RETRY_CHECK_INTERVAL = 5000;

export function useNetworkRetry() {
  useEffect(() => {
    let isRetrying = false;
    let retryIntervalId: ReturnType<typeof setInterval> | null = null;

    const processQueuedMessages = async () => {
      if (isRetrying) return;

      try {
        // Check if we're online
        const netState = await NetInfo.fetch();
        if (!netState.isConnected || !netState.isInternetReachable) {
          return; // Skip if offline
        }

        isRetrying = true;

        // Get all queued/failed messages
        const queuedMessages = await getQueuedMessages();

        if (queuedMessages.length > 0) {
          console.log(`📤 Checking ${queuedMessages.length} queued messages for retry...`);

          // Retry each message (respecting exponential backoff)
          for (const message of queuedMessages) {
            try {
              // retryFailedMessage will check if enough time has passed
              await retryFailedMessage(message.id);
              
              // Small delay to avoid overwhelming Firestore
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (error) {
              console.error(`❌ Failed to retry message ${message.id}:`, error);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error checking queued messages:', error);
      } finally {
        isRetrying = false;
      }
    };

    // Listen for network state changes (immediate retry when coming online)
    const unsubscribeNetwork = NetInfo.addEventListener(async (state) => {
      if (state.isConnected && state.isInternetReachable) {
        console.log('🌐 Network connected - checking for queued messages...');
        await processQueuedMessages();
      }
    });

    // Set up periodic retry check (respects exponential backoff)
    retryIntervalId = setInterval(processQueuedMessages, RETRY_CHECK_INTERVAL);

    // Initial check
    processQueuedMessages();

    return () => {
      unsubscribeNetwork();
      if (retryIntervalId) {
        clearInterval(retryIntervalId);
      }
    };
  }, []); // Empty deps - set up once and leave running
}

