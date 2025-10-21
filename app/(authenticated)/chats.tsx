/**
 * Chats Screen (Protected)
 * Main chat list screen - only accessible when authenticated
 */

import { Button, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';

export default function ChatsScreen() {
  const { user, logOut } = useAuth();
  const { userProfile } = useUser();

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
});


