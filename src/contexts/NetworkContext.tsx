/**
 * Network Context
 * Provides global network connectivity state
 */

import NetInfo from '@react-native-community/netinfo';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface NetworkContextValue {
  isConnected: boolean;
}

const NetworkContext = createContext<NetworkContextValue | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then(state => {
      setIsConnected(state.isConnected === true);
    });

    // Listen for changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = state.isConnected === true;
      setIsConnected(connected);
      console.log('🌐 Network status changed:', connected ? 'online' : 'offline');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isConnected }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (!context) {
    throw new Error('useNetwork must be used within NetworkProvider');
  }
  return context;
}

