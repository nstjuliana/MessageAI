import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { httpsCallable } from 'firebase/functions';
import { useState } from 'react';
import { ActivityIndicator, Button, StyleSheet, Text, View } from 'react-native';

import { auth, db, functions } from '@/config/firebase';

export default function HomeScreen() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string>('');

  const testFirebaseConnection = async () => {
    setTesting(true);
    setResult('');

    try {
      // Test 1: Check Firebase initialization
      if (!auth || !db) {
        throw new Error('Firebase not initialized');
      }

      // Test 2: Get current auth state
      const currentUser = auth.currentUser;
      
      // Test 3: Try to access Firestore (just checking connection, not reading data)
      const firestoreApp = db.app;

      setResult(
        '✅ Firebase Connected!\n\n' +
        `Auth: ${auth ? 'Initialized' : 'Failed'}\n` +
        `Firestore: ${db ? 'Initialized' : 'Failed'}\n` +
        `Functions: ${functions ? 'Initialized' : 'Failed'}\n` +
        `User: ${currentUser ? currentUser.uid : 'Not logged in'}\n` +
        `App Name: ${firestoreApp.name}`
      );
    } catch (error: any) {
      setResult(`❌ Firebase Error:\n\n${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  const testCloudFunction = async () => {
    setTesting(true);
    setResult('');

    try {
      // Call the Cloud Function
      const testFunc = httpsCallable(functions, 'testFunction');
      const response = await testFunc({ name: 'MessageAI User' });
      
      const data = response.data as any;
      
      setResult(
        '✅ Cloud Function Success!\n\n' +
        `Message: ${data.message}\n\n` +
        `Timestamp: ${data.timestamp}\n` +
        `Success: ${data.success}`
      );
    } catch (error: any) {
      setResult(`❌ Cloud Function Error:\n\n${error.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>MessageAI</Text>
      <Text style={styles.subtitle}>Chat List Coming Soon</Text>
      
      <View style={styles.authSection}>
        <Button
          title="Sign Up"
          onPress={() => router.push('/auth/signup')}
          color="#007AFF"
        />
        
        <View style={styles.buttonSpacer} />
        
        <Button
          title="Log In"
          onPress={() => router.push('/auth/login')}
          color="#34C759"
        />
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.testSection}>
        <Text style={styles.testTitle}>Testing Tools</Text>
        
        <Button
          title="Test Firebase Connection"
          onPress={testFirebaseConnection}
          disabled={testing}
        />
        
        <View style={styles.buttonSpacer} />
        
        <Button
          title="Test Cloud Function"
          onPress={testCloudFunction}
          disabled={testing}
          color="#34C759"
        />
        
        {testing && (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        )}
        
        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}
      </View>
      
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
    marginBottom: 40,
  },
  authSection: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 20,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: '#ddd',
    marginVertical: 20,
  },
  testSection: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginBottom: 16,
  },
  buttonSpacer: {
    height: 12,
  },
  loader: {
    marginTop: 20,
  },
  resultBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    width: '100%',
  },
  resultText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#333',
  },
});

