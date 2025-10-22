/**
 * Chats Screen - Main chat list
 * Shows all user's conversations with real-time updates
 */

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { onUserChatsSnapshot } from '@/services/chat.service';
import { onUsersPresenceChange } from '@/services/presence.service';
import { getUsersByIds } from '@/services/user.service';
import type { Chat } from '@/types/chat.types';
import type { User, UserPresence } from '@/types/user.types';

export default function ChatsScreen() {
  const { user, logOut } = useAuth();
  const { userProfile } = useUser();
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatParticipants, setChatParticipants] = useState<Record<string, User>>({});
  const [presenceData, setPresenceData] = useState<Record<string, { status: UserPresence; lastSeen: number }>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      // Note: setRefreshing(false) is now handled by handleRefresh for manual refreshes

      // Fetch participant info for all chats (from Firestore - profiles only)
      const allParticipantIds = new Set<string>();
      updatedChats.forEach(chat => {
        chat.participantIds.forEach(id => {
          if (id !== user.uid) { // Don't fetch current user
            allParticipantIds.add(id);
          }
        });
      });

      if (allParticipantIds.size > 0) {
        try {
          const participants = await getUsersByIds(Array.from(allParticipantIds));
          const participantsMap: Record<string, User> = {};
          participants.forEach(participant => {
            participantsMap[participant.id] = participant;
          });
          setChatParticipants(participantsMap);
        } catch (error) {
          console.error('Error fetching participants:', error);
        }
      }
    });

    return () => {
      console.log('Cleaning up chats listener');
      unsubscribe();
    };
  }, [user]);

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

  const handleRefresh = async () => {
    if (refreshing) return; // Prevent multiple simultaneous refreshes

    setRefreshing(true);

    try {
      if (user) {
        console.log('🔄 Pull-to-refresh triggered for user:', user.uid);

        // Force refresh of participant data (usernames, display names, etc.)
        if (chats.length > 0) {
          const allParticipantIds = new Set<string>();
          chats.forEach(chat => {
            chat.participantIds.forEach(id => {
              if (id !== user.uid) { // Don't fetch current user
                allParticipantIds.add(id);
              }
            });
          });

          if (allParticipantIds.size > 0) {
            console.log(`🔄 Refreshing ${allParticipantIds.size} participant profiles`);
            const participants = await getUsersByIds(Array.from(allParticipantIds));
            const participantsMap: Record<string, User> = {};
            participants.forEach(participant => {
              participantsMap[participant.id] = participant;
            });
            setChatParticipants(participantsMap);
            console.log('✅ Participant profiles refreshed');
          }
        }

        // Show refresh indicator for at least 1 second for good UX
        setTimeout(() => {
          setRefreshing(false);
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

  const renderChatItem = ({ item }: { item: Chat }) => {
    const { title, subtitle, presence } = getChatDisplayInfo(item);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => {
          router.push(`/chat/${item.id}` as any);
        }}
      >
        {/* Avatar placeholder with presence indicator */}
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {title.charAt(0).toUpperCase()}
            </Text>
          </View>
          {/* Show presence dot for DM chats only */}
          {item.type === 'dm' && (
            <View style={[styles.presenceDot, { backgroundColor: getPresenceColor(presence) }]} />
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity onPress={logOut} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

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
    </View>
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
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
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
  },
  presenceDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
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
