/**
 * Chats Screen (Protected)
 * Main chat list screen - only accessible when authenticated
 */

import { Alert, Button, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { getDatabaseStats } from '@/database/database';
import { createWelcomeChat } from '@/services/chat.service';

export default function ChatsScreen() {
  const { user, logOut } = useAuth();
  const { userProfile } = useUser();

  const handleTestDatabase = async () => {
    try {
      const stats = await getDatabaseStats();
      Alert.alert(
        '✅ Database Working!',
        `Database is initialized and working correctly!\n\n` +
        `📊 Statistics:\n` +
        `• Messages: ${stats.messageCount}\n` +
        `• Chats: ${stats.chatCount}\n` +
        `• Participants: ${stats.participantCount}\n` +
        `• Size: ${stats.databaseSize}`,
        [{ text: 'OK' }]
      );
      console.log('Database stats:', stats);
    } catch (error: any) {
      Alert.alert(
        '❌ Database Error',
        `Failed to access database:\n${error.message}`,
        [{ text: 'OK' }]
      );
      console.error('Database test failed:', error);
    }
  };

  const handleCreateWelcomeChat = async () => {
    if (!user || !userProfile?.displayName) {
      Alert.alert('Error', 'User not fully loaded');
      return;
    }

    try {
      console.log('Attempting to create welcome chat...');
      await createWelcomeChat(user.uid, userProfile.displayName);
      Alert.alert(
        '✅ Success!',
        'Welcome chat created! Check Firestore Console.',
        [{ text: 'OK' }]
      );
      console.log('✅ Welcome chat created successfully');
    } catch (error: any) {
      Alert.alert(
        '❌ Failed to Create Chat',
        `Error: ${error.message}\n\nCheck console for details.`,
        [{ text: 'OK' }]
      );
      console.error('❌ Welcome chat creation failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chat List</Text>
      <Text style={styles.subtitle}>
        Welcome, {userProfile?.displayName || user?.email || 'User'}!
      </Text>
      <Text style={styles.info}>Chat functionality coming soon...</Text>
      
      <View style={styles.userInfo}>
        <Text style={styles.label}>Display Name:</Text>
        <Text style={styles.value}>{userProfile?.displayName || 'Not set'}</Text>
        
        <Text style={styles.label}>Email:</Text>
        <Text style={styles.value}>{user?.email}</Text>
        
        <Text style={styles.label}>Status:</Text>
        <Text style={styles.value}>{userProfile?.presence || 'Unknown'}</Text>
        
        <Text style={styles.label}>User ID:</Text>
        <Text style={styles.value}>{user?.uid}</Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="🗄️ Test Database" 
          onPress={handleTestDatabase} 
          color="#007AFF" 
        />
      </View>
      
      <View style={styles.buttonContainer}>
        <Button 
          title="💬 Create Welcome Chat" 
          onPress={handleCreateWelcomeChat} 
          color="#34C759" 
        />
      </View>
      
      <Button title="Log Out" onPress={logOut} color="#FF3B30" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  info: {
    fontSize: 16,
    color: '#999',
    marginBottom: 32,
    textAlign: 'center',
  },
  userInfo: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
  },
  value: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    marginBottom: 16,
  },
});


