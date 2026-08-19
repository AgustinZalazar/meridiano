import { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform,
} from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  avoidKeyboard?: boolean;
}

export function BottomSheet({ visible, onClose, children, avoidKeyboard = false }: Props) {
  const [mounted, setMounted] = useState(visible);
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop fades in independently over the sliding sheet */}
      <Animated.View
        style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdropOpacity }]}
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
        {children}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  overlay:  { flex: 1, justifyContent: 'flex-end' },
});
