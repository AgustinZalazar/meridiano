import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, SectionList } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

interface DbMaterial {
  id: string;
  name: string;
  unit: string | null;
  estimated_quantity: number | null;
  estimated_date: string | null;
  actual_quantity: number | null;
  actual_date: string | null;
  supplier: string | null;
  unit_cost: number | null;
  rubro_id: string | null;
}

interface DbRubro {
  id: string;
  name: string;
}

interface Section {
  title: string;
  rubroId: string | null;
  data: DbMaterial[];
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function fmtQty(qty: number | null, unit: string | null): string {
  if (qty == null) return '—';
  return unit ? `${qty} ${unit}` : String(qty);
}

function deviation(estimated: number | null, actual: number | null): number | null {
  if (estimated == null || actual == null || estimated === 0) return null;
  return Math.round(((actual - estimated) / estimated) * 100);
}

function MaterialCard({ item, onPress }: { item: DbMaterial; onPress: () => void }) {
  const dev = deviation(item.estimated_quantity, item.actual_quantity);
  const hasActual = item.actual_quantity != null || item.actual_date != null;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cardHeader}>
        <View style={s.cardLeft}>
          <Text style={s.cardName}>{item.name}</Text>
          {item.supplier ? (
            <Text style={s.cardSupplier} numberOfLines={1}>{item.supplier}</Text>
          ) : null}
        </View>
        {dev != null && (
          <View style={[s.devChip, { backgroundColor: dev > 0 ? 'rgba(192,57,43,0.1)' : 'rgba(74,124,89,0.1)' }]}>
            <Text style={[s.devText, { color: dev > 0 ? colors.error : colors.success }]}>
              {dev > 0 ? '+' : ''}{dev}%
            </Text>
          </View>
        )}
      </View>

