/**
 * Chats Screen - Main chat list
 * Shows all user's conversations with real-time updates
 */

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ChatSummaryModal from '@/components/ChatSummaryModal';
import { useActivity } from '@/contexts/ActivityContext';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileCache } from '@/contexts/ProfileCacheContext';
import { useUser } from '@/contexts/UserContext';
import { onUserChatsSnapshot } from '@/services/chat.service';
import { getAllMessagesForChat, markMessageAsDelivered } from '@/services/message.service';
import { summarizeChat } from '@/services/openai.service';
import { onUserPresenceChange, onUsersPresenceChange } from '@/services/presence.service';
import { onUsersProfilesSnapshot } from '@/services/user.service';
import type { Chat } from '@/types/chat.types';
import type { PublicUserProfile, User, UserPresence } from '@/types/user.types';
import GroupAvatar from '../../components/GroupAvatar';
import Screen from '../../components/Screen';

export default function ChatsScreen() {
  const { user, logOut } = useAuth();
  const { userProfile } = useUser();
  const { resetActivityTimer } = useActivity();
  const { getProfiles } = useProfileCache();
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatParticipants, setChatParticipants] = useState<Record<string, PublicUserProfile>>({});
  const [presenceData, setPresenceData] = useState<Record<string, { status: UserPresence; lastSeen: number }>>({});
  const [myPresence, setMyPresence] = useState<UserPresence>('online');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Track which messages we've already marked as delivered to avoid duplicate writes
  const deliveredMessagesRef = useRef<Set<string>>(new Set());
  
  // Chat summary modal state
  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [selectedChatForSummary, setSelectedChatForSummary] = useState<Chat | null>(null);

  // Subscribe to user's chats in real-time
  useEffect(() => {
    if (!user) {
      setChats([]);
      setLoading(false);
      return;
    }

    console.log('Setting up chats listener for user:', user.uid);
    setLoading(true);

    const unsubscribe = onUserChatsSnapshot(user.uid, async (updatedChats) => {
      setChats(updatedChats);
      setLoading(false);
      
      // Mark unread messages from others as delivered
      for (const chat of updatedChats) {
        if (chat.lastMessageId && 
            chat.lastMessageSenderId && 
            chat.lastMessageSenderId !== user.uid &&
            !deliveredMessagesRef.current.has(chat.lastMessageId)) {
          // Mark as delivered
          deliveredMessagesRef.current.add(chat.lastMessageId);
          markMessageAsDelivered(
            chat.id,
            chat.lastMessageId,
            user.uid,
            chat.lastMessageSenderId
          ).catch((error) => {
            // Silent fail - delivery status is not critical
            console.log('Could not mark message as delivered:', error);
          });
        }
      }
    });

    return () => {
      console.log('Cleaning up chats listener');
      unsubscribe();
    };
  }, [user]);

  // Load participant profiles (with caching for instant display)
  useEffect(() => {
    if (!user || chats.length === 0) return;

    // Collect all participant IDs from chats
    const allParticipantIds = new Set<string>();
    chats.forEach(chat => {
      chat.participantIds.forEach(id => {
        if (id !== user.uid) { // Don't fetch current user
          allParticipantIds.add(id);
        }
      });
    });

    if (allParticipantIds.size === 0) return;

    const participantIdsArray = Array.from(allParticipantIds);
    console.log(`👥 Loading profiles for ${participantIdsArray.length} participants`);

    // Load profiles from cache first (instant display if available)
    getProfiles(participantIdsArray).then((profilesMap) => {
      console.log(`📦 Loaded ${Object.keys(profilesMap).length} profiles from cache`);
      
      // Convert PublicUserProfile to User format
      const userMap: Record<string, User> = {};
      Object.entries(profilesMap).forEach(([id, profile]) => {
        userMap[id] = {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          bio: profile.bio,
          presence: 'offline', // Will be updated by RTDB
          lastSeen: profile.lastSeen,
          deviceTokens: [],
          createdAt: 0,
          updatedAt: 0,
        };
      });
      setChatParticipants(userMap);
    });

    // Also set up real-time listener for updates (avatar changes, name changes, etc.)
    const unsubscribe = onUsersProfilesSnapshot(
      participantIdsArray,
      (participantsMap) => {
        // Only update if we got data (don't clear cached profiles on network failure)
        if (Object.keys(participantsMap).length === 0) {
          console.log('⚠️ Firestore returned empty profiles (likely offline), keeping cached data');
          return;
        }
        
        console.log('🔄 Participant profiles updated from Firestore:', Object.keys(participantsMap).length);
        setChatParticipants(participantsMap);
      }
    );

    return () => {
      console.log('👋 Cleaning up profile listeners');
      unsubscribe();
    };
  }, [user, chats, getProfiles]);

  // Subscribe to presence data for all participants (from RTDB)
  useEffect(() => {
    const participantIds = Object.keys(chatParticipants);
    if (participantIds.length === 0) return;

    console.log(`👁️ Setting up RTDB presence for ${participantIds.length} participants`);

    const unsubscribe = onUsersPresenceChange(participantIds, (presenceMap) => {
      console.log('🔄 Presence data updated from RTDB:', Object.keys(presenceMap).length, 'users');
      setPresenceData(presenceMap);
    });

    return () => {
      console.log('👋 Cleaning up RTDB presence listeners');
      unsubscribe();
    };
  }, [chatParticipants]);

  // Subscribe to current user's own presence (for header avatar)
  useEffect(() => {
    if (!user) return;

    console.log('👁️ Setting up RTDB presence for current user');

    const unsubscribe = onUserPresenceChange(user.uid, (presence) => {
      if (presence) {
        setMyPresence(presence.status);
        console.log('🔄 My presence updated:', presence.status);
      }
    });

    return () => {
      console.log('👋 Cleaning up my presence listener');
      unsubscribe();
    };
  }, [user]);

  const handleRefresh = async () => {
    if (refreshing) return; // Prevent multiple simultaneous refreshes

    setRefreshing(true);

    try {
      if (user) {
        console.log('🔄 Pull-to-refresh triggered for user:', user.uid);

        // Profiles are already being updated in real-time by listeners
        // Just show the refresh animation for UX

        // Show refresh indicator for at least 1 second for good UX
        setTimeout(() => {
          setRefreshing(false);
          console.log('✅ Refresh complete (real-time data already synced)');
        }, 1000);
      } else {
        setRefreshing(false);
      }
    } catch (error) {
      console.error('Error during pull-to-refresh:', error);
      setRefreshing(false);
    }
  };

  const getChatDisplayInfo = (chat: Chat) => {
    if (chat.type === 'group') {
      return {
        title: chat.groupName || 'Unnamed Group',
        subtitle: chat.lastMessageText || 'No messages yet',
        presence: 'offline' as UserPresence,
        avatarUrl: undefined,
        avatarLocalPath: undefined,
      };
    }

    // DM chat - get other participant's name and presence
    const otherParticipantId = chat.participantIds.find(id => id !== user?.uid);
    const otherParticipant = otherParticipantId ? chatParticipants[otherParticipantId] : null;
    const presence = otherParticipantId ? presenceData[otherParticipantId]?.status || 'offline' : 'offline';

    return {
      title: otherParticipant?.displayName || 'Unknown User',
      subtitle: chat.lastMessageText || 'No messages yet',
      presence,
      avatarUrl: otherParticipant?.avatarUrl,
      avatarLocalPath: otherParticipant?.avatarLocalPath,
    };
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return '';

    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  const getPresenceColor = (presence: UserPresence) => {
    switch (presence) {
      case 'online':
        return '#34C759'; // Green
      case 'away':
        return '#FF9500'; // Orange
      default:
        return '#8E8E93'; // Gray
    }
  };

  // Handle long press on chat to show summary option
  const handleChatLongPress = (chat: Chat) => {
    Alert.alert(
      'Chat Actions',
      'What would you like to do?',
      [
        {
          text: 'AI Summary',
          onPress: () => handleGenerateSummary(chat),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Generate AI summary for a chat
  const handleGenerateSummary = async (chat: Chat) => {
    setSelectedChatForSummary(chat);
    setSummaryModalVisible(true);
    setSummaryLoading(true);
    setSummaryText(null);
    setSummaryError(null);

    try {
      console.log(`📝 Generating summary for chat ${chat.id}`);
      
      // Fetch all messages for this chat
      const messages = await getAllMessagesForChat(chat.id);
      
      if (messages.length === 0) {
        setSummaryError('No messages to summarize in this chat.');
        setSummaryLoading(false);
        return;
      }

      // Call OpenAI API to generate summary
      const summary = await summarizeChat(messages);
      
      setSummaryText(summary);
      console.log('✅ Summary generated successfully');
    } catch (error) {
      console.error('❌ Summary generation failed:', error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to generate summary. Please try again.';
      
      setSummaryError(errorMessage);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Close summary modal
  const handleCloseSummaryModal = () => {
    setSummaryModalVisible(false);
    setSummaryText(null);
    setSummaryError(null);
    setSelectedChatForSummary(null);
  };

  // Get chat title for summary modal
  const getSummaryModalTitle = (): string => {
    if (!selectedChatForSummary) return 'Chat';
    
    if (selectedChatForSummary.type === 'group') {
      return selectedChatForSummary.groupName || 'Group Chat';
    } else {
      // DM - get other participant's name
      const otherParticipantId = selectedChatForSummary.participantIds.find(id => id !== user?.uid);
      const otherParticipant = otherParticipantId ? chatParticipants[otherParticipantId] : null;
      return otherParticipant?.displayName || 'Chat';
    }
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const { title, subtitle, presence, avatarUrl, avatarLocalPath } = getChatDisplayInfo(item);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => {
          router.push(`/(authenticated)/chat/${item.id}` as any);
        }}
        onLongPress={() => handleChatLongPress(item)}
        delayLongPress={500}
      >
        {/* Avatar with presence indicator */}
        <View style={styles.avatarContainer}>
          {item.type === 'group' ? (
            <GroupAvatar
              groupName={item.groupName}
              avatarUrl={item.groupAvatarUrl}
              groupId={item.id}
              size={56}
            />
          ) : (
            <>
              <View style={styles.avatar}>
                {avatarLocalPath ? (
                  <Image 
                    source={{ uri: avatarLocalPath }} 
                    style={styles.avatarImage} 
                  />
                ) : avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>
                    {title.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              {/* Show presence dot for DM chats only */}
              <View style={[styles.presenceDot, { backgroundColor: getPresenceColor(presence) }]} />
            </>
          )}
        </View>

        {/* Chat info */}
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.chatTime}>
              {formatTimestamp(item.lastMessageAt || 0)}
            </Text>
          </View>

          <Text style={styles.chatSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>💬</Text>
      <Text style={styles.emptyTitle}>No chats yet</Text>
      <Text style={styles.emptyText}>
        Your conversations will appear here
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  return (
    <Screen>
      <Screen.Header>
        {/* Header */}
        <View style={styles.header}>
          {/* Left: Title */}
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>Chats</Text>
          </View>
          
          {/* Center: Profile Photo with Status */}
          <TouchableOpacity 
            style={styles.profileContainer}
            onPress={() => router.push('/(authenticated)/profile')}
          >
            <View style={styles.profileAvatarWrapper}>
              <View style={styles.profileAvatar}>
                {userProfile?.avatarUrl ? (
                  <Image
                    source={{ uri: userProfile.avatarUrl }}
                    style={styles.profileAvatarImage}
                  />
                ) : (
                  <Text style={styles.profileAvatarText}>
                    {userProfile?.displayName?.charAt(0).toUpperCase() || '?'}
                  </Text>
                )}
              </View>
              {/* Status indicator - sibling of avatar, not child */}
              <View style={[
                styles.profilePresenceDot,
                { backgroundColor: getPresenceColor(myPresence) }
              ]} />
            </View>
          </TouchableOpacity>
          
          {/* Right: Logout */}
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={logOut} style={styles.logoutButton}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Screen.Header>

      <Screen.Content>
        {/* Chat List */}
        <FlatList
        style={{flex: 1, minHeight: '100%'}}
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={chats.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={renderEmptyState}
        bounces={true}
        showsVerticalScrollIndicator={true}
        onScroll={resetActivityTimer}
        scrollEventThrottle={1000}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
      />

        {/* New Chat FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            router.push('/(authenticated)/new-chat');
          }}
        >
          <Text style={styles.fabIcon}>✏️</Text>
        </TouchableOpacity>

        {/* Debug info */}
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>
              {userProfile?.displayName} • {chats.length} chats
            </Text>
          </View>
        )}

        {/* Chat Summary Modal */}
        <ChatSummaryModal
          visible={summaryModalVisible}
          summary={summaryText}
          loading={summaryLoading}
          error={summaryError}
          chatTitle={getSummaryModalTitle()}
          onClose={handleCloseSummaryModal}
        />
      </Screen.Content>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
  },
  profileContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16, // Add some padding around the profile
  },
  profileAvatarWrapper: {
    position: 'relative',
    width: 50,
    height: 50,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 50,
    height: 50,
  },
  profileAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  profilePresenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    fontSize: 16,
    color: '#007AFF',
  },
  chatItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
  },
  presenceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    flex: 1,
  },
  chatTime: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 8,
  },
  chatSubtitle: {
    fontSize: 15,
    color: '#8E8E93',
  },
  emptyContainer: {
    flexGrow: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 1000,
  },
  fabIcon: {
    fontSize: 28,
  },
  debugInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
});
