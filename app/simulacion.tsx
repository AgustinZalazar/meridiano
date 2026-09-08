import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';

const TIPO_OPTIONS = [
  'Estructura', 'Mampostería', 'Terminaciones', 'Electricidad',
  'Plomería', 'Carpintería', 'Pintura', 'Paisajismo', 'Otro',
];

const MIN_SAMPLE = 2;

type MaterialSuggestion = {
  name: string;
  unit: string | null;
  avgQty: number;
  avgCost: number | null;
  frequency: number;
};

type TipoResult = {
  tipo: string;
  avgDays: number | null;
  sampleSize: number;
  materials: MaterialSuggestion[];
};

function daysBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export default function SimulacionScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TipoResult[] | null>(null);

  function toggleTipo(t: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
    setResults(null);
  }

  async function calculate() {
    if (selected.size === 0) return;
    setLoading(true);

    const tipos = Array.from(selected);

    const { data: rubros } = await supabase
      .from('rubros')
      .select('id, tipo, start_date, end_date')
      .in('tipo', tipos);

    const rubroIds = (rubros ?? []).map(r => r.id);

    const { data: materials } = rubroIds.length > 0
      ? await supabase
          .from('materials')
          .select('name, unit, estimated_quantity, unit_cost, rubro_id')
          .in('rubro_id', rubroIds)
          .not('estimated_quantity', 'is', null)
      : { data: [] };

    const tipoResults: TipoResult[] = tipos.map(tipo => {
      const tipoRubros = (rubros ?? []).filter(r => r.tipo === tipo);

      const withDates = tipoRubros.filter(r => r.start_date && r.end_date);
      const avgDays = withDates.length > 0
        ? Math.round(withDates.reduce((sum, r) => sum + daysBetween(r.start_date, r.end_date), 0) / withDates.length)
        : null;

      const tipoRubroIds = new Set(tipoRubros.map(r => r.id));
      const tipoMaterials = (materials ?? []).filter(m => tipoRubroIds.has(m.rubro_id));

      type MatAcc = { totalQty: number; totalCost: number; costCount: number; frequency: number; unit: string | null };
      const matMap = new Map<string, MatAcc>();
      for (const m of tipoMaterials) {
        const key = `${m.name}||${m.unit ?? ''}`;
        const ex = matMap.get(key) ?? { totalQty: 0, totalCost: 0, costCount: 0, frequency: 0, unit: m.unit };
        ex.totalQty += m.estimated_quantity ?? 0;
        if (m.unit_cost != null) { ex.totalCost += m.unit_cost; ex.costCount++; }
        ex.frequency++;
        matMap.set(key, ex);
      }

      const materialSuggestions: MaterialSuggestion[] = Array.from(matMap.entries())
        .map(([key, v]) => ({
          name: key.split('||')[0],
          unit: v.unit,
          avgQty: Math.round((v.totalQty / v.frequency) * 10) / 10,
          avgCost: v.costCount > 0 ? Math.round(v.totalCost / v.costCount) : null,
          frequency: v.frequency,
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 8);

      return { tipo, avgDays, sampleSize: tipoRubros.length, materials: materialSuggestions };
    });

    setResults(tipoResults);
    setLoading(false);
  }

  const totalDays = results?.reduce((sum, r) => sum + (r.avgDays ?? 0), 0) ?? 0;
  const anyLowData = results?.some(r => r.sampleSize < MIN_SAMPLE) ?? false;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        <View style={s.topRow}>
          <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="arrow-left" size={16} color={colors.crema} />
          </TouchableOpacity>
          <Text style={s.topLabel}>Simular proyecto</Text>
          <View style={{ width: 42 }} />
        </View>

        {/* Tipo selector */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>¿Qué rubros va a tener?</Text>
          <Text style={s.sectionHint}>Seleccioná todos los que apliquen</Text>
          <View style={s.chips}>
            {TIPO_OPTIONS.map(t => (
              <TouchableOpacity
                key={t}
                style={[s.chip, selected.has(t) && s.chipActive]}
                onPress={() => toggleTipo(t)}
                activeOpacity={0.75}
              >
                {selected.has(t) && <Feather name="check" size={11} color="#FFF" style={{ marginRight: 4 }} />}
                <Text style={[s.chipText, selected.has(t) && s.chipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.ctaBlock}>
          <TouchableOpacity
            style={[s.btn, (selected.size === 0 || loading) && s.btnDisabled]}
            onPress={calculate}
            disabled={selected.size === 0 || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={s.btnText}>Calcular estimación</Text>
            }
          </TouchableOpacity>
        </View>

        {results && (
          <View style={s.resultsBlock}>

            {anyLowData && (
              <View style={s.disclaimer}>
                <Feather name="info" size={14} color={colors.arena} />
                <Text style={s.disclaimerText}>
                  Algunos tipos tienen pocos datos históricos. Las estimaciones son orientativas.
                </Text>
              </View>
            )}

            {totalDays > 0 && (
              <View style={s.totalCard}>
                <Text style={s.totalEyebrow}>DURACIÓN TOTAL ESTIMADA</Text>
                <Text style={s.totalValue}>{totalDays} días</Text>
                <Text style={s.totalSub}>≈ {Math.round(totalDays / 7)} semanas</Text>
              </View>
            )}

            {results.map(r => (
              <View key={r.tipo} style={s.tipoCard}>
                <View style={s.tipoHeader}>
                  <Text style={s.tipoName}>{r.tipo}</Text>
                  {r.sampleSize < MIN_SAMPLE && (
                    <View style={s.lowBadge}>
                      <Text style={s.lowBadgeText}>Pocos datos</Text>
                    </View>
                  )}
                </View>

                {r.sampleSize === 0 ? (
                  <Text style={s.noData}>No hay proyectos previos con este tipo de rubro.</Text>
                ) : r.avgDays != null ? (
                  <Text style={s.tipoDuration}>
                    ≈ {r.avgDays} días · basado en {r.sampleSize} {r.sampleSize === 1 ? 'rubro anterior' : 'rubros anteriores'}
                  </Text>
                ) : (
                  <Text style={s.noData}>Sin fechas cargadas para estimar duración.</Text>
                )}

                {r.materials.length > 0 && (
                  <View style={s.matSection}>
                    <Text style={s.matEyebrow}>MATERIALES FRECUENTES</Text>
                    {r.materials.map((m, i) => (
                      <View key={i} style={[s.matRow, i < r.materials.length - 1 && s.matRowBorder]}>
                        <View style={s.matMain}>
                          <Text style={s.matName}>{m.name}</Text>
                          <Text style={s.matQty}>≈ {m.avgQty}{m.unit ? ` ${m.unit}` : ''}</Text>
                        </View>
                        {m.avgCost != null && (
                          <Text style={s.matCost}>$ {m.avgCost.toLocaleString('es-AR')}/u</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  scroll: { paddingBottom: 48, gap: spacing.lg },

  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  topLabel: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },

  section: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema, letterSpacing: -0.3 },
  sectionHint: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.gris },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    height: 36, paddingHorizontal: 14, borderRadius: 18,
    backgroundColor: colors.panel,
  },
  chipActive: { backgroundColor: colors.crema },
  chipText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.gris },
  chipTextActive: { color: '#FFFFFF' },

  ctaBlock: { paddingHorizontal: spacing.xl },
  btn: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },

  resultsBlock: { gap: spacing.md, paddingHorizontal: spacing.xl },

  disclaimer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: `${colors.arena}18`,
    borderRadius: 14, padding: spacing.md,
  },
  disclaimerText: { flex: 1, fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.crema, lineHeight: 19 },

  totalCard: {
    backgroundColor: colors.crema, borderRadius: 20, padding: spacing.lg, gap: 2,
    shadowColor: colors.crema, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  totalEyebrow: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)' },
  totalValue: { fontFamily: fonts.archivo.bold, fontSize: 36, color: '#FFFFFF', letterSpacing: -1, lineHeight: 42 },
  totalSub: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: 'rgba(255,255,255,0.7)' },

  tipoCard: {
    backgroundColor: colors.panel, borderRadius: 20, padding: spacing.lg, gap: spacing.sm,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3,
  },
  tipoHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tipoName: { fontFamily: fonts.archivo.bold, fontSize: 16, color: colors.crema, letterSpacing: -0.3 },
  lowBadge: { backgroundColor: `${colors.arena}22`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  lowBadgeText: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.arena },
  tipoDuration: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.gris },
  noData: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.faint, fontStyle: 'italic' },

  matSection: { marginTop: spacing.xs, gap: 0 },
  matEyebrow: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gris, marginBottom: spacing.sm },
  matRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  matRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  matMain: { flex: 1, gap: 2 },
  matName: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema },
  matQty: { fontFamily: fonts.mono.regular, fontSize: 11, color: colors.gris, letterSpacing: 0.3 },
  matCost: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.gris },
});
