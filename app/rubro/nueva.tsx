import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SlidingTabs } from '../../components/SlidingTabs';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { DateField } from '../../components/DateField';
import { supabase } from '../../lib/supabase';

type RubroStatus = 'sin_iniciar' | 'en_curso' | 'completada';

const TIPO_OPTIONS = [
  'Estructura', 'Mampostería', 'Terminaciones', 'Electricidad',
  'Plomería', 'Carpintería', 'Pintura', 'Paisajismo', 'Otro',
];

const STATUS_OPTIONS: { key: RubroStatus; label: string }[] = [
  { key: 'sin_iniciar', label: 'Sin iniciar' },
  { key: 'en_curso',    label: 'En curso'    },
  { key: 'completada',  label: 'Entregado'   },
];

export default function NuevoRubroScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  const [name,       setName]       = useState('');
  const [tipo,       setTipo]       = useState<string | null>(null);
  const [contractor, setContractor] = useState('');
  const [code,       setCode]       = useState('');
  const [status,     setStatus]     = useState<RubroStatus>('sin_iniciar');
  const [startDate,  setStartDate]  = useState<Date | null>(null);
  const [endDate,    setEndDate]    = useState<Date | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const pid = Array.isArray(projectId) ? projectId[0] : projectId;
  const canSave = name.trim().length > 0;

  async function handleSave() {
    if (!canSave || !pid) return;
    setLoading(true);
    setError(null);

    const finalCode = code.trim() || `RB-${String(Math.floor(Math.random() * 900) + 100)}`;

    const { error: dbError } = await supabase.from('rubros').insert({
      project_id:  pid,
      name:        name.trim(),
      tipo:        tipo || null,
      contractor:  contractor.trim() || null,
      code:        finalCode,
      status,
      start_date:  startDate ? startDate.toISOString().slice(0, 10) : null,
      end_date:    endDate   ? endDate.toISOString().slice(0, 10)   : null,
    });

    setLoading(false);
    if (dbError) {
      setError('No se pudo guardar el rubro. Intentá de nuevo.');
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={s.topRow}>
          <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="x" size={16} color={colors.crema} />
          </TouchableOpacity>
          <Text style={s.topLabel}>Nuevo rubro</Text>
          <TouchableOpacity
            style={[s.saveBtn, (!canSave || loading) && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={s.saveBtnText}>Crear</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Nombre */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>NOMBRE</Text>
          <TextInput
            style={s.input}
            value={name}
            onChangeText={setName}
            placeholder="Ej. Instalaciones Eléctricas"
            placeholderTextColor={colors.faint}
            selectionColor={colors.arena}
            autoFocus
            returnKeyType="next"
          />
        </View>

        {/* Tipo */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>TIPO <Text style={s.fieldOptional}>(opcional)</Text></Text>
          <View style={s.tipoRow}>
            {TIPO_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[s.tipoChip, tipo === opt && s.tipoChipActive]}
                onPress={() => setTipo(t => t === opt ? null : opt)}
                activeOpacity={0.75}
              >
                <Text style={[s.tipoChipText, tipo === opt && s.tipoChipTextActive]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contratista */}
        <View style={s.field}>
          <View style={s.fieldLabelRow}>
            <Text style={s.fieldLabel}>CONTRATISTA</Text>
            <Text style={s.fieldBadge}>aparece en informes</Text>
          </View>
          <TextInput
            style={s.input}
            value={contractor}
            onChangeText={setContractor}
            placeholder="Ej. Electro Sur S.A."
            placeholderTextColor={colors.faint}
            selectionColor={colors.arena}
            returnKeyType="next"
          />
        </View>

        {/* Código */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>CÓDIGO <Text style={s.fieldOptional}>(opcional)</Text></Text>
          <TextInput
            style={s.input}
            value={code}
            onChangeText={setCode}
            placeholder="Ej. RB-005"
            placeholderTextColor={colors.faint}
            selectionColor={colors.arena}
            autoCapitalize="characters"
            returnKeyType="done"
          />
        </View>

        {/* Fechas */}
        <View style={s.field}>
          <DateField
            label="FECHA DE INICIO"
            value={startDate}
            onChange={setStartDate}
            placeholder="Seleccionar fecha"
            maximumDate={endDate ?? undefined}
          />
        </View>

        <View style={s.field}>
          <DateField
            label="FECHA DE FIN"
            value={endDate}
            onChange={setEndDate}
            placeholder="Seleccionar fecha"
            minimumDate={startDate ?? undefined}
          />
        </View>

        {/* Estado */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>ESTADO</Text>
          <SlidingTabs
            options={STATUS_OPTIONS.map(o => o.label)}
            selected={STATUS_OPTIONS.find(o => o.key === status)?.label ?? STATUS_OPTIONS[0].label}
            onChange={(label) => setStatus(STATUS_OPTIONS.find(o => o.label === label)!.key)}
          />
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}
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
  topLabel: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  saveBtn: {
    height: 36, paddingHorizontal: 18, borderRadius: 18, backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: '#FFFFFF' },

  field: { paddingHorizontal: spacing.xl },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  fieldLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
    marginBottom: spacing.sm,
  },
  fieldOptional: { color: colors.faint, textTransform: 'none', letterSpacing: 0 },
  fieldBadge: {
    fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 0.5,
    color: colors.arena, textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  input: {
    height: 52, borderRadius: 16, backgroundColor: colors.panel,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  tipoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tipoChip: {
    height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  tipoChipActive: { backgroundColor: colors.crema },
  tipoChipText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.gris },
  tipoChipTextActive: { color: '#FFFFFF' },

  errorText: {
    paddingHorizontal: spacing.xl,
    fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error,
  },
});
