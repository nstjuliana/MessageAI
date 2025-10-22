/**
 * New Chat Screen - Search for users and start conversations
 */

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { findOrCreateDMChat } from '@/services/chat.service';
import { onUsersPresenceChange } from '@/services/presence.service';
import { onUsersProfilesSnapshot, searchUsers } from '@/services/user.service';
import type { PublicUserProfile, User, UserPresence } from '@/types/user.types';

export default function NewChatScreen() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUserProfile[]>([]);
  const [profileData, setProfileData] = useState<Record<string, User>>({});
  const [presenceData, setPresenceData] = useState<Record<string, { status: UserPresence; lastSeen: number }>>({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);

    if (!term || term.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const results = await searchUsers(term, user.uid);
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to profile data for search results (real-time avatarUrl updates)
  useEffect(() => {
    const userIds = searchResults.map(user => user.id);
    if (userIds.length === 0) return;

    console.log(`📡 Setting up real-time profile listeners for ${userIds.length} search results`);

    const unsubscribe = onUsersProfilesSnapshot(userIds, (profilesMap) => {
      console.log('🔄 Search result profiles updated:', Object.keys(profilesMap).length);
      setProfileData(profilesMap);
    });

    return () => {
      console.log('👋 Cleaning up profile listeners for search');
      unsubscribe();
    };
  }, [searchResults]);

  // Subscribe to presence data for search results (from RTDB)
  useEffect(() => {
    const userIds = searchResults.map(user => user.id);
    if (userIds.length === 0) return;

    console.log(`👁️ Setting up RTDB presence for ${userIds.length} search results`);

    const unsubscribe = onUsersPresenceChange(userIds, (presenceMap) => {
      setPresenceData(presenceMap);
    });

    return () => {
      console.log('👋 Cleaning up RTDB presence listeners for search');
      unsubscribe();
    };
  }, [searchResults]);

  const handleSelectUser = async (selectedUser: PublicUserProfile) => {
    if (!user) return;

    setCreating(true);
    try {
      console.log(`Creating/finding chat with ${selectedUser.displayName}...`);

      // Find existing chat or create new one
      const chat = await findOrCreateDMChat(user.uid, selectedUser.id);

      console.log(`✅ Chat ready: ${chat.id}`);

      // Navigate to chat screen
      router.push(`/chat/${chat.id}` as any);
    } catch (error: any) {
      console.error('Failed to create chat:', error);
      alert(`Failed to create chat: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const renderUserItem = ({ item }: { item: PublicUserProfile }) => {
    // Get presence from RTDB (not stale Firestore data)
    const presence = presenceData[item.id]?.status || 'offline';
    const presenceColor =
      presence === 'online'
        ? '#34C759'
        : presence === 'away'
        ? '#FF9500'
        : '#8E8E93';

    // Get latest profile data (including avatarUrl) from real-time listener
    const profile = profileData[item.id];
    const avatarUrl = profile?.avatarUrl || item.avatarUrl;

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleSelectUser(item)}
        disabled={creating}
      >
        {/* Avatar */}
        <View style={styles.avatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
          )}
          {/* Presence indicator */}
          <View style={[styles.presenceIndicator, { backgroundColor: presenceColor }]} />
        </View>

        {/* User info */}
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{item.displayName}</Text>
          {item.username && (
            <Text style={styles.username}>@{item.username}</Text>
          )}
          {item.bio && (
            <Text style={styles.bio} numberOfLines={1}>
              {item.bio}
            </Text>
          )}
        </View>

        {/* Chevron */}
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.emptyText}>Searching...</Text>
        </View>
      );
    }

    if (searchTerm.trim().length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>Search for users</Text>
          <Text style={styles.emptyText}>
            Enter a name to find people to chat with
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyEmoji}>😔</Text>
        <Text style={styles.emptyTitle}>No users found</Text>
        <Text style={styles.emptyText}>Try a different search term</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Chat</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or @username..."
          value={searchTerm}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Results */}
      <FlatList
        data={searchResults}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          searchResults.length === 0 ? styles.emptyContainer : undefined
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* Creating chat overlay */}
      {creating && (
        <View style={styles.creatingOverlay}>
          <View style={styles.creatingCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.creatingText}>Creating chat...</Text>
          </View>
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
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 18,
    color: '#007AFF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  placeholder: {
    width: 40,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    margin: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 50,
    height: 50,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  presenceIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 2,
  },
  bio: {
    fontSize: 14,
    color: '#8E8E93',
  },
  chevron: {
    fontSize: 24,
    color: '#C7C7CC',
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
  creatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  creatingCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  creatingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000',
  },
});

