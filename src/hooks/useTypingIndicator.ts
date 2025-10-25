/**
 * Typing Indicator Hook
 * Manages typing status with debouncing and auto-clear using RTDB
 */

import { clearUserTyping, setUserTyping } from '@/services/typing-rtdb.service';
import { useCallback, useEffect, useRef } from 'react';

// Typing status cleared after 1 second of inactivity
const TYPING_TIMEOUT = 1000;

// Debounce updates to RTDB (don't update more than once every 1 second)
const TYPING_DEBOUNCE = 1000;

/**
 * Hook to manage typing status for current user
 * 
 * Usage:
 * const { onTypingStart } = useTypingIndicator(chatId, userId);
 * <TextInput onChangeText={onTypingStart} />
 */
export function useTypingIndicator(chatId: string | null, userId: string | null) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingUpdateRef = useRef<number>(0);
  const isTypingRef = useRef<boolean>(false);

  /**
   * Clear the typing timeout
   */
  const clearTypingTimeout = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, []);

  /**
   * Set typing status and schedule auto-clear
   */
  const setTypingStatus = useCallback(async () => {
    if (!chatId || !userId) return;

    // Debounce: Don't update RTDB too frequently
    const now = Date.now();
    const timeSinceLastUpdate = now - lastTypingUpdateRef.current;

    if (timeSinceLastUpdate < TYPING_DEBOUNCE && isTypingRef.current) {
      // Already typing and updated recently, just reset the timeout
      clearTypingTimeout();
      
      typingTimeoutRef.current = setTimeout(async () => {
        await clearUserTyping(chatId, userId);
        isTypingRef.current = false;
      }, TYPING_TIMEOUT);
      
      return;
    }

    // Update RTDB (with auto-disconnect configured)
    await setUserTyping(chatId, userId);
    isTypingRef.current = true;
    lastTypingUpdateRef.current = now;

    // Clear existing timeout
    clearTypingTimeout();

    // Set new timeout to clear typing status after inactivity
    typingTimeoutRef.current = setTimeout(async () => {
      await clearUserTyping(chatId, userId);
      isTypingRef.current = false;
    }, TYPING_TIMEOUT);
  }, [chatId, userId, clearTypingTimeout]);

  /**
   * Handle typing start (call this on TextInput change)
   */
  const onTypingStart = useCallback(() => {
    setTypingStatus();
  }, [setTypingStatus]);

  /**
   * Manually clear typing status
   */
  const clearTyping = useCallback(async () => {
    if (!chatId || !userId) return;

    clearTypingTimeout();
    
    if (isTypingRef.current) {
      await clearUserTyping(chatId, userId);
      isTypingRef.current = false;
    }
  }, [chatId, userId, clearTypingTimeout]);

  // Cleanup on unmount or when chat/user changes
  useEffect(() => {
    return () => {
      clearTypingTimeout();
      
      // Clear typing status when leaving chat
      if (chatId && userId && isTypingRef.current) {
        clearUserTyping(chatId, userId);
        isTypingRef.current = false;
      }
    };
  }, [chatId, userId, clearTypingTimeout]);

  return {
    onTypingStart,
    clearTyping,
  };
}

