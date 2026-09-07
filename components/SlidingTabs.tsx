import { useRef, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated, Easing,
  type LayoutChangeEvent, type StyleProp, type ViewStyle,
} from 'react-native';
import { colors, fonts } from '../constants/theme';

interface Props {
  options: string[];
  selected: string;
  onChange: (v: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function SlidingTabs({ options, selected, onChange, style }: Props) {
  const indicatorLeft  = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const [layouts, setLayouts] = useState<Array<{ x: number; w: number }>>([]);
  const [ready, setReady] = useState(false);

  function onOptionLayout(i: number, e: LayoutChangeEvent) {
    const { x, width } = e.nativeEvent.layout;
    setLayouts(prev => {
      const next = [...prev];
      next[i] = { x, w: width };
      return next;
    });
  }

  useEffect(() => {
    if (layouts.length < options.length || layouts.some(l => !l)) return;
    const idx = options.indexOf(selected);
    const layout = layouts[idx];
    if (!layout) return;

    if (!ready) {
      indicatorLeft.setValue(layout.x);
      indicatorWidth.setValue(layout.w);
      setReady(true);
      return;
    }

    Animated.parallel([
      Animated.timing(indicatorLeft, {
        toValue: layout.x, duration: 280,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false,
      }),
      Animated.timing(indicatorWidth, {
        toValue: layout.w, duration: 280,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        useNativeDriver: false,
      }),
    ]).start();
  }, [selected, layouts, options.length]);

  return (
    <View style={[styles.container, style]}>
      {ready && (
        <Animated.View
          style={[styles.indicator, { left: indicatorLeft, width: indicatorWidth }]}
          pointerEvents="none"
        />
      )}
      {options.map((opt, i) => (
        <TouchableOpacity
          key={opt}
          style={styles.option}
          onLayout={(e) => onOptionLayout(i, e)}
          onPress={() => onChange(opt)}
          activeOpacity={0.8}
        >
          <Text style={[styles.optText, selected === opt && styles.optTextActive]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.chip,
    borderRadius: 20,
    padding: 3,
    alignSelf: 'flex-start',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 17,
    backgroundColor: colors.crema,
  },
  option: {
    height: 30,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 12.5,
    color: colors.gris,
  },
  optTextActive: {
    color: '#FFFFFF',
  },
});
