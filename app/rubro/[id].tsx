import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { DateField } from '../../components/DateField';
import { supabase } from '../../lib/supabase';

type RubroStatus = 'sin_iniciar' | 'en_curso' | 'completada';

const STATUS_OPTIONS: { key: RubroStatus; label: string }[] = [
  { key: 'sin_iniciar', label: 'Sin iniciar' },
  { key: 'en_curso',    label: 'En curso'    },
  { key: 'completada',  label: 'Entregado'   },
];

function parseDateParam(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? raw + 'T12:00:00' : raw);
  return isNaN(d.getTime()) ? null : d;
}

export default function EditarRubroScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    projectId: string;
    name: string;
    contractor: string;
    code: string;
    status: RubroStatus;
    startDate: string;
    endDate: string;
  }>();

  const rubroId   = Array.isArray(params.id)        ? params.id[0]        : params.id;
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  const [name,       setName]       = useState(params.name       ?? '');
  const [contractor, setContractor] = useState(params.contractor ?? '');
  const [code,       setCode]       = useState(params.code       ?? '');
  const [status,     setStatus]     = useState<RubroStatus>(params.status ?? 'sin_iniciar');
  const [startDate,  setStartDate]  = useState<Date | null>(parseDateParam(params.startDate));
  const [endDate,    setEndDate]    = useState<Date | null>(parseDateParam(params.endDate));
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const canSave = name.trim().length > 0;

  async function handleSave() {
    if (!canSave || !rubroId) return;
    setLoading(true);
    setError(null);

    const finalCode = code.trim() || `RB-${String(Math.floor(Math.random() * 900) + 100)}`;

    const { error: dbError } = await supabase
      .from('rubros')
      .update({
        name:       name.trim(),
        contractor: contractor.trim() || null,
        code:       finalCode,
        status,
        start_date: startDate ? startDate.toISOString().slice(0, 10) : null,
        end_date:   endDate   ? endDate.toISOString().slice(0, 10)   : null,
      })
      .eq('id', rubroId);

    setLoading(false);
    if (dbError) {
      setError('No se pudo guardar. Intentá de nuevo.');
      return;
    }
    router.back();
  }

  function handleDelete() {
    Alert.alert(
      'Eliminar rubro',
      `¿Eliminar "${name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const { error: dbError } = await supabase
              .from('rubros')
              .delete()
              .eq('id', rubroId);

            if (dbError) {
              Alert.alert('Error', 'No se pudo eliminar el rubro.');
              return;
            }
            router.back();
            router.back();
          },
        },
      ],
    );
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
            <Feather name="arrow-left" size={16} color={colors.crema} />
          </TouchableOpacity>
          <Text style={s.topLabel} numberOfLines={1}>Editar rubro</Text>
          <TouchableOpacity style={s.circleBtnDestructive} onPress={handleDelete} activeOpacity={0.8}>
            <Feather name="trash-2" size={15} color={colors.error} />
          </TouchableOpacity>
        </View>

        {params.code ? (
          <View style={s.codeRow}>
            <Text style={s.codeText}>{params.code}</Text>
          </View>
        ) : null}

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
            returnKeyType="next"
          />
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
            placeholder="Ej. RB-001"
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
          <View style={s.statusRow}>
            {STATUS_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[s.statusBtn, status === opt.key && s.statusBtnActive]}
                onPress={() => setStatus(opt.key)}
                activeOpacity={0.75}
              >
                <Text style={[s.statusBtnText, status === opt.key && s.statusBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error && <Text style={s.errorText}>{error}</Text>}

        {/* CTA */}
        <View style={s.ctaBlock}>
          <TouchableOpacity
            style={[s.btnPrimary, (!canSave || loading) && s.btnPrimaryDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={!canSave || loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={s.btnPrimaryText}>Guardar cambios</Text>
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
  topLabel: {
    fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema, flex: 1,
    textAlign: 'center', marginHorizontal: spacing.sm,
  },

  codeRow: { paddingHorizontal: spacing.xl },
  codeText: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris,
  },

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

  statusRow: { flexDirection: 'row', gap: spacing.sm },
  statusBtn: {
    flex: 1, height: 46, borderRadius: 14,
    backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  statusBtnActive: { backgroundColor: colors.crema },
  statusBtnText: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: colors.gris },
  statusBtnTextActive: { color: '#FFFFFF' },

  errorText: {
    paddingHorizontal: spacing.xl,
    fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error,
  },

  ctaBlock: { paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryDisabled: { opacity: 0.35 },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
