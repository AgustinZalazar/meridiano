import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useStudio } from '../../lib/use-studio';

function PlanCard({ name, price, desc, active, onPress }: { name: string; price: string; desc: string; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.planCard, active && styles.planCardActive]} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.planCardLeft}>
        <Text style={[styles.planName, active && styles.planNameActive]}>{name}</Text>
        <Text style={[styles.planDesc, active && styles.planDescActive]}>{desc}</Text>
      </View>
      <Text style={[styles.planPrice, active && styles.planPriceActive]}>{price}</Text>
    </TouchableOpacity>
  );
}

export default function CrearEstudioScreen() {
  const router = useRouter();
  const { studio, loading: studioLoading } = useStudio();
  const [studioName, setStudioName] = useState('');
  const [plan, setPlan] = useState<'starter' | 'pro' | 'enterprise'>('starter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already in a studio — redirect instead of letting them create another
  if (!studioLoading && studio) {
    router.replace('/(tabs)');
    return null;
  }

  const canCreate = studioName.trim().length > 0;

  async function handleCreate() {
    if (!canCreate) return;
    setLoading(true);
    setError(null);

    const { error: rpcError } = await supabase.rpc('create_studio', {
      studio_name: studioName.trim(),
      studio_plan: plan,
    });

    setLoading(false);
    if (rpcError) {
      setError('No se pudo crear el estudio. Intentá de nuevo.');
      return;
    }
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.top}>
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
                <Feather name="arrow-left" size={16} color={colors.crema} />
              </TouchableOpacity>
            </View>
            <Text style={styles.heading}>Crear estudio</Text>
            <Text style={styles.subheading}>Tu espacio de trabajo en Meridiano</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>NOMBRE DEL ESTUDIO</Text>
              <View style={styles.fieldRow}>
                <TextInput
                  style={styles.fieldInput}
                  value={studioName}
                  onChangeText={setStudioName}
                  placeholder="Ej: Estudio Belgrano"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="words"
                  autoCorrect={false}
                  selectionColor={colors.arena}
                  autoFocus
                />
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.plans}>
              <Text style={styles.plansLabel}>PLAN</Text>
              <View style={styles.plansList}>
                <PlanCard name="Starter" price="$0/mes" desc="1 usuario · 10 videos/mes" active={plan === 'starter'} onPress={() => setPlan('starter')} />
                <PlanCard name="Pro" price="$49/mes" desc="10 usuarios · 60 videos/mes" active={plan === 'pro'} onPress={() => setPlan('pro')} />
                <PlanCard name="Enterprise" price="A medida" desc="Ilimitado" active={plan === 'enterprise'} onPress={() => setPlan('enterprise')} />
              </View>
            </View>
          </View>

          <View style={styles.bottom}>
            <TouchableOpacity
              style={[styles.btnPrimary, (!canCreate || loading) && styles.btnDisabled]}
              onPress={handleCreate}
              activeOpacity={0.85}
              disabled={!canCreate || loading}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.btnPrimaryText}>Crear estudio  →</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'space-between' },
  top: { padding: spacing.xl, gap: spacing.lg },
  topBar: { marginBottom: spacing.sm },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  heading: {
    fontFamily: fonts.archivo.bold, fontSize: 30, color: colors.crema,
    letterSpacing: -0.7, lineHeight: 36,
  },
  subheading: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris },
  field: { gap: 8 },
  fieldLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  fieldRow: { borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  fieldInput: { fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema, paddingVertical: 8 },
  errorText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error },
  plans: { gap: spacing.md, marginTop: spacing.sm },
  plansLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  plansList: { gap: spacing.sm },
  planCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, borderRadius: 20, backgroundColor: colors.panel,
  },
  planCardActive: { backgroundColor: colors.crema },
  planCardLeft: { gap: 3 },
  planName: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  planNameActive: { color: '#FFFFFF' },
  planDesc: { fontFamily: fonts.archivo.semibold, fontSize: 11.5, color: colors.gris },
  planDescActive: { color: 'rgba(255,255,255,0.6)' },
  planPrice: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema },
  planPriceActive: { color: '#FFFFFF' },
  bottom: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  btnPrimary: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
