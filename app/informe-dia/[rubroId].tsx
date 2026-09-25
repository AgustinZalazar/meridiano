import { useCallback, useState } from 'react';
import { SlidingTabs } from '../../components/SlidingTabs';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useStudio } from '../../lib/use-studio';

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

  const { studio } = useStudio();

  const [loading, setLoading]         = useState(true);
  const [openReport, setOpenReport]   = useState<DailyReport | null>(null);
  const [media, setMedia]             = useState<ReportMedia[]>([]);
  const [reportType, setReportType]   = useState<ReportType>('contratistas');
  const [starting, setStarting]       = useState(false);
  const [closing, setClosing]         = useState(false);
  const [closeStage, setCloseStage]   = useState<string | null>(null);

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

  async function runClose() {
    if (!openReport || !studio) return;
    setClosing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      // Build media_items: fotos use uri directly, videos need a thumbnail
      const mediaItems: { type: 'foto' | 'video'; url: string; note: string | null }[] = [];

      setCloseStage('Preparando material…');

      for (const item of media) {
        if (!item.uri) continue;

        if (item.type === 'foto') {
          mediaItems.push({ type: 'foto', url: item.uri, note: item.note });
        } else {
          // Extract thumbnail from video at 1s (or 0 if shorter)
          try {
            setCloseStage(`Extrayendo captura de video ${mediaItems.length + 1}…`);
            const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(item.uri, { time: 1000 });

            // Upload thumbnail to storage
            const thumbPath = `${studio.id}/daily/thumbs/${Date.now()}.jpg`;
            const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/processing/${thumbPath}`;

            const cacheDir  = `${FileSystem.cacheDirectory ?? ''}daily_thumbs/`;
            await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
            const localPath = `${cacheDir}${Date.now()}.jpg`;
            await FileSystem.copyAsync({ from: thumbUri, to: localPath });

            const uploadTask = FileSystem.createUploadTask(
              uploadUrl, localPath,
              {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  'Content-Type': 'image/jpeg',
                  'x-upsert': 'true',
                },
              },
            );
            const result = await uploadTask.uploadAsync();
            FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});

            if (result && result.status < 300) {
              const thumbUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/processing/${thumbPath}`;
              mediaItems.push({ type: 'video', url: thumbUrl, note: item.note });
            }
          } catch {
            // If thumbnail extraction fails, skip this video rather than blocking the whole report
          }
        }
      }

      if (mediaItems.length === 0) throw new Error('No hay material válido para generar el informe.');

      setCloseStage('Analizando con IA…');

      const { data, error } = await supabase.functions.invoke('process-daily-report', {
        body: {
          daily_report_id: openReport.id,
          media_items: mediaItems,
        },
      });

      if (error) throw new Error(error.message ?? 'Error al generar el informe');

      setCloseStage(null);
      setClosing(false);
      router.replace(`/informe/${data.report_id}?type=${openReport.type}`);

    } catch (e: any) {
      setCloseStage(null);
      setClosing(false);
      Alert.alert('Error al generar', e.message ?? 'Ocurrió un error inesperado.');
    }
  }

  function handleClose() {
    if (!openReport) return;
    if (media.length === 0) {
      Alert.alert('Sin elementos', 'Agregá al menos una foto o video antes de cerrar el informe.');
      return;
    }
    Alert.alert(
      'Cerrar y generar',
      `¿Cerrar el informe del día y generar el resumen con IA? Se analizarán ${media.length} elemento${media.length !== 1 ? 's' : ''}.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Generar', onPress: runClose },
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
          <SlidingTabs
            options={['Contratistas', 'Oficina técnica']}
            selected={reportType === 'contratistas' ? 'Contratistas' : 'Oficina técnica'}
            onChange={(v) => setReportType(v === 'Contratistas' ? 'contratistas' : 'oficina')}
            style={s.typeToggle}
          />

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
          style={[s.closeBtn, closing && { opacity: 0.6, paddingHorizontal: 10 }]}
          onPress={handleClose}
          disabled={closing}
          activeOpacity={0.85}
        >
          {closing
            ? <ActivityIndicator color="#FFF" size="small" />
            : <Text style={s.closeBtnText}>Cerrar y generar</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Processing overlay */}
      {closing && closeStage && (
        <View style={s.processingBanner}>
          <ActivityIndicator color={colors.arena} size="small" />
          <Text style={s.processingText}>{closeStage}</Text>
        </View>
      )}

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
    height: 36, paddingHorizontal: 14, borderRadius: 18,
    backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: '#FFF' },

  processingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: 'rgba(217,119,87,0.10)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(217,119,87,0.25)',
  },
  processingText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.arena, flex: 1 },

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
  typeToggle: {},

  startBtn: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema, width: '100%',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8,
  },
  startBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFF' },
});
