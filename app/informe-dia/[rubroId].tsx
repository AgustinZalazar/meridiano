import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Alert, ScrollView, Image, Platform, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { FadeImage } from '../../components/FadeImage';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useStudio } from '../../lib/use-studio';
import { useToast } from '../../lib/toast';
import { scheduleInformeReminder, cancelInformeReminder, scheduleTestNotification } from '../../lib/informe-reminder';
import * as store from '../../lib/offline/store';
import {
  localIso, todayIso, getMondayIso, getSundayIso,
  getWeekDays, fmtLastReport, fmtDateHeading,
} from '../../utils/dates';

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
  video_path: string | null;
  note: string | null;
  created_at: string;
  _offline?: boolean;
}

interface GeneratedToday {
  id: string;
  type: ReportType;
  createdAt: string;
  coverUri: string | null;
  stackUris: string[];
  fotoCount: number;
  videoCount: number;
  totalCount: number;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Media card (memoized) ────────────────────────────────────────────────────

const MediaCard = memo(function MediaCard({
  item,
  thumb,
  onDelete,
}: {
  item: ReportMedia;
  thumb: string | undefined;
  onDelete: (id: string) => void;
}) {
  return (
    <View style={[s.mediaCard, item._offline && s.mediaCardOffline]}>
      <View>
        <FadeImage uri={thumb} style={s.mediaThumb} />
        {item._offline && (
          <View style={s.offlineBadge}>
            <Feather name="wifi-off" size={9} color="#FFF" />
          </View>
        )}
      </View>
      <View style={s.mediaBody}>
        <View style={s.mediaTopRow}>
          <Text style={s.mediaType}>{item.type === 'foto' ? 'Foto' : 'Video'}</Text>
          {item._offline
            ? <Text style={s.mediaPending}>Pendiente sync</Text>
            : <Text style={s.mediaTime}>{fmtTime(item.created_at)}</Text>
          }
        </View>
        {item.note
          ? <Text style={s.mediaNote} numberOfLines={2}>{item.note}</Text>
          : <Text style={s.mediaNoNote}>Sin nota</Text>
        }
      </View>
      <TouchableOpacity style={s.mediaDeleteBtn} onPress={() => onDelete(item.id)} activeOpacity={0.7}>
        <Feather name="trash-2" size={15} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
});

// ─────────────────────────────────────────────────────────────────────────────

async function buildSignedUris(items: ReportMedia[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const byBucket: Record<string, { id: string; path: string }[]> = {};
  for (const item of items) {
    if (!item.uri) continue;
    const match = item.uri.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
    if (!match) continue;
    const [, bucket, path] = match;
    (byBucket[bucket] ??= []).push({ id: item.id, path });
  }
  await Promise.all(Object.entries(byBucket).map(async ([bucket, entries]) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrls(entries.map(e => e.path), 3600);
    if (!data) return;
    for (let i = 0; i < entries.length; i++) {
      const url = data[i]?.signedUrl;
      if (url) result[entries[i].id] = url;
    }
  }));
  return result;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const REPORT_TYPE_OPTIONS: { value: ReportType; label: string; desc: string; icon: React.ComponentProps<typeof Feather>['name'] }[] = [
  { value: 'contratistas', label: 'Contratistas', desc: 'Pendientes agrupados por oficio, para el equipo en obra', icon: 'grid' },
  { value: 'oficina',      label: 'Oficina técnica', desc: 'Avance y observaciones para el estudio', icon: 'clipboard' },
];

const TopBar = memo(function TopBar({ rubroName, rubroId, openReport, onCancel }: {
  rubroName: string | null;
  rubroId: string | null;
  openReport: DailyReport | null;
  onCancel: () => void;
}) {
  const router = useRouter();
  return (
    <View style={s.topBar}>
      <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
        <Feather name="arrow-left" size={16} color={colors.crema} />
      </TouchableOpacity>
      <View style={s.topMeta}>
        <Text style={s.topEyebrow}>INFORME DEL DÍA</Text>
        <Text style={s.topTitle} numberOfLines={1}>{rubroName ?? 'Rubro'}</Text>
      </View>
      {openReport ? (
        <TouchableOpacity style={s.circleBtn} onPress={onCancel} activeOpacity={0.8}>
          <Feather name="trash-2" size={16} color={colors.error} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={s.circleBtn}
          onPress={() => router.push({ pathname: '/informe-dia/historial', params: { rubroId: rubroId ?? '', rubroName: rubroName ?? '' } })}
          activeOpacity={0.8}
        >
          <Feather name="clock" size={16} color={colors.crema} />
        </TouchableOpacity>
      )}
    </View>
  );
});

const WeekStrip = memo(function WeekStrip({ weekReportDates }: { weekReportDates: Set<string> }) {
  const days = getWeekDays();
  return (
    <View style={s.weekStrip}>
      {days.map((day) => (
        <View
          key={day.iso}
          style={[s.dayPill, day.isToday && s.dayPillToday, day.isFuture && s.dayPillFuture]}
        >
          <Text style={[s.dayLetter, day.isToday && s.dayTextWhite, day.isFuture && s.dayTextFaint]}>
            {day.letter}
          </Text>
          <Text style={[s.dayNum, day.isToday && s.dayTextWhite, day.isFuture && s.dayTextFaint]}>
            {day.num}
          </Text>
          {weekReportDates.has(day.iso)
            ? <View style={[s.dayDot, day.isToday && s.dayDotWhite]} />
            : <View style={s.dayDotGhost} />
          }
        </View>
      ))}
    </View>
  );
});

const TypeSelector = memo(function TypeSelector({ reportType, onChange }: {
  reportType: ReportType;
  onChange: (v: ReportType) => void;
}) {
  return (
    <View style={s.typeSection}>
      <Text style={s.typeSectionHeading}>Tipo de informe</Text>
      {REPORT_TYPE_OPTIONS.map((opt) => {
        const active = reportType === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[s.typeCard, active && s.typeCardActive]}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.8}
          >
            <View style={[s.typeCardIcon, active && s.typeCardIconActive]}>
              <Feather name={opt.icon} size={18} color={active ? '#FFF' : colors.gris} />
            </View>
            <View style={s.typeCardBody}>
              <Text style={[s.typeCardLabel, active && s.typeCardLabelActive]}>{opt.label}</Text>
              <Text style={[s.typeCardDesc, active && s.typeCardDescActive]}>{opt.desc}</Text>
            </View>
            <View style={[s.typeCardRadio, active && s.typeCardRadioActive]}>
              {active && <Feather name="check" size={12} color="#FFF" />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InformeDiaScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const { session } = useAuth();
  const params  = useLocalSearchParams<{
    rubroId: string; rubroName: string; projectId: string;
  }>();

  const rubroId   = Array.isArray(params.rubroId)   ? params.rubroId[0]   : params.rubroId;
  const rubroName = Array.isArray(params.rubroName) ? params.rubroName[0] : params.rubroName;
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  const { studio } = useStudio();
  const toast = useToast();

  const [loading,          setLoading]          = useState(true);
  const [openReport,       setOpenReport]       = useState<DailyReport | null>(null);
  const [generatedToday,   setGeneratedToday]   = useState<GeneratedToday | null>(null);
  const [media,            setMedia]            = useState<ReportMedia[]>([]);
  const [thumbUris,        setThumbUris]        = useState<Record<string, string>>({});
  const [weekReportDates,  setWeekReportDates]  = useState<Set<string>>(new Set());
  const [lastReportDate,   setLastReportDate]   = useState<string | null>(null);
  const [reportType,       setReportType]       = useState<ReportType>('contratistas');
  const [starting,         setStarting]         = useState(false);
  const [closing,          setClosing]          = useState(false);
  const [closeStage,       setCloseStage]       = useState<string | null>(null);
  const [reportComment,    setReportComment]    = useState('');

  // Cache refs — avoid redundant DB queries and signed URL requests on re-focus
  const staticLoaded   = useRef(false);  // week strip + last report: load once per mount
  const signedCache    = useRef<Record<string, string>>({});  // signed URLs by item ID
  const isFirstLoad    = useRef(true);   // show spinner only on first load
  const mediaRef       = useRef<ReportMedia[]>([]);

  // Reset caches when rubroId changes
  useEffect(() => {
    staticLoaded.current = false;
    signedCache.current  = {};
    isFirstLoad.current  = true;
  }, [rubroId]);

  const load = useCallback(() => {
    if (!rubroId) return;
    if (isFirstLoad.current) setLoading(true);

    void (async () => {
      // Static data: week strip + last report — only once per mount
      if (!staticLoaded.current) {
        const [weekRes, lastRes] = await Promise.all([
          supabase.from('reports').select('date')
            .eq('rubro_id', rubroId)
            .gte('date', getMondayIso()).lte('date', getSundayIso())
            .not('date', 'is', null),
          supabase.from('reports').select('date')
            .eq('rubro_id', rubroId).not('date', 'is', null)
            .neq('status', 'abierto')
            .order('date', { ascending: false }).limit(1).maybeSingle(),
        ]);
        setWeekReportDates(new Set((weekRes.data ?? []).map((r: any) => r.date as string)));
        setLastReportDate((lastRes.data as any)?.date ?? null);
        staticLoaded.current = true;
      }

      // Dynamic: always check open report
      const { data: openData } = await supabase.from('reports').select('id, date, type, status')
        .eq('rubro_id', rubroId).eq('date', todayIso()).eq('status', 'abierto').maybeSingle();

      const open = openData as DailyReport | null;
      setOpenReport(open);

      if (open) {
        const { data } = await supabase.from('report_media')
          .select('id, type, uri, video_path, note, created_at').eq('report_id', open.id).order('created_at');
        const items = (data as ReportMedia[]) ?? [];

        // Merge pending offline ops for this report
        const queue = await store.getQueue();
        const offlineItems: ReportMedia[] = queue
          .filter(op =>
            op.status === 'pending' &&
            (op.type === 'add_report_media_foto' || op.type === 'add_report_media_video') &&
            op.payload.report_id === open.id
          )
          .map(op => ({
            id: op.localId,
            type: op.type === 'add_report_media_foto' ? 'foto' as const : 'video' as const,
            uri: op.type === 'add_report_media_foto' ? op.payload.local_path : op.payload.local_thumb_path,
            video_path: null,
            note: op.payload.note ?? null,
            created_at: new Date(op.createdAt).toISOString(),
            _offline: true,
          }));

        // Pre-seed signed cache with local URIs for offline items
        for (const item of offlineItems) {
          if (item.uri) signedCache.current[item.id] = item.uri;
        }

        const merged = [...items, ...offlineItems];
        mediaRef.current = merged;
        setMedia(merged);

        // Only sign URLs for DB items not already cached
        const toSign = items.filter(m => m.uri && !signedCache.current[m.id]);
        if (toSign.length > 0) {
          const fresh = await buildSignedUris(toSign);
          Object.assign(signedCache.current, fresh);
        }
        // Evict stale cache entries (DB items removed)
        const live = new Set(merged.map(m => m.id));
        for (const id of Object.keys(signedCache.current)) {
          if (!live.has(id)) delete signedCache.current[id];
        }
        setThumbUris({ ...signedCache.current });

        // Schedule or cancel end-of-day reminder based on media count
        if (items.length > 0 && rubroName) {
          void scheduleInformeReminder(rubroId, rubroName, items.length);
        } else {
          void cancelInformeReminder(rubroId);
        }
      } else {
        void cancelInformeReminder(rubroId);
        setMedia([]);
        setThumbUris({});
        signedCache.current = {};

        const { data: gen } = await supabase.from('reports').select('id, type, created_at')
          .eq('rubro_id', rubroId).eq('date', todayIso())
          .eq('status', 'completed').eq('mode', 'foto')
          .order('created_at', { ascending: false }).limit(1).maybeSingle();

        if (gen) {
          const { data: genMedia } = await supabase.from('report_media')
            .select('id, type, uri').eq('report_id', gen.id).order('created_at');
          const allMedia = (genMedia ?? []) as { id: string; type: string; uri: string | null }[];
          const fotoCount  = allMedia.filter(m => m.type === 'foto').length;
          const videoCount = allMedia.filter(m => m.type === 'video').length;

          const first3 = allMedia.slice(0, 3);
          const signedMap = await buildSignedUris(
            first3.filter(m => m.uri).map(m => ({ ...m, video_path: null, note: null, created_at: '' } as ReportMedia))
          );

          const coverUri  = first3[0] ? (signedMap[first3[0].id] ?? null) : null;
          const stackUris = first3.slice(1).map(m => signedMap[m.id]).filter(Boolean) as string[];

          setGeneratedToday({
            id: gen.id, type: gen.type as ReportType, createdAt: gen.created_at,
            coverUri, stackUris, fotoCount, videoCount, totalCount: allMedia.length,
          });
        } else {
          setGeneratedToday(null);
        }
      }

      if (isFirstLoad.current) {
        setLoading(false);
        isFirstLoad.current = false;
      }
    })();
  }, [rubroId]);

  useFocusEffect(load);

  async function createReport(): Promise<DailyReport | null> {
    if (!rubroId || !projectId || !session?.user?.id) return null;
    const { data, error } = await supabase.from('reports').insert({
      rubro_id: rubroId, project_id: projectId,
      type: reportType, mode: 'video',
      status: 'abierto', date: todayIso(),
      created_by: session.user.id,
    }).select('id, date, type, status').single();
    if (error || !data) return null;
    return data as DailyReport;
  }

  async function handleStart() {
    setStarting(true);
    const report = await createReport();
    setStarting(false);
    if (!report) { toast.error('No se pudo iniciar el informe.'); return; }
    setOpenReport(report);
    mediaRef.current = [];
    setMedia([]);
    setThumbUris({});
  }

  async function handleStartAndAdd(addMode: 'foto' | 'video') {
    setStarting(true);
    const report = await createReport();
    setStarting(false);
    if (!report) { toast.error('No se pudo iniciar el informe.'); return; }
    setOpenReport(report);
    mediaRef.current = [];
    setMedia([]);
    setThumbUris({});
    router.push({
      pathname: '/informe-dia/agregar',
      params: { reportId: report.id, rubroName: rubroName ?? '', defaultMode: addMode },
    });
  }

  async function runClose() {
    if (!openReport || !studio) return;
    setClosing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      setCloseStage('Preparando material…');
      const mediaItems: { type: 'foto' | 'video'; url: string; video_path?: string; note: string | null }[] = [];
      for (const item of media) {
        if (!item.uri) continue;
        mediaItems.push({ type: item.type, url: item.uri, video_path: item.video_path ?? undefined, note: item.note });
      }
      if (mediaItems.length === 0) throw new Error('No hay material válido para generar el informe.');

      setCloseStage('Analizando con IA…');
      const { data, error } = await supabase.functions.invoke('process-daily-report', {
        body: {
          daily_report_id: openReport.id,
          media_items: mediaItems,
          comment: reportComment.trim() || null,
        },
      });

      if (error) {
        let msg = error.message ?? 'Error al generar el informe';
        try {
          const ctx = (error as any).context;
          if (ctx) {
            const body = typeof ctx === 'string' ? JSON.parse(ctx) : await ctx.json?.();
            if (body?.error) msg = body.error;
          }
        } catch {}
        throw new Error(msg);
      }

      setCloseStage(null);
      setClosing(false);
      signedCache.current  = {};
      staticLoaded.current = false;  // week strip will have a new dot after generation
      if (rubroId) void cancelInformeReminder(rubroId);
      router.replace(`/informe/${data.report_id}?type=${openReport.type}`);
    } catch (e: any) {
      setCloseStage(null);
      setClosing(false);
      toast.error(e.message ?? 'Ocurrió un error inesperado.');
    }
  }

  const handleDeleteMedia = useCallback(async (id: string) => {
    const item = mediaRef.current.find(m => m.id === id);
    if (item?._offline) {
      await store.removeByLocalId(id);
    } else {
      await supabase.from('report_media').delete().eq('id', id);
    }
    delete signedCache.current[id];
    mediaRef.current = mediaRef.current.filter(m => m.id !== id);
    setMedia(prev => prev.filter(m => m.id !== id));
    setThumbUris({ ...signedCache.current });
  }, []);

  const renderMediaItem = useCallback(({ item }: { item: ReportMedia }) => (
    <MediaCard item={item} thumb={thumbUris[item.id]} onDelete={handleDeleteMedia} />
  ), [thumbUris, handleDeleteMedia]);

  const handleCancelReport = useCallback(() => {
    if (!openReport) return;
    Alert.alert(
      'Cancelar jornada',
      '¿Cancelar el informe del día? Se eliminarán todos los elementos cargados.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancelar jornada',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('report_media').delete().eq('report_id', openReport.id);
            await supabase.from('reports').delete().eq('id', openReport.id);
            if (rubroId) void cancelInformeReminder(rubroId);
            signedCache.current  = {};
            staticLoaded.current = false;
            mediaRef.current     = [];
            setOpenReport(null);
            setMedia([]);
            setThumbUris({});
          },
        },
      ],
    );
  }, [openReport]);

  function handleClose() {
    if (!openReport) return;
    if (media.length === 0) {
      Alert.alert('Sin elementos', 'Agregá al menos una foto o video antes de cerrar el informe.');
      return;
    }
    Alert.alert(
      'Cerrar y generar',
      `¿Cerrar el informe del día y generar el resumen con IA? Se analizarán ${media.length} elemento${media.length !== 1 ? 's' : ''}.`,
      [{ text: 'Cancelar', style: 'cancel' }, { text: 'Generar', onPress: runClose }],
    );
  }


  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[s.safe, s.center]}>
        <ActivityIndicator color={colors.crema} />
      </View>
    );
  }

