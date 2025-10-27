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
import { createUser, isUsernameAvailable } from '@/services/user.service';
import { formatUsername, validateUsername } from '@/utils/username';

export default function ProfileSetupScreen() {
  const { user } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [errors, setErrors] = useState<{
    username?: string;
    displayName?: string;
  }>({});

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    // Username validation
    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else {
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.valid) {
        newErrors.username = usernameValidation.error;
      }
    }

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
      // Check username availability
      const formattedUsername = formatUsername(username);
      const available = await isUsernameAvailable(formattedUsername);
      
      if (!available) {
        setErrors({ ...errors, username: 'Username is already taken' });
        setLoading(false);
        return;
      }

      // Create user profile in Firestore
      await createUser(user.uid, {
        username: formattedUsername,
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

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Username <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.usernameInputContainer}>
              <Text style={styles.usernamePrefix}>@</Text>
              <TextInput
                style={[styles.usernameInput, errors.username && styles.inputError]}
                placeholder="username"
                placeholderTextColor="#64748B"
                value={username}
                onChangeText={(text) => {
                  // Only allow lowercase letters, numbers, and underscores
                  const filtered = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
                  setUsername(filtered);
                  if (errors.username) {
                    setErrors({ ...errors, username: undefined });
                  }
                }}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                editable={!loading}
                maxLength={20}
              />
            </View>
            {errors.username && (
              <Text style={styles.errorText}>{errors.username}</Text>
            )}
            <Text style={styles.helperText}>
              {username.length}/20 characters • Letters, numbers, and underscores only
            </Text>
          </View>

          {/* Display Name Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              Display Name <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, errors.displayName && styles.inputError]}
              placeholder="How should we call you?"
              placeholderTextColor="#64748B"
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
              placeholderTextColor="#64748B"
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
    backgroundColor: '#0F172A',
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
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
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
    backgroundColor: '#6366F1',
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
    color: '#6366F1',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E2E8F0',
    marginBottom: 8,
  },
  required: {
    color: '#FF3B30',
  },
  usernameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    backgroundColor: '#1E293B',
    height: 50,
  },
  usernamePrefix: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
    paddingLeft: 16,
  },
  usernameInput: {
    flex: 1,
    height: 50,
    paddingHorizontal: 8,
    fontSize: 16,
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: '#FFFFFF',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
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
    color: '#64748B',
    marginTop: 4,
  },
  readOnlyInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  readOnlyText: {
    fontSize: 16,
    color: '#64748B',
  },
  button: {
    height: 50,
    backgroundColor: '#6366F1',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonPressed: {
    backgroundColor: '#4F46E5',
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
    color: '#64748B',
    textAlign: 'center',
    marginTop: 16,
  },
});

