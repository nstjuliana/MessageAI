/**
 * New Group Screen - Finalize group creation
 */

import { router, useLocalSearchParams } from 'expo-router';
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
import { createGroupChat } from '@/services/chat.service';
import { getUsersByIds } from '@/services/user.service';
import type { PublicUserProfile } from '@/types/user.types';

export default function NewGroupScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [selectedUsers, setSelectedUsers] = useState<PublicUserProfile[]>([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadSelectedUsers();
  }, []);

  const loadSelectedUsers = async () => {
    try {
      const userIdsString = params.userIds as string;
      const userIds = JSON.parse(userIdsString) as string[];
      
      // Fetch user profiles
      const users = await getUsersByIds(userIds);
      setSelectedUsers(users);
      
      // Auto-generate group name
      const names = users.slice(0, 3).map(u => u.displayName);
      let autoName = names.join(', ');
      if (users.length > 3) {
        autoName += ` +${users.length - 3} more`;
      }
      setGroupName(autoName);
    } catch (error) {
      console.error('Failed to load users:', error);
      alert('Failed to load selected users');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!user) return;
    
    if (selectedUsers.length < 2) {
      alert('A group must have at least 2 other members');
      return;
    }

    setCreating(true);
    try {
      console.log('Creating group chat...');
      
      // Create group chat
      const chat = await createGroupChat(
        user.uid,
        selectedUsers.map(u => u.id),
        groupName.trim() || undefined
      );
      
      console.log(`✅ Group created: ${chat.id}`);
      
      // Navigate back to chats list, then push to the new chat
      // This ensures the navigation stack is correct
      router.back(); // Back to new-chat
      router.back(); // Back to chats list
      router.push(`/(authenticated)/chat/${chat.id}` as any);
    } catch (error: any) {
      console.error('Failed to create group:', error);
      alert(`Failed to create group: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveUser = (userId: string) => {
    const newUsers = selectedUsers.filter(u => u.id !== userId);
    setSelectedUsers(newUsers);
    
    if (newUsers.length === 0) {
      router.back();
      return;
    }
    
    // Regenerate group name
    const names = newUsers.slice(0, 3).map(u => u.displayName);
    let autoName = names.join(', ');
    if (newUsers.length > 3) {
      autoName += ` +${newUsers.length - 3} more`;
    }
    setGroupName(autoName);
  };

  const renderUserItem = ({ item }: { item: PublicUserProfile }) => (
    <View style={styles.userItem}>
      <View style={styles.avatar}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>
            {item.displayName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>{item.displayName}</Text>
        {item.username && (
          <Text style={styles.username}>@{item.username}</Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => handleRemoveUser(item.id)}
        style={styles.removeButton}
      >
        <Text style={styles.removeText}>✕</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
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
        <Text style={styles.headerTitle}>New Group</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Group Name Input */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Group Name</Text>
        <TextInput
          style={styles.groupNameInput}
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Enter group name..."
          placeholderTextColor="#64748B"
          maxLength={50}
        />
      </View>

      {/* Participants */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          Participants ({selectedUsers.length + 1})
        </Text>
        
        {/* Current user */}
        {user && (
          <View style={styles.userItem}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>You</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.displayName}>You</Text>
              <Text style={styles.adminBadge}>Admin</Text>
            </View>
          </View>
        )}
        
        {/* Selected users */}
        <FlatList
          data={selectedUsers}
          renderItem={renderUserItem}
          keyExtractor={(item) => item.id}
          style={styles.userList}
        />
      </View>

      {/* Create Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreateGroup}
          disabled={creating || selectedUsers.length < 2}
        >
          {creating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create Group</Text>
          )}
        </TouchableOpacity>
      </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 60,
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
  section: {
    padding: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  groupNameInput: {
    fontSize: 16,
    padding: 12,
    backgroundColor: '#1E293B',
    borderRadius: 10,
    color: '#FFFFFF',
  },
  userList: {
    maxHeight: 300,
  },
  userItem: {
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
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  username: {
    fontSize: 14,
    color: '#64748B',
  },
  adminBadge: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '600',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  createButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

