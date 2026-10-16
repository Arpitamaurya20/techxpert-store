import Ionicons from '@expo/vector-icons/Ionicons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH, colors, fonts, radius, spacing, typography } from '@/constants/theme';

type ToastVariant = 'success' | 'error';

type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  action?: { label: string; onPress: () => void };
  /** Distance above the bottom safe area; defaults to clearing the tab bar. */
  bottomOffset?: number;
};

type ToastContextValue = {
  showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;
/** Leaves room for the bottom tab bar so the toast never covers it. */
const TAB_BAR_CLEARANCE = 64;

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((options: ToastOptions) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({ ...options, id: Date.now() });
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(options.message);
    timeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const value = useMemo(() => ({ showToast }), [showToast]);
  const isError = toast?.variant === 'error';

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          key={toast.id}
          style={[
            styles.wrapper,
            { bottom: insets.bottom + (toast.bottomOffset ?? TAB_BAR_CLEARANCE) },
          ]}
        >
          <View
            style={[styles.toast, isError && styles.toastError]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Ionicons
              name={isError ? 'alert-circle' : 'checkmark-circle'}
              size={20}
              color={isError ? '#FFB4AB' : '#7BD49A'}
            />
            <Text style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
            {toast.action ? (
              <Pressable
                onPress={() => {
                  setToast(null);
                  toast.action?.onPress();
                }}
                accessibilityRole="button"
                hitSlop={8}
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              >
                <Text style={styles.actionLabel}>{toast.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  toast: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastError: {
    backgroundColor: '#5C1A1A',
  },
  message: {
    ...typography.caption,
    flex: 1,
    color: colors.white,
    fontFamily: fonts.medium,
  },
  action: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  actionPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  actionLabel: {
    ...typography.label,
    color: '#7BD49A',
  },
});
