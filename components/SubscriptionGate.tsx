import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../constants/theme';
import { useSubscription } from '../lib/use-subscription';

// Set your landing page / pricing URL here
const PRICING_URL = 'https://meridianoapp.com/precios';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SubscriptionGate({ children, fallback }: Props) {
  const { isActive, loading } = useSubscription();

  if (loading) return null;
  if (isActive) return <>{children}</>;

  return fallback ? <>{fallback}</> : <UpgradePrompt />;
}

export function UpgradePrompt() {
  return (
    <View style={s.container}>
      <View style={s.iconWrap}>
        <Feather name="lock" size={22} color={colors.arena} />
      </View>
      <Text style={s.title}>Función premium</Text>
      <Text style={s.body}>
        Esta función está disponible en el plan Pro. Suscribite para acceder.
      </Text>
      <TouchableOpacity
        style={s.btn}
        onPress={() => Linking.openURL(PRICING_URL)}
        activeOpacity={0.85}
      >
        <Text style={s.btnText}>Ver planes</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    margin: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.panel,
    borderRadius: 20,
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.archivo.bold,
    fontSize: 16,
    color: colors.crema,
  },
  body: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 14,
    color: colors.gris,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    marginTop: spacing.sm,
    height: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: 23,
    backgroundColor: colors.arena,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14,
    color: '#FFFFFF',
  },
});
