import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { SlidingTabs } from '../../components/SlidingTabs';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = 'contratistas' | 'oficina';
type PendingStatus = 'pendiente' | 'en_revision' | 'resuelto';

interface DbPending {
  id: string;
  description: string;
  trade: string | null;
  status: PendingStatus;
  source: 'ai' | 'manual';
  created_at: string;
  projects: { name: string } | null;
  rubros: { name: string } | null;
  reports: { type: ReportType } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<PendingStatus, string> = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  resuelto: 'Resuelto',
};

const STATUS_STYLE: Record<PendingStatus, { bg: string; color: string }> = {
  pendiente: { bg: colors.chip, color: colors.crema },
  en_revision: { bg: 'rgba(217,119,87,0.12)', color: colors.arena },
  resuelto: { bg: 'rgba(74,124,89,0.12)', color: colors.success },
};

function formatItemDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    ...(!sameYear && { year: 'numeric' }),
  }).replace('.', '').toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SkeletonPendienteCard() {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 1100, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.45, 1] });
  return (
    <Animated.View style={[styles.card, { opacity }]}>
      <View style={[styles.imageSlot, { backgroundColor: colors.chip }]} />
      <View style={[styles.cardBody, { gap: 10 }]}>
        <View style={{ height: 13, borderRadius: 7, backgroundColor: colors.chip, width: '70%' }} />
        <View style={{ height: 11, borderRadius: 6, backgroundColor: colors.chip, width: '50%' }} />
        <View style={{ height: 20, borderRadius: 10, backgroundColor: colors.chip, width: '35%' }} />
      </View>
    </Animated.View>
  );
}

