/**
 * Chat Conversation Screen
 * Real-time messaging interface with message list and input
 */

import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { useActivity } from '@/contexts/ActivityContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useProfileCache } from '@/contexts/ProfileCacheContext';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { getChatFromSQLite, onChatMessagesSnapshot } from '@/services/chat.service';
import {
  getMessagesFromSQLite,
  markMessageAsDelivered,
  sendMessageOptimistic,
  syncMessageToSQLite,
} from '@/services/message.service';
import { onUsersPresenceChange } from '@/services/presence.service';
import { onTypingStatusChange } from '@/services/typing-rtdb.service';
import { onUsersProfilesSnapshot } from '@/services/user.service';
import type { Chat, Message, MessageStatus } from '@/types/chat.types';
import type { PublicUserProfile } from '@/types/user.types';
import Screen from '../../../components/Screen';

// Memoized Message Item Component for performance
const MessageItem = React.memo(({ 
  message, 
  isSent, 
  sender, 
  currentStatus,
  isGroupChat,
}: { 
  message: Message; 
  isSent: boolean; 
  sender?: PublicUserProfile;
  currentStatus: MessageStatus;
  isGroupChat: boolean;
}) => {
  return (
    <View style={[styles.messageContainer, isSent ? styles.sentContainer : styles.receivedContainer]}>
      {/* Avatar for received messages in groups */}
      {!isSent && isGroupChat && (
        <View style={styles.avatar}>
          {sender?.avatarLocalPath ? (
            <Image 
              source={{ uri: sender.avatarLocalPath }} 
              style={styles.avatarImage} 
            />
          ) : sender?.avatarUrl ? (
            <Image source={{ uri: sender.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {sender?.displayName?.charAt(0).toUpperCase() || '?'}
            </Text>
          )}
        </View>
      )}

      <View style={{ flex: 1 }}>
        {/* Sender name for received messages */}
        {!isSent && (
          <Text style={styles.senderName}>
            {sender?.displayName || 'Unknown'}
          </Text>
        )}

        {/* Message bubble */}
        <View style={[styles.messageBubble, isSent ? styles.sentBubble : styles.receivedBubble]}>
          <Text style={[styles.messageText, isSent ? styles.sentText : styles.receivedText]}>
            {message.text}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.timestamp, isSent ? styles.sentTimestamp : styles.receivedTimestamp]}>
              {new Date(message.createdAt).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
            {/* Status indicators for sent messages */}
            {isSent && (
              <View style={styles.statusContainer}>
                {currentStatus === 'sending' && (
                  <IconSymbol name="clock" size={12} color="#999" style={styles.statusIcon} />
                )}
                {currentStatus === 'sent' && (
                  <IconSymbol name="checkmark" size={12} color="#999" style={styles.statusIcon} />
                )}
                {currentStatus === 'delivered' && (
                  <View style={styles.doubleCheck}>
                    <IconSymbol name="checkmark" size={12} color="#999" style={styles.statusIcon} />
                    <IconSymbol name="checkmark" size={12} color="#999" style={styles.statusIcon} />
                  </View>
                )}
                {currentStatus === 'failed' && (
                  <IconSymbol name="exclamationmark.circle" size={12} color="#ff3b30" style={styles.statusIcon} />
                )}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.text === nextProps.message.text &&
    prevProps.currentStatus === nextProps.currentStatus &&
    prevProps.isSent === nextProps.isSent &&
    prevProps.sender?.id === nextProps.sender?.id &&
    prevProps.sender?.avatarLocalPath === nextProps.sender?.avatarLocalPath &&
    prevProps.sender?.displayName === nextProps.sender?.displayName &&
    prevProps.isGroupChat === nextProps.isGroupChat
  );
});

MessageItem.displayName = 'MessageItem';

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user } = useAuth();
  const { resetActivityTimer } = useActivity();
  const { setActiveChatId } = useNotifications();
  const { getProfiles, cacheProfile, getCachedProfile } = useProfileCache();
  const { onTypingStart, clearTyping } = useTypingIndicator(chatId || null, user?.uid || null);
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Record<string, PublicUserProfile>>({});
  const [presenceData, setPresenceData] = useState<Record<string, { status: 'online' | 'offline' | 'away'; lastSeen: number }>>({});
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  
  const flatListRef = useRef<FlatList>(null);
  
  // Track message statuses for optimistic UI
  const [messageStatuses, setMessageStatuses] = useState<Record<string, MessageStatus>>({});
  
  // Track which messages we've already processed to avoid re-syncing
  const processedMessagesRef = useRef<Map<string, string>>(new Map()); // messageId -> status hash
  
  // Track if this is the first load to prevent animated scroll on open
  const isFirstLoadRef = useRef(true);

  // Register this chat as active (suppress notifications for this chat)
  useEffect(() => {
    if (chatId) {
      console.log('📍 Registering active chat:', chatId);
      setActiveChatId(chatId);
      
      return () => {
        console.log('📍 Unregistering active chat:', chatId);
        setActiveChatId(null);
      };
    }
  }, [chatId, setActiveChatId]);

  // Load chat data and messages (SQLite + Firestore)
  useEffect(() => {
    if (!chatId || !user) {
      setLoading(false);
      return;
    }

    // Reset first load flag when chat changes
    isFirstLoadRef.current = true;

    let unsubscribeMessages: (() => void) | undefined;
    let messagesFromSQLite: Message[] = [];
    let messagesFromFirestore: Message[] = [];

    const loadChat = async () => {
      try {
        setLoading(true);

        // 1. Load chat metadata from SQLite FIRST (instant, no network)
        const chatDataFromSQLite = await getChatFromSQLite(chatId);
        if (chatDataFromSQLite) {
          setChat(chatDataFromSQLite);
          console.log('💾 Chat loaded from SQLite (instant)');
          
          // Pre-load participant profiles immediately
          const participantIds = chatDataFromSQLite.participantIds.filter(id => id !== user.uid);
          if (participantIds.length > 0) {
            getProfiles(participantIds).then(profiles => {
              console.log('👤 Initial profiles loaded:', profiles);
              Object.entries(profiles).forEach(([id, profile]) => {
                console.log(`  - ${profile.displayName}: avatarUrl=${!!profile.avatarUrl}, avatarLocalPath=${!!profile.avatarLocalPath}`);
              });
              setParticipants(profiles);
            });
          }
        }

        // 2. Load messages from SQLite (instant load - no network)
        // Only load first 20 messages initially for fast rendering
        messagesFromSQLite = await getMessagesFromSQLite(chatId);
        const recentMessages = messagesFromSQLite.slice(-20); // Last 20 messages
        setMessages(recentMessages);
        setLoading(false); // Stop showing spinner immediately
        
        console.log(`💾 Loaded ${recentMessages.length} messages from SQLite (${messagesFromSQLite.length} total available)`);
        
        // Pre-populate processedMessagesRef with existing SQLite messages
        // This prevents re-syncing messages we already have
        messagesFromSQLite.forEach(msg => {
          const messageHash = `${msg.id}-${msg.status}`;
          processedMessagesRef.current.set(msg.id, messageHash);
        });
        console.log(`✅ Marked ${messagesFromSQLite.length} existing messages as processed`);

        // 3. If no chat data in SQLite, we'll just show empty state
        // The background sync will populate it eventually
        if (!chatDataFromSQLite) {
          console.log('⚠️ No local chat data - will be synced by background sync');
        }

        // 4. Set up Firestore listener for real-time updates (background, non-blocking)
        // This ONLY listens for new messages, doesn't fetch existing ones
        console.log('🔄 Setting up Firestore listener for real-time updates...');
        unsubscribeMessages = onChatMessagesSnapshot(chatId, async (firestoreMessages) => {
          messagesFromFirestore = firestoreMessages;
          
          // Track how many messages are actually new or updated
          let newOrUpdatedCount = 0;
          
          // Sync Firestore messages to SQLite and mark as delivered
          // Only process messages that are new or have changed status
          for (const message of firestoreMessages) {
            const messageHash = `${message.id}-${message.status}`;
            const previousHash = processedMessagesRef.current.get(message.id);
            
            // Only sync if message is new or status has changed
            if (previousHash !== messageHash) {
              newOrUpdatedCount++;
              await syncMessageToSQLite(message);
              processedMessagesRef.current.set(message.id, messageHash);
              
              // Update messageStatuses for UI updates (fixes real-time status display)
              setMessageStatuses(prev => ({
                ...prev,
                [message.id]: message.status
              }));
              
              // Mark messages as delivered if:
              // - Message status is 'sent' (not already delivered)
              // - Current user is NOT the sender (recipient receiving the message)
              // - We haven't already marked it (check previous status)
              if (message.status === 'sent' && message.senderId !== user.uid && !previousHash?.includes('-delivered')) {
                console.log(`📬 Marking message ${message.id} as delivered`);
                await markMessageAsDelivered(chatId, message.id, user.uid, message.senderId);
              }
            }
          }
          
          // Only log if there were actual changes
          if (newOrUpdatedCount > 0) {
            console.log(`📱 Synced ${newOrUpdatedCount} new/updated messages (${firestoreMessages.length} total)`);
          }
          
          // Merge messages: Use Map to deduplicate by ID
          const messageMap = new Map<string, Message>();
          
          // Add SQLite messages first
          messagesFromSQLite.forEach(msg => messageMap.set(msg.id, msg));
          
          // Override with Firestore messages (they're the source of truth)
          firestoreMessages.forEach(msg => messageMap.set(msg.id, msg));
          
          // Convert to array and sort by createdAt
          const mergedMessages = Array.from(messageMap.values()).sort(
            (a, b) => a.createdAt - b.createdAt
          );
          
          setMessages(mergedMessages);
          
          // Mark first load complete after Firestore sync
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
          }
        });
      } catch (error) {
        console.error('Error loading chat:', error);
        setLoading(false);
      }
    };

    loadChat();

    // Cleanup
    return () => {
      if (unsubscribeMessages) {
        unsubscribeMessages();
      }
    };
  }, [chatId, user]);

  // Set up real-time profile listener (profiles are already pre-loaded above)
  useEffect(() => {
    if (!chatId || !user || !chat) return;

    const participantIds = chat.participantIds.filter(id => id !== user.uid);
    if (participantIds.length === 0) return;

    console.log(`📡 Setting up real-time profile listener`);

    // Set up real-time listener for profile updates (avatar changes, name changes, etc.)
    const unsubscribe = onUsersProfilesSnapshot(participantIds, async (profilesMap) => {
      // Only update if we got data (don't clear cached profiles on network failure)
      if (Object.keys(profilesMap).length === 0) {
        console.log('⚠️ Firestore returned empty profiles (likely offline), keeping cached data');
        return;
      }
      
      console.log('🔄 Participant profiles updated from Firestore:', Object.keys(profilesMap).length);
      
      // Convert to PublicUserProfile format and cache to SQLite
      const publicProfilesMap: Record<string, PublicUserProfile> = {};
      
      // Cache all profiles and wait for completion
      for (const [id, profile] of Object.entries(profilesMap)) {
        const publicProfile: PublicUserProfile = {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          presence: 'offline', // Will be updated by RTDB listener
          lastSeen: profile.lastSeen,
        };
        
        try {
          // Cache profile to SQLite (this downloads images and updates L1 cache)
          await cacheProfile(publicProfile);
          
          // Now get the cached version with the blob
          const cachedProfile = getCachedProfile(id);
          if (cachedProfile) {
            publicProfilesMap[id] = cachedProfile;
            console.log(`✅ Updated participant: ${cachedProfile.displayName}, hasLocalFile=${!!cachedProfile.avatarLocalPath}`);
          } else {
            // Fallback if cache read failed
            publicProfilesMap[id] = publicProfile;
          }
        } catch (err) {
          console.error('Failed to cache profile:', err);
          // Use the profile without blob as fallback
          publicProfilesMap[id] = publicProfile;
        }
      }
      
      // Update UI with profiles that include blobs
      setParticipants(publicProfilesMap);
    });

    return () => {
      console.log('👋 Cleaning up profile listeners');
      unsubscribe();
    };
  }, [chatId, user, chat]);

  // Subscribe to presence data for all participants (from RTDB)
  // Same pattern as chats.tsx - store presence separately to avoid infinite loops
  useEffect(() => {
    const participantIds = Object.keys(participants);
    if (participantIds.length === 0) return;

    console.log(`👁️ Setting up RTDB presence for ${participantIds.length} participant(s)`);

    const unsubscribe = onUsersPresenceChange(participantIds, (presenceMap) => {
      console.log('🔄 Presence data updated from RTDB:', Object.keys(presenceMap).length, 'user(s)');
      setPresenceData(presenceMap);
    });

    return () => {
      console.log(`👋 Cleaning up RTDB presence listeners`);
      unsubscribe();
    };
  }, [participants]);

  // Listen for typing status changes
  useEffect(() => {
    if (!chatId || !user) return;

    console.log(`👀 Setting up typing status listener for chat: ${chatId}`);

    const unsubscribe = onTypingStatusChange(chatId, user.uid, (typingIds) => {
      setTypingUserIds(typingIds);
    });

    return () => {
      console.log(`👋 Cleaning up typing status listener for chat: ${chatId}`);
      unsubscribe();
    };
  }, [chatId, user]);

  const handleSend = async () => {
    if (!messageText.trim() || !user || !chatId || sending) return;

    const textToSend = messageText.trim();
    setMessageText(''); // Clear input immediately for better UX
    setSending(true);

    // Clear typing status when sending
    clearTyping();

    try {
      // Send message with optimistic UI
      const message = await sendMessageOptimistic(
        {
          chatId,
          senderId: user.uid,
          text: textToSend,
        },
        // Callback for status changes
        (messageId, status) => {
          console.log(`Message ${messageId} status changed to ${status}`);
          setMessageStatuses(prev => ({ ...prev, [messageId]: status }));
        }
      );
      
      // Add message to UI immediately (optimistic)
      setMessages(prev => [...prev, message]);
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message text if send failed
      setMessageText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    if (!chatId) return;
    
    setRefreshing(true);
    try {
      // Load older messages from SQLite
      const allMessages = await getMessagesFromSQLite(chatId);
      
      // If we have more messages in SQLite than currently showing, load them
      if (allMessages.length > messages.length) {
        console.log(`📜 Loading ${allMessages.length - messages.length} more messages from SQLite`);
        setMessages(allMessages);
      } else {
        console.log('📜 All local messages already loaded. Pull-to-refresh for Firestore sync is background-only.');
        // Note: Firestore listener already handles syncing new messages in background
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getChatTitle = (): string => {
    if (!chat) return 'Chat';
    
    if (chat.type === 'group') {
      return chat.groupName || 'Group Chat';
    } else {
      // DM - get other participant's name
      const otherParticipantId = chat.participantIds.find(id => id !== user?.uid);
      const otherParticipant = otherParticipantId ? participants[otherParticipantId] : null;
      return otherParticipant?.displayName || 'Chat';
    }
  };

  const getOtherParticipant = () => {
    if (!chat || chat.type === 'group') return null;
    const otherParticipantId = chat.participantIds.find(id => id !== user?.uid);
    if (!otherParticipantId) return null;
    
    // Merge participant data with live presence from RTDB
    const participant = participants[otherParticipantId];
    if (!participant) return null;
    
    const presence = presenceData[otherParticipantId];
    return {
      ...participant,
      presence: presence?.status || 'offline',
      lastSeen: presence?.lastSeen || participant.lastSeen,
    };
  };

  const getPresenceColor = (presence?: 'online' | 'away' | 'offline'): string => {
    switch (presence) {
      case 'online':
        return '#34C759'; // Green
      case 'away':
        return '#FF9500'; // Orange
      case 'offline':
      default:
        return '#8E8E93'; // Gray
    }
  };

  // Memoized render function for better performance
  const renderMessage = useCallback(({ item }: { item: Message }) => {
    const isSent = item.senderId === user?.uid;
    const sender = participants[item.senderId];
    const currentStatus = messageStatuses[item.id] || item.status;
    
    return (
      <MessageItem 
        message={item}
        isSent={isSent}
        sender={sender}
        currentStatus={currentStatus}
        isGroupChat={chat?.type === 'group'}
      />
    );
  }, [user?.uid, participants, messageStatuses, chat?.type]);
  
  const getStatusIndicator = (status: MessageStatus): string => {
    switch (status) {
      case 'sending':
        return '⏱'; // Clock for queued/sending
      case 'sent':
        return '✓'; // Single checkmark
      case 'delivered':
        return '✓✓'; // Double checkmark
      case 'read':
        return '✓✓'; // Blue double checkmark (styled separately)
      case 'failed':
        return '!'; // Exclamation mark
      default:
        return '';
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderEmptyState = () => (
    <View style={[styles.emptyState, { transform: [{ scaleY: -1 }] }]}>
      <Text style={styles.emptyEmoji}>💬</Text>
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <Text style={styles.emptyText}>Send a message to start the conversation</Text>
    </View>
  );

  const getTypingText = (): string => {
    if (typingUserIds.length === 0) return '';
    
    if (typingUserIds.length === 1) {
      // Single user typing
      const typingUser = participants[typingUserIds[0]];
      const name = typingUser?.displayName || 'Someone';
      return `${name} is typing...`;
    } else if (typingUserIds.length === 2) {
      // Two users typing
      const user1 = participants[typingUserIds[0]]?.displayName || 'Someone';
      const user2 = participants[typingUserIds[1]]?.displayName || 'Someone';
      return `${user1} and ${user2} are typing...`;
    } else {
      // Multiple users typing
      return `${typingUserIds.length} people are typing...`;
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <Screen.Header>
        {/* Header */}
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {chat?.type === 'dm' ? (
            // DM: Show profile picture with status indicator
            <View style={styles.headerAvatarContainer}>
              <View style={styles.headerAvatarWrapper}>
                <View style={styles.headerAvatar}>
                  {(() => {
                    const participant = getOtherParticipant();
                    
                    if (participant?.avatarLocalPath) {
                      return (
                        <Image 
                          source={{ uri: participant.avatarLocalPath }} 
                          style={styles.headerAvatarImage} 
                        />
                      );
                    } else if (participant?.avatarUrl) {
                      return (
                        <Image 
                          source={{ uri: participant.avatarUrl }} 
                          style={styles.headerAvatarImage} 
                        />
                      );
                    } else {
                      return (
                        <Text style={styles.headerAvatarText}>
                          {participant?.displayName?.charAt(0).toUpperCase() || '?'}
                        </Text>
                      );
                    }
                  })()}
                </View>
                {/* Status indicator - sibling of avatar, not child */}
                <View style={[
                  styles.statusDot,
                  { backgroundColor: getPresenceColor(getOtherParticipant()?.presence) }
                ]} />
              </View>
              {/* Name below avatar */}
              <Text style={styles.headerName}>{getChatTitle()}</Text>
            </View>
          ) : (
            // Group: Show group name with participant count
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{getChatTitle()}</Text>
              <Text style={styles.headerSubtitle}>
                {chat?.participantIds.length || 0} participants
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            // TODO: Open chat settings
            console.log('Chat settings tapped');
          }}
          style={styles.settingsButton}
        >
          <IconSymbol name="gearshape.fill" size={32} color="#007AFF" />
        </TouchableOpacity>
      </View>
      </Screen.Header>

      <Screen.Content>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Message List Container - Takes full available space */}
          <View style={styles.messageListContainer}>
        <FlatList
        ref={flatListRef}
        data={[...messages].reverse()}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          messages.length === 0 ? styles.emptyContainer : styles.messageList,
          { minHeight: '100%' } // Ensure minimum height for scrolling
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        // Inverted makes newest messages appear at bottom naturally
        inverted
        // Track scrolling activity for presence
        onScroll={resetActivityTimer}
        scrollEventThrottle={1000}
        // Enable proper scrolling
        showsVerticalScrollIndicator={true}
        bounces={true}
        // Dismiss keyboard interactively when dragging through it
        keyboardDismissMode="interactive"
        // Performance optimizations
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={21}
        removeClippedSubviews={Platform.OS === 'android'}
        updateCellsBatchingPeriod={50}
        />
      </View>

      {/* Typing Indicator */}
      {typingUserIds.length > 0 && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>
            {getTypingText()}
          </Text>
        </View>
      )}

      {/* Message Input - Positioned at bottom */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={messageText}
          onChangeText={(text) => {
            setMessageText(text);
            onTypingStart();
            resetActivityTimer(); // Reset away timer when user types
          }}
          multiline
          maxLength={1000}
          editable={!sending}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>➤</Text>
          )}
        </TouchableOpacity>
      </View>
        </KeyboardAvoidingView>
      </Screen.Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F0F2F5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  backButton: {
    padding: 8,
    minWidth: 70,
  },
  backText: {
    fontSize: 18,
    color: '#007AFF',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarWrapper: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 40,
    height: 40,
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginTop: 4,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  settingsButton: {
    padding: 8,
    minWidth: 70,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messageListContainer: {
    flex: 1, // Take up all available space between header and input
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sentContainer: {
    justifyContent: 'flex-end',
  },
  receivedContainer: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  senderName: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sentBubble: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  receivedBubble: {
    backgroundColor: '#f5f5f5',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  sentText: {
    color: '#fff',
  },
  receivedText: {
    color: '#000',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  sentTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  receivedTimestamp: {
    color: '#8E8E93',
  },
  statusIndicator: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 4,
  },
  statusFailed: {
    color: '#FF3B30', // Red for failed
  },
  statusQueued: {
    color: 'rgba(255, 255, 255, 0.5)', // Dimmer for queued
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  statusIcon: {
    marginLeft: 2,
  },
  doubleCheck: {
    flexDirection: 'row',
    marginLeft: -4,
  },
  typingIndicator: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  typingText: {
    fontSize: 13,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 50, // Extra bottom padding for better spacing
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 12,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  sendButtonText: {
    fontSize: 20,
    color: '#fff',
  },
});


