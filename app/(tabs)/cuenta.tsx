import { useState, useCallback, useEffect, Fragment } from 'react';
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

const PLAN_META: Record<string, { label: string; videos: number; price: string }> = {
  starter:    { label: 'Starter',    videos: 30,  price: '$49/mes' },
  pro:        { label: 'Pro',        videos: 100, price: '$149/mes' },
  enterprise: { label: 'Enterprise', videos: 999, price: 'A medida' },
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

function UserAvatar({ uri, name, size = 64 }: { uri?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  if (uri) {
    return <Image source={{ uri }} style={[{ width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarInitials, { fontSize: size * 0.33 }]}>{initials}</Text>
    </View>
  );
}

function MemberAvatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
  return (
    <View style={[styles.memberAvatarWrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.memberAvatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${value}%` as `${number}%` }]} />
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
  const { studio, isAdmin, loading: studioLoading, refetch: refetchStudio } = useStudio();
  const { subscription } = useSubscription();

  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [cancelingInviteId, setCancelingInviteId] = useState<string | null>(null);

  const [profileSheetVisible, setProfileSheetVisible] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [studioSheetVisible, setStudioSheetVisible] = useState(false);
  const [editStudioName, setEditStudioName] = useState('');
  const [savingStudio, setSavingStudio] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  const [memberSheetMember, setMemberSheetMember] = useState<Member | null>(null);
  const [memberSheetRole, setMemberSheetRole] = useState<StudioRole>('member');
  const [memberActionLoading, setMemberActionLoading] = useState(false);

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
    subStatus === 'trialing' ? 'Período de prueba' :
    subStatus === 'past_due' ? 'Pago pendiente' :
    subStatus === 'canceled' ? 'Cancelado' : 'Activo';

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
    ]).then(([{ data: md }, { data: id }]) => {
      setMembers((md as Member[]) ?? []);
      setPendingInvites((id as PendingInvite[]) ?? []);
      setMembersLoading(false);
    });
  }, [studio?.id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ── Profile ──────────────────────────────────────────────────────────────

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
      const bs = atob(b64);
      const bytes = new Uint8Array(bs.length);
      for (let i = 0; i < bs.length; i++) bytes[i] = bs.charCodeAt(i);
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
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
    } finally {
      setAvatarUploading(false);
    }
  }

  async function handleSaveProfile() {
    if (!editFullName.trim() || !session?.user?.id) return;
    setSavingProfile(true);
    await supabase.from('profiles').update({ full_name: editFullName.trim() }).eq('id', session.user.id);
    await refetchProfile();
    setSavingProfile(false);
    setProfileSheetVisible(false);
  }

  // ── Studio ───────────────────────────────────────────────────────────────

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
      const bs = atob(asset.base64);
      const bytes = new Uint8Array(bs.length);
      for (let i = 0; i < bs.length; i++) bytes[i] = bs.charCodeAt(i);
      const { error: uploadError } = await supabase.storage
        .from('studio-logos')
        .upload(path, bytes, { contentType: `image/${ext}`, upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('studio-logos').getPublicUrl(path);
      await supabase.from('studios').update({ logo_url: `${publicUrl}?v=${Date.now()}` }).eq('id', studio.id);
      await refetchStudio();
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : String(err));
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

  // ── Members ──────────────────────────────────────────────────────────────

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
    Alert.alert('Eliminar miembro', `¿Eliminar a ${name} del estudio?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await supabase
            .from('studio_members')
            .delete()
            .match({ studio_id: studio.id, user_id: memberSheetMember.user_id });
          fetchMembers();
        },
      },
    ]);
  }

  async function handleCancelInvite(inviteId: string) {
    setCancelingInviteId(inviteId);
    await supabase.from('studio_invites').delete().eq('id', inviteId);
    setCancelingInviteId(null);
    fetchMembers();
  }

  // ── Account ──────────────────────────────────────────────────────────────

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

  // ── Helpers ──────────────────────────────────────────────────────────────

  const allMemberRows = [...members, ...pendingInvites];
  const totalRows = allMemberRows.length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>

        {/* ─── PERFIL ──────────────────────────────────────────────────── */}
        <View style={styles.profileBlock}>
          <View style={styles.profileRow}>
            {/* Avatar with camera badge */}
            <TouchableOpacity onPress={openProfileSheet} activeOpacity={0.85} style={styles.avatarTouchable}>
              <UserAvatar uri={profile?.avatar_url} name={displayName} size={64} />
              <View style={styles.cameraBadge}>
                <Feather name="camera" size={11} color={colors.panel} />
              </View>
            </TouchableOpacity>

            {/* Name + email */}
            <View style={styles.profileInfo}>
              <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
              {email ? <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text> : null}
            </View>

            {/* Bell */}
            <TouchableOpacity style={styles.circleBtn} onPress={() => router.push('/notificaciones')} activeOpacity={0.8}>
              <Feather name="bell" size={16} color={colors.crema} />
            </TouchableOpacity>
          </View>

          {/* Edit pill */}
          <TouchableOpacity style={styles.editPill} onPress={openProfileSheet} activeOpacity={0.75}>
            <Feather name="edit-2" size={11} color={colors.gris} />
            <Text style={styles.editPillText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.break} />

        {/* ─── SUSCRIPCIÓN ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionTop}>
            <Text style={styles.sectionLabel}>SUSCRIPCIÓN</Text>
            <TouchableOpacity onPress={() => router.push('/suscripcion')} activeOpacity={0.7}>
              <Text style={styles.sectionAction}>Ver planes ›</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.planCard}>
            <View style={styles.planCardRow}>
              <View>
                <Text style={styles.planName}>{plan.label}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
              </View>
              <View style={styles.statusPill}>
                <View style={[
                  styles.statusDot,
                  subStatus === 'past_due' || subStatus === 'canceled'
                    ? { backgroundColor: colors.error }
                    : { backgroundColor: '#4ade80' },
                ]} />
                <Text style={styles.statusText}>{statusLabel}</Text>
              </View>
            </View>

            {subscription?.currentPeriodEnd && (
              <Text style={styles.planPeriodText}>
                Próximo cobro: {formatPeriodEnd(subscription.currentPeriodEnd)}
              </Text>
            )}

            <View style={styles.usageBlock}>
              <View style={styles.usageRow}>
                <Text style={styles.usageLabel}>Videos este período</Text>
                <Text style={styles.usageCount}>
                  {videosUsed} / {videoLimit === 999 ? '∞' : videoLimit}
                </Text>
              </View>
              <ProgressBar value={videoProgress} />
            </View>
          </View>
        </View>

        <View style={styles.break} />

        {/* ─── ESTUDIO ─────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionTop}>
            <View>
              <Text style={styles.sectionLabel}>ESTUDIO</Text>
              {studio && <Text style={styles.studioTitle}>{studio.name}</Text>}
            </View>
            {isAdmin && (
              <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/invitar-miembro')} activeOpacity={0.8}>
                <Feather name="user-plus" size={14} color={colors.crema} />
                <Text style={styles.addBtnText}>Invitar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Studio identity row */}
          {studio && (
            <TouchableOpacity
              style={styles.studioRow}
              onPress={openStudioSheet}
              activeOpacity={isAdmin ? 0.75 : 1}
              disabled={!isAdmin}
            >
              <View style={styles.studioLogoSlot}>
                {studio.logo_url
                  ? <Image source={{ uri: studio.logo_url }} style={styles.studioLogoImg} />
                  : <Text style={styles.studioLogoInitials}>
                      {studio.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </Text>
                }
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.studioRowName}>{studio.name}</Text>
                {isAdmin && <Text style={styles.studioRowHint}>Editar nombre y logo</Text>}
              </View>
              {isAdmin && <Feather name="chevron-right" size={16} color={colors.faint} />}
            </TouchableOpacity>
          )}

          {/* Members grouped container */}
          {(membersLoading || (!studioLoading && studio)) && (
            <View style={styles.grouped}>
              {membersLoading ? (
                <View style={styles.groupedRow}>
                  <ActivityIndicator color={colors.crema} />
                </View>
              ) : (
                <>
                  {members.map((m, i) => {
                    const name = m.full_name || 'Usuario';
                    const canManage = isAdmin && m.role !== 'owner';
                    const isLast = i === members.length - 1 && pendingInvites.length === 0;
                    return (
                      <Fragment key={m.user_id}>
                        <View style={styles.groupedRow}>
                          <MemberAvatar name={name} size={36} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberName}>{name}</Text>
                            <Text style={styles.memberRole}>{ROLE_LABEL[m.role]}</Text>
                          </View>
                          {canManage && (
                            <TouchableOpacity
                              onPress={() => openMemberSheet(m)}
                              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                              activeOpacity={0.6}
                            >
                              <Feather name="more-horizontal" size={18} color={colors.gris} />
                            </TouchableOpacity>
                          )}
                        </View>
                        {!isLast && <View style={styles.groupedDivider} />}
                      </Fragment>
                    );
                  })}
                  {pendingInvites.map((inv, i) => {
                    const isLast = i === pendingInvites.length - 1;
                    return (
                      <Fragment key={inv.id}>
                        {members.length > 0 && i === 0 && <View style={styles.groupedDivider} />}
                        <View style={styles.groupedRow}>
                          <View style={styles.inviteIcon}>
                            <Feather name="mail" size={15} color={colors.faint} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.memberName} numberOfLines={1}>{inv.email}</Text>
                            <Text style={[styles.memberRole, { color: colors.arena }]}>Invitación pendiente</Text>
                          </View>
                          {isAdmin && (
                            <TouchableOpacity
                              onPress={() => handleCancelInvite(inv.id)}
                              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                              activeOpacity={0.6}
                            >
                              {cancelingInviteId === inv.id
                                ? <ActivityIndicator size="small" color={colors.gris} />
                                : <Feather name="x" size={18} color={colors.gris} />
                              }
                            </TouchableOpacity>
                          )}
                        </View>
                        {!isLast && <View style={styles.groupedDivider} />}
                      </Fragment>
                    );
                  })}
                </>
              )}
            </View>
          )}

          {/* No studio */}
          {!studioLoading && !studio && (
            <TouchableOpacity style={styles.createStudioBtn} onPress={() => router.push('/studio/crear')} activeOpacity={0.85}>
              <Feather name="home" size={14} color={colors.crema} />
              <Text style={styles.createStudioText}>Crear estudio</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.break} />

        {/* ─── CONFIGURACIÓN ───────────────────────────────────────────── */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONFIGURACIÓN</Text>
          <View style={styles.grouped}>
            <TouchableOpacity
              style={styles.groupedRow}
              onPress={() => router.push('/configuracion-informe')}
              activeOpacity={0.75}
            >
              <View style={styles.settingsIcon}>
                <Feather name="file-text" size={15} color={colors.panel} />
              </View>
              <Text style={styles.settingsLabel}>Logo del informe</Text>
              <Feather name="chevron-right" size={16} color={colors.faint} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.break} />

        {/* ─── CUENTA ──────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => setDeleteAccountVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.deleteBtnText}>Eliminar cuenta</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.appVersion}>MERIDIANO v1.0.0</Text>
      </ScrollView>

      {/* ── Sheet: editar perfil ── */}
      <BottomSheet visible={profileSheetVisible} onClose={() => setProfileSheetVisible(false)} avoidKeyboard>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Editar perfil</Text>

          <TouchableOpacity style={styles.sheetMediaRow} onPress={handleAvatarUpload} activeOpacity={0.8} disabled={avatarUploading}>
            <View style={styles.sheetMediaSlot}>
              {avatarUploading
                ? <ActivityIndicator color={colors.gris} />
                : <UserAvatar uri={profile?.avatar_url} name={displayName} size={56} />
              }
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.sheetMediaLabel}>
                {profile?.avatar_url ? 'Cambiar foto' : 'Agregar foto de perfil'}
              </Text>
              <Text style={styles.sheetMediaHint}>Cuadrada, PNG o JPG</Text>
            </View>
            <View style={styles.sheetMediaIcon}><Feather name="camera" size={15} color={colors.crema} /></View>
          </TouchableOpacity>

          <View style={styles.sheetField}>
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
            style={[styles.sheetBtn, (!editFullName.trim() || savingProfile) && styles.sheetBtnOff]}
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

          <TouchableOpacity style={styles.sheetMediaRow} onPress={handleLogoUpload} activeOpacity={0.8} disabled={logoUploading}>
            <View style={[styles.sheetMediaSlot, { borderRadius: 16 }]}>
              {logoUploading
                ? <ActivityIndicator color={colors.gris} size="small" />
                : studio?.logo_url
                  ? <Image source={{ uri: studio.logo_url }} style={{ width: 56, height: 56 }} />
                  : <Text style={styles.studioLogoInitials}>
                      {(studio?.name ?? '').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </Text>
              }
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.sheetMediaLabel}>{studio?.logo_url ? 'Cambiar logo' : 'Agregar logo'}</Text>
              <Text style={styles.sheetMediaHint}>Cuadrado, PNG o JPG</Text>
            </View>
            <View style={styles.sheetMediaIcon}><Feather name="camera" size={15} color={colors.crema} /></View>
          </TouchableOpacity>

          <View style={styles.sheetField}>
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
            style={[styles.sheetBtn, (!editStudioName.trim() || savingStudio) && styles.sheetBtnOff]}
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
      <BottomSheet visible={!!memberSheetMember} onClose={() => setMemberSheetMember(null)}>
        {memberSheetMember && (
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.memberSheetHead}>
              <MemberAvatar name={memberSheetMember.full_name || 'U'} size={40} />
              <View>
                <Text style={styles.memberSheetName}>{memberSheetMember.full_name || 'Usuario'}</Text>
                <Text style={styles.memberSheetCurrent}>{ROLE_LABEL[memberSheetMember.role]}</Text>
              </View>
            </View>

            <Text style={styles.sheetFieldLabel}>CAMBIAR ROL</Text>
            <View style={styles.roleList}>
              {ROLES_ASSIGNABLE.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleRow, memberSheetRole === r.value && styles.roleRowOn]}
                  onPress={() => setMemberSheetRole(r.value)}
                  activeOpacity={0.75}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleLabel, memberSheetRole === r.value && styles.roleLabelOn]}>{r.label}</Text>
                    <Text style={styles.roleDesc}>{r.desc}</Text>
                  </View>
                  <View style={[styles.radio, memberSheetRole === r.value && styles.radioOn]}>
                    {memberSheetRole === r.value && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.sheetBtn, memberActionLoading && styles.sheetBtnOff]}
              onPress={handleSaveMemberRole}
              activeOpacity={0.85}
              disabled={memberActionLoading}
            >
              {memberActionLoading
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={styles.sheetBtnText}>Guardar cambios</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={styles.removeBtn} onPress={handleRemoveMember} activeOpacity={0.7}>
              <Feather name="user-x" size={14} color={colors.error} />
              <Text style={styles.removeBtnText}>Eliminar del estudio</Text>
            </TouchableOpacity>
          </View>
        )}
      </BottomSheet>

      {/* ── Sheet: confirmar eliminar cuenta ── */}
      <BottomSheet visible={deleteAccountVisible} onClose={() => setDeleteAccountVisible(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.deleteIcon}>
            <Feather name="alert-triangle" size={30} color={colors.error} />
          </View>
          <Text style={styles.deleteTitle}>Eliminar cuenta</Text>
          <Text style={styles.deleteBody}>
            Esta acción es permanente. Se eliminarán tu cuenta y todos tus datos. No se puede deshacer.
          </Text>
          <TouchableOpacity
            style={[styles.deleteConfirmBtn, deletingAccount && styles.sheetBtnOff]}
            onPress={handleDeleteAccount}
            activeOpacity={0.85}
            disabled={deletingAccount}
          >
            {deletingAccount
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.deleteConfirmText}>Sí, eliminar mi cuenta</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setDeleteAccountVisible(false)} activeOpacity={0.7}>
            <Text style={styles.deleteCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },

  // ── Profile block ─────────────────────────────────────────────────────
  profileBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 16,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarTouchable: { position: 'relative', flexShrink: 0 },
  avatarFallback: {
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.archivo.bold,
    color: colors.crema,
    letterSpacing: -0.5,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.tinta,
  },
  profileInfo: { flex: 1, gap: 3 },
  profileName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 22,
    color: colors.crema,
    letterSpacing: -0.5,
  },
  profileEmail: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13,
    color: colors.gris,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    flexShrink: 0,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.chip,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editPillText: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12.5,
    color: colors.gris,
  },

  // ── Section break ─────────────────────────────────────────────────────
  break: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xl,
    marginVertical: 24,
  },

  // ── Sections ──────────────────────────────────────────────────────────
  section: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 4,
    gap: 12,
  },
  sectionTop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  sectionLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.gris,
    fontWeight: '700',
  },
  sectionAction: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13,
    color: colors.arena,
  },
  studioTitle: {
    fontFamily: fonts.archivo.bold,
    fontSize: 17,
    color: colors.crema,
    letterSpacing: -0.3,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.crema,
  },
  addBtnText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 12,
    color: colors.panel,
  },

  // ── Plan card ─────────────────────────────────────────────────────────
  planCard: {
    borderRadius: 20,
    backgroundColor: colors.crema,
    padding: 20,
    gap: 16,
  },
  planCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  planName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 22,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  planPrice: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  planPeriodText: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.45)',
    marginTop: -8,
  },
  usageBlock: { gap: 8 },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usageLabel: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.6)',
  },
  usageCount: {
    fontFamily: fonts.archivo.bold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.6)',
  },
  progressTrack: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },

  // ── Studio row ────────────────────────────────────────────────────────
  studioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.panel,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  studioLogoSlot: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  studioLogoImg: { width: '100%', height: '100%' },
  studioLogoInitials: {
    fontFamily: fonts.archivo.bold,
    fontSize: 17,
    color: colors.crema,
    letterSpacing: -0.5,
  },
  studioRowName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 15,
    color: colors.crema,
  },
  studioRowHint: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12,
    color: colors.faint,
    marginTop: 2,
  },

  // ── Grouped container ─────────────────────────────────────────────────
  grouped: {
    borderRadius: 18,
    backgroundColor: colors.panel,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  groupedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 60,
  },
  groupedDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 64, // lines up after avatar
  },
  memberAvatarWrap: {
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  memberAvatarText: {
    fontFamily: fonts.archivo.bold,
    color: colors.crema,
  },
  memberName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14,
    color: colors.crema,
  },
  memberRole: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12,
    color: colors.gris,
    marginTop: 2,
  },
  inviteIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Settings rows ─────────────────────────────────────────────────────
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  settingsLabel: {
    flex: 1,
    fontFamily: fonts.archivo.bold,
    fontSize: 14,
    color: colors.crema,
  },

  // ── Create studio ─────────────────────────────────────────────────────
  createStudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  createStudioText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14,
    color: colors.crema,
  },

  // ── Account buttons ───────────────────────────────────────────────────
  logoutBtn: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14.5,
    color: colors.gris,
  },
  deleteBtn: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  deleteBtnText: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13,
    color: colors.error,
  },

  appVersion: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.faint,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },

  // ── Sheets ────────────────────────────────────────────────────────────
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingBottom: 36,
    paddingTop: 12,
    gap: spacing.lg,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 4,
  },
  sheetTitle: {
    fontFamily: fonts.archivo.bold,
    fontSize: 18,
    color: colors.crema,
    letterSpacing: -0.3,
  },
  sheetMediaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.chip,
  },
  sheetMediaSlot: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', flexShrink: 0,
  },
  sheetMediaLabel: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14,
    color: colors.crema,
  },
  sheetMediaHint: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 11.5,
    color: colors.gris,
  },
  sheetMediaIcon: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetField: { gap: spacing.sm },
  sheetFieldLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.gris,
    fontWeight: '700',
  },
  sheetInput: {
    height: 52, borderRadius: 16, backgroundColor: colors.chip,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema,
  },
  sheetBtn: {
    height: 54, borderRadius: 27,
    backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetBtnOff: { opacity: 0.35 },
  sheetBtnText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 15, color: '#FFFFFF', letterSpacing: 0.1,
  },

  // ── Member sheet ──────────────────────────────────────────────────────
  memberSheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  memberSheetName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 16,
    color: colors.crema,
    letterSpacing: -0.2,
  },
  memberSheetCurrent: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12.5,
    color: colors.gris,
  },
  roleList: { gap: 8 },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.chip,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  roleRowOn: {
    borderColor: colors.crema,
    backgroundColor: colors.panel,
  },
  roleLabel: {
    fontFamily: fonts.archivo.bold,
    fontSize: 13.5,
    color: colors.crema,
  },
  roleLabelOn: { color: colors.crema },
  roleDesc: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 12,
    color: colors.gris,
    marginTop: 1,
  },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: colors.faint,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: colors.crema },
  radioDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: colors.crema,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  removeBtnText: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13.5,
    color: colors.error,
  },

  // ── Delete account sheet ──────────────────────────────────────────────
  deleteIcon: { alignItems: 'center', paddingTop: 8 },
  deleteTitle: {
    fontFamily: fonts.archivo.bold,
    fontSize: 20,
    color: colors.crema,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  deleteBody: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 14,
    color: colors.gris,
    lineHeight: 21,
    textAlign: 'center',
  },
  deleteConfirmBtn: {
    height: 54, borderRadius: 27,
    backgroundColor: colors.error,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteConfirmText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 15,
    color: '#FFFFFF',
  },
  deleteCancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  deleteCancelText: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 14,
    color: colors.gris,
  },
});