function PendienteCard({ item, onPress, index }: { item: DbPending; onPress: () => void; index: number }) {
  const s = STATUS_STYLE[item.status];
  const projectName = item.projects?.name ?? '—';
  const rubroName = item.rubros?.name ?? '—';
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 65),
      Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
      transform: [
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      ],
    }}>
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageSlot}>
        <Feather
          name={item.source === 'ai' ? 'cpu' : 'edit-3'}
          size={20}
          color={colors.faint}
        />
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardMeta} numberOfLines={1}>{projectName} · {rubroName}</Text>
          <Text style={styles.cardDate}>{formatItemDate(item.created_at)}</Text>
        </View>
        <View style={styles.cardFooter}>
          {item.trade ? (
            <View style={styles.tradeChip}>
              <Text style={styles.tradeText}>{item.trade.toUpperCase()}</Text>
            </View>
          ) : null}
          <View style={[styles.statusChip, { backgroundColor: s.bg }]}>
            <Text style={[styles.statusChipText, { color: s.color }]}>
              {STATUS_LABEL[item.status]}
            </Text>
          </View>
          <View style={styles.sourceChip}>
            <Text style={styles.sourceChipText}>
              {item.source === 'ai' ? 'IA' : 'Manual'}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PendientesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeType, setActiveType] = useState<ReportType>('contratistas');
  const [items, setItems] = useState<DbPending[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterVisible, setFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PendingStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ai' | 'manual'>('all');

  const hasActiveFilters = statusFilter !== 'all' || sourceFilter !== 'all';

  function resetFilters() {
    setStatusFilter('all');
    setSourceFilter('all');
  }

  const fetchPendientes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pending_items')
      .select('id, description, trade, status, source, created_at, projects(name), rubros(name), reports(type)')
      .order('created_at', { ascending: false });
    setItems((data as DbPending[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPendientes(); }, [fetchPendientes]);

  const filtered = items.filter((p) => {
    const type = p.reports?.type;
    if (type && type !== activeType) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && p.source !== sourceFilter) return false;
    return true;
  });

  const pendienteCount = filtered.filter((p) => p.status === 'pendiente').length;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.heading}>{pendienteCount} sin resolver</Text>
        </View>
        <TouchableOpacity style={styles.circleBtn} onPress={() => setFilterVisible(true)} activeOpacity={0.8}>
          <Feather name="filter" size={16} color={hasActiveFilters ? colors.arena : colors.crema} />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* Type toggle */}
      <SlidingTabs
        options={['Contratistas', 'Oficina técnica']}
        selected={activeType === 'contratistas' ? 'Contratistas' : 'Oficina técnica'}
        onChange={(v) => setActiveType(v === 'Contratistas' ? 'contratistas' : 'oficina')}
        style={styles.typeToggle}
      />

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <>{[0,1,2,3].map(i => <SkeletonPendienteCard key={i} />)}</>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={32} color={colors.faint} />
            <Text style={styles.emptyText}>Sin pendientes</Text>
          </View>
        ) : (
          filtered.map((item, i) => (
            <PendienteCard
              key={item.id}
              item={item}
              index={i}
              onPress={() => router.push(`/pendiente/${item.id}`)}
            />
          ))
        )}
      </ScrollView>
      {/* ── Filter sheet ──────────────────────────────────────── */}
      <BottomSheet visible={filterVisible} onClose={() => setFilterVisible(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>Filtros</Text>
            {hasActiveFilters && (
              <TouchableOpacity onPress={resetFilters} activeOpacity={0.7}>
                <Text style={styles.sheetReset}>Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.sheetGroupLabel}>ESTADO</Text>
          <View style={styles.chipRow}>
            {([['all', 'Todos'], ['pendiente', 'Pendiente'], ['en_revision', 'En revisión'], ['resuelto', 'Resuelto']] as const).map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[styles.filterChip, statusFilter === val && styles.filterChipActive]}
                onPress={() => setStatusFilter(val)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, statusFilter === val && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sheetGroupLabel}>FUENTE</Text>
          <View style={styles.chipRow}>
            {([['all', 'Todos'], ['ai', 'IA'], ['manual', 'Manual']] as const).map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[styles.filterChip, sourceFilter === val && styles.filterChipActive]}
                onPress={() => setSourceFilter(val)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterChipText, sourceFilter === val && styles.filterChipTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.sheetApplyBtn} onPress={() => setFilterVisible(false)} activeOpacity={0.85}>
            <Text style={styles.sheetApplyText}>
              Ver {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },

  topBar: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  eyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.6,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  heading: {
    fontFamily: fonts.archivo.bold, fontSize: 28, color: colors.crema,
    letterSpacing: -0.7, lineHeight: 34, marginTop: 4,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },

  typeToggle: {
    marginHorizontal: spacing.xl, marginBottom: spacing.md,
  },

  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md + 4, paddingTop: spacing.xs, gap: 10 },

  card: {
    flexDirection: 'row', gap: 14, backgroundColor: colors.panel, borderRadius: 20, padding: 14,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2,
  },
  imageSlot: {
    width: 64, height: 64, borderRadius: 14, backgroundColor: colors.chip,
    flexShrink: 0, alignItems: 'center', justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 5, justifyContent: 'center' },
  cardDesc: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.crema, lineHeight: 19 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  cardMeta: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris, letterSpacing: 0.3, flex: 1 },
  cardDate: { fontFamily: fonts.mono.regular, fontSize: 9, color: colors.faint, letterSpacing: 0.3, flexShrink: 0 },
  cardFooter: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },

  tradeChip: {
    height: 22, borderRadius: 11, paddingHorizontal: 8,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  tradeText: { fontFamily: fonts.archivo.bold, fontSize: 9, letterSpacing: 0.3, color: colors.crema },

  statusChip: { height: 22, borderRadius: 11, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  statusChipText: { fontFamily: fonts.archivo.bold, fontSize: 9, letterSpacing: 0.3 },

  sourceChip: {
    height: 22, borderRadius: 11, paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  sourceChipText: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 0.3, color: colors.faint },

  emptyState: { alignItems: 'center', gap: 10, paddingTop: 60 },
  emptyText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.faint },

  filterDot: {
    position: 'absolute', top: 9, right: 9,
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: colors.arena, borderWidth: 1.5, borderColor: colors.tinta,
  },

  sheet: {
    backgroundColor: colors.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl, paddingBottom: 36, paddingTop: 12, gap: spacing.lg,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4,
  },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema, letterSpacing: -0.3 },
  sheetReset: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.arena },
  sheetGroupLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700', marginBottom: -spacing.sm,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterChip: {
    height: 34, paddingHorizontal: 16, borderRadius: 17,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: colors.crema },
  filterChipText: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: colors.crema },
  filterChipTextActive: { color: '#FFFFFF' },
  sheetApplyBtn: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center', marginTop: spacing.xs,
  },
  sheetApplyText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.1 },
});
