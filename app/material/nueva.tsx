import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const UNIT_OPTIONS = ['kg', 'm²', 'm³', 'm', 'l', 'un.'];
const UNIT_NAMES: Record<string, string> = {
  'kg': 'kilogramo',
  'm²': 'metro cuadrado',
  'm³': 'metro cúbico',
  'm': 'metro lineal',
  'l': 'litro',
  'un.': 'unidad',
};

function parseDateParam(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? raw + 'T12:00:00' : raw);
  return isNaN(d.getTime()) ? null : d;
}

export default function NuevoMaterialScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId: string; rubros: string }>();
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  const rubros: { id: string; name: string }[] = (() => {
    try { return JSON.parse(params.rubros ?? '[]'); } catch { return []; }
  })();

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [unitCustom, setUnitCustom] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [estimatedQty, setEstimatedQty] = useState('');
  const [actualQty, setActualQty] = useState('');
  const [rubroId, setRubroId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0;

  async function handleSave() {
    if (!canSave || !projectId) return;
    setLoading(true);
    setError(null);

    const { error: dbError } = await supabase.from('materials').insert({
      project_id: projectId,
      rubro_id: rubroId || null,
      name: name.trim(),
      unit: unit.trim() || null,
      supplier: supplier.trim() || null,
      unit_cost: unitCost ? parseFloat(unitCost) : null,
      estimated_quantity: estimatedQty ? parseFloat(estimatedQty) : null,
      estimated_date: null,
      actual_quantity: actualQty ? parseFloat(actualQty) : null,
      actual_date: null,
    });

    setLoading(false);
    if (dbError) { setError('No se pudo guardar. Intentá de nuevo.'); return; }
    router.back();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Top bar */}
        <View style={s.topRow}>
          <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="arrow-left" size={16} color={colors.crema} />
          </TouchableOpacity>
          <Text style={s.topLabel}>Nuevo material</Text>
          <View style={{ width: 42 }} />
        </View>

        {/* Nombre */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>NOMBRE</Text>
          <TextInput
            style={s.input} value={name} onChangeText={setName}
            placeholder="Ej. Cemento Portland" placeholderTextColor={colors.faint}
            selectionColor={colors.arena} returnKeyType="next"
          />
        </View>

        {/* Unidad */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>UNIDAD</Text>
          <View style={s.unitRow}>
            {UNIT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[s.unitChip, !unitCustom && unit === opt && s.unitChipActive]}
                onPress={() => { setUnit(opt); setUnitCustom(false); }}
                activeOpacity={0.75}
              >
                <Text style={[s.unitChipText, !unitCustom && unit === opt && s.unitChipTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.unitChip, unitCustom && s.unitChipActive]}
              onPress={() => { setUnitCustom(true); setUnit(''); }}
              activeOpacity={0.75}
            >
              <Text style={[s.unitChipText, unitCustom && s.unitChipTextActive]}>Otro</Text>
            </TouchableOpacity>
          </View>
          {!unitCustom && unit && UNIT_NAMES[unit] && (
            <Text style={s.unitHint}>{unit} · {UNIT_NAMES[unit]}</Text>
          )}
          {unitCustom && (
            <TextInput
              style={[s.input, { marginTop: spacing.sm }]}
              value={unit} onChangeText={setUnit}
              placeholder="Ingresá la unidad" placeholderTextColor={colors.faint}
              selectionColor={colors.arena} autoFocus returnKeyType="next"
            />
          )}
        </View>

        {/* Costo unitario */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>COSTO UNITARIO</Text>
          <View style={s.currencyRow}>
            <Text style={s.currencySymbol}>$</Text>
            <TextInput
              style={[s.input, s.currencyInput]}
              value={unitCost} onChangeText={setUnitCost}
              placeholder="0.00" placeholderTextColor={colors.faint}
              selectionColor={colors.arena} keyboardType="decimal-pad" returnKeyType="next"
            />
          </View>
        </View>

        {/* Proveedor */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>PROVEEDOR <Text style={s.optional}>(opcional)</Text></Text>
          <TextInput
            style={s.input} value={supplier} onChangeText={setSupplier}
            placeholder="Ej. Cementos del Sur" placeholderTextColor={colors.faint}
            selectionColor={colors.arena} returnKeyType="next"
          />
        </View>

        {/* Rubro */}
        {rubros.length > 0 && (
          <View style={s.field}>
            <Text style={s.fieldLabel}>RUBRO <Text style={s.optional}>(opcional)</Text></Text>
            <View style={s.rubroContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rubroRow}>
                <TouchableOpacity
                  style={[s.rubroChip, rubroId === null && s.rubroChipActive]}
                  onPress={() => setRubroId(null)} activeOpacity={0.8}
                >
                  <Text style={[s.rubroChipText, rubroId === null && s.rubroChipTextActive]}>General</Text>
                </TouchableOpacity>
                {rubros.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.rubroChip, rubroId === r.id && s.rubroChipActive]}
                    onPress={() => setRubroId(r.id)} activeOpacity={0.8}
                  >
                    <Text style={[s.rubroChipText, rubroId === r.id && s.rubroChipTextActive]} numberOfLines={1}>{r.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <LinearGradient
                colors={[`${colors.tinta}00`, colors.tinta]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.rubroFade}
                pointerEvents="none"
              />
            </View>
          </View>
        )}

        {/* Estimado */}
        <View style={s.sectionDivider}>
          <Text style={s.sectionLabel}>ESTIMADO</Text>
          <Text style={s.sectionOptional}>(opcional)</Text>
        </View>
        <View style={s.field}>
          <Text style={s.fieldLabel}>CANTIDAD</Text>
          <TextInput
            style={s.input} value={estimatedQty} onChangeText={setEstimatedQty}
            placeholder="0" placeholderTextColor={colors.faint}
            selectionColor={colors.arena} keyboardType="decimal-pad"
          />
        </View>

        {/* Real */}
        <View style={s.sectionDivider}>
          <Text style={s.sectionLabel}>REAL</Text>
          <Text style={s.sectionOptional}>(opcional)</Text>
        </View>
        <View style={s.field}>
          <Text style={s.fieldLabel}>CANTIDAD</Text>
          <TextInput
            style={s.input} value={actualQty} onChangeText={setActualQty}
            placeholder="0" placeholderTextColor={colors.faint}
            selectionColor={colors.arena} keyboardType="decimal-pad"
          />
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}

        <View style={s.ctaBlock}>
          <TouchableOpacity
            style={[s.btnPrimary, (!canSave || loading) && s.btnDisabled]}
            onPress={handleSave} activeOpacity={0.85} disabled={!canSave || loading}
          >
            {loading
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={s.btnText}>Guardar material</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  scroll: { paddingBottom: 40, gap: spacing.lg },

  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  topLabel: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },

  field: { paddingHorizontal: spacing.xl },
  fieldLabel: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gris, fontWeight: '700', marginBottom: spacing.sm },
  optional: { color: colors.faint, textTransform: 'none', letterSpacing: 0 },
  input: {
    height: 52, borderRadius: 16, backgroundColor: colors.panel,
    paddingHorizontal: spacing.md, fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl },

  // Unit selector
  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  unitChip: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  unitChipActive: { backgroundColor: colors.crema },
  unitChipText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.gris },
  unitChipTextActive: { color: '#FFFFFF' },
  unitHint: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.3, color: colors.gris, marginTop: spacing.sm },

  // Currency input
  currencyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  currencySymbol: { fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema, paddingLeft: 4 },
  currencyInput: { flex: 1 },

  // Rubro
  rubroContainer: { position: 'relative' },
  rubroRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: 40 },
  rubroFade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 40 },
  rubroChip: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
  rubroChipActive: { backgroundColor: colors.crema },
  rubroChipText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.gris },
  rubroChipTextActive: { color: '#FFFFFF' },

  sectionDivider: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.xs },
  sectionLabel: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gris },
  sectionOptional: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 0.3, color: colors.faint },

  errorText: { paddingHorizontal: spacing.xl, fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error },

  ctaBlock: { paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
