import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useProfile } from '../../lib/use-profile';
import { useStudio, StudioRole } from '../../lib/use-studio';

const PLAN_META: Record<string, { label: string; users: string; videos: number; price: string }> = {
  starter:    { label: 'Starter',    users: '3 usuarios',   videos: 30,  price: '$49/mes' },
  pro:        { label: 'Pro',        users: '10 usuarios',  videos: 100, price: '$149/mes' },
  enterprise: { label: 'Enterprise', users: 'Ilimitado',    videos: 999, price: 'A medida' },
};

const ROLE_LABEL: Record<StudioRole, string> = {
  owner:  'Propietario',
  admin:  'Admin',
  member: 'Miembro',
  viewer: 'Observador',
};

interface Member {
  user_id: string;
  role: StudioRole;
  full_name: string;
}

interface PendingInvite {
  id: string;
  email: string;
  role: StudioRole;
  expires_at: string;
}

function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

function ProgressBar({ value, dark }: { value: number; dark?: boolean }) {
  return (
    <View style={[styles.progressTrack, dark && styles.progressTrackDark]}>
      <View
        style={[
          styles.progressFill,
          { width: `${value}%` as `${number}%` },
          dark && styles.progressFillDark,
        ]}
      />
    </View>
  );
}

function Chip({ children, active }: { children: string; active?: boolean }) {
  return (
    <View style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{children}</Text>
    </View>
  );
}

