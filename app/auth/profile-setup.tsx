import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { createWelcomeChat } from '@/services/chat.service';
import { createUser } from '@/services/user.service';

export default function ProfileSetupScreen() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    displayName?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Display name validation
    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Display name must be at least 2 characters';
    } else if (displayName.trim().length > 50) {
      newErrors.displayName = 'Display name must be less than 50 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleComplete = async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    if (!user) {
      Alert.alert('Error', 'No authenticated user found. Please sign up again.');
      router.replace('/auth/signup');
      return;
    }

    setLoading(true);

    try {
      // Create user profile in Firestore
      await createUser(user.uid, {
        displayName: displayName.trim(),
        email: user.email || undefined,
        bio: bio.trim() || undefined,
      });

      // Create welcome chat with MessageAI (non-blocking)
      createWelcomeChat(user.uid, displayName.trim()).catch((error) => {
        console.warn('Failed to create welcome chat:', error);
        // Don't block user if welcome chat fails
      });

      // Success - navigate to main app
      router.replace('/(authenticated)/chats');
    } catch (error: any) {
      // Show error alert
      Alert.alert('Setup Failed', error.message || 'Failed to create profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // For now, we require display name, so skip is not available
    // Could be enabled later if we want to make it optional
    Alert.alert(
      'Display Name Required',
      'Please enter a display name to continue. This is how other users will see you.'
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Set Up Your Profile</Text>
          <Text style={styles.subtitle}>Tell us a bit about yourself</Text>
        </View>

        <View style={styles.form}>
          {/* Avatar Placeholder - Will be implemented later with image picker */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {displayName.trim() ? displayName.trim()[0].toUpperCase() : '?'}
              </Text>
            </View>
            <Pressable style={styles.avatarButton} onPress={() => Alert.alert('Coming Soon', 'Avatar upload will be available soon!')}>
              <Text style={styles.avatarButtonText}>Add Photo</Text>
            </Pressable>
          </View>

          {/* Display Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Display Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.displayName && styles.inputError]}
              placeholder="How should we call you?"
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                if (errors.displayName) {
                  setErrors({ ...errors, displayName: undefined });
                }
              }}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              editable={!loading}
              maxLength={50}
            />
            {errors.displayName && (
              <Text style={styles.errorText}>{errors.displayName}</Text>
            )}
            <Text style={styles.helperText}>
              {displayName.length}/50 characters
            </Text>
          </View>

          {/* Bio Input (Optional) */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Bio (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell others about yourself..."
              value={bio}
              onChangeText={setBio}
              autoCapitalize="sentences"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!loading}
              maxLength={150}
            />
            <Text style={styles.helperText}>
              {bio.length}/150 characters
            </Text>
          </View>

          {/* Email Display (Read-only) */}
          {user?.email && (
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.readOnlyInput}>
                <Text style={styles.readOnlyText}>{user.email}</Text>
              </View>
            </View>
          )}

          {/* Complete Button */}
          <Pressable
            style={({ pressed }) => [
              styles.button,
              loading && styles.buttonDisabled,
              pressed && !loading && styles.buttonPressed,
            ]}
            onPress={handleComplete}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Complete Setup</Text>
            )}
          </Pressable>

          {/* Info Text */}
          <Text style={styles.infoText}>
            You can update your profile anytime from settings
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  avatarButtonText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 90,
    paddingTop: 12,
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  readOnlyInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#666',
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    backgroundColor: '#0051D5',
  },
  buttonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
});

