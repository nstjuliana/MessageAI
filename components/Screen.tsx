/**
 * Screen component that provides standard structure for all authenticated screens
 * Includes network status bar that appears between header and content
 */

import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import NetworkStatusBar from './NetworkStatusBar';

interface ScreenProps {
  children: ReactNode;
}

export default function Screen({ children }: ScreenProps) {
  return (
    <View style={styles.container}>
      {children}
    </View>
  );
}

/**
 * Screen.Header - Wrap your header content with this
 */
Screen.Header = function ScreenHeader({ children }: { children: ReactNode }) {
  return <View>{children}</View>;
};

/**
 * Screen.Content - Wrap your main content with this
 * Network status bar automatically appears between Header and Content
 */
Screen.Content = function ScreenContent({ children }: { children: ReactNode }) {
  return (
    <>
      <NetworkStatusBar />
      <View style={styles.content}>{children}</View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    flex: 1,
  },
});

