import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = 'contratistas' | 'oficina';

interface DailyReport {
  id: string;
  date: string;
  type: ReportType;
  status: string;
}

interface ReportMedia {
  id: string;
  type: 'foto' | 'video';
  uri: string | null;
  note: string | null;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InformeDiaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const params = useLocalSearchParams<{
    rubroId: string; rubroName: string; projectId: string; projectName: string;
  }>();

  const rubroId     = Array.isArray(params.rubroId)     ? params.rubroId[0]     : params.rubroId;
  const rubroName   = Array.isArray(params.rubroName)   ? params.rubroName[0]   : params.rubroName;
  const projectId   = Array.isArray(params.projectId)   ? params.projectId[0]   : params.projectId;

  const [loading, setLoading]         = useState(true);
  const [openReport, setOpenReport]   = useState<DailyReport | null>(null);
  const [media, setMedia]             = useState<ReportMedia[]>([]);
  const [reportType, setReportType]   = useState<ReportType>('contratistas');
  const [starting, setStarting]       = useState(false);
  const [closing, setClosing]         = useState(false);

  const load = useCallback(() => {
    if (!rubroId) return;
    setLoading(true);

    supabase
      .from('reports')
      .select('id, date, type, status')
      .eq('rubro_id', rubroId)
      .eq('date', todayIso())
      .eq('status', 'abierto')
      .maybeSingle()
      .then(({ data: report }) => {
        setOpenReport(report as DailyReport | null);

        if (report) {
          supabase
            .from('report_media')
            .select('id, type, uri, note, created_at')
            .eq('report_id', report.id)
            .order('created_at')
            .then(({ data }) => {
              setMedia((data as ReportMedia[]) ?? []);
              setLoading(false);
            });
        } else {
          setMedia([]);
          setLoading(false);
        }
      });
  }, [rubroId]);

  useFocusEffect(load);

  async function handleStart() {
    if (!rubroId || !projectId || !session?.user?.id) return;
    setStarting(true);

    const { data, error } = await supabase
      .from('reports')
      .insert({
        rubro_id:   rubroId,
        project_id: projectId,
        type:       reportType,
        mode:       'video',
        status:     'abierto',
        date:       todayIso(),
        created_by: session.user.id,
      })
      .select('id, date, type, status')
      .single();

    setStarting(false);
    if (error || !data) {
      Alert.alert('Error', 'No se pudo iniciar el informe.');
      return;
    }
    setOpenReport(data as DailyReport);
    setMedia([]);
  }

