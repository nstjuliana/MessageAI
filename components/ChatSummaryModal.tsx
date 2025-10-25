/**
 * Chat Summary Modal Component
 * Displays AI-generated summary of a chat conversation
 */

import React from 'react';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface ChatSummaryModalProps {
  visible: boolean;
  summary: string | null;
  loading: boolean;
  error: string | null;
  chatTitle: string;
  onClose: () => void;
}

export default function ChatSummaryModal({
  visible,
  summary,
  loading,
  error,
  chatTitle,
  onClose,
}: ChatSummaryModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Chat Summary</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Chat Title */}
          <Text style={styles.chatTitle}>{chatTitle}</Text>

          {/* Content */}
          <ScrollView 
            style={styles.contentContainer}
            contentContainerStyle={styles.contentInner}
            showsVerticalScrollIndicator={true}
          >
            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Generating summary...</Text>
              </View>
            )}

            {error && !loading && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorEmoji}>⚠️</Text>
                <Text style={styles.errorTitle}>Error</Text>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {summary && !loading && !error && (
              <View style={styles.summaryContainer}>
                <Text style={styles.summaryText}>{summary}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.closeFooterButton}
              onPress={onClose}
            >
              <Text style={styles.closeFooterButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 4,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#8E8E93',
    lineHeight: 24,
  },
  chatTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  contentContainer: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF3B30',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
  },
  summaryContainer: {
    paddingVertical: 8,
  },
  summaryText: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  closeFooterButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeFooterButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
});

