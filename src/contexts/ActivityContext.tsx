/**
 * Activity Context
 * Provides access to activity tracking for presence management
 * Allows any screen to signal user activity (reset away timer)
 */

import React, { createContext, useContext } from 'react';

interface ActivityContextType {
  resetActivityTimer: () => void;
}

const ActivityContext = createContext<ActivityContextType | undefined>(undefined);

export function ActivityProvider({ 
  children, 
  resetActivityTimer 
}: { 
  children: React.ReactNode;
  resetActivityTimer: () => void;
}) {
  return (
    <ActivityContext.Provider value={{ resetActivityTimer }}>
      {children}
    </ActivityContext.Provider>
  );
}

export function useActivity() {
  const context = useContext(ActivityContext);
  if (!context) {
    // Return a no-op if context is not available (shouldn't happen in normal use)
    return { resetActivityTimer: () => {} };
  }
  return context;
}

