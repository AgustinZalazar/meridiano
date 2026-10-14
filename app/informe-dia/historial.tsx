import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { FadeImage } from '../../components/FadeImage';
import { supabase } from '../../lib/supabase';
import { getDateBlock, getMonthLabel, parseLocalDate } from '../../utils/dates';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistorialReport {
  id: string;
  date: string;
  type: 'contratistas' | 'oficina';
  fotoCount: number;
  videoCount: number;
  pendingCount: number;
  thumbUris: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthKey(iso: string): string { return iso.slice(0, 7); }

// ─── Report card (memoized to avoid re-renders on filter/search change) ───────

const ReportCard = memo(function ReportCard({
  report,
  onPress,
}: {
  report: HistorialReport;
  onPress: () => void;
}) {
  const { abbrev, num } = getDateBlock(report.date);
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      <View style={s.dateBlock}>
        <Text style={s.dateAbbrev}>{abbrev}</Text>
        <Text style={s.dateNum}>{num}</Text>
      </View>
      <View style={s.cardContent}>
        <View style={s.cardTopRow}>
          <Text style={s.cardTitle} numberOfLines={1}>
            {report.type === 'contratistas' ? 'Contratistas' : 'Oficina técnica'}
          </Text>
          {report.pendingCount > 0 ? (
            <View style={s.pendingBadge}>
              <Text style={s.pendingBadgeText}>{report.pendingCount}pendientes</Text>
            </View>
          ) : (
            <View style={s.noPendingBadge}>
              <Text style={s.noPendingBadgeText}>Sin pendientes</Text>
            </View>
          )}
        </View>
        <View style={s.cardMediaRow}>
          {report.thumbUris.length > 0 && (
            <View style={s.thumbStack}>
              {report.thumbUris.map((uri, i) => (
                <FadeImage key={i} uri={uri} style={[s.thumb, i > 0 && { marginLeft: -9 }]} borderRadius={9} />
              ))}
            </View>
          )}
          <View style={s.mediaCounts}>
            <Feather name="camera" size={13} color={colors.gris} />
            <Text style={s.mediaCountText}>{report.fotoCount}</Text>
            <Feather name="video" size={13} color={colors.gris} />
            <Text style={s.mediaCountText}>{report.videoCount}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HistorialScreen() {
  const router  = useRouter();
  const insets  = useSafeAreaInsets();
  const params  = useLocalSearchParams<{ rubroId: string; rubroName: string }>();

  const rubroId   = Array.isArray(params.rubroId)   ? params.rubroId[0]   : params.rubroId;
  const rubroName = Array.isArray(params.rubroName) ? params.rubroName[0] : params.rubroName;

  const [loading,     setLoading]     = useState(true);
  const [reports,     setReports]     = useState<HistorialReport[]>([]);
  const [typeFilter,  setTypeFilter]  = useState<'all' | 'contratistas' | 'oficina'>('all');
  const [showSearch,  setShowSearch]  = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Signed URL cache — persists between focus events, only sign new/unseen items
  const signedCache = useRef<Record<string, string>>({});

  useEffect(() => { signedCache.current = {}; }, [rubroId]);

  const load = useCallback(() => {
    if (!rubroId) return;
    setLoading(true);

    void (async () => {
      // Single query with join — replaces 2 roundtrips
      const { data: raws } = await supabase.from('reports')
        .select('id, date, type, report_media(id, type, uri)')
        .eq('rubro_id', rubroId)
        .eq('status', 'completed')
        .not('date', 'is', null)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      const rawReports = (raws ?? []) as {
        id: string; date: string; type: string;
        report_media: { id: string; type: string; uri: string | null }[];
      }[];

      if (rawReports.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Only sign URLs for items not already in cache
      const toSign = rawReports.flatMap(r =>
        (r.report_media ?? []).slice(0, 3).filter(m => m.uri && !signedCache.current[m.id])
      );

      await Promise.all(toSign.map(async (item) => {
        const match = item.uri!.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
        if (!match) return;
        const [, bucket, path] = match;
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (data?.signedUrl) signedCache.current[item.id] = data.signedUrl;
      }));

      setReports(rawReports.map(r => {
        const media = r.report_media ?? [];
        return {
          id: r.id,
          date: r.date,
          type: r.type as 'contratistas' | 'oficina',
          fotoCount:    media.filter(m => m.type === 'foto').length,
          videoCount:   media.filter(m => m.type === 'video').length,
          pendingCount: 0,
          thumbUris:    media.slice(0, 3).map(m => signedCache.current[m.id]).filter(Boolean) as string[],
        };
      }));
      setLoading(false);
    })();
  }, [rubroId]);

  useFocusEffect(load);

  const typeLabel = (type: string) => type === 'contratistas' ? 'contratistas' : 'oficina técnica';

  const filtered = reports.filter(r => {
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const dateStr = getMonthLabel(r.date).toLowerCase() + ' ' + parseLocalDate(r.date).getDate();
      if (!typeLabel(r.type).includes(q) && !dateStr.includes(q)) return false;
    }
    return true;
  });

  const totalInformes   = reports.length;
  const totalFotos      = reports.reduce((s, r) => s + r.fotoCount,    0);
  const totalPendientes = reports.reduce((s, r) => s + r.pendingCount, 0);

  // Group filtered by month
  const grouped: { key: string; label: string; items: HistorialReport[] }[] = [];
  filtered.forEach(r => {
    const key = getMonthKey(r.date);
    const last = grouped[grouped.length - 1];
    if (last && last.key === key) last.items.push(r);
    else grouped.push({ key, label: getMonthLabel(r.date), items: [r] });
  });

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={16} color={colors.crema} />
        </TouchableOpacity>
        <View style={s.topMeta}>
          <Text style={s.topEyebrow}>{(rubroName ?? 'Rubro').toUpperCase()}</Text>
          <Text style={s.topTitle}>Historial</Text>
        </View>
        <TouchableOpacity
          style={s.circleBtn}
          activeOpacity={0.8}
          onPress={() => { setShowSearch(v => !v); setSearchQuery(''); }}
          testID="historial-search-btn"
        >
          <Feather name={showSearch ? 'x' : 'search'} size={16} color={colors.crema} />
        </TouchableOpacity>
      </View>

      {showSearch && (
        <View style={s.searchBar}>
          <Feather name="search" size={14} color={colors.gris} />
          <TextInput
            style={s.searchInput}
            placeholder="Buscar por tipo o fecha…"
            placeholderTextColor={colors.gris}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
        </View>
      )}

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.crema} /></View>
      ) : (
        <FlatList
          data={grouped}
          keyExtractor={g => g.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 40 }]}
          ListHeaderComponent={
            <>
              {/* Stats */}
              <View style={s.statsRow}>
                {([
                  { num: totalInformes,   label: 'Informes'   },
                  { num: totalFotos,      label: 'Fotos'      },
                  { num: totalPendientes, label: 'Pendientes' },
                ] as { num: number; label: string }[]).map(({ num, label }) => (
                  <View key={label} style={s.statCard}>
                    <Text style={s.statNum}>{num}</Text>
                    <Text style={s.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Type filter */}
              <View style={s.filterRow}>
                {([
                  { key: 'all',          label: 'Todos' },
                  { key: 'contratistas', label: 'Contratistas' },
                  { key: 'oficina',      label: 'Oficina técnica' },
                ] as { key: typeof typeFilter; label: string }[]).map(({ key, label }) => (
                  <TouchableOpacity
                    key={key}
                    style={[s.filterChip, typeFilter === key && s.filterChipActive]}
                    onPress={() => setTypeFilter(key)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.filterChipText, typeFilter === key && s.filterChipTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}><Feather name="clock" size={28} color={colors.gris} /></View>
              <Text style={s.emptyTitle}>Sin informes anteriores</Text>
              <Text style={s.emptyBody}>
                Los informes generados aparecerán acá una vez que cierres una jornada.
              </Text>
            </View>
          }
          renderItem={useCallback(({ item: group }: { item: typeof grouped[0] }) => (
            <View style={s.group}>
              <Text style={s.monthLabel}>{group.label}</Text>
              {group.items.map(report => (
                <ReportCard
                  key={report.id}
                  report={report}
                  onPress={() => router.push(`/informe/${report.id}?type=${report.type}`)}
                />
              ))}
            </View>
          ), [router])}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.tinta },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  topTitle: { fontFamily: fonts.archivo.bold, fontSize: 22, color: colors.crema, marginTop: 1 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    backgroundColor: colors.panel, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, fontFamily: fonts.archivo.semibold, fontSize: 14,
    color: colors.crema, padding: 0,
  },

  listContent: { paddingHorizontal: spacing.xl, gap: 24, paddingTop: spacing.md },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: colors.panel, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statNum:   { fontFamily: fonts.archivo.bold, fontSize: 22, color: colors.crema, letterSpacing: -0.5 },
  statLabel: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.gris, marginTop: 2 },

  // Filter
  filterRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  filterChip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1, borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.crema, borderColor: colors.crema },
  filterChipText: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: colors.gris },
  filterChipTextActive: { color: '#FFF' },

  // Groups
  group: { gap: 10 },
  monthLabel: {
    fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.gris,
    letterSpacing: -0.1, marginBottom: 2,
  },

  // Card
  card: {
    flexDirection: 'row', gap: 14, alignItems: 'flex-start',
    backgroundColor: colors.panel, borderRadius: 20, padding: 14,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },

  // Date block
  dateBlock: {
    width: 68, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.chip, borderRadius: 14,
    paddingVertical: 12, flexShrink: 0,
  },
  dateAbbrev: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris,
    letterSpacing: 0.8, textTransform: 'uppercase',
  },
  dateNum: { fontFamily: fonts.archivo.bold, fontSize: 26, color: colors.crema, letterSpacing: -0.5 },

  // Card content
  cardContent: { flex: 1, gap: 8, justifyContent: 'center' },
  cardTopRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle:   { fontFamily: fonts.archivo.bold, fontSize: 15.5, color: colors.crema, flex: 1 },

  pendingBadge: {
    backgroundColor: colors.crema, borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0,
  },
  pendingBadgeText: { fontFamily: fonts.archivo.bold, fontSize: 11.5, color: '#FFF', letterSpacing: -0.2 },

  noPendingBadge: {
    backgroundColor: colors.crema, borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0,
  },
  noPendingBadgeText: { fontFamily: fonts.archivo.bold, fontSize: 11.5, color: '#FFF' },

  cardMediaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumbStack:   { flexDirection: 'row', alignItems: 'center' },
  thumb: {
    width: 36, height: 36, borderRadius: 9,
    borderWidth: 1.5, borderColor: colors.panel,
    backgroundColor: colors.chip,
  },
  mediaCounts: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mediaCountText: { fontFamily: fonts.mono.regular, fontSize: 12.5, color: colors.gris },

  // Empty
  emptyWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingTop: 80, gap: 14,
  },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema },
  emptyBody: {
    fontFamily: fonts.archivo.semibold, fontSize: 13.5, color: colors.gris,
    textAlign: 'center', lineHeight: 20,
  },
});
