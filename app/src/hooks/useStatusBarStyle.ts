import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle, type StatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';

/**
 * Tab screens stay mounted after their first visit, so a <StatusBar>
 * element cannot tell which tab is visible. This sets the style whenever
 * the screen gains focus and restores dark icons when it loses focus.
 */
export function useStatusBarStyle(style: StatusBarStyle) {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(style);
      return () => setStatusBarStyle('dark');
    }, [style])
  );
}
