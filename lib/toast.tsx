import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'error' | 'success' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  error:   (message: string) => void;
  success: (message: string) => void;
  info:    (message: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  error:   () => {},
  success: () => {},
  info:    () => {},
});

// ─── Config ───────────────────────────────────────────────────────────────────

const DURATION   = 3200;
const ANIM_IN    = 260;
const ANIM_OUT   = 220;

const ICON: Record<ToastType, React.ComponentProps<typeof Feather>['name']> = {
  error:   'alert-circle',
  success: 'check-circle',
  info:    'info',
};

const ACCENT: Record<ToastType, string> = {
  error:   colors.error,
  success: colors.success,
  info:    colors.arena,
};

// ─── Single toast (animated) ──────────────────────────────────────────────────

function ToastView({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: ANIM_IN,  useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: ANIM_IN,  useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity,    { toValue: 0, duration: ANIM_OUT, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -16, duration: ANIM_OUT, useNativeDriver: true }),
        ]).start(onDone);
      }, DURATION);
    });
  }, []);

  return (
    <Animated.View style={[s.toast, { opacity, transform: [{ translateY }] }]}>
      <View style={[s.iconWrap, { backgroundColor: `${ACCENT[item.type]}26` }]}>
        <Feather name={ICON[item.type]} size={14} color={ACCENT[item.type]} />
      </View>
      <Text style={s.msg} numberOfLines={3}>{item.message}</Text>
    </Animated.View>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const show = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts(prev => [...prev, { id, type, message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    error:   (msg) => show('error',   msg),
    success: (msg) => show('success', msg),
    info:    (msg) => show('info',    msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View style={[s.container, { top: insets.top + 12 }]} pointerEvents="none">
        {toasts.map(t => (
          <ToastView key={t.id} item={t} onDone={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToast() {
  return useContext(ToastContext);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    position: 'absolute', left: 16, right: 16,
    gap: 8, zIndex: 9999,
  },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: colors.crema,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24, shadowRadius: 16, elevation: 10,
  },
  iconWrap: {
    width: 30, height: 30, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  msg: {
    flex: 1, fontFamily: fonts.archivo.semibold,
    fontSize: 13.5, color: colors.tinta, lineHeight: 18,
  },
});