  async function handleClose() {
    if (!openReport) return;
    Alert.alert(
      'Cerrar y generar',
      '¿Cerrar el informe del día y generar el resumen con IA?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar y generar',
          onPress: async () => {
            setClosing(true);
            await supabase
              .from('reports')
              .update({ status: 'processing' })
              .eq('id', openReport.id);
            setClosing(false);
            router.replace('/(tabs)');
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <View style={[s.safe, s.center]}>
        <ActivityIndicator color={colors.crema} />
      </View>
    );
  }

  // ── No open report: Iniciar ──────────────────────────────────────────────

  if (!openReport) {
    return (
      <View style={[s.safe, { paddingTop: insets.top }]}>
        <View style={s.topBar}>
          <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="arrow-left" size={16} color={colors.crema} />
          </TouchableOpacity>
          <View style={s.topMeta}>
            <Text style={s.topEyebrow}>INFORME DEL DÍA</Text>
            <Text style={s.topTitle} numberOfLines={1}>{rubroName ?? 'Rubro'}</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Feather name="calendar" size={28} color={colors.gris} />
          </View>
          <Text style={s.emptyTitle}>Sin informe hoy</Text>
          <Text style={s.emptyBody}>
            Iniciá el informe del día para ir agregando fotos y videos durante la jornada.
          </Text>

          {/* Tipo */}
          <Text style={s.typeLabel}>TIPO DE INFORME</Text>
          <View style={s.typeToggle}>
            <TouchableOpacity
              style={[s.typeBtn, reportType === 'contratistas' && s.typeBtnActive]}
              onPress={() => setReportType('contratistas')}
              activeOpacity={0.8}
            >
              <Feather name="tool" size={13} color={reportType === 'contratistas' ? '#FFF' : colors.gris} />
              <Text style={[s.typeBtnText, reportType === 'contratistas' && s.typeBtnTextActive]}>Contratistas</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.typeBtn, reportType === 'oficina' && s.typeBtnActive]}
              onPress={() => setReportType('oficina')}
              activeOpacity={0.8}
            >
              <Feather name="briefcase" size={13} color={reportType === 'oficina' ? '#FFF' : colors.gris} />
              <Text style={[s.typeBtnText, reportType === 'oficina' && s.typeBtnTextActive]}>Oficina técnica</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.startBtn, starting && { opacity: 0.5 }]}
            onPress={handleStart}
            disabled={starting}
            activeOpacity={0.85}
          >
            {starting
              ? <ActivityIndicator color="#FFF" size="small" />
              : <>
                  <Feather name="play" size={16} color="#FFF" />
                  <Text style={s.startBtnText}>Iniciar informe del día</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Open report: list + agregar ──────────────────────────────────────────

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={16} color={colors.crema} />
        </TouchableOpacity>
        <View style={s.topMeta}>
          <Text style={s.topEyebrow}>INFORME DEL DÍA</Text>
          <Text style={s.topTitle} numberOfLines={1}>{rubroName ?? 'Rubro'}</Text>
        </View>
        <TouchableOpacity
          style={[s.closeBtn, closing && { opacity: 0.5 }]}
          onPress={handleClose}
          disabled={closing}
          activeOpacity={0.85}
        >
          {closing
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={s.closeBtnText}>Cerrar</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Status banner */}
      <View style={s.statusBanner}>
        <View style={s.statusDot} />
        <Text style={s.statusText}>Informe abierto · {media.length} elemento{media.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={s.mediaCard}>
            <View style={s.mediaIcon}>
              <Feather name={item.type === 'foto' ? 'image' : 'video'} size={20} color={colors.gris} />
            </View>
            <View style={s.mediaBody}>
              <Text style={s.mediaType}>{item.type === 'foto' ? 'Foto' : 'Video'}</Text>
              {item.note ? <Text style={s.mediaNote} numberOfLines={2}>{item.note}</Text> : null}
              <Text style={s.mediaTime}>{fmtTime(item.created_at)}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.emptyMedia}>
            <Feather name="inbox" size={28} color={colors.faint} />
            <Text style={s.emptyMediaText}>Todavía no hay elementos</Text>
            <Text style={s.emptyMediaSub}>Agregá fotos o videos para ir construyendo el informe</Text>
          </View>
        }
      />

      {/* FAB agregar */}
      <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + 28 }]}
        onPress={() => router.push({
          pathname: '/informe-dia/agregar',
          params: { reportId: openReport.id, rubroName: rubroName ?? '' },
        })}
        activeOpacity={0.85}
      >
        <Feather name="plus" size={20} color="#FFF" />
        <Text style={s.fabText}>Agregar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  center: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  topMeta: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  topEyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: colors.gris,
  },
  topTitle: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema, marginTop: 2 },

  closeBtn: {
    height: 36, paddingHorizontal: 16, borderRadius: 18,
    backgroundColor: colors.arena, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: '#FFF' },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: 'rgba(74,124,89,0.10)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(74,124,89,0.2)',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  statusText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.success },

  listContent: { paddingHorizontal: spacing.xl, paddingBottom: 120, gap: 10 },

  mediaCard: {
    flexDirection: 'row', gap: 12, backgroundColor: colors.panel, borderRadius: 16, padding: 14,
  },
  mediaIcon: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  mediaBody: { flex: 1, justifyContent: 'center', gap: 3 },
  mediaType: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.crema },
  mediaNote: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.gris, lineHeight: 17 },
  mediaTime: { fontFamily: fonts.mono.regular, fontSize: 10, color: colors.faint, letterSpacing: 0.3 },

  emptyMedia: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: spacing.xl },
  emptyMediaText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.gris },
  emptyMediaSub: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.faint, textAlign: 'center', lineHeight: 19 },

  fab: {
    position: 'absolute', right: spacing.xl,
    height: 50, borderRadius: 25, paddingHorizontal: 22,
    backgroundColor: colors.arena, flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowColor: colors.arena, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8,
  },
  fabText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: '#FFF' },

  // ── Empty state (iniciar) ──
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, gap: 16,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  emptyTitle: { fontFamily: fonts.archivo.bold, fontSize: 20, color: colors.crema },
  emptyBody: {
    fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris,
    textAlign: 'center', lineHeight: 21,
  },

  typeLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700', marginTop: 8,
  },
  typeToggle: {
    flexDirection: 'row', backgroundColor: colors.chip, borderRadius: 24,
    padding: 4, gap: 4, width: '100%',
  },
  typeBtn: {
    flex: 1, height: 44, borderRadius: 21, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  typeBtnActive: { backgroundColor: colors.crema },
  typeBtnText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.gris },
  typeBtnTextActive: { color: '#FFF' },

  startBtn: {
    height: 54, borderRadius: 27, backgroundColor: colors.arena, width: '100%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8,
  },
  startBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFF' },
});
