import { useRef, useState } from 'react';
import { Animated, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { colors } from '../constants/theme';

interface Props {
  uri: string | null | undefined;
  style?: StyleProp<ImageStyle>;
  placeholderColor?: string;
  borderRadius?: number;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
}

export function FadeImage({ uri, style, placeholderColor, borderRadius, resizeMode = 'cover' }: Props) {
  const opacity  = useRef(new Animated.Value(0)).current;
  const [failed, setFailed] = useState(false);

  const onLoad = () => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const bg = placeholderColor ?? colors.chip;
  const br = borderRadius ?? 0;

  return (
    <View style={[style, styles.wrap, { backgroundColor: bg, borderRadius: br }]}>
      {uri && !failed && (
        <Animated.Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { opacity, borderRadius: br }]}
          onLoad={onLoad}
          onError={() => setFailed(true)}
          resizeMode={resizeMode}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
});
