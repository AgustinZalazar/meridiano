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

const PASSWORD_RULES: { key: string; label: string; test: (p: string) => boolean }[] = [
  { key: 'len',     label: '8 caracteres',        test: (p) => p.length >= 8 },
  { key: 'upper',   label: '1 mayúscula',          test: (p) => /[A-Z]/.test(p) },
  { key: 'number',  label: '1 número',             test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: '1 carácter especial',  test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function isPasswordValid(p: string) { return PASSWORD_RULES.every((r) => r.test(p)); }

function PasswordRules({ password, touched }: { password: string; touched: boolean }) {
  if (!touched && !password) return null;
  return (
    <View style={styles.rulesRow}>
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <View key={r.key} style={[styles.ruleChip, ok && styles.ruleChipOk]}>
            <Feather name={ok ? 'check' : 'minus'} size={10} color={ok ? colors.success : colors.gris} />
            <Text style={[styles.ruleText, ok && styles.ruleTextOk]}>{r.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Field({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize = 'none',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
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
  const [fullName, setFullName]   = useState('');
  const [studioName, setStudioName] = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched]   = useState(false);
  const [plan, setPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordOk   = isPasswordValid(password);
  const confirmMatch = password === confirm && confirm.length > 0;

  const canCreate =
    fullName.trim().length > 0 &&
    studioName.trim().length > 0 &&
    email.trim().length > 0 &&
    passwordOk &&
    confirmMatch;

  async function handleCreate() {
    if (!canCreate) return;
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    const { error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
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

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (signInError) {
      setLoading(false);
      setError('Cuenta creada. Ingresá con tu email y contraseña.');
      return;
    }

    await supabase.rpc('create_studio', { studio_name: studioName.trim() });
    setLoading(false);
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
              <Image source={LOGO_SRC} style={{ width: 48, height: 48 }} resizeMode="contain" />
            </View>
            <Text style={styles.heading}>Configurá tu{'\n'}espacio de trabajo</Text>

            <View style={styles.fields}>
              <Field label="NOMBRE DEL ESTUDIO" value={studioName} onChangeText={setStudioName} placeholder="Ej: Estudio Belgrano" autoCapitalize="words" />
              <Field label="NOMBRE COMPLETO" value={fullName} onChangeText={setFullName} placeholder="Juan García" autoCapitalize="words" />
              <Field label="CORREO" value={email} onChangeText={setEmail} placeholder="nombre@estudio.com" keyboardType="email-address" />

              {/* Contraseña */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
                <View style={[styles.fieldRow, styles.fieldRowInput]}>
                  <TextInput
                    style={[styles.fieldInput, { flex: 1 }]}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setError(null); }}
                    onFocus={() => setPasswordTouched(true)}
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor={colors.faint}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor={colors.arena}
                    returnKeyType="next"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(s => !s)} hitSlop={10} activeOpacity={0.6}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={colors.gris} />
                  </TouchableOpacity>
                </View>
                <PasswordRules password={password} touched={passwordTouched} />
              </View>

              {/* Repetir contraseña */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>REPETIR CONTRASEÑA</Text>
                <View style={[
                  styles.fieldRow, styles.fieldRowInput,
                  confirmTouched && confirm.length > 0 && !confirmMatch && styles.fieldRowError,
                ]}>
                  <TextInput
                    style={[styles.fieldInput, { flex: 1 }]}
                    value={confirm}
                    onChangeText={(v) => { setConfirm(v); setError(null); }}
                    onFocus={() => setConfirmTouched(true)}
                    placeholder="Repetí tu contraseña"
                    placeholderTextColor={colors.faint}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    autoCorrect={false}
                    selectionColor={colors.arena}
                    returnKeyType="done"
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(s => !s)} hitSlop={10} activeOpacity={0.6}>
                    <Feather name={showConfirm ? 'eye-off' : 'eye'} size={16} color={colors.gris} />
                  </TouchableOpacity>
                </View>
                {confirmTouched && confirm.length > 0 && !confirmMatch && (
                  <Text style={styles.fieldError}>Las contraseñas no coinciden</Text>
                )}
                {confirmMatch && (
                  <View style={styles.matchRow}>
                    <Feather name="check-circle" size={12} color={colors.success} />
                    <Text style={styles.matchText}>Las contraseñas coinciden</Text>
                  </View>
                )}
              </View>
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
  fieldRowInput: { flexDirection: 'row', alignItems: 'center' },
  fieldRowError: { borderBottomColor: colors.error },
  fieldInput: { fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema, paddingVertical: 8 },
  fieldError: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.3,
    color: colors.error, marginTop: 2,
  },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  matchText: { fontFamily: fonts.mono.regular, fontSize: 10, color: colors.success, letterSpacing: 0.2 },

  rulesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  ruleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: colors.chip,
  },
  ruleChipOk: { backgroundColor: '#EBF4EE' },
  ruleText: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris, letterSpacing: 0.2 },
  ruleTextOk: { color: colors.success },

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