  // ── No open report ───────────────────────────────────────────────────────

  if (!openReport) {
    const { line1, line2 } = fmtDateHeading();

    if (generatedToday) {
      const userName = (session as any)?.user?.user_metadata?.full_name
        ?? session?.user?.email?.split('@')[0]
        ?? 'Usuario';
      const extraCount = Math.max(0, generatedToday.totalCount - 1);

      return (
        <View style={[s.safe, { paddingTop: insets.top }]}>
          <TopBar rubroName={rubroName ?? null} rubroId={rubroId ?? null} openReport={openReport} onCancel={handleCancelReport} />
          {__DEV__ && (
            <TouchableOpacity style={s.devTestBtn} onPress={() => void scheduleTestNotification()} activeOpacity={0.8}>
              <Text style={s.devTestBtnText}>🔔 Test notif (5s)</Text>
            </TouchableOpacity>
          )}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          >
            <View style={s.dateHeading}>
              <Text style={s.dateLine1}>{line1}</Text>
              <Text style={s.dateLine2}>{line2}</Text>
            </View>
            <WeekStrip weekReportDates={weekReportDates} />

            {/* ── Generated report card ── */}
            <View style={s.genCard}>
              {/* Cover image */}
              <View style={s.genCoverWrap}>
                <FadeImage uri={generatedToday.coverUri} style={s.genCover} />
                {/* Badge */}
                <View style={s.genBadge}>
                  <View style={s.genBadgeDot} />
                  <Text style={s.genBadgeText}>Informe listo</Text>
                </View>
                {/* Thumbnail stack */}
                {generatedToday.totalCount > 1 && (
                  <View style={s.genStack}>
                    {generatedToday.stackUris.map((uri, i) => (
                      <FadeImage
                        key={i}
                        uri={uri}
                        style={[s.genStackThumb, i > 0 && { marginLeft: -10 }]}
                        borderRadius={10}
                      />
                    ))}
                    {extraCount > 0 && (
                      <View style={[s.genStackThumb, s.genStackCount, { marginLeft: -10 }]}>
                        <Text style={s.genStackCountText}>+{extraCount}</Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Title + share */}
              <View style={s.genTitleRow}>
                <View style={s.genTitleBody}>
                  <Text style={s.genTitle}>
                    {generatedToday.type === 'contratistas' ? 'Contratistas' : 'Oficina técnica'}
                  </Text>
                  <Text style={s.genMeta}>{userName} · generado {fmtTime(generatedToday.createdAt)}</Text>
                </View>
                <TouchableOpacity style={s.genShareBtn} activeOpacity={0.8}>
                  <Feather name="share" size={16} color={colors.crema} />
                </TouchableOpacity>
              </View>

              {/* Stats */}
              <View style={s.genStats}>
                <View style={s.genStat}>
                  <Text style={s.genStatNum}>{generatedToday.fotoCount}</Text>
                  <Text style={s.genStatLabel}>Fotos</Text>
                </View>
                <View style={s.genStatSep} />
                <View style={s.genStat}>
                  <Text style={s.genStatNum}>{generatedToday.videoCount}</Text>
                  <Text style={s.genStatLabel}>Videos</Text>
                </View>
                <View style={s.genStatSep} />
                <View style={s.genStat}>
                  <Text style={s.genStatNum}>{generatedToday.totalCount}</Text>
                  <Text style={s.genStatLabel}>Total</Text>
                </View>
              </View>

              {/* CTA */}
              <View style={s.genCtaRow}>
                <TouchableOpacity
                  style={s.verInformeBtn}
                  onPress={() => router.push(`/informe/${generatedToday.id}?type=${generatedToday.type}`)}
                  activeOpacity={0.85}
                >
                  <Text style={s.verInformeBtnText}>Ver informe</Text>
                  <Feather name="arrow-right" size={18} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity style={s.downloadBtn} activeOpacity={0.8}>
                  <Feather name="download" size={18} color={colors.crema} />
                </TouchableOpacity>
              </View>
            </View>

          </ScrollView>
        </View>
      );
    }

    // Empty — no report today
    return (
      <View style={[s.safe, { paddingTop: insets.top }]}>
        <TopBar rubroName={rubroName ?? null} rubroId={rubroId ?? null} openReport={openReport} onCancel={handleCancelReport} />
        {__DEV__ && (
          <TouchableOpacity style={s.devTestBtn} onPress={() => void scheduleTestNotification()} activeOpacity={0.8}>
            <Text style={s.devTestBtnText}>🔔 Test notif (5s)</Text>
          </TouchableOpacity>
        )}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        >
          {/* Date heading */}
          <View style={s.dateHeading}>
            <Text style={s.dateLine1}>{line1}</Text>
            <Text style={s.dateLine2}>{line2}</Text>
          </View>

          {/* Week strip */}
          <WeekStrip weekReportDates={weekReportDates} />

          {/* Empty card */}
          <View style={s.emptyCard}>
            <View style={s.emptyCardIcons}>
              <TouchableOpacity
                style={s.emptyCardIconBtn}
                onPress={() => handleStartAndAdd('foto')}
                disabled={starting}
                activeOpacity={0.75}
              >
                <Feather name="camera" size={22} color={colors.crema} />
              </TouchableOpacity>
              <TouchableOpacity
                style={s.emptyCardIconBtn}
                onPress={() => handleStartAndAdd('video')}
                disabled={starting}
                activeOpacity={0.75}
              >
                <Feather name="video" size={22} color={colors.crema} />
              </TouchableOpacity>
              <View style={s.emptyCardIconBtn}>
                <Feather name="file-text" size={22} color={colors.crema} />
              </View>
            </View>
            <Text style={s.emptyCardTitle}>Todavía no hay registros hoy</Text>
            <Text style={s.emptyCardBody}>
              Iniciá la jornada y sumá fotos, videos y notas a medida que avanza la obra.
            </Text>
          </View>

          {/* Type selector */}
          <TypeSelector reportType={reportType} onChange={setReportType} />

          {/* CTA */}
          <TouchableOpacity
            style={[s.startBtn, starting && { opacity: 0.5 }]}
            onPress={handleStart}
            disabled={starting}
            activeOpacity={0.85}
          >
            {starting
              ? <ActivityIndicator color="#FFF" size="small" />
              : <><Feather name="play" size={16} color="#FFF" /><Text style={s.startBtnText}>Iniciar informe del día</Text></>
            }
          </TouchableOpacity>

          {/* Footer */}
          {lastReportDate && (
            <View style={s.footer}>
              <Text style={s.footerText}>Último informe: {fmtLastReport(lastReportDate)} · </Text>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/informe-dia/historial', params: { rubroId: rubroId ?? '', rubroName: rubroName ?? '' } })}
                activeOpacity={0.7}
              >
                <Text style={s.footerLink}>Ver historial</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  // ── Open report ──────────────────────────────────────────────────────────

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      <TopBar rubroName={rubroName ?? null} rubroId={rubroId ?? null} openReport={openReport} onCancel={handleCancelReport} />
      {__DEV__ && (
        <TouchableOpacity
          style={s.devTestBtn}
          onPress={() => void scheduleTestNotification()}
          activeOpacity={0.8}
        >
          <Text style={s.devTestBtnText}>🔔 Test notif (5s)</Text>
        </TouchableOpacity>
      )}

      {closing && closeStage && (
        <View style={s.processingBanner}>
          <ActivityIndicator color={colors.arena} size="small" />
          <Text style={s.processingText}>{closeStage}</Text>
        </View>
      )}

      <View style={s.statusRow}>
        <View style={s.statusPill}>
          <View style={s.statusDot} />
          <Text style={s.statusText}>
            Jornada abierta · {media.length} elemento{media.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      <FlatList
        data={media}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 180 }]}
        showsVerticalScrollIndicator={false}
        renderItem={renderMediaItem}
        ListEmptyComponent={
          <View style={s.emptyMedia}>
            <Feather name="inbox" size={28} color={colors.faint} />
            <Text style={s.emptyMediaTitle}>Todavía no hay elementos</Text>
            <Text style={s.emptyMediaSub}>
              Usá el botón de abajo para agregar fotos o videos
            </Text>
          </View>
        }
      />

      <View style={s.commentBar}>
        <TextInput
          style={s.commentInput}
          value={reportComment}
          onChangeText={setReportComment}
          placeholder="Comentario general del informe… (opcional)"
          placeholderTextColor={colors.faint}
          selectionColor={colors.arena}
          multiline
          returnKeyType="done"
          blurOnSubmit
        />
      </View>

      <View style={[s.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => router.push({ pathname: '/informe-dia/agregar', params: { reportId: openReport.id, rubroName: rubroName ?? '' } })}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={18} color={colors.crema} />
          <Text style={s.addBtnText}>Agregar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.closeBtn, closing && { opacity: 0.6 }]}
          onPress={handleClose}
          disabled={closing}
          activeOpacity={0.85}
        >
          {closing
            ? <ActivityIndicator color="#FFF" size="small" />
            : <><Text style={s.closeBtnText}>Cerrar y generar</Text><Feather name="arrow-right" size={16} color="#FFF" /></>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.tinta },
  center: { alignItems: 'center', justifyContent: 'center' },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  topMeta: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  topEyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: colors.gris,
  },
  topTitle: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema, marginTop: 2 },

  // Scroll content
  scrollContent: { paddingHorizontal: spacing.xl, gap: 20 },

  // Date heading
  dateHeading: { gap: 0, marginBottom: 4 },
  dateLine1: {
    fontFamily: fonts.archivo.bold, fontSize: 34, color: colors.crema,
    letterSpacing: -0.8, lineHeight: 40,
  },
  dateLine2: {
    fontFamily: fonts.archivo.bold, fontSize: 34, color: colors.crema,
    letterSpacing: -0.8, lineHeight: 40,
  },

  // Week strip
  weekStrip: { flexDirection: 'row', gap: 6 },
  dayPill: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14,
    backgroundColor: colors.panel, gap: 2,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  dayPillToday: { backgroundColor: colors.crema },
  dayPillFuture: {
    backgroundColor: 'transparent',
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    shadowOpacity: 0, elevation: 0,
  },
  dayLetter: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris, letterSpacing: 0.5 },
  dayNum:    { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  dayTextWhite: { color: '#FFF' },
  dayTextFaint: { color: colors.faint },
  dayDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.arena, marginTop: 2 },
  dayDotWhite: { backgroundColor: 'rgba(255,255,255,0.6)' },
  dayDotGhost: { width: 5, height: 5, marginTop: 2 },

  // Empty card
  emptyCard: {
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: 20, paddingVertical: 28, paddingHorizontal: spacing.xl,
    alignItems: 'center', gap: 12,
  },
  emptyCardIcons: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  emptyCardIconBtn: {
    width: 56, height: 56, borderRadius: 16, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  emptyCardTitle: { fontFamily: fonts.archivo.bold, fontSize: 17, color: colors.crema, textAlign: 'center' },
  emptyCardBody: {
    fontFamily: fonts.archivo.semibold, fontSize: 13.5, color: colors.gris,
    textAlign: 'center', lineHeight: 20,
  },

  // Type selector
  typeSection: { gap: 10 },
  typeSectionHeading: { fontFamily: fonts.archivo.bold, fontSize: 17, color: colors.crema },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: colors.panel, borderRadius: 18, padding: 16,
    borderWidth: 1.5, borderColor: 'transparent',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  typeCardActive: { borderColor: colors.crema },
  typeCardIcon: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  typeCardIconActive: { backgroundColor: colors.crema },
  typeCardBody: { flex: 1, gap: 2 },
  typeCardLabel: { fontFamily: fonts.archivo.semibold, fontSize: 14.5, color: colors.gris },
  typeCardLabelActive: { fontFamily: fonts.archivo.bold, color: colors.crema },
  typeCardDesc: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.faint, lineHeight: 17 },
  typeCardDescActive: { color: colors.gris },
  typeCardRadio: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  typeCardRadioActive: { backgroundColor: colors.crema, borderColor: colors.crema },

  // Start button
  startBtn: {
    height: 56, borderRadius: 28, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  startBtnText: { fontFamily: fonts.archivo.bold, fontSize: 16, color: '#FFF' },

  // Footer
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', paddingBottom: 4 },
  footerText: { fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: colors.gris },
  footerLink: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: colors.crema },

  // ── Generated today card ──────────────────────────────────────────────────
  genCard: {
    backgroundColor: colors.panel, borderRadius: 24, overflow: 'hidden',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 4,
  },
  genCoverWrap: { position: 'relative' },
  genCover: { width: '100%', height: 200 },
  genBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#FFF', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  genBadgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.arena },
  genBadgeText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema },
  genStack: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
  },
  genStackThumb: {
    width: 42, height: 42, borderRadius: 10,
    borderWidth: 2, borderColor: '#FFF',
    backgroundColor: colors.chip,
  },
  genStackCount: {
    backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center',
  },
  genStackCountText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: '#FFF' },
  genTitleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  genTitleBody: { flex: 1 },
  genTitle: { fontFamily: fonts.archivo.bold, fontSize: 22, color: colors.crema, letterSpacing: -0.3 },
  genMeta:  { fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: colors.gris, marginTop: 3 },
  genShareBtn: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  genStats: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    backgroundColor: colors.chip, borderRadius: 16, overflow: 'hidden',
  },
  genStat: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  genStatNum: { fontFamily: fonts.archivo.bold, fontSize: 20, color: colors.crema },
  genStatLabel: { fontFamily: fonts.archivo.semibold, fontSize: 11.5, color: colors.gris, marginTop: 2 },
  genStatSep: { width: 1, backgroundColor: colors.border, marginVertical: 10 },
  genCtaRow: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 16, paddingBottom: 16,
  },
  verInformeBtn: {
    flex: 1, height: 50, borderRadius: 25, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  verInformeBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFF' },
  downloadBtn: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Nueva jornada card ────────────────────────────────────────────────────
  nuevaJornadaCard: {
    borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed',
    borderRadius: 22, padding: 18, gap: 14,
  },
  nuevaJornadaHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nuevaJornadaPlus: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  nuevaJornadaTitle: { fontFamily: fonts.archivo.bold, fontSize: 15.5, color: colors.crema },
  nuevaJornadaSub:  { fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: colors.gris, lineHeight: 18, marginTop: 2 },
  compactToggle: {
    flexDirection: 'row', backgroundColor: colors.chip,
    borderRadius: 22, padding: 4, gap: 4,
  },
  compactToggleBtn: {
    flex: 1, height: 40, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  compactToggleBtnActive: {
    backgroundColor: colors.panel,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  compactToggleText: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.gris },
  compactToggleTextActive: { color: colors.crema },
  iniciarNuevaBtn: {
    height: 50, borderRadius: 25,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.panel,
  },
  iniciarNuevaBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14.5, color: colors.crema },

  // Open report
  processingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    backgroundColor: 'rgba(217,119,87,0.10)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(217,119,87,0.25)',
  },
  processingText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.arena, flex: 1 },

  statusRow: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  statusPill: {
    alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(74,124,89,0.10)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(74,124,89,0.2)',
  },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.success },
  statusText: { fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: colors.success },

  listContent: { paddingHorizontal: spacing.xl, gap: 10 },
  mediaCard: {
    flexDirection: 'row', gap: 14, backgroundColor: colors.panel,
    borderRadius: 16, overflow: 'hidden',
  },
  mediaThumb: { width: 72, height: 72, flexShrink: 0 },
  mediaThumbFallback: { backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  mediaBody: { flex: 1, paddingVertical: 12, paddingRight: 14, justifyContent: 'center', gap: 4 },
  mediaTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mediaType: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.crema },
  mediaTime: { fontFamily: fonts.mono.regular, fontSize: 10, color: colors.faint, letterSpacing: 0.3 },
  mediaPending: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.arena, letterSpacing: 0.3 },
  mediaCardOffline: { borderWidth: 1, borderColor: 'rgba(217,119,87,0.25)' },
  offlineBadge: {
    position: 'absolute', bottom: 5, right: 5,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.arena,
    alignItems: 'center', justifyContent: 'center',
  },
  mediaNote: { fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: colors.gris, lineHeight: 18 },
  mediaNoNote: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.faint, fontStyle: 'italic' },
  mediaDeleteBtn: { padding: 14, alignSelf: 'center', justifyContent: 'center' },

  emptyMedia: { alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: spacing.xl },
  emptyMediaTitle: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.gris },
  emptyMediaSub: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.faint, textAlign: 'center', lineHeight: 19 },

  commentBar: {
    position: 'absolute', bottom: 82, left: 0, right: 0,
    paddingHorizontal: spacing.xl, paddingBottom: 8,
    backgroundColor: colors.tinta,
  },
  commentInput: {
    borderRadius: 14, backgroundColor: colors.panel,
    paddingHorizontal: spacing.md, paddingVertical: 10,
    fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.crema,
    textAlignVertical: 'top', maxHeight: 80,
    borderWidth: 1, borderColor: colors.border,
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10,
    paddingHorizontal: spacing.xl, paddingTop: 14,
    backgroundColor: colors.tinta,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  addBtn: {
    flex: 1, height: 50, borderRadius: 25,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.panel, borderWidth: 1.5, borderColor: colors.border,
  },
  addBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema },
  closeBtn: {
    flex: 2, height: 50, borderRadius: 25,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: colors.crema,
  },
  closeBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: '#FFF' },
  devTestBtn: {
    alignSelf: 'center', marginTop: 6, marginBottom: 2,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: colors.chip, borderRadius: 12,
  },
  devTestBtnText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.arena },
});
