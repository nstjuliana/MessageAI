/**
 * Add Members Screen
 * Multi-select users to add to chat
 */

import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import {
    addParticipantsToGroup,
    convertDMToGroup,
    createGroupChat,
} from '@/services/chat.service';
import { onUsersPresenceChange } from '@/services/presence.service';
import { onUsersProfilesSnapshot, searchUsers } from '@/services/user.service';
import type { Chat } from '@/types/chat.types';
import type { PublicUserProfile, User, UserPresence } from '@/types/user.types';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function AddMembersScreen() {
  const { user } = useAuth();
  const { chatId } = useLocalSearchParams();
  const [chat, setChat] = useState<Chat | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<PublicUserProfile[]>([]);
  const [profileData, setProfileData] = useState<Record<string, User>>({});
  const [presenceData, setPresenceData] = useState<Record<string, { status: UserPresence; lastSeen: number }>>({});
  const [selectedUsers, setSelectedUsers] = useState<PublicUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!chatId) return;
    
    setLoading(true);
    
    // Set up real-time listener for chat updates
    const unsubscribe = onSnapshot(
      doc(db, 'chats', chatId as string),
      (docSnapshot) => {
        try {
          if (!docSnapshot.exists()) {
            console.error('Chat not found or no permission');
            Alert.alert('Error', 'Chat not found or no permission');
            router.back();
            return;
          }
          
          const data = docSnapshot.data();
          
          // Verify user has access to this chat
          if (!data.participantIds?.includes(user?.uid)) {
            console.error('User not in chat participants');
            Alert.alert('Error', 'You do not have access to this chat');
            router.back();
            return;
          }
          
          const chatData: Chat = {
            id: docSnapshot.id,
            type: data.type || 'dm',
            participantIds: data.participantIds || [],
            adminIds: data.adminIds || [],
            groupName: data.groupName,
            groupAvatarUrl: data.groupAvatarUrl,
            lastMessageId: data.lastMessageId,
            lastMessageText: data.lastMessageText,
            lastMessageSenderId: data.lastMessageSenderId,
            lastMessageAt: data.lastMessageAt?.toMillis?.() || data.lastMessageAt || 0,
            createdAt: data.createdAt?.toMillis?.() || data.createdAt || 0,
            updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || 0,
          };
          
          console.log('📡 Add members screen - chat updated:', chatData.participantIds.length, 'participants');
          
          setChat(chatData);
          setLoading(false);
        } catch (error) {
          console.error('Failed to process chat data:', error);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error listening to chat updates:', error);
        
        // Check if it's a permissions error
        const errorCode = (error as any)?.code;
        if (errorCode === 'permission-denied') {
          console.log('⚠️ Permission denied - user may not be in chat participants');
          Alert.alert('Error', 'You do not have permission to view this chat');
          router.back();
        } else {
          Alert.alert('Error', 'Failed to load chat');
        }
        setLoading(false);
      }
    );
    
    return () => {
      console.log('👋 Cleaning up add members listener');
      unsubscribe();
    };
  }, [chatId]);

  const handleSearch = async (term: string) => {
    setSearchTerm(term);

    if (!term || term.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    if (!user || !chat) return;

    setSearching(true);
    try {
      const results = await searchUsers(term, user.uid);
      
      // Filter out existing participants
      const filtered = results.filter(
        u => !chat.participantIds.includes(u.id)
      );
      
      setSearchResults(filtered);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Subscribe to profile data for search results
  useEffect(() => {
    const userIds = searchResults.map(user => user.id);
    if (userIds.length === 0) return;

    const unsubscribe = onUsersProfilesSnapshot(userIds, (profilesMap) => {
      setProfileData(profilesMap);
    });

    return () => {
      unsubscribe();
    };
  }, [searchResults]);

  // Subscribe to presence data for search results
  useEffect(() => {
    const userIds = searchResults.map(user => user.id);
    if (userIds.length === 0) return;

    const unsubscribe = onUsersPresenceChange(userIds, (presenceMap) => {
      setPresenceData(presenceMap);
    });

    return () => {
      unsubscribe();
    };
  }, [searchResults]);

  const handleSelectUser = (selectedUser: PublicUserProfile) => {
    const isSelected = selectedUsers.some(u => u.id === selectedUser.id);
    if (isSelected) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== selectedUser.id));
    } else {
      setSelectedUsers([...selectedUsers, selectedUser]);
    }
  };

  const handleNext = () => {
    if (selectedUsers.length === 0) {
      Alert.alert('No Selection', 'Please select at least one person to add');
      return;
    }
    
    setShowActionModal(true);
  };

  const handleAddToCurrentChat = async () => {
    if (!chat || !user || selectedUsers.length === 0) return;
    
    setProcessing(true);
    setShowActionModal(false);
    
    try {
      const newParticipantIds = selectedUsers.map(u => u.id);
      
      if (chat.type === 'dm') {
        // Convert DM to group
        await convertDMToGroup(chat.id, newParticipantIds);
        Alert.alert('Success', 'Chat converted to group');
      } else {
        // Add to existing group
        await addParticipantsToGroup(chat.id, newParticipantIds);
        Alert.alert('Success', 'Participants added to group');
      }
      
      router.back();
    } catch (error: any) {
      console.error('Failed to add participants:', error);
      Alert.alert('Error', error.message || 'Failed to add participants');
    } finally {
      setProcessing(false);
    }
  };

  const handleCreateNewGroup = async () => {
    if (!chat || !user || selectedUsers.length === 0) return;
    
    setProcessing(true);
    setShowActionModal(false);
    
    try {
      // Include all participants from current chat + new ones
      const allParticipantIds = [
        ...chat.participantIds.filter(id => id !== user.uid),
        ...selectedUsers.map(u => u.id),
      ];
      
      const newChat = await createGroupChat(user.uid, allParticipantIds);
      
      Alert.alert('Success', 'New group created');
      router.replace(`/chat/${newChat.id}` as any);
    } catch (error: any) {
      console.error('Failed to create group:', error);
      Alert.alert('Error', error.message || 'Failed to create group');
    } finally {
      setProcessing(false);
    }
  };

  const renderUserItem = ({ item }: { item: PublicUserProfile }) => {
    const presence = presenceData[item.id]?.status || 'offline';
    const presenceColor =
      presence === 'online'
        ? '#34C759'
        : presence === 'away'
        ? '#FF9500'
        : '#8E8E93';

    const profile = profileData[item.id];
    const avatarUrl = profile?.avatarUrl || item.avatarUrl;
    const isSelected = selectedUsers.some(u => u.id === item.id);

    return (
      <TouchableOpacity
        style={styles.userItem}
        onPress={() => handleSelectUser(item)}
      >
        {/* Checkbox */}
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
        
        {/* Avatar with presence */}
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {item.displayName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={[styles.presenceIndicator, { backgroundColor: presenceColor }]} />
        </View>

        {/* User info */}
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>{item.displayName}</Text>
          {item.username && (
            <Text style={styles.username}>@{item.username}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (searching) {
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
            Find people to add to the chat
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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {selectedUsers.length > 0
            ? `Selected (${selectedUsers.length})`
            : 'Add Members'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search */}
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

      {/* Next button */}
      {selectedUsers.length > 0 && (
        <View style={styles.nextButtonContainer}>
          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            disabled={processing}
          >
            <Text style={styles.nextButtonText}>
              Next ({selectedUsers.length} selected)
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Modal */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How would you like to add them?</Text>
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleAddToCurrentChat}
            >
              <Text style={styles.modalButtonText}>
                {chat?.type === 'dm' ? 'Convert to Group' : 'Add to Current Chat'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleCreateNewGroup}
            >
              <Text style={styles.modalButtonText}>Create New Group</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalButton, styles.modalCancelButton]}
              onPress={() => setShowActionModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Processing overlay */}
      {processing && (
        <View style={styles.processingOverlay}>
          <View style={styles.processingCard}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.processingText}>Processing...</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  avatarWrapper: {
    position: 'relative',
    width: 50,
    height: 50,
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
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
  nextButtonContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  nextButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCancelButton: {
    backgroundColor: '#F2F2F7',
  },
  modalCancelText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingCard: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  processingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#000',
  },
});