      <View style={s.cardGrid}>
        <View style={s.gridCol}>
          <Text style={s.gridLabel}>ESTIMADO</Text>
          <Text style={s.gridVal}>{fmtQty(item.estimated_quantity, item.unit)}</Text>
          <Text style={s.gridDate}>{fmtDate(item.estimated_date)}</Text>
        </View>
        <View style={s.gridDivider} />
        <View style={s.gridCol}>
          <Text style={s.gridLabel}>REAL</Text>
          <Text style={[s.gridVal, !hasActual && { color: colors.faint }]}>
            {fmtQty(item.actual_quantity, item.unit)}
          </Text>
          <Text style={[s.gridDate, !hasActual && { color: colors.faint }]}>
            {fmtDate(item.actual_date)}
          </Text>
        </View>
        {item.unit_cost != null && (
          <>
            <View style={s.gridDivider} />
            <View style={s.gridCol}>
              <Text style={s.gridLabel}>COSTO UNIT.</Text>
              <Text style={s.gridVal}>${item.unit_cost.toLocaleString('es-AR')}</Text>
              {item.actual_quantity != null && (
                <Text style={s.gridDate}>${(item.unit_cost * item.actual_quantity).toLocaleString('es-AR')} total</Text>
              )}
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function MaterialesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Array.isArray(id) ? id[0] : id;

  const [projectName, setProjectName] = useState('');
  const [rubros, setRubros] = useState<DbRubro[]>([]);
  const [materials, setMaterials] = useState<DbMaterial[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!projectId) return;
      setLoading(true);

      Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('rubros').select('id, name').eq('project_id', projectId).order('created_at'),
        supabase.from('materials').select('id, name, unit, estimated_quantity, estimated_date, actual_quantity, actual_date, supplier, unit_cost, rubro_id').eq('project_id', projectId).order('created_at'),
      ]).then(([projRes, rubrosRes, matRes]) => {
        setProjectName((projRes.data as any)?.name ?? '');
        setRubros((rubrosRes.data as DbRubro[]) ?? []);
        setMaterials((matRes.data as DbMaterial[]) ?? []);
        setLoading(false);
      });
    }, [projectId])
  );

  const sections: Section[] = [];

  const general = materials.filter((m) => m.rubro_id == null);
  if (general.length > 0) sections.push({ title: 'General', rubroId: null, data: general });

  for (const r of rubros) {
    const items = materials.filter((m) => m.rubro_id === r.id);
    if (items.length > 0) sections.push({ title: r.name, rubroId: r.id, data: items });
  }

  function navToMaterial(material: DbMaterial) {
    router.push({
      pathname: '/material/[id]',
      params: {
        id: material.id,
        projectId,
        rubroId: material.rubro_id ?? '',
        name: material.name,
        unit: material.unit ?? '',
        estimatedQuantity: material.estimated_quantity != null ? String(material.estimated_quantity) : '',
        estimatedDate: material.estimated_date ?? '',
        actualQuantity: material.actual_quantity != null ? String(material.actual_quantity) : '',
        actualDate: material.actual_date ?? '',
        supplier: material.supplier ?? '',
        unitCost: material.unit_cost != null ? String(material.unit_cost) : '',
      },
    });
  }

  if (loading) {
    return (
      <View style={[s.safe, { paddingTop: insets.top }, s.center]}>
        <ActivityIndicator color={colors.crema} />
      </View>
    );
  }

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={s.topBar}>
        <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={16} color={colors.crema} />
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.topEyebrow}>MATERIALES</Text>
          {projectName ? <Text style={s.topTitle} numberOfLines={1}>{projectName}</Text> : null}
        </View>
        <TouchableOpacity
          style={s.circleBtn}
          onPress={() => router.push({ pathname: '/material/nueva', params: { projectId, rubros: JSON.stringify(rubros) } })}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={18} color={colors.crema} />
        </TouchableOpacity>
      </View>

      {sections.length === 0 ? (
        <View style={s.empty}>
          <Feather name="package" size={32} color={colors.faint} />
          <Text style={s.emptyText}>Sin materiales cargados</Text>
          <TouchableOpacity
            style={s.emptyBtn}
            onPress={() => router.push({ pathname: '/material/nueva', params: { projectId, rubros: JSON.stringify(rubros) } })}
            activeOpacity={0.85}
          >
            <Text style={s.emptyBtnText}>Agregar material</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MaterialCard item={item} onPress={() => navToMaterial(item)} />
          )}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              <Text style={s.sectionCount}>{section.data.length}</Text>
            </View>
          )}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  center: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  topCenter: { flex: 1, alignItems: 'center', gap: 1 },
  topEyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1.4,
    textTransform: 'uppercase', color: colors.gris,
  },
  topTitle: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },

  listContent: { paddingHorizontal: spacing.xl, paddingBottom: 80, paddingTop: spacing.sm, gap: 8 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
  sectionTitle: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema, flex: 1 },
  sectionCount: {
    fontFamily: fonts.mono.regular, fontSize: 10, color: colors.gris,
    backgroundColor: colors.chip, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8,
  },

  card: {
    backgroundColor: colors.panel, borderRadius: 20, padding: 16, gap: 14,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cardLeft: { flex: 1, gap: 2 },
  cardName: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  cardSupplier: { fontFamily: fonts.archivo.semibold, fontSize: 11.5, color: colors.gris },

  devChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  devText: { fontFamily: fonts.mono.medium, fontSize: 10, letterSpacing: 0.3 },

  cardGrid: { flexDirection: 'row', gap: 0 },
  gridCol: { flex: 1, gap: 4, alignItems: 'center' },
  gridDivider: { width: 1, backgroundColor: colors.border, marginVertical: 2 },
  gridLabel: {
    fontFamily: fonts.mono.regular, fontSize: 8.5, letterSpacing: 1,
    textTransform: 'uppercase', color: colors.faint,
  },
  gridVal: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema },
  gridDate: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.gris, letterSpacing: 0.3 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.faint },
  emptyBtn: {
    marginTop: spacing.sm, height: 46, paddingHorizontal: spacing.xl,
    borderRadius: 23, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center',
  },
  emptyBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: '#FFFFFF' },
});
