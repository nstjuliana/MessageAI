/**
 * Chat Conversation Screen
 * Real-time messaging interface with message list and input
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { usePresenceTracking } from '@/hooks/usePresenceTracking';
import { getChatById, onChatMessagesSnapshot } from '@/services/chat.service';
import {
  getMessagesFromSQLite,
  sendMessageOptimistic,
  syncMessageToSQLite,
} from '@/services/message.service';
import { getUsersByIds } from '@/services/user.service';
import type { Chat, Message, MessageStatus } from '@/types/chat.types';
import type { PublicUserProfile } from '@/types/user.types';

export default function ChatScreen() {
  const { chatId } = useLocalSearchParams<{ chatId: string }>();
  const { user } = useAuth();
  const { resetActivityTimer } = usePresenceTracking();
  
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Record<string, PublicUserProfile>>({});
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  
  // Track message statuses for optimistic UI
  const [messageStatuses, setMessageStatuses] = useState<Record<string, MessageStatus>>({});

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

        // 3. Load participant profiles (background)
        const participantIds = chatData.participantIds.filter(id => id !== user.uid);
        if (participantIds.length > 0) {
          const profiles = await getUsersByIds(participantIds);
          const profilesMap: Record<string, PublicUserProfile> = {};
          profiles.forEach(profile => {
            profilesMap[profile.id] = {
              id: profile.id,
              username: profile.username,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              bio: profile.bio,
              presence: profile.presence,
              lastSeen: profile.lastSeen,
            };
          });
          setParticipants(profilesMap);
        }

        // 4. Listen to messages in real-time from Firestore
        unsubscribeMessages = onChatMessagesSnapshot(chatId, async (firestoreMessages) => {
          messagesFromFirestore = firestoreMessages;
          
          // Sync Firestore messages to SQLite
          for (const message of firestoreMessages) {
            await syncMessageToSQLite(message);
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

  const handleSend = async () => {
    if (!messageText.trim() || !user || !chatId || sending) return;

    resetActivityTimer();
    const textToSend = messageText.trim();
    setMessageText(''); // Clear input immediately for better UX
    setSending(true);

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
            <Text style={styles.avatarText}>
              {sender?.displayName?.charAt(0).toUpperCase() || '?'}
            </Text>
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
          <Text style={styles.headerTitle}>{getChatTitle()}</Text>
          {/* TODO: Show online status or participant count */}
        </View>
        <View style={styles.placeholder} />
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
        // Enable proper scrolling
        showsVerticalScrollIndicator={true}
        bounces={true}
        // Auto-scroll to bottom when new messages arrive (normal order)
        onContentSizeChange={() => {
          if (messages.length > 0 && flatListRef.current) {
            flatListRef.current.scrollToEnd({ animated: true });
          }
        }}
        />
      </View>

      {/* Message Input - Positioned at bottom */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={messageText}
          onChangeText={setMessageText}
          onFocus={resetActivityTimer}
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
  },
  backText: {
    fontSize: 18,
    color: '#007AFF',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
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

