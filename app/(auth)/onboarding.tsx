import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const LOGO_SRC = require('../../assets/icon.png');

function Logo({ size = 48 }: { size?: number }) {
  return <Image source={LOGO_SRC} style={{ width: size, height: size }} resizeMode="contain" />;
}

function Field({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'words';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldRow}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          selectionColor={colors.arena}
        />
      </View>
    </View>
  );
}

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

export default function OnboardingScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [studioName, setStudioName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate =
    fullName.trim().length > 0 &&
    studioName.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 6;

  async function handleCreate() {
    if (!canCreate) return;
    setLoading(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName.trim() } },
    });

    if (signUpError) {
      setLoading(false);
      const msg = signUpError.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already in use') || msg.includes('already exists')) {
        setError('Ya existe una cuenta con ese email.');
      } else {
        setError('Ocurrió un error. Intentá de nuevo.');
      }
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setLoading(false);
      setError('Cuenta creada. Ingresá con tu email y contraseña.');
      return;
    }

    await supabase.rpc('create_studio', {
      studio_name: studioName.trim(),
      studio_plan: plan,
    });

    setLoading(false);
    // onAuthStateChange en _layout redirige automáticamente
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
            <View style={styles.logoRow}>
              <Logo />
            </View>
            <Text style={styles.heading}>Configurá tu{'\n'}espacio de trabajo</Text>

            <View style={styles.fields}>
              <Field
                label="NOMBRE DEL ESTUDIO"
                value={studioName}
                onChangeText={setStudioName}
                placeholder="Ej: Estudio Belgrano"
                autoCapitalize="words"
              />
              <Field
                label="NOMBRE COMPLETO"
                value={fullName}
                onChangeText={setFullName}
                placeholder="Juan García"
                autoCapitalize="words"
              />
              <Field
                label="CORREO"
                value={email}
                onChangeText={setEmail}
                placeholder="nombre@estudio.com"
                keyboardType="email-address"
              />
              <Field
                label="CONTRASEÑA"
                value={password}
                onChangeText={setPassword}
                placeholder="Mínimo 6 caracteres"
                secureTextEntry
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <View style={styles.plans}>
              <Text style={styles.plansLabel}>ELEGÍ TU PLAN</Text>
              <View style={styles.plansList}>
                <PlanCard name="Starter" price="$49/mes" desc="3 usuarios · 30 videos/mes" active={plan === 'starter'} onPress={() => setPlan('starter')} />
                <PlanCard name="Pro" price="$149/mes" desc="10 usuarios · 100 videos/mes" active={plan === 'pro'} onPress={() => setPlan('pro')} />
                <PlanCard name="Enterprise" price="A medida" desc="Usuarios y videos ilimitados" active={plan === 'enterprise'} onPress={() => setPlan('enterprise')} />
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
            <Text style={styles.trialNote}>14 días gratis, sin tarjeta requerida</Text>
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
  top: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.lg },
  topBar: { marginBottom: spacing.sm },
  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  logoRow: { alignItems: 'center', marginBottom: spacing.sm },
  heading: { fontFamily: fonts.archivo.bold, fontSize: 26, color: colors.crema, letterSpacing: -0.6, lineHeight: 32, textAlign: 'center' },
  fields: { gap: spacing.xl },
  field: { gap: 8 },
  fieldLabel: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gris, fontWeight: '700' },
  fieldRow: { borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  fieldInput: { fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema, paddingVertical: 8 },
  errorText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error },
  plans: { gap: spacing.md, marginTop: spacing.sm },
  plansLabel: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gris, fontWeight: '700' },
  plansList: { gap: spacing.sm },
  planCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: 20, backgroundColor: colors.panel, shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 },
  planCardActive: { backgroundColor: colors.crema, shadowOpacity: 0, elevation: 0 },
  planCardLeft: { gap: 3 },
  planName: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  planNameActive: { color: '#FFFFFF' },
  planDesc: { fontFamily: fonts.archivo.semibold, fontSize: 11.5, color: colors.gris },
  planDescActive: { color: 'rgba(255,255,255,0.6)' },
  planPrice: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema },
  planPriceActive: { color: '#FFFFFF' },
  bottom: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
  trialNote: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.4, color: colors.faint, textAlign: 'center', textTransform: 'uppercase' },
});
