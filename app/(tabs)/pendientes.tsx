import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function PendienteCard({ item, onPress }: { item: DbPending; onPress: () => void }) {
  const s = STATUS_STYLE[item.status];
  const projectName = item.projects?.name ?? '—';
  const rubroName = item.rubros?.name ?? '—';

  return (
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
        <Text style={styles.cardMeta}>{projectName} · {rubroName}</Text>
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
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PendientesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeType, setActiveType] = useState<ReportType>('contratistas');
  const [items, setItems] = useState<DbPending[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Items without a linked report (manual) show in both tabs
  const filtered = items.filter((p) => {
    const type = p.reports?.type;
    return !type || type === activeType;
  });

  const pendienteCount = filtered.filter((p) => p.status === 'pendiente').length;

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.eyebrow}>PENDIENTES</Text>
          <Text style={styles.heading}>{pendienteCount} sin resolver</Text>
        </View>
        <TouchableOpacity style={styles.circleBtn} activeOpacity={0.8}>
          <Feather name="filter" size={16} color={colors.crema} />
        </TouchableOpacity>
      </View>

      {/* Type toggle */}
      <View style={styles.typeToggle}>
        <TouchableOpacity
          style={[styles.typeBtn, activeType === 'contratistas' && styles.typeBtnActive]}
          onPress={() => setActiveType('contratistas')}
          activeOpacity={0.8}
        >
          <Feather name="tool" size={13} color={activeType === 'contratistas' ? '#FFFFFF' : colors.gris} />
          <Text style={[styles.typeBtnText, activeType === 'contratistas' && styles.typeBtnTextActive]}>
            Contratistas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.typeBtn, activeType === 'oficina' && styles.typeBtnActive]}
          onPress={() => setActiveType('oficina')}
          activeOpacity={0.8}
        >
          <Feather name="briefcase" size={13} color={activeType === 'oficina' ? '#FFFFFF' : colors.gris} />
          <Text style={[styles.typeBtnText, activeType === 'oficina' && styles.typeBtnTextActive]}>
            Oficina técnica
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator color={colors.crema} />
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={32} color={colors.faint} />
            <Text style={styles.emptyText}>Sin pendientes</Text>
          </View>
        ) : (
          filtered.map((item) => (
            <PendienteCard
              key={item.id}
              item={item}
              onPress={() => router.push(`/pendiente/${item.id}`)}
            />
          ))
        )}
      </ScrollView>
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
    flexDirection: 'row', marginHorizontal: spacing.xl, marginBottom: spacing.md,
    backgroundColor: colors.chip, borderRadius: 24, padding: 4, gap: 4,
  },
  typeBtn: {
    flex: 1, height: 42, borderRadius: 21, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  typeBtnActive: { backgroundColor: colors.crema },
  typeBtnText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.gris },
  typeBtnTextActive: { color: '#FFFFFF' },

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
  cardMeta: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris, letterSpacing: 0.3 },
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
});
