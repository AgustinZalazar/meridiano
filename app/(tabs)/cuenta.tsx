import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Image, Alert, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { requestPhotoPermission } from '../../lib/pick-image';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useProfile } from '../../lib/use-profile';
import { useStudio, StudioRole } from '../../lib/use-studio';
import { useSubscription } from '../../lib/use-subscription';
import { BottomSheet } from '../../components/BottomSheet';

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

const ROLES_ASSIGNABLE: { value: StudioRole; label: string; desc: string }[] = [
  { value: 'admin',  label: 'Admin',      desc: 'Acceso completo al estudio' },
  { value: 'member', label: 'Miembro',    desc: 'Puede grabar y ver informes' },
  { value: 'viewer', label: 'Observador', desc: 'Solo puede ver informes' },
];

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

function UserAvatar({
  uri, name, size = 52,
}: { uri?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.userAvatarImg, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }
  return (
    <View style={[styles.userAvatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.userAvatarInitials, { fontSize: size * 0.34 }]}>{initials}</Text>
    </View>
  );
}

function MemberAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  return (
    <View style={[styles.memberAvatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.memberAvatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

function ProgressBar({ value, dark }: { value: number; dark?: boolean }) {
  return (
    <View style={[styles.progressTrack, dark && styles.progressTrackDark]}>
      <View style={[styles.progressFill, { width: `${value}%` as `${number}%` }, dark && styles.progressFillDark]} />
    </View>
  );
}

function Chip({ children, active, danger }: { children: string; active?: boolean; danger?: boolean }) {
  return (
    <View style={[styles.chip, active && styles.chipActive, danger && styles.chipDanger]}>
      <Text style={[styles.chipText, active && styles.chipTextActive, danger && styles.chipTextDanger]}>
        {children}
      </Text>
    </View>
  );
}

function formatPeriodEnd(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export default function CuentaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const { profile, email, refetch: refetchProfile } = useProfile();
  const { studio, role: myRole, isAdmin, isOwner, loading: studioLoading, refetch: refetchStudio } = useStudio();
  const { subscription } = useSubscription();

  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null);

  // Profile sheet
  const [profileSheetVisible, setProfileSheetVisible] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Studio sheet
  const [studioSheetVisible, setStudioSheetVisible] = useState(false);
  const [editStudioName, setEditStudioName] = useState('');
  const [savingStudio, setSavingStudio] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  // Member sheet
  const [memberSheetMember, setMemberSheetMember] = useState<Member | null>(null);
  const [memberSheetRole, setMemberSheetRole] = useState<StudioRole>('member');
  const [memberActionLoading, setMemberActionLoading] = useState(false);

  // Delete account sheet
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const displayName = profile?.full_name ?? '...';
  const planKey = studio?.plan ?? 'starter';
  const plan = PLAN_META[planKey] ?? PLAN_META.starter;
  const videosUsed = studio?.videos_used ?? 0;
  const videoLimit = plan.videos;
  const videoProgress = videoLimit === 999 ? 0 : Math.min((videosUsed / videoLimit) * 100, 100);

  const subStatus = subscription?.status;
  const statusLabel =
    subStatus === 'trialing' ? 'Prueba' :
    subStatus === 'past_due' ? 'Pago pendiente' :
    subStatus === 'canceled' ? 'Cancelado' : 'Activo';
  const statusDanger = subStatus === 'past_due' || subStatus === 'canceled';

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

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ── Profile actions ──────────────────────────────────────────────────────

  function openProfileSheet() {
    setEditFullName(profile?.full_name ?? '');
    setProfileSheetVisible(true);
  }

  async function handleAvatarUpload() {
    if (!session?.user?.id) return;
    if (!(await requestPhotoPermission())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    setAvatarUploading(true);
    try {
      const asset = result.assets[0];
      const b64 = asset.base64!;
      const ext = (asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg').replace(/\?.*$/, '');
      const path = `${session.user.id}/avatar.${ext}`;

      const binaryString = atob(b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, bytes, { contentType: `image/${ext}`, upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      await supabase
        .from('profiles')
        .update({ avatar_url: `${publicUrl}?v=${Date.now()}` })
        .eq('id', session.user.id);
      await refetchProfile();
    } catch (err: unknown) {
      Alert.alert('Error', `No se pudo actualizar la foto.\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSaveProfile() {
    if (!editFullName.trim() || !session?.user?.id) return;
    setSavingProfile(true);
    await supabase
      .from('profiles')
      .update({ full_name: editFullName.trim() })
      .eq('id', session.user.id);
    await refetchProfile();
    setSavingProfile(false);
    setProfileSheetVisible(false);
  }

  // ── Studio actions ───────────────────────────────────────────────────────

  function openStudioSheet() {
    if (!studio || !isAdmin) return;
    setEditStudioName(studio.name);
    setStudioSheetVisible(true);
  }

  async function handleLogoUpload() {
    if (!studio || !isAdmin) return;
    if (!(await requestPhotoPermission())) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    setLogoUploading(true);
    try {
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('No se pudo leer la imagen');
      const ext = (asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg').replace(/\?.*$/, '');
      const path = `${studio.id}/logo.${ext}`;

      const binaryString = atob(asset.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const { error: uploadError } = await supabase.storage
        .from('studio-logos')
        .upload(path, bytes, { contentType: `image/${ext}`, upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('studio-logos').getPublicUrl(path);
      await supabase.from('studios').update({ logo_url: `${publicUrl}?v=${Date.now()}` }).eq('id', studio.id);
      await refetchStudio();
    } catch (err: unknown) {
      Alert.alert('Error', `No se pudo subir el logo.\n${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleSaveStudio() {
    if (!studio || !editStudioName.trim()) return;
    setSavingStudio(true);
    if (editStudioName.trim() !== studio.name) {
      await supabase.from('studios').update({ name: editStudioName.trim() }).eq('id', studio.id);
      await refetchStudio();
    }
    setSavingStudio(false);
    setStudioSheetVisible(false);
  }

  // ── Member actions ───────────────────────────────────────────────────────

  function openMemberSheet(member: Member) {
    setMemberSheetMember(member);
    setMemberSheetRole(member.role === 'owner' ? 'admin' : member.role);
  }

  async function handleSaveMemberRole() {
    if (!memberSheetMember || !studio) return;
    setMemberActionLoading(true);
    if (memberSheetRole !== memberSheetMember.role) {
      await supabase
        .from('studio_members')
        .update({ role: memberSheetRole })
        .match({ studio_id: studio.id, user_id: memberSheetMember.user_id });
      fetchMembers();
    }
    setMemberActionLoading(false);
    setMemberSheetMember(null);
  }

  function handleRemoveMember() {
    if (!memberSheetMember || !studio) return;
    const name = memberSheetMember.full_name || 'este miembro';
    setMemberSheetMember(null);
    Alert.alert(
      'Eliminar miembro',
      `¿Eliminar a ${name} del estudio?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('studio_members')
              .delete()
              .match({ studio_id: studio.id, user_id: memberSheetMember.user_id });
            fetchMembers();
          },
        },
      ]
    );
  }

  async function handleCancelInvite(inviteId: string) {
    setCancelingInviteId(inviteId);
    await supabase.from('studio_invites').delete().eq('id', inviteId);
    setCancelingInviteId(null);
    fetchMembers();
  }

  // ── Account actions ──────────────────────────────────────────────────────

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      const { error } = await supabase.rpc('delete_user');
      if (error) throw error;
      await supabase.auth.signOut();
    } catch {
      Alert.alert('Error', 'No se pudo eliminar la cuenta. Contactá soporte.');
      setDeletingAccount(false);
      setDeleteAccountVisible(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
      >
        {/* ── Profile header ── */}
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={openProfileSheet} activeOpacity={0.8}>
            <UserAvatar uri={profile?.avatar_url} name={displayName} size={52} />
          </TouchableOpacity>
          <View style={styles.profileMeta}>
            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            {email ? <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text> : null}
            <TouchableOpacity onPress={openProfileSheet} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 0, right: 8 }}>
              <Text style={styles.profileEditLink}>Editar perfil  ›</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.push('/notificaciones')} activeOpacity={0.8}>
            <Feather name="bell" size={16} color={colors.crema} />
          </TouchableOpacity>
        </View>

        {/* ── Suscripción ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SUSCRIPCIÓN</Text>
          <View style={styles.planCard}>
            <View style={styles.planCardTop}>
              <Text style={styles.planLabel}>{plan.label.toUpperCase()} · {plan.price}</Text>
              <Chip active={!statusDanger} danger={statusDanger}>{statusLabel}</Chip>
            </View>
            {subscription?.currentPeriodEnd && (
              <Text style={styles.planPeriodText}>
                Período hasta {formatPeriodEnd(subscription.currentPeriodEnd)}
              </Text>
            )}
            <View style={styles.planUsage}>
              <View style={styles.usageMeta}>
                <Text style={styles.usageText}>Videos este período</Text>
                <Text style={styles.usageCount}>
                  {videosUsed} / {videoLimit === 999 ? '∞' : videoLimit}
                </Text>
              </View>
              <ProgressBar value={videoProgress} dark />
            </View>
            <TouchableOpacity style={styles.manageSub} onPress={() => router.push('/suscripcion')} activeOpacity={0.8}>
              <Text style={styles.manageSubText}>Ver planes  →</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Estudio ── */}
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
              onPress={openStudioSheet}
              activeOpacity={isAdmin ? 0.75 : 1}
              disabled={!isAdmin}
            >
              <View style={styles.logoSlot}>
                {studio.logo_url ? (
                  <Image source={{ uri: studio.logo_url }} style={styles.logoImage} />
                ) : (
                  <Text style={styles.logoInitials}>
                    {studio.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.logoMeta}>
                <Text style={styles.logoStudioName}>{studio.name}</Text>
                {isAdmin && <Text style={styles.logoHint}>Editar nombre y logo</Text>}
              </View>
              {isAdmin && <Feather name="edit-2" size={14} color={colors.faint} />}
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
                  const canManage = isAdmin && m.role !== 'owner';
                  return (
                    <View key={m.user_id} style={styles.memberRow}>
                      <MemberAvatar name={name} size={30} />
                      <Text style={styles.memberName}>{name}</Text>
                      <Chip>{ROLE_LABEL[m.role] ?? m.role}</Chip>
                      {canManage && (
                        <TouchableOpacity
                          onPress={() => openMemberSheet(m)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          activeOpacity={0.6}
                        >
                          <Feather name="more-horizontal" size={17} color={colors.gris} />
                        </TouchableOpacity>
                      )}
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
                    {isAdmin && (
                      <TouchableOpacity
                        onPress={() => handleCancelInvite(inv.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.6}
                      >
                        {cancelingInviteId === inv.id
                          ? <ActivityIndicator size="small" color={colors.gris} />
                          : <Feather name="x" size={17} color={colors.gris} />}
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        </View>

        {/* ── Configuración ── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONFIGURACIÓN</Text>
          <View style={styles.teamList}>
            <TouchableOpacity
              style={styles.memberRow}
              onPress={() => router.push('/configuracion-informe')}
              activeOpacity={0.8}
            >
              <View style={[styles.pendingAvatar, { backgroundColor: colors.chip }]}>
                <Feather name="file-text" size={14} color={colors.crema} />
              </View>
              <Text style={styles.memberName}>Logo del informe</Text>
              <Feather name="chevron-right" size={16} color={colors.faint} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Cuenta ── */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteAccountBtn}
            onPress={() => setDeleteAccountVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteAccountText}>Eliminar cuenta</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.appVersion}>MERIDIANO v1.0.0</Text>
      </ScrollView>

      {/* ── Sheet: editar perfil ── */}
      <BottomSheet visible={profileSheetVisible} onClose={() => setProfileSheetVisible(false)} avoidKeyboard>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Editar perfil</Text>

          <TouchableOpacity
            style={styles.sheetAvatarRow}
            onPress={handleAvatarUpload}
            activeOpacity={0.8}
            disabled={avatarUploading}
          >
            <View style={styles.sheetAvatarSlot}>
              {avatarUploading ? (
                <ActivityIndicator color={colors.gris} />
              ) : (
                <UserAvatar uri={profile?.avatar_url} name={displayName} size={56} />
              )}
            </View>
            <View style={styles.sheetLogoMeta}>
              <Text style={styles.sheetLogoLabel}>
                {profile?.avatar_url ? 'Cambiar foto' : 'Agregar foto de perfil'}
              </Text>
              <Text style={styles.sheetLogoHint}>Cuadrada, PNG o JPG</Text>
            </View>
            <View style={styles.sheetLogoIcon}>
              <Feather name="camera" size={15} color={colors.crema} />
            </View>
          </TouchableOpacity>

          <View style={styles.sheetFieldWrap}>
            <Text style={styles.sheetFieldLabel}>NOMBRE</Text>
            <TextInput
              style={styles.sheetInput}
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="Tu nombre completo"
              placeholderTextColor={colors.faint}
              selectionColor={colors.arena}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          <TouchableOpacity
            style={[styles.sheetBtn, (!editFullName.trim() || savingProfile) && styles.sheetBtnDisabled]}
            onPress={handleSaveProfile}
            activeOpacity={0.85}
            disabled={!editFullName.trim() || savingProfile}
          >
            {savingProfile
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.sheetBtnText}>Guardar</Text>
            }
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Sheet: editar estudio ── */}
      <BottomSheet visible={studioSheetVisible} onClose={() => setStudioSheetVisible(false)} avoidKeyboard>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Editar estudio</Text>

          <TouchableOpacity
            style={styles.sheetAvatarRow}
            onPress={handleLogoUpload}
            activeOpacity={0.8}
            disabled={logoUploading}
          >
            <View style={styles.sheetAvatarSlot}>
              {logoUploading ? (
                <ActivityIndicator color={colors.gris} size="small" />
              ) : studio?.logo_url ? (
                <Image source={{ uri: studio.logo_url }} style={styles.logoImage} />
              ) : (
                <Text style={styles.logoInitials}>
                  {(studio?.name ?? '').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                </Text>
              )}
            </View>
            <View style={styles.sheetLogoMeta}>
              <Text style={styles.sheetLogoLabel}>
                {studio?.logo_url ? 'Cambiar logo' : 'Agregar logo'}
              </Text>
              <Text style={styles.sheetLogoHint}>Cuadrado, PNG o JPG</Text>
            </View>
            <View style={styles.sheetLogoIcon}>
              <Feather name="camera" size={15} color={colors.crema} />
            </View>
          </TouchableOpacity>

          <View style={styles.sheetFieldWrap}>
            <Text style={styles.sheetFieldLabel}>NOMBRE DEL ESTUDIO</Text>
            <TextInput
              style={styles.sheetInput}
              value={editStudioName}
              onChangeText={setEditStudioName}
              placeholder="Ej. Estudio Meridiano"
              placeholderTextColor={colors.faint}
              selectionColor={colors.arena}
              returnKeyType="done"
              autoCorrect={false}
            />
          </View>

          <TouchableOpacity
            style={[styles.sheetBtn, (!editStudioName.trim() || savingStudio) && styles.sheetBtnDisabled]}
            onPress={handleSaveStudio}
            activeOpacity={0.85}
            disabled={!editStudioName.trim() || savingStudio}
          >
            {savingStudio
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.sheetBtnText}>Guardar</Text>
            }
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Sheet: gestionar miembro ── */}
      <BottomSheet
        visible={!!memberSheetMember}
        onClose={() => setMemberSheetMember(null)}
      >
        {memberSheetMember && (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.memberSheetHeader}>
              <MemberAvatar name={memberSheetMember.full_name || 'U'} size={36} />
              <View>
                <Text style={styles.memberSheetName}>{memberSheetMember.full_name || 'Usuario'}</Text>
                <Text style={styles.memberSheetRole}>{ROLE_LABEL[memberSheetMember.role]}</Text>
              </View>
            </View>

            <Text style={styles.sheetFieldLabel}>CAMBIAR ROL</Text>
            <View style={styles.roleList}>
              {ROLES_ASSIGNABLE.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleRow, memberSheetRole === r.value && styles.roleRowActive]}
                  onPress={() => setMemberSheetRole(r.value)}
                  activeOpacity={0.75}
                >
                  <View style={styles.roleRowLeft}>
                    <Text style={[styles.roleRowLabel, memberSheetRole === r.value && styles.roleRowLabelActive]}>
                      {r.label}
                    </Text>
                    <Text style={styles.roleRowDesc}>{r.desc}</Text>
                  </View>
                  <View style={[styles.radioOuter, memberSheetRole === r.value && styles.radioOuterActive]}>
                    {memberSheetRole === r.value && <View style={styles.radioInner} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.sheetBtn, memberActionLoading && styles.sheetBtnDisabled]}
              onPress={handleSaveMemberRole}
              activeOpacity={0.85}
              disabled={memberActionLoading}
            >
              {memberActionLoading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.sheetBtnText}>Guardar cambios</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.removeMemberBtn}
              onPress={handleRemoveMember}
              activeOpacity={0.7}
            >
              <Feather name="user-x" size={14} color={colors.error} />
              <Text style={styles.removeMemberText}>Eliminar del estudio</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>

      {/* ── Sheet: confirmar eliminar cuenta ── */}
      <BottomSheet visible={deleteAccountVisible} onClose={() => setDeleteAccountVisible(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.deleteSheetIcon}>
            <Feather name="alert-triangle" size={28} color={colors.error} />
          </View>
          <Text style={styles.deleteSheetTitle}>Eliminar cuenta</Text>
          <Text style={styles.deleteSheetBody}>
            Esta acción es permanente. Se eliminarán tu cuenta y todos tus datos. No se puede deshacer.
          </Text>
          <TouchableOpacity
            style={[styles.deleteConfirmBtn, deletingAccount && styles.sheetBtnDisabled]}
            onPress={handleDeleteAccount}
            activeOpacity={0.85}
            disabled={deletingAccount}
          >
            {deletingAccount
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.deleteConfirmText}>Sí, eliminar mi cuenta</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteCancelBtn}
            onPress={() => setDeleteAccountVisible(false)}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },

  // ── Profile header ──────────────────────────────────────────────────────
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  userAvatarImg: { flexShrink: 0 },
  userAvatarFallback: {
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatarInitials: {
    fontFamily: fonts.archivo.bold,
    color: colors.crema,
    letterSpacing: -0.5,
  },
  profileMeta: { flex: 1, gap: 2 },
  profileName: {
    fontFamily: fonts.archivo.bold, fontSize: 20,
    color: colors.crema, letterSpacing: -0.4,
  },
  profileEmail: {
    fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: colors.gris,
  },
  profileEditLink: {
    fontFamily: fonts.archivo.semibold, fontSize: 12.5,
    color: colors.arena, marginTop: 3,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
    flexShrink: 0,
  },

  // ── Sections ────────────────────────────────────────────────────────────
  section: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12,
  },
  sectionLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700', marginBottom: 12,
  },
  studioName: {
    fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema, marginTop: 3,
  },
  addCircle: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },

  // ── Plan card ────────────────────────────────────────────────────────────
  planCard: { borderRadius: 24, backgroundColor: colors.crema, padding: 20, gap: 14 },
  planCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: '700',
  },
  planPeriodText: {
    fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: 'rgba(255,255,255,0.5)',
    marginTop: -6,
  },
  planUsage: { gap: 9 },
  usageMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  usageText: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  usageCount: { fontFamily: fonts.archivo.bold, fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.chip, overflow: 'hidden' },
  progressTrackDark: { backgroundColor: 'rgba(255,255,255,0.2)' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.crema },
  progressFillDark: { backgroundColor: '#FFFFFF' },
  manageSub: {
    height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  manageSubText: { fontFamily: fonts.archivo.bold, fontSize: 14.5, color: '#FFFFFF' },

  // ── Chip ────────────────────────────────────────────────────────────────
  chip: {
    height: 28, borderRadius: 14, paddingHorizontal: 12,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#FFFFFF' },
  chipDanger: { backgroundColor: 'rgba(192,69,53,0.12)' },
  chipText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.crema },
  chipTextActive: { color: colors.crema },
  chipTextDanger: { color: colors.error },

  // ── Studio logo row ──────────────────────────────────────────────────────
  logoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 18, backgroundColor: colors.panel, marginBottom: 12,
  },
  logoSlot: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  logoImage: { width: '100%', height: '100%' },
  logoInitials: { fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema, letterSpacing: -0.5 },
  logoMeta: { flex: 1, gap: 2 },
  logoStudioName: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema, letterSpacing: -0.2 },
  logoHint: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.faint },

  // ── Team list ────────────────────────────────────────────────────────────
  teamList: { gap: 8 },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12,
    borderRadius: 16, backgroundColor: colors.panel,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03, shadowRadius: 8, elevation: 1,
  },
  memberAvatarWrap: { backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  memberAvatarText: { fontFamily: fonts.archivo.bold, color: colors.crema },
  memberName: { flex: 1, fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.crema },
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
  pendingBadgeText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.faint },

  // ── Create studio ────────────────────────────────────────────────────────
  createStudioBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
  },
  createStudioText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema },

  // ── Logout / delete ──────────────────────────────────────────────────────
  logoutBtn: {
    height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center',
  },
  logoutText: { fontFamily: fonts.archivo.bold, fontSize: 14.5, color: colors.gris },
  deleteAccountBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, marginTop: 4,
  },
  deleteAccountText: {
    fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error,
  },

  appVersion: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.faint, textAlign: 'center',
    marginTop: spacing.xl, marginBottom: spacing.lg,
  },

  // ── Sheets (shared) ──────────────────────────────────────────────────────
  sheet: {
    backgroundColor: colors.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl, paddingBottom: 36, paddingTop: 12, gap: spacing.lg,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: { fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema, letterSpacing: -0.3 },

  sheetAvatarRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 14, borderRadius: 18, backgroundColor: colors.chip,
  },
  sheetAvatarSlot: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  sheetLogoMeta: { flex: 1, gap: 2 },
  sheetLogoLabel: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema },
  sheetLogoHint: { fontFamily: fonts.archivo.semibold, fontSize: 11.5, color: colors.gris },
  sheetLogoIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
  },

  sheetFieldWrap: { gap: spacing.sm },
  sheetFieldLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  sheetInput: {
    height: 52, borderRadius: 16, backgroundColor: colors.chip,
    paddingHorizontal: spacing.md, fontFamily: fonts.archivo.semibold,
    fontSize: 15, color: colors.crema,
  },
  sheetBtn: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetBtnDisabled: { opacity: 0.35 },
  sheetBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.1 },

  // ── Member sheet ─────────────────────────────────────────────────────────
  memberSheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 4,
  },
  memberSheetName: { fontFamily: fonts.archivo.bold, fontSize: 16, color: colors.crema, letterSpacing: -0.2 },
  memberSheetRole: { fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: colors.gris },
  roleList: { gap: 8 },
  roleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 16, backgroundColor: colors.chip,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  roleRowActive: { borderColor: colors.crema, backgroundColor: colors.panel },
  roleRowLeft: { flex: 1, gap: 2 },
  roleRowLabel: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.crema },
  roleRowLabelActive: { color: colors.crema },
  roleRowDesc: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.gris },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: colors.faint, alignItems: 'center', justifyContent: 'center',
  },
  radioOuterActive: { borderColor: colors.crema },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.crema },
  removeMemberBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 12,
  },
  removeMemberText: {
    fontFamily: fonts.archivo.semibold, fontSize: 13.5, color: colors.error,
  },

  // ── Delete account sheet ─────────────────────────────────────────────────
  deleteSheetIcon: { alignItems: 'center', paddingTop: 8 },
  deleteSheetTitle: {
    fontFamily: fonts.archivo.bold, fontSize: 20, color: colors.crema,
    letterSpacing: -0.4, textAlign: 'center',
  },
  deleteSheetBody: {
    fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris,
    lineHeight: 21, textAlign: 'center',
  },
  deleteConfirmBtn: {
    height: 54, borderRadius: 27, backgroundColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteConfirmText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF' },
  deleteCancelBtn: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
  },
  deleteCancelText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris },
});