export default function CuentaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, email } = useProfile();
  const { studio, role: myRole, isAdmin, isOwner, loading: studioLoading, refetch: refetchStudio } = useStudio();
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const displayName = profile?.full_name ?? '...';
  const planKey = studio?.plan ?? 'starter';
  const plan = PLAN_META[planKey] ?? PLAN_META.starter;
  const videosUsed = studio?.videos_used ?? 0;
  const videoLimit = plan.videos;
  const videoProgress = videoLimit === 999 ? 0 : Math.min((videosUsed / videoLimit) * 100, 100);

  useFocusEffect(useCallback(() => { refetchStudio(); }, [refetchStudio]));

  const fetchMembers = useCallback(() => {
    if (!studio?.id) return;
    setMembersLoading(true);
    Promise.all([
      supabase.rpc('get_studio_members', { p_studio_id: studio.id }),
      supabase
        .from('studio_invites')
        .select('id, email, role, expires_at')
        .eq('studio_id', studio.id)
        .gt('expires_at', new Date().toISOString()),
    ]).then(([{ data: membersData }, { data: invitesData }]) => {
      setMembers((membersData as Member[]) ?? []);
      setPendingInvites((invitesData as PendingInvite[]) ?? []);
      setMembersLoading(false);
    });
  }, [studio?.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleLogoUpload() {
    if (!studio || !isAdmin) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;

    setLogoUploading(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${studio.id}/logo.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('studio-logos')
        .upload(path, bytes, { contentType: `image/${ext}`, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('studio-logos')
        .getPublicUrl(path);

      await supabase.from('studios').update({ logo_url: publicUrl }).eq('id', studio.id);
      await refetchStudio();
    } catch {
      Alert.alert('Error', 'No se pudo subir el logo. Intentá de nuevo.');
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Text style={styles.eyebrow}>MI CUENTA</Text>
            <Text style={styles.heading}>{displayName}</Text>
            {email ? <Text style={styles.subheading}>{email}</Text> : null}
          </View>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.push('/notificaciones')} activeOpacity={0.8}>
            <Feather name="bell" size={16} color={colors.crema} />
          </TouchableOpacity>
        </View>

        {/* Plan card */}
        <View style={styles.section}>
          <View style={styles.planCard}>
            <View style={styles.planCardTop}>
              <Text style={styles.planLabel}>{plan.label.toUpperCase()} · {plan.price}</Text>
              <Chip active>Activo</Chip>
            </View>
            <View style={styles.planUsage}>
              <View style={styles.usageMeta}>
                <Text style={styles.usageText}>Videos este período</Text>
                <Text style={styles.usageCount}>
                  {videosUsed} / {videoLimit === 999 ? '∞' : videoLimit}
                </Text>
              </View>
              <ProgressBar value={videoProgress} dark />
            </View>
            <TouchableOpacity style={styles.manageSub} activeOpacity={0.8}>
              <Text style={styles.manageSubText}>Gestionar suscripción</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Team members */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>MIEMBROS DEL ESTUDIO</Text>
              {studio ? <Text style={styles.studioName}>{studio.name}</Text> : null}
            </View>
            {isAdmin && (
              <TouchableOpacity style={styles.addCircle} onPress={() => router.push('/invitar-miembro')} activeOpacity={0.8}>
                <Feather name="plus" size={14} color={colors.crema} />
              </TouchableOpacity>
            )}
          </View>

          {studio && (
            <TouchableOpacity
              style={styles.logoRow}
              onPress={handleLogoUpload}
              activeOpacity={isAdmin ? 0.75 : 1}
              disabled={!isAdmin || logoUploading}
            >
              <View style={styles.logoSlot}>
                {logoUploading ? (
                  <ActivityIndicator color={colors.gris} size="small" />
                ) : studio.logo_url ? (
                  <Image source={{ uri: studio.logo_url }} style={styles.logoImage} />
                ) : (
                  <Text style={styles.logoInitials}>
                    {studio.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.logoMeta}>
                <Text style={styles.logoStudioName}>{studio.name}</Text>
                {isAdmin && (
                  <Text style={styles.logoHint}>
                    {studio.logo_url ? 'Cambiar logo' : 'Agregar logo'}
                  </Text>
                )}
              </View>
              {isAdmin && (
                <Feather name="camera" size={14} color={colors.faint} />
              )}
            </TouchableOpacity>
          )}
          <View style={styles.teamList}>
            {membersLoading ? (
              <ActivityIndicator color={colors.crema} style={{ marginVertical: 16 }} />
            ) : !studioLoading && !studio ? (
              <TouchableOpacity style={styles.createStudioBtn} onPress={() => router.push('/studio/crear')} activeOpacity={0.85}>
                <Feather name="home" size={14} color={colors.crema} />
                <Text style={styles.createStudioText}>Crear estudio</Text>
              </TouchableOpacity>
            ) : (
              <>
                {members.map((m) => {
                  const name = m.full_name || 'Usuario';
                  return (
                    <View key={m.user_id} style={styles.memberRow}>
                      <Avatar name={name} size={30} />
                      <Text style={styles.memberName}>{name}</Text>
                      <Chip>{ROLE_LABEL[m.role] ?? m.role}</Chip>
                    </View>
                  );
                })}
                {pendingInvites.map((inv) => (
                  <View key={inv.id} style={[styles.memberRow, styles.memberRowPending]}>
                    <View style={styles.pendingAvatar}>
                      <Feather name="mail" size={14} color={colors.faint} />
                    </View>
                    <Text style={[styles.memberName, styles.memberNamePending]} numberOfLines={1}>
                      {inv.email}
                    </Text>
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingBadgeText}>Pendiente</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.appVersion}>MERIDIANO v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  topBar: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  topBarLeft: { gap: 4 },
  eyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.6,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  heading: {
    fontFamily: fonts.archivo.bold, fontSize: 30, color: colors.crema,
    letterSpacing: -0.7, lineHeight: 36, marginTop: 6,
  },
  subheading: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.gris, marginTop: 2 },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  studioName: {
    fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema, marginTop: 3,
  },
  addCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  planCard: { borderRadius: 24, backgroundColor: colors.crema, padding: 20, gap: 18 },
  planCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', fontWeight: '700',
  },
  planUsage: { gap: 9 },
  usageMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  usageText: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  usageCount: { fontFamily: fonts.archivo.bold, fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.chip, overflow: 'hidden' },
  progressTrackDark: { backgroundColor: 'rgba(255,255,255,0.25)' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.crema },
  progressFillDark: { backgroundColor: '#FFFFFF' },
  manageSub: {
    height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  manageSubText: { fontFamily: fonts.archivo.bold, fontSize: 14.5, color: '#FFFFFF' },
  teamList: { gap: 10 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12,
    borderRadius: 16, backgroundColor: colors.panel,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 1,
  },
  avatar: { backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontFamily: fonts.archivo.bold, color: colors.crema },
  memberName: { flex: 1, fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.crema },
  chip: {
    height: 28, borderRadius: 14, paddingHorizontal: 12,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#FFFFFF' },
  chipText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.crema },
  chipTextActive: { color: colors.crema },
  memberRowPending: { opacity: 0.7 },
  memberNamePending: { color: colors.gris },
  pendingAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  pendingBadge: {
    height: 28, borderRadius: 14, paddingHorizontal: 12,
    backgroundColor: colors.chip, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pendingBadgeText: {
    fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.faint,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.panel,
    marginBottom: 12,
  },
  logoSlot: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoInitials: {
    fontFamily: fonts.archivo.bold,
    fontSize: 18,
    color: colors.crema,
    letterSpacing: -0.5,
  },
  logoMeta: {
    flex: 1,
    gap: 2,
  },
  logoStudioName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 15,
    color: colors.crema,
    letterSpacing: -0.2,
  },
  logoHint: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12,
    color: colors.faint,
  },
  createStudioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border,
    borderStyle: 'dashed',
  },
  createStudioText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema },
  logoutBtn: {
    height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { fontFamily: fonts.archivo.bold, fontSize: 14.5, color: colors.gris },
  appVersion: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.faint, textAlign: 'center',
    marginTop: spacing.xl, marginBottom: spacing.lg,
  },
});
