import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image, TextInput, ActivityIndicator, Alert, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type Status = 'pendiente' | 'en_revision' | 'resuelto';

interface PendingItem {
  id: string;
  description: string;
  trade: string | null;
  status: Status;
  source: 'ai' | 'manual';
  created_at: string;
  frame_id: string | null;
  report_frames: { storage_path: string; timestamp_sec: number; order_index: number } | null;
  projects: { name: string } | null;
  rubros: { name: string } | null;
  reports: { id: string; type: string; created_at: string; ai_summary: string | null } | null;
}

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'pendiente',   label: 'Pendiente'   },
  { value: 'en_revision', label: 'En revisión' },
  { value: 'resuelto',    label: 'Resuelto'    },
];

const STATUS_COLOR: Record<Status, string> = {
  pendiente:   colors.crema,
  en_revision: colors.arena,
  resuelto:    colors.success,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DetallePendienteScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [item, setItem] = useState<PendingItem | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('pendiente');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayedSummary, setDisplayedSummary] = useState('');
  const shimmerX = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    const summary = item?.reports?.ai_summary;
    if (!summary || item?.source !== 'ai') { setDisplayedSummary(''); return; }
    setDisplayedSummary('');
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayedSummary(summary.slice(0, i));
      if (i >= summary.length) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [item?.reports?.ai_summary, item?.source]);

  useEffect(() => {
    if (item?.source !== 'ai') return;
    shimmerX.setValue(-80);
    const t = setTimeout(() => {
      Animated.timing(shimmerX, { toValue: 120, duration: 900, useNativeDriver: true }).start();
    }, 200);
    return () => clearTimeout(t);
  }, [item?.source]);

  const fetchItem = useCallback(async () => {
    if (!id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('pending_items')
      .select(`
        id, description, trade, status, source, created_at, frame_id,
        report_frames(storage_path, timestamp_sec, order_index),
        projects(name),
        rubros(name),
        reports(id, type, created_at, ai_summary)
      `)
      .eq('id', id)
      .single<PendingItem>();

    if (error || !data) {
      setLoading(false);
      return;
    }

    setItem(data);
    setStatus(data.status);

    if (data.report_frames?.storage_path) {
      const { data: signed } = await supabase.storage
        .from('report-frames')
        .createSignedUrl(data.report_frames.storage_path, 3600);
      if (signed?.signedUrl) setFrameUrl(signed.signedUrl);
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { fetchItem(); }, [fetchItem]);

  async function handleSave() {
    if (!item) return;
    setSaving(true);
    const { error } = await supabase
      .from('pending_items')
      .update({ status })
      .eq('id', item.id);
    setSaving(false);
    if (error) {
      Alert.alert('Error', 'No se pudo guardar el cambio.');
    } else {
      router.back();
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.crema} />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Pendiente no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAI = item.source === 'ai';
  const projectName = item.projects?.name ?? '—';
  const rubroName = item.rubros?.name ?? '—';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="arrow-left" size={18} color={colors.crema} />
          </TouchableOpacity>
        </View>

        {/* Frame image — solo si viene de IA y tiene frame */}
        {isAI && frameUrl ? (
          <View style={styles.imageWrap}>
            <Image source={{ uri: frameUrl }} style={styles.image} resizeMode="cover" />
            <View style={styles.frameBadgeRow}>
              {item.report_frames && (
                <View style={styles.frameBadge}>
                  <Feather name="film" size={10} color={colors.gris} />
                  <Text style={styles.frameBadgeText}>
                    Frame {item.report_frames.order_index + 1} · t={formatTime(item.report_frames.timestamp_sec)}
                  </Text>
                </View>
              )}
              <View style={[styles.frameBadge, { backgroundColor: 'rgba(18,21,26,0.7)' }]}>
                <Feather name="cpu" size={10} color={colors.arena} />
                <Text style={[styles.frameBadgeText, { color: colors.arena }]}>Detectado por IA</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* Content */}
        <View style={styles.content}>

          {/* Eyebrow */}
          <Text style={styles.eyebrow}>{projectName} · {rubroName}</Text>

          {/* Description */}
          <Text style={styles.description}>{item.description}</Text>

          {/* Trade + source chips */}
          <View style={styles.chipRow}>
            {item.trade ? (
              <View style={styles.tradeChip}>
                <Text style={styles.tradeText}>{item.trade.toUpperCase()}</Text>
              </View>
            ) : null}
            <View style={[styles.sourceChip, isAI && styles.sourceChipAI, isAI && { overflow: 'hidden' }]}>
              <Feather name={isAI ? 'cpu' : 'edit-3'} size={10} color={isAI ? colors.arena : colors.gris} />
              <Text style={[styles.sourceChipText, isAI && styles.sourceChipTextAI]}>
                {isAI ? 'Generado por IA' : 'Manual'}
              </Text>
              {isAI && (
                <Animated.View
                  style={{
                    position: 'absolute', top: 0, bottom: 0, width: 30,
                    backgroundColor: 'rgba(255,255,255,0.28)',
                    transform: [{ translateX: shimmerX }],
                  }}
                  pointerEvents="none"
                />
              )}
            </View>
          </View>

          {/* Análisis de IA */}
          {isAI && item.reports?.ai_summary ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="cpu" size={12} color={colors.arena} />
                <Text style={[styles.sectionLabel, { color: colors.arena }]}>ANÁLISIS DE IA</Text>
              </View>
              <View style={styles.aiCard}>
                <Text style={styles.aiText}>{displayedSummary}</Text>
              </View>
            </View>
          ) : null}

          {/* Informe de origen */}
          {isAI && item.reports ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Feather name="file-text" size={12} color={colors.gris} />
                <Text style={styles.sectionLabel}>INFORME DE ORIGEN</Text>
              </View>
              <View style={styles.infoCardShadow}>
                <View style={styles.infoCard}>
                  <InfoRow icon="calendar" label="Fecha" value={formatDate(item.reports.created_at)} />
                  <View style={styles.infoRowDivider} />
                  <InfoRow
                    icon="tag"
                    label="Tipo"
                    value={item.reports.type === 'contratistas' ? 'Contratistas' : 'Oficina técnica'}
                  />
                  {item.report_frames && (
                    <>
                      <View style={styles.infoRowDivider} />
                      <InfoRow
                        icon="film"
                        label="Frame"
                        value={`Frame ${item.report_frames.order_index + 1} · t=${formatTime(item.report_frames.timestamp_sec)}`}
                      />
                    </>
                  )}
                  <View style={styles.infoRowDivider} />
                  <TouchableOpacity
                    style={styles.verInformeRow}
                    onPress={() => router.push(`/informe/${item.reports!.id}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.verInformeText}>Ver informe completo</Text>
                    <Feather name="arrow-right" size={14} color={colors.arena} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : null}

          {/* Estado */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="activity" size={12} color={colors.gris} />
              <Text style={styles.sectionLabel}>ESTADO</Text>
            </View>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.statusBtn,
                    status === opt.value && { backgroundColor: STATUS_COLOR[opt.value] + '22', borderColor: STATUS_COLOR[opt.value] },
                  ]}
                  onPress={() => setStatus(opt.value)}
                  activeOpacity={0.8}
                >
                  {status === opt.value && (
                    <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[opt.value] }]} />
                  )}
                  <Text style={[
                    styles.statusBtnText,
                    status === opt.value && { color: STATUS_COLOR[opt.value] },
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Nota */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="edit-3" size={12} color={colors.gris} />
              <Text style={styles.sectionLabel}>NOTA</Text>
            </View>
            <View style={styles.noteField}>
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Agregar observación o resolución…"
                placeholderTextColor={colors.faint}
                multiline
                numberOfLines={3}
                selectionColor={colors.crema}
              />
            </View>
          </View>

          {/* CTAs */}
          <TouchableOpacity
            style={[styles.btnPrimary, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.btnPrimaryText}>Guardar cambios</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Info row helper ──────────────────────────────────────────────────────────

function InfoRow({ icon, label, value }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Feather name={icon} size={12} color={colors.gris} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  scroll: { paddingBottom: 48 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },

  imageWrap: {
    marginHorizontal: spacing.xl, borderRadius: 24, overflow: 'hidden',
    height: 220, backgroundColor: colors.chip,
  },
  image: { width: '100%', height: '100%' },
  frameBadgeRow: {
    position: 'absolute', bottom: 12, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  frameBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(18,21,26,0.65)', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  frameBadgeText: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris, letterSpacing: 0.3,
  },

  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.lg },

  eyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.gris,
  },
  description: {
    fontFamily: fonts.archivo.bold, fontSize: 19, color: colors.crema,
    lineHeight: 27, letterSpacing: -0.3,
  },

  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tradeChip: {
    height: 28, borderRadius: 14, paddingHorizontal: 12,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  tradeText: { fontFamily: fonts.archivo.bold, fontSize: 10.5, letterSpacing: 0.4, color: colors.crema },
  sourceChip: {
    height: 28, borderRadius: 14, paddingHorizontal: 12,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 5,
  },
  sourceChipAI: { backgroundColor: 'rgba(217,119,87,0.1)', borderWidth: 1, borderColor: 'rgba(217,119,87,0.25)' },
  sourceChipText: { fontFamily: fonts.archivo.bold, fontSize: 10.5, color: colors.gris },
  sourceChipTextAI: { color: colors.arena },

  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },

  aiCard: {
    backgroundColor: 'rgba(217,119,87,0.07)',
    borderWidth: 1, borderColor: 'rgba(217,119,87,0.15)',
    borderRadius: 18, padding: spacing.md,
  },
  aiText: {
    fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema,
    lineHeight: 22,
  },

  infoCardShadow: {
    borderRadius: 18, backgroundColor: colors.panel,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  infoCard: { borderRadius: 18, overflow: 'hidden' },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 13,
    backgroundColor: colors.panel,
  },
  infoRowDivider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  infoRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.gris },
  infoValue: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema },

  verInformeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 13,
    backgroundColor: colors.panel,
  },
  verInformeText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.arena },

  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusBtn: {
    flex: 1, height: 42, borderRadius: 21, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBtnText: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: colors.gris },

  noteField: {
    backgroundColor: colors.panel, borderRadius: 16,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  noteInput: {
    fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema, minHeight: 72,
  },

  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
