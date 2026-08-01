import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts } from '../constants/theme';

interface Props {
  variant?: 'banner' | 'card';
}

export function ProjectPlaceholder({ variant = 'banner' }: Props) {
  if (variant === 'card') {
    return (
      <View style={s.card}>
        <Feather name="layers" size={22} color={colors.faint} />
      </View>
    );
  }

  return (
    <View style={s.banner}>
      {/* Diagonal stripe overlay */}
      <View style={s.stripes} pointerEvents="none">
        {Array.from({ length: 14 }).map((_, i) => (
          <View key={i} style={[s.stripe, { left: i * 36 - 60 }]} />
        ))}
      </View>

      {/* Center content */}
      <View style={s.bannerContent}>
        <View style={s.iconCircle}>
          <Feather name="home" size={22} color={colors.gris} />
        </View>
        <Text style={s.bannerLabel}>Sin foto de portada</Text>
      </View>
    </View>
  );
}

const STRIPE_COLOR = 'rgba(255,255,255,0.03)';

const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },

  banner: {
    flex: 1,
    backgroundColor: '#1A1D24',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripes: {
    position: 'absolute',
    top: -100,
    bottom: -100,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  stripe: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 20,
    backgroundColor: STRIPE_COLOR,
    transform: [{ rotate: '20deg' }],
  },

  bannerContent: {
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.faint,
    fontWeight: '700',
  },
});
