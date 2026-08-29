import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { DateField } from '../../components/DateField';
import { supabase } from '../../lib/supabase';

function parseDateParam(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? raw + 'T12:00:00' : raw);
  return isNaN(d.getTime()) ? null : d;
}

export default function EditarMaterialScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    projectId: string;
    rubroId: string;
    name: string;
    unit: string;
    estimatedQuantity: string;
    estimatedDate: string;
    actualQuantity: string;
    actualDate: string;
    supplier: string;
    unitCost: string;
  }>();

  const materialId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [name, setName] = useState(params.name ?? '');
  const [unit, setUnit] = useState(params.unit ?? '');
  const [supplier, setSupplier] = useState(params.supplier ?? '');
  const [unitCost, setUnitCost] = useState(params.unitCost ?? '');
  const [estimatedQty, setEstimatedQty] = useState(params.estimatedQuantity ?? '');
  const [estimatedDate, setEstimatedDate] = useState<Date | null>(parseDateParam(params.estimatedDate));
  const [actualQty, setActualQty] = useState(params.actualQuantity ?? '');
  const [actualDate, setActualDate] = useState<Date | null>(parseDateParam(params.actualDate));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0;

  async function handleSave() {
    if (!canSave || !materialId) return;
    setLoading(true);
    setError(null);

    const { error: dbError } = await supabase
      .from('materials')
      .update({
        name: name.trim(),
        unit: unit.trim() || null,
        supplier: supplier.trim() || null,
        unit_cost: unitCost ? parseFloat(unitCost) : null,
        estimated_quantity: estimatedQty ? parseFloat(estimatedQty) : null,
        estimated_date: estimatedDate ? estimatedDate.toISOString().slice(0, 10) : null,
        actual_quantity: actualQty ? parseFloat(actualQty) : null,
        actual_date: actualDate ? actualDate.toISOString().slice(0, 10) : null,
      })
      .eq('id', materialId);

    setLoading(false);
    if (dbError) { setError('No se pudo guardar. Intentá de nuevo.'); return; }
    router.back();
  }

  function handleDelete() {
    Alert.alert(
      'Eliminar material',
      `¿Eliminar "${name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error: dbError } = await supabase.from('materials').delete().eq('id', materialId);
            if (dbError) { Alert.alert('Error', 'No se pudo eliminar.'); return; }
            router.back();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Top bar */}
        <View style={s.topRow}>
          <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="arrow-left" size={16} color={colors.crema} />
          </TouchableOpacity>
          <Text style={s.topLabel} numberOfLines={1}>Editar material</Text>
          <TouchableOpacity style={s.circleBtnDestructive} onPress={handleDelete} activeOpacity={0.8}>
            <Feather name="trash-2" size={15} color={colors.error} />
          </TouchableOpacity>
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

        {/* Unidad + Costo */}
        <View style={s.row}>
          <View style={[s.field, { flex: 1 }]}>
            <Text style={s.fieldLabel}>UNIDAD</Text>
            <TextInput
              style={s.input} value={unit} onChangeText={setUnit}
              placeholder="kg, m², un." placeholderTextColor={colors.faint}
              selectionColor={colors.arena} returnKeyType="next"
            />
          </View>
          <View style={[s.field, { flex: 1 }]}>
            <Text style={s.fieldLabel}>COSTO UNITARIO</Text>
            <TextInput
              style={s.input} value={unitCost} onChangeText={setUnitCost}
              placeholder="0.00" placeholderTextColor={colors.faint}
              selectionColor={colors.arena} keyboardType="decimal-pad"
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

        {/* Estimado */}
        <View style={s.sectionDivider}>
          <Text style={s.sectionLabel}>ESTIMADO</Text>
        </View>
        <View style={s.row}>
          <View style={[s.field, { flex: 1 }]}>
            <Text style={s.fieldLabel}>CANTIDAD</Text>
            <TextInput
              style={s.input} value={estimatedQty} onChangeText={setEstimatedQty}
              placeholder="0" placeholderTextColor={colors.faint}
              selectionColor={colors.arena} keyboardType="decimal-pad"
            />
          </View>
          <View style={[s.field, { flex: 1.4 }]}>
            <DateField label="FECHA" value={estimatedDate} onChange={setEstimatedDate} placeholder="Sin fecha" />
          </View>
        </View>

        {/* Real */}
        <View style={s.sectionDivider}>
          <Text style={s.sectionLabel}>REAL</Text>
        </View>
        <View style={s.row}>
          <View style={[s.field, { flex: 1 }]}>
            <Text style={s.fieldLabel}>CANTIDAD</Text>
            <TextInput
              style={s.input} value={actualQty} onChangeText={setActualQty}
              placeholder="0" placeholderTextColor={colors.faint}
              selectionColor={colors.arena} keyboardType="decimal-pad"
            />
          </View>
          <View style={[s.field, { flex: 1.4 }]}>
            <DateField label="FECHA" value={actualDate} onChange={setActualDate} placeholder="Sin fecha" />
          </View>
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}

        <View style={s.ctaBlock}>
          <TouchableOpacity
            style={[s.btnPrimary, (!canSave || loading) && s.btnDisabled]}
            onPress={handleSave} activeOpacity={0.85} disabled={!canSave || loading}
          >
            {loading
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={s.btnText}>Guardar cambios</Text>
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
  circleBtnDestructive: {
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

  sectionDivider: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs },
  sectionLabel: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.arena },

  errorText: { paddingHorizontal: spacing.xl, fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error },

  ctaBlock: { paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
