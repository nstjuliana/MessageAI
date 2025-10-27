/**
 * Chat Settings Screen
 * Shows chat information, participants, and management actions
 */

import GroupAvatar from '@/components/GroupAvatar';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { leaveGroup, updateGroupInfo } from '@/services/chat.service';
import { getUsersByIds } from '@/services/user.service';
import type { Chat } from '@/types/chat.types';
import type { PublicUserProfile } from '@/types/user.types';
import { router, useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function ChatSettingsScreen() {
  const { user } = useAuth();
  const { chatId } = useLocalSearchParams();
  const [chat, setChat] = useState<Chat | null>(null);
  const [participants, setParticipants] = useState<PublicUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!chatId) return;
    
    setLoading(true);
    
    // Set up real-time listener for chat updates
    const unsubscribe = onSnapshot(
      doc(db, 'chats', chatId as string),
      async (docSnapshot) => {
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
          
          console.log('📡 Chat settings updated:', chatData.groupName, chatData.participantIds.length);
          
          setChat(chatData);
          setGroupName(chatData.groupName || '');
          
          // Reload participants
          const profiles = await getUsersByIds(chatData.participantIds);
          setParticipants(profiles);
          
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
          Alert.alert('Error', 'Failed to load chat information');
        }
        setLoading(false);
      }
    );
    
    return () => {
      console.log('👋 Cleaning up chat settings listener');
      unsubscribe();
    };
  }, [chatId]);

  const handleAddParticipants = () => {
    router.push(`/add-members/${chatId}` as any);
  };

  const handleSaveGroupName = async () => {
    if (!chat || chat.type !== 'group') return;
    
    const trimmedName = groupName.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Group name cannot be empty');
      return;
    }
    
    setSavingName(true);
    try {
      await updateGroupInfo(chat.id, { groupName: trimmedName });
      setChat({ ...chat, groupName: trimmedName });
      setEditingName(false);
      Alert.alert('Success', 'Group name updated');
    } catch (error: any) {
      console.error('Failed to update group name:', error);
      Alert.alert('Error', error.message || 'Failed to update group name');
    } finally {
      setSavingName(false);
    }
  };

  const handleLeaveGroup = () => {
    if (!chat || !user) return;
    
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveGroup(chat.id, user.uid);
              router.replace('/chats' as any);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave group');
            }
          },
        },
      ]
    );
  };

  const isAdmin = () => {
    if (!chat || !user || chat.type !== 'group') return false;
    return chat.adminIds?.includes(user.uid) || false;
  };

  const renderParticipant = ({ item }: { item: PublicUserProfile }) => {
    const isUserAdmin = chat?.adminIds?.includes(item.id) || false;
    
    return (
      <View style={styles.participantItem}>
        <View style={styles.avatar}>
          {item.avatarUrl ? (
            <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>{item.displayName}</Text>
          {item.username && (
            <Text style={styles.participantUsername}>@{item.username}</Text>
          )}
        </View>
        {isUserAdmin && (
          <View style={styles.adminBadge}>
            <Text style={styles.adminBadgeText}>Admin</Text>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!chat) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Chat not found</Text>
      </View>
    );
  }

  const isGroup = chat.type === 'group';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* Chat Info */}
        <View style={styles.section}>
          <View style={styles.chatInfoContainer}>
            {isGroup ? (
              <GroupAvatar
                groupName={chat.groupName}
                avatarUrl={chat.groupAvatarUrl}
                groupId={chat.id}
                size={80}
              />
            ) : (
              <View style={styles.dmAvatar}>
                {participants[0]?.avatarUrl ? (
                  <Image
                    source={{ uri: participants[0].avatarUrl }}
                    style={styles.dmAvatarImage}
                  />
                ) : (
                  <Text style={styles.dmAvatarText}>
                    {participants[0]?.displayName?.charAt(0).toUpperCase() || '?'}
                  </Text>
                )}
              </View>
            )}
            
            <View style={styles.chatInfoText}>
              {isGroup && editingName ? (
                <View style={styles.editNameContainer}>
                  <TextInput
                    style={styles.editNameInput}
                    value={groupName}
                    onChangeText={setGroupName}
                    maxLength={50}
                    autoFocus
                  />
                  <View style={styles.editNameButtons}>
                    <TouchableOpacity
                      onPress={() => {
                        setGroupName(chat.groupName || '');
                        setEditingName(false);
                      }}
                      style={styles.editNameButton}
                    >
                      <Text style={styles.editNameCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSaveGroupName}
                      style={[styles.editNameButton, styles.editNameSaveButton]}
                      disabled={savingName}
                    >
                      {savingName ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.editNameSaveText}>Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.chatName}>
                    {isGroup ? chat.groupName : participants[0]?.displayName || 'Unknown'}
                  </Text>
                  <Text style={styles.chatType}>
                    {isGroup
                      ? `${chat.participantIds.length} participants`
                      : 'Direct Message'}
                  </Text>
                </>
              )}
            </View>
          </View>
          
          {/* Edit Group Name Button */}
          {isGroup && isAdmin() && !editingName && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setEditingName(true)}
            >
              <Text style={styles.actionButtonText}>Edit Group Name</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Participants */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Participants ({participants.length})
          </Text>
          <FlatList
            data={participants}
            renderItem={renderParticipant}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleAddParticipants}
          >
            <Text style={styles.actionButtonText}>Add Participants</Text>
          </TouchableOpacity>
          
          {isGroup && (
            <TouchableOpacity
              style={[styles.actionButton, styles.dangerButton]}
              onPress={handleLeaveGroup}
            >
              <Text style={styles.dangerButtonText}>Leave Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 18,
    color: '#6366F1',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  chatInfoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dmAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  dmAvatarImage: {
    width: 80,
    height: 80,
  },
  dmAvatarText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#fff',
  },
  chatInfoText: {
    alignItems: 'center',
    marginTop: 12,
  },
  chatName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  chatType: {
    fontSize: 14,
    color: '#64748B',
  },
  editNameContainer: {
    width: '100%',
    alignItems: 'center',
  },
  editNameInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 8,
    padding: 8,
    width: '80%',
    textAlign: 'center',
    marginBottom: 12,
  },
  editNameButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editNameButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  editNameSaveButton: {
    backgroundColor: '#6366F1',
  },
  editNameCancelText: {
    color: '#6366F1',
    fontSize: 16,
    fontWeight: '500',
  },
  editNameSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 44,
    height: 44,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  participantUsername: {
    fontSize: 14,
    color: '#64748B',
  },
  adminBadge: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adminBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  dangerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

