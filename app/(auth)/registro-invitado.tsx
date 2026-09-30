import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { onboardingKey } from '../welcome';

const RULES: { key: string; label: string; test: (p: string) => boolean }[] = [
  { key: 'len',     label: '8 caracteres',   test: (p) => p.length >= 8 },
  { key: 'upper',   label: '1 mayúscula',     test: (p) => /[A-Z]/.test(p) },
  { key: 'number',  label: '1 número',        test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: '1 carácter especial', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function isPasswordValid(p: string) { return RULES.every((r) => r.test(p)); }

function PasswordRules({ password, touched }: { password: string; touched: boolean }) {
  if (!touched && !password) return null;
  return (
    <View style={styles.rulesRow}>
      {RULES.map((r) => {
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

export default function RegistroInvitadoScreen() {
  const router = useRouter();
  const [fullName, setFullName]         = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const passwordOk   = isPasswordValid(password);
  const confirmMatch = password === confirm && confirm.length > 0;
  const canSubmit    =
    fullName.trim().length > 0 &&
    email.includes('@') &&
    passwordOk &&
    confirmMatch;

  async function handleRegister() {
    if (!canSubmit) return;
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
        setError('Ya existe una cuenta con ese email. Intentá iniciar sesión.');
      } else {
        setError('Ocurrió un error al crear la cuenta. Intentá de nuevo.');
      }
      return;
    }

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError || !signInData.user) {
      setLoading(false);
      setError('Cuenta creada. Intentá iniciar sesión desde la pantalla anterior.');
      return;
    }

    // handle_new_user() trigger auto-joins if a studio_invites row exists for this email
    const { data: membership } = await supabase
      .from('studio_members')
      .select('studio_id')
      .eq('user_id', signInData.user.id)
      .maybeSingle();

    if (!membership) {
      await supabase.auth.signOut();
      setLoading(false);
      setError(
        'No encontramos una invitación pendiente para ese email. '
        + 'Pedile al admin del estudio que te invite primero.',
      );
      return;
    }

    await AsyncStorage.setItem(onboardingKey(signInData.user.id), 'true');
    setLoading(false);
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.top}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
              <Feather name="arrow-left" size={16} color={colors.crema} />
            </TouchableOpacity>

            <View style={styles.iconWrap}>
              <Feather name="mail" size={22} color={colors.crema} />
            </View>

            <Text style={styles.heading}>Unirme{'\n'}al estudio</Text>
            <Text style={styles.subheading}>
              Completá tus datos con el email al que te enviaron la invitación.
            </Text>

            <View style={styles.fields}>
              {/* Nombre */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>NOMBRE COMPLETO</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={(v) => { setFullName(v); setError(null); }}
                  placeholder="Juan García"
                  placeholderTextColor={colors.faint}
                  autoCapitalize="words"
                  autoCorrect={false}
                  selectionColor={colors.arena}
                  returnKeyType="next"
                />
              </View>

              {/* Email */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>CORREO DE INVITACIÓN</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); }}
                  placeholder="nombre@empresa.com"
                  placeholderTextColor={colors.faint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  selectionColor={colors.arena}
                  returnKeyType="next"
                />
              </View>

              {/* Contraseña */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>CONTRASEÑA</Text>
                <View style={[styles.inputRow, passwordTouched && !passwordOk && styles.inputRowError]}>
                  <TextInput
                    style={[styles.input, styles.inputNoBorder, { flex: 1 }]}
                    value={password}
                    onChangeText={(v) => { setPassword(v); setError(null); }}
                    onFocus={() => setPasswordTouched(true)}
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor={colors.faint}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    selectionColor={colors.arena}
                    returnKeyType="next"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(s => !s)} hitSlop={10} activeOpacity={0.6}>
                    <Feather name={showPassword ? 'eye-off' : 'eye'} size={16} color={colors.gris} />
                  </TouchableOpacity>
                </View>
                <PasswordRules password={password} touched={passwordTouched} />
              </View>

              {/* Confirmar contraseña */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>REPETIR CONTRASEÑA</Text>
                <View style={[
                  styles.inputRow,
                  confirmTouched && confirm.length > 0 && !confirmMatch && styles.inputRowError,
                ]}>
                  <TextInput
                    style={[styles.input, styles.inputNoBorder, { flex: 1 }]}
                    value={confirm}
                    onChangeText={(v) => { setConfirm(v); setError(null); }}
                    onFocus={() => setConfirmTouched(true)}
                    placeholder="Repetí tu contraseña"
                    placeholderTextColor={colors.faint}
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    selectionColor={colors.arena}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
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

            {error && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={14} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}
          </View>

          <View style={styles.bottom}>
            <TouchableOpacity
              style={[styles.btnPrimary, (!canSubmit || loading) && styles.btnDisabled]}
              onPress={handleRegister}
              activeOpacity={0.85}
              disabled={!canSubmit || loading}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : (
                  <>
                    <Text style={styles.btnPrimaryText}>Unirme al estudio</Text>
                    <Feather name="arrow-right" size={16} color="#FFFFFF" />
                  </>
                )
              }
            </TouchableOpacity>
            <Text style={styles.hint}>
              Si todavía no recibiste una invitación, pedile al admin del estudio que te invite desde su cuenta.
            </Text>
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
  top: { padding: spacing.xl, paddingTop: spacing.md, gap: spacing.md },

  backBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    alignSelf: 'flex-start',
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 16,
    backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.sm,
  },
  heading: {
    fontFamily: fonts.archivo.bold, fontSize: 34,
    color: colors.crema, letterSpacing: -1, lineHeight: 40,
  },
  subheading: {
    fontFamily: fonts.archivo.semibold, fontSize: 14,
    color: colors.gris, lineHeight: 21, marginTop: -spacing.xs,
  },

  fields: { gap: spacing.xl, marginTop: spacing.sm },
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  input: {
    fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
    paddingVertical: 8, paddingBottom: spacing.sm,
  },
  inputNoBorder: { borderBottomWidth: 0, paddingBottom: 0 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  inputRowError: { borderBottomColor: colors.error },

  // Password rules
  rulesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  ruleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: colors.chip,
  },
  ruleChipOk: { backgroundColor: '#EBF4EE' },
  ruleText: {
    fontFamily: fonts.mono.regular, fontSize: 9.5,
    color: colors.gris, letterSpacing: 0.2,
  },
  ruleTextOk: { color: colors.success },

  fieldError: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.3,
    color: colors.error, marginTop: 2,
  },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  matchText: {
    fontFamily: fonts.mono.regular, fontSize: 10,
    color: colors.success, letterSpacing: 0.2,
  },

  errorBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FDF0EE', borderRadius: 14,
    padding: 14, marginTop: spacing.xs,
  },
  errorText: {
    fontFamily: fonts.archivo.semibold, fontSize: 13,
    color: colors.error, flex: 1, lineHeight: 19,
  },

  bottom: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  btnPrimary: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnDisabled: { opacity: 0.35 },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
  hint: {
    fontFamily: fonts.archivo.semibold, fontSize: 12,
    color: colors.faint, textAlign: 'center', lineHeight: 18,
  },
});
