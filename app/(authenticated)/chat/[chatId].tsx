/**
 * Chat Conversation Screen
 * Real-time messaging interface with message list and input
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { getChatById, onChatMessagesSnapshot } from '@/services/chat.service';
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

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user } = useAuth();
  const { resetActivityTimer } = useActivity();
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

  // Load chat data and messages (SQLite + Firestore)
  useEffect(() => {
    if (!chatId || !user) {
      setLoading(false);
      return;
    }

    let unsubscribeMessages: (() => void) | undefined;
    let messagesFromSQLite: Message[] = [];
    let messagesFromFirestore: Message[] = [];

    const loadChat = async () => {
      try {
        setLoading(true);

        // 1. Load messages from SQLite FIRST (instant load - no network)
        messagesFromSQLite = await getMessagesFromSQLite(chatId);
        setMessages(messagesFromSQLite);
        setLoading(false); // Stop showing spinner immediately

        // 2. Load chat metadata and participants in parallel (background)
        const [chatData] = await Promise.all([
          getChatById(chatId),
          // Load participants after we have chat data
        ]);
        
        if (!chatData) {
          console.error('Chat not found');
          return;
        }
        setChat(chatData);

        // 3. Listen to messages in real-time from Firestore
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

  // Subscribe to participant profiles in real-time (including avatars)
  useEffect(() => {
    if (!chatId || !user || !chat) return;

    const participantIds = chat.participantIds.filter(id => id !== user.uid);
    if (participantIds.length === 0) return;

    console.log(`📡 Setting up real-time profile listeners for ${participantIds.length} participant(s)`);

    const unsubscribe = onUsersProfilesSnapshot(participantIds, (profilesMap) => {
      console.log('🔄 Participant profiles updated:', Object.keys(profilesMap).length);
      
      // Convert to PublicUserProfile format
      const publicProfilesMap: Record<string, PublicUserProfile> = {};
      Object.entries(profilesMap).forEach(([id, profile]) => {
        publicProfilesMap[id] = {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          presence: 'offline', // Will be updated by RTDB listener
          lastSeen: profile.lastSeen,
        };
      });
      
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
      
      // Scroll to bottom
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToEnd({ animated: true });
        }
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message text if send failed
      setMessageText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // TODO: Load older messages
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
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

  const renderMessage = ({ item }: { item: Message }) => {
    const isSent = item.senderId === user?.uid;
    const sender = participants[item.senderId];
    
    // Get current status (use local state if available, otherwise use message status)
    const currentStatus = messageStatuses[item.id] || item.status;
    
    return (
      <View style={[styles.messageContainer, isSent ? styles.sentContainer : styles.receivedContainer]}>
        {/* Avatar for received messages in groups */}
        {!isSent && chat?.type === 'group' && (
          <View style={styles.avatar}>
            {sender?.avatarUrl ? (
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
              {sender?.displayName || 'Unknown User'}
            </Text>
          )}

          {/* Message bubble */}
          <View style={[styles.messageBubble, isSent ? styles.sentBubble : styles.receivedBubble]}>
            <Text style={[styles.messageText, isSent ? styles.sentText : styles.receivedText]}>
              {item.text}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[styles.timestamp, isSent ? styles.sentTimestamp : styles.receivedTimestamp]}>
                {formatTimestamp(item.createdAt)}
              </Text>
              {/* Status indicator for sent messages */}
              {isSent && (
                <Text style={[
                  styles.statusIndicator,
                  currentStatus === 'failed' && styles.statusFailed,
                  currentStatus === 'sending' && styles.statusQueued,
                ]}>
                  {getStatusIndicator(currentStatus)}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };
  
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
    <View style={styles.emptyState}>
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={-30}
      enabled
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {chat?.type === 'dm' ? (
            // DM: Show profile picture with status indicator
            <View style={styles.headerAvatarContainer}>
              <View style={styles.headerAvatar}>
                {getOtherParticipant()?.avatarUrl ? (
                  <Image 
                    source={{ uri: getOtherParticipant()?.avatarUrl }} 
                    style={styles.headerAvatarImage} 
                  />
                ) : (
                  <Text style={styles.headerAvatarText}>
                    {getOtherParticipant()?.displayName?.charAt(0).toUpperCase() || '?'}
                  </Text>
                )}
                {/* Status indicator */}
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

      {/* Message List Container - Takes full available space */}
      <View style={styles.messageListContainer}>
        <FlatList
        ref={flatListRef}
        data={messages}
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
        // Track scrolling activity for presence
        onScroll={resetActivityTimer}
        scrollEventThrottle={1000}
        // Enable proper scrolling
        showsVerticalScrollIndicator={true}
        bounces={true}
        // Dismiss keyboard interactively when dragging through it
        keyboardDismissMode="interactive"
        // Auto-scroll to bottom when new messages arrive (normal order)
        onContentSizeChange={() => {
          if (messages.length > 0 && flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }}
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
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
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
    backgroundColor: '#fff',
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


