import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image,
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
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
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
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={colors.arena}
        />
      </View>
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError('Email o contraseña incorrectos.');
    }
    // Si no hay error, onAuthStateChange en _layout redirige automáticamente
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Ingresá tu email primero.');
      return;
    }
    setLoading(true);
    await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    setError('Te enviamos un link para restablecer tu contraseña.');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Logo />
            <Text style={styles.heading}>Bienvenida{'\n'}de nuevo</Text>
            <Text style={styles.subheading}>Ingresá para ver tus proyectos y rubros</Text>

            <View style={styles.fields}>
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
                placeholder="••••••••"
                secureTextEntry
              />
            </View>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity style={styles.forgotRow} onPress={handleForgotPassword} activeOpacity={0.7}>
              <Text style={styles.forgotText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottom}>
            <TouchableOpacity
              style={[styles.btnPrimary, (!email || !password || loading) && styles.btnDisabled]}
              onPress={handleLogin}
              activeOpacity={0.85}
              disabled={!email || !password || loading}
            >
              {loading
                ? <ActivityIndicator color="#FFFFFF" />
                : <Text style={styles.btnPrimaryText}>Entrar al estudio  →</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnLink} onPress={() => router.push('/(auth)/onboarding')} activeOpacity={0.7}>
              <Text style={styles.btnLinkText}>¿Primera vez? Crear estudio</Text>
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
  top: { padding: spacing.xl, paddingTop: spacing.xxl + spacing.md, gap: spacing.md },
  heading: { fontFamily: fonts.archivo.bold, fontSize: 34, color: colors.crema, letterSpacing: -1, lineHeight: 40, marginTop: spacing.sm },
  subheading: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris, marginTop: spacing.xs },
  fields: { gap: spacing.xl, marginTop: spacing.lg },
  field: { gap: 8 },
  fieldLabel: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gris, fontWeight: '700' },
  fieldRow: { borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  fieldInput: { fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema, paddingVertical: 8 },
  errorText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error, marginTop: spacing.xs },
  forgotRow: { alignItems: 'flex-end', marginTop: spacing.xs },
  forgotText: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.crema, letterSpacing: 0.2 },
  bottom: { padding: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.md },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
  btnLink: { alignItems: 'center', paddingVertical: spacing.sm },
  btnLinkText: { fontFamily: fonts.mono.regular, fontSize: 10.5, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.gris, fontWeight: '700' },
});
