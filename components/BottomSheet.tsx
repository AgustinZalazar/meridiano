import { useEffect, useState, useRef } from 'react';
import {
  Modal, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  avoidKeyboard?: boolean;
}

export function BottomSheet({ visible, onClose, children, avoidKeyboard = false }: Props) {
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);
  const closingRef = useRef(false);
  const { bottom: bottomInset } = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      closingRef.current = false;
      setMounted(true);
      backdropOpacity.value = withTiming(1, { duration: 280 });
      translateY.value = withSpring(0, { damping: 22, stiffness: 200, mass: 0.9 });
    } else {
      closingRef.current = true;
      backdropOpacity.value = withTiming(0, { duration: 220 });
      translateY.value = withSpring(600, { damping: 28, stiffness: 280 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
      // Fallback: unmount if spring callback doesn't fire with finished=true
      const timer = setTimeout(() => {
        if (closingRef.current) setMounted(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
        pointerEvents="none"
      />
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        enabled={avoidKeyboard}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        {/* bottom: -bottomInset extends past the safe-area boundary to the physical screen edge */}
        <Animated.View style={[styles.sheetAnchor, { bottom: -bottomInset }, sheetStyle]}>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  overlay: { flex: 1 },
  sheetAnchor: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
