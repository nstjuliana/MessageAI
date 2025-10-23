/**
 * Network Status Bar
 * Shows a red banner when device is offline
 * Uses layout animation to push content down when visible
 */

import { useNetwork } from '@/contexts/NetworkContext';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export default function NetworkStatusBar() {
  const { isConnected } = useNetwork();
  // Initialize height based on current connection state
  const [heightAnim] = useState(() => new Animated.Value(isConnected ? 0 : 40));

  useEffect(() => {
    if (!isConnected) {
      // Expand to show banner
      Animated.spring(heightAnim, {
        toValue: 40,
        useNativeDriver: false, // height animation requires layout
        friction: 8,
      }).start();
    } else {
      // Collapse to hide banner
      Animated.timing(heightAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }
  }, [isConnected]);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: heightAnim,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>📡</Text>
        <Text style={styles.text}>No internet connection</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#DC3545',
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    height: 40,
  },
  icon: {
    fontSize: 16,
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

