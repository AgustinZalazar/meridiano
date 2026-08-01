import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useStudio, StudioRole } from '../lib/use-studio';

type InviteRole = 'admin' | 'member' | 'viewer';
type SuccessKind = 'added' | 'invited';

const ROLES: { value: InviteRole; label: string; desc: string }[] = [
  { value: 'admin',  label: 'Admin',      desc: 'Acceso completo al estudio' },
  { value: 'member', label: 'Miembro',    desc: 'Puede grabar y ver informes' },
  { value: 'viewer', label: 'Observador', desc: 'Solo puede ver informes' },
];

export default function InvitarMiembroScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const { studio, isAdmin } = useStudio();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessKind | null>(null);

  const canSend = email.includes('@') && !loading && !!studio && isAdmin;

  async function handleInvite() {
    if (!canSend || !studio || !session) return;
    setLoading(true);
    setError(null);

    const normalizedEmail = email.trim().toLowerCase();

    // Try to find an existing Meridiano user with that email
    const { data: found } = await supabase.rpc('find_profile_by_email', {
      p_email: normalizedEmail,
    });

    if (found && found.length > 0) {
      const targetUserId = found[0].id;

      const { error: addError } = await supabase
        .from('studio_members')
        .insert({ studio_id: studio.id, user_id: targetUserId, role });

      setLoading(false);
      if (addError) {
        // Unique constraint on user_id → already in a studio
        if (addError.code === '23505') {
          setError('Ese usuario ya pertenece a un estudio.');
        } else {
          setError('No se pudo agregar al usuario. Intentá de nuevo.');
        }
        return;
      }
      setSuccess('added');
    } else {
      // User doesn't have an account yet — save pending invite
      const { error: invError } = await supabase
        .from('studio_invites')
        .upsert(
          {
            studio_id: studio.id,
            email: normalizedEmail,
            role,
            invited_by: session.user.id,
          },
          { onConflict: 'studio_id,email' }
        );

      setLoading(false);
      if (invError) {
        setError('No se pudo guardar la invitación. Intentá de nuevo.');
        return;
      }
      setSuccess('invited');
    }

    setTimeout(() => router.back(), 1800);
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="x" size={16} color={colors.crema} />
          </TouchableOpacity>
        </View>
        <View style={styles.accessDenied}>
          <Feather name="lock" size={28} color={colors.faint} />
          <Text style={styles.accessDeniedText}>Solo los admins pueden invitar miembros.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="x" size={16} color={colors.crema} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          {studio ? <Text style={styles.eyebrow}>{studio.name.toUpperCase()}</Text> : null}
          <Text style={styles.heading}>Invitar miembro</Text>
        </View>

        {success ? (
          <View style={styles.successBox}>
            <Feather name="check-circle" size={32} color={colors.crema} />
            <Text style={styles.successTitle}>
              {success === 'added' ? '¡Miembro agregado!' : '¡Invitación guardada!'}
            </Text>
            <Text style={styles.successBody}>
              {success === 'invited'
                ? 'Cuando se registre con ese email, será agregado automáticamente al estudio.'
                : null}
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.form}>
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>CORREO ELECTRÓNICO</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(v) => { setEmail(v); setError(null); }}
                  placeholder="nombre@empresa.com"
                  placeholderTextColor={colors.faint}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  selectionColor={colors.crema}
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>ROL</Text>
                <View style={styles.roleList}>
                  {ROLES.map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.roleCard, role === r.value && styles.roleCardActive]}
                      onPress={() => setRole(r.value)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.roleCardLeft}>
                        <View style={[styles.roleDot, role === r.value && styles.roleDotActive]} />
                        <View>
                          <Text style={[styles.roleLabel, role === r.value && styles.roleLabelActive]}>
                            {r.label}
                          </Text>
                          <Text style={styles.roleDesc}>{r.desc}</Text>
                        </View>
                      </View>
                      {role === r.value && <Feather name="check" size={15} color="#FFFFFF" />}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>

            <View style={styles.cta}>
              <TouchableOpacity
                style={[styles.btnPrimary, !canSend && styles.btnPrimaryDisabled]}
                disabled={!canSend}
                activeOpacity={0.85}
                onPress={handleInvite}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="user-plus" size={16} color="#FFFFFF" />
                    <Text style={styles.btnPrimaryText}>Invitar al estudio</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnCancel} onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  scroll: { paddingBottom: 48 },
  topBar: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  header: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: 4 },
  eyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.6,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  heading: {
    fontFamily: fonts.archivo.bold, fontSize: 28, color: colors.crema,
    letterSpacing: -0.7, lineHeight: 34, marginTop: 4,
  },
  form: { paddingHorizontal: spacing.xl, gap: spacing.xl },
  field: { gap: spacing.sm },
  fieldLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  input: {
    fontFamily: fonts.archivo.semibold, fontSize: 16, color: colors.crema,
    borderBottomWidth: 1.5, borderBottomColor: colors.border,
    paddingBottom: spacing.sm, paddingTop: 4,
  },
  roleList: { gap: spacing.sm },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 18, backgroundColor: colors.panel,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  roleCardActive: { backgroundColor: colors.crema },
  roleCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.faint },
  roleDotActive: { backgroundColor: 'rgba(255,255,255,0.6)' },
  roleLabel: { fontFamily: fonts.archivo.bold, fontSize: 14.5, color: colors.crema },
  roleLabelActive: { color: '#FFFFFF' },
  roleDesc: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.gris, marginTop: 1 },
  errorText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error },
  successBox: { alignItems: 'center', paddingHorizontal: spacing.xl, paddingVertical: 48, gap: 14 },
  successTitle: { fontFamily: fonts.archivo.bold, fontSize: 20, color: colors.crema },
  successBody: {
    fontFamily: fonts.archivo.semibold, fontSize: 13.5, color: colors.gris,
    textAlign: 'center', lineHeight: 20,
  },
  accessDenied: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: spacing.xl,
  },
  accessDeniedText: {
    fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.gris, textAlign: 'center',
  },
  cta: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl, gap: spacing.sm },
  btnPrimary: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryDisabled: { opacity: 0.35 },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
  btnCancel: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnCancelText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris, textDecorationLine: 'underline' },
});
