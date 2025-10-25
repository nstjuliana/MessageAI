/**
 * GroupAvatar Component
 * Displays group avatar with fallback to text-based initials
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface GroupAvatarProps {
  groupName?: string;
  avatarUrl?: string;
  size?: number;
  groupId?: string;
}

// Generate a consistent color based on string hash
function stringToColor(str: string): string {
  if (!str) return '#007AFF';
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    '#007AFF', // Blue
    '#34C759', // Green
    '#FF9500', // Orange
    '#FF3B30', // Red
    '#AF52DE', // Purple
    '#FF2D55', // Pink
    '#5AC8FA', // Light Blue
    '#FFCC00', // Yellow
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

// Extract initials from group name
function getInitials(groupName?: string): string {
  if (!groupName) return 'G';
  
  const words = groupName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  
  return (words[0][0] + words[1][0]).toUpperCase();
}

export default function GroupAvatar({ 
  groupName, 
  avatarUrl, 
  size = 56,
  groupId 
}: GroupAvatarProps) {
  const initials = getInitials(groupName);
  const backgroundColor = stringToColor(groupId || groupName || 'group');
  
  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      />
    );
  }
  
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          { fontSize: size * 0.4 },
        ]}
      >
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: '#fff',
    fontWeight: '600',
  },
});

