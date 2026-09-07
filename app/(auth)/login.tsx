import { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
  Animated, Easing,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const LOGO_SRC = require('../../assets/icon.png');

function Logo({ size = 48 }: { size?: number }) {
  return <Image source={LOGO_SRC} style={{ width: size, height: size }} resizeMode="contain" />;
}

function Field({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType, error, onBlur,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  error?: string | null;
  onBlur?: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, !!error && styles.fieldLabelError]}>{label}</Text>
      <View style={[styles.fieldRow, !!error && styles.fieldRowError]}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={colors.arena}
          onBlur={onBlur}
        />
      </View>
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const animLogo   = useRef(new Animated.Value(0)).current;
  const animTitle  = useRef(new Animated.Value(0)).current;
  const animSub    = useRef(new Animated.Value(0)).current;
  const animFields = useRef(new Animated.Value(0)).current;
  const animBtn    = useRef(new Animated.Value(0)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mk = (v: Animated.Value) => Animated.timing(v, {
      toValue: 1, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: true,
    });
    Animated.stagger(70, [animLogo, animTitle, animSub, animFields, animBtn].map(mk)).start();
  }, []);

  const fs = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  });

  function triggerShake() {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 55, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 45, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: -6,  duration: 45, useNativeDriver: true, easing: Easing.linear }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 35, useNativeDriver: true, easing: Easing.linear }),
    ]).start();
  }

  function validateEmail(val: string): string | null {
    const trimmed = val.trim();
    if (!trimmed) return 'Requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Email inválido';
    return null;
  }

  async function handleLogin() {
    const eErr = validateEmail(email);
    const pErr = !password ? 'Requerido' : password.length < 6 ? 'Mínimo 6 caracteres' : null;

    setEmailError(eErr);
    setPasswordError(pErr);
    setGlobalError(null);

    if (eErr || pErr) {
      triggerShake();
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);

    if (error) {
      setGlobalError('Email o contraseña incorrectos.');
      triggerShake();
    }
  }

  async function handleForgotPassword() {
    const eErr = validateEmail(email);
    if (eErr) {
      setEmailError(eErr);
      triggerShake();
      return;
    }
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    setGlobalError('Te enviamos un link para restablecer tu contraseña.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Animated.View style={fs(animLogo)}>
              <Logo />
            </Animated.View>
            <Animated.View style={fs(animTitle)}>
              <Text style={styles.heading}>Bienvenida{'\n'}de nuevo</Text>
            </Animated.View>
            <Animated.View style={fs(animSub)}>
              <Text style={styles.subheading}>Ingresá para ver tus proyectos y rubros</Text>
            </Animated.View>

            <Animated.View style={[fs(animFields), { gap: spacing.md }]}>
              <View style={styles.fields}>
                <Field
                  label="CORREO"
                  value={email}
                  onChangeText={v => { setEmail(v); setEmailError(null); setGlobalError(null); }}
                  placeholder="nombre@estudio.com"
                  keyboardType="email-address"
                  error={emailError}
                />
                <Field
                  label="CONTRASEÑA"
                  value={password}
                  onChangeText={v => { setPassword(v); setPasswordError(null); setGlobalError(null); }}
                  placeholder="••••••••"
                  secureTextEntry
                  error={passwordError}
                />
              </View>

              {globalError ? <Text style={styles.globalError}>{globalError}</Text> : null}

              <TouchableOpacity style={styles.forgotRow} onPress={handleForgotPassword} activeOpacity={0.7}>
                <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          <Animated.View style={[styles.bottom, fs(animBtn)]}>
            <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
              <TouchableOpacity
                style={[styles.btnPrimary, (!email || !password || loading) && styles.btnDisabled]}
                onPress={handleLogin}
                activeOpacity={0.85}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#FFFFFF" />
                  : <Text style={styles.btnPrimaryText}>Entrar al estudio  →</Text>
                }
              </TouchableOpacity>
            </Animated.View>
            <TouchableOpacity style={styles.btnLink} onPress={() => router.push('/(auth)/onboarding')} activeOpacity={0.7}>
              <Text style={styles.btnLinkText}>¿Primera vez? Crear estudio</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'space-between' },
  top: { padding: spacing.xl, paddingTop: spacing.xxl + spacing.md, gap: spacing.md },
  heading: { fontFamily: fonts.archivo.bold, fontSize: 34, color: colors.crema, letterSpacing: -1, lineHeight: 40, marginTop: spacing.sm },
  subheading: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris, marginTop: spacing.xs },
  fields: { gap: spacing.xl, marginTop: spacing.lg },
  field: { gap: 6 },
  fieldLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  fieldLabelError: { color: colors.error },
  fieldRow: { borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  fieldRowError: { borderBottomColor: colors.error },
  fieldInput: { fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema, paddingVertical: 8 },
  fieldError: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.3,
    color: colors.error, marginTop: 2,
  },
  globalError: {
    fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error,
    marginTop: spacing.xs,
  },
  forgotRow: { alignItems: 'flex-end', marginTop: spacing.xs },
  forgotText: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.crema, letterSpacing: 0.2 },
  bottom: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
  btnLink: { alignItems: 'center', paddingVertical: spacing.sm },
  btnLinkText: { fontFamily: fonts.mono.regular, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.gris, fontWeight: '700' },
});
