import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../constants/theme';
import { useStudio } from '../lib/use-studio';
import { useSubscription } from '../lib/use-subscription';

interface PlanDef {
  key: string;
  name: string;
  price: string;
  period: string;
  users: string;
  videosLabel: string;
  features: string[];
}

const PLANS: PlanDef[] = [
  {
    key: 'starter',
    name: 'Starter',
    price: '$49',
    period: '/mes',
    users: '3 usuarios',
    videosLabel: '30 videos/período',
    features: [
      'Proyectos ilimitados',
      '3 usuarios por estudio',
      '30 videos por período',
      'Informes en PDF',
      'Soporte por email',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$149',
    period: '/mes',
    users: '10 usuarios',
    videosLabel: '100 videos/período',
    features: [
      'Todo lo de Starter',
      '10 usuarios por estudio',
      '100 videos por período',
      'Acceso prioritario a AI',
      'Soporte prioritario',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 'A medida',
    period: '',
    users: 'Ilimitado',
    videosLabel: 'Videos ilimitados',
    features: [
      'Todo lo de Pro',
      'Usuarios ilimitados',
      'Videos ilimitados',
      'Integración con sistemas externos',
      'Soporte dedicado',
    ],
  },
];

function formatPeriodEnd(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function SuscripcionScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { studio } = useStudio();
  const { subscription } = useSubscription();

  const currentPlanKey = studio?.plan ?? 'starter';

  function handleUpgrade(planKey: string) {
    if (planKey === currentPlanKey) return;
    if (planKey === 'enterprise') {
      Alert.alert(
        'Enterprise',
        'Para acceder al plan Enterprise, contactanos a hola@meridiano.app'
      );
      return;
    }
    Alert.alert('Próximamente', 'El cambio de plan estará disponible en breve.');
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={colors.crema} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Suscripción</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40, paddingHorizontal: spacing.xl }}
      >
        {/* Current plan summary */}
        <View style={styles.currentCard}>
          <View style={styles.currentCardTop}>
            <View>
              <Text style={styles.currentLabel}>PLAN ACTUAL</Text>
              <Text style={styles.currentPlanName}>
                {PLANS.find((p) => p.key === currentPlanKey)?.name ?? 'Starter'}
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>
                {subscription?.status === 'trialing' ? 'Prueba' : 'Activo'}
              </Text>
            </View>
          </View>
          {subscription?.currentPeriodEnd && (
            <Text style={styles.currentPeriodText}>
              Próximo cobro: {formatPeriodEnd(subscription.currentPeriodEnd)}
            </Text>
          )}
        </View>

        {/* Plan cards */}
        <Text style={styles.sectionLabel}>PLANES DISPONIBLES</Text>

        {PLANS.map((plan) => {
          const isCurrent = plan.key === currentPlanKey;
          return (
            <View key={plan.key} style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Plan actual</Text>
                </View>
              )}

              <View style={styles.planCardHead}>
                <View>
                  <Text style={[styles.planName, isCurrent && styles.planNameCurrent]}>{plan.name}</Text>
                  <Text style={[styles.planMeta, isCurrent && styles.planMetaCurrent]}>
                    {plan.users} · {plan.videosLabel}
                  </Text>
                </View>
                <View style={styles.priceWrap}>
                  <Text style={[styles.planPrice, isCurrent && styles.planPriceCurrent]}>{plan.price}</Text>
                  {plan.period ? (
                    <Text style={[styles.planPeriod, isCurrent && styles.planPeriodCurrent]}>{plan.period}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.featureList}>
                {plan.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Feather
                      name="check"
                      size={13}
                      color={isCurrent ? 'rgba(255,255,255,0.7)' : colors.success}
                    />
                    <Text style={[styles.featureText, isCurrent && styles.featureTextCurrent]}>{f}</Text>
                  </View>
                ))}
              </View>

              {!isCurrent && (
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() => handleUpgrade(plan.key)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.upgradeBtnText}>
                    {plan.key === 'enterprise' ? 'Contactar' : `Cambiar a ${plan.name}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <Text style={styles.disclaimer}>
          Los cambios de plan se aplican al inicio del próximo período de facturación.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  headerTitle: {
    fontFamily: fonts.archivo.bold, fontSize: 20,
    color: colors.crema, letterSpacing: -0.4,
  },

  currentCard: {
    borderRadius: 20, backgroundColor: colors.crema,
    padding: 20, gap: 8, marginBottom: spacing.lg,
  },
  currentCardTop: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  currentLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontWeight: '700',
    marginBottom: 4,
  },
  currentPlanName: {
    fontFamily: fonts.archivo.bold, fontSize: 22,
    color: '#FFFFFF', letterSpacing: -0.5,
  },
  activeBadge: {
    height: 28, borderRadius: 14, paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  activeBadgeText: {
    fontFamily: fonts.archivo.bold, fontSize: 11, color: '#FFFFFF',
  },
  currentPeriodText: {
    fontFamily: fonts.archivo.semibold, fontSize: 12.5,
    color: 'rgba(255,255,255,0.5)',
  },

  sectionLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
    marginBottom: 12,
  },

  planCard: {
    borderRadius: 20, backgroundColor: colors.panel,
    padding: 20, gap: 16, marginBottom: 12,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
    overflow: 'hidden',
  },
  planCardCurrent: {
    backgroundColor: colors.crema,
  },
  currentBadge: {
    alignSelf: 'flex-start',
    height: 24, borderRadius: 12, paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: -4,
  },
  currentBadgeText: {
    fontFamily: fonts.archivo.bold, fontSize: 10.5, color: 'rgba(255,255,255,0.8)',
  },
  planCardHead: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  planName: {
    fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema, letterSpacing: -0.3,
  },
  planNameCurrent: { color: '#FFFFFF' },
  planMeta: {
    fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: colors.gris, marginTop: 3,
  },
  planMetaCurrent: { color: 'rgba(255,255,255,0.55)' },
  priceWrap: { alignItems: 'flex-end' },
  planPrice: {
    fontFamily: fonts.archivo.bold, fontSize: 22, color: colors.crema, letterSpacing: -0.5,
  },
  planPriceCurrent: { color: '#FFFFFF' },
  planPeriod: {
    fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.gris, marginTop: 1,
  },
  planPeriodCurrent: { color: 'rgba(255,255,255,0.5)' },

  featureList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  featureText: {
    fontFamily: fonts.archivo.semibold, fontSize: 13.5, color: colors.gris, flex: 1,
  },
  featureTextCurrent: { color: 'rgba(255,255,255,0.75)' },

  upgradeBtn: {
    height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.chip,
  },
  upgradeBtnText: {
    fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema,
  },

  disclaimer: {
    fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.faint,
    textAlign: 'center', marginTop: spacing.md, lineHeight: 18,
  },
});
