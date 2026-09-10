import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SlidingTabs } from '../../components/SlidingTabs';
import { BottomSheet } from '../../components/BottomSheet';
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

interface DbHito {
  id: string;
  name: string;
  date: string | null;
  done: boolean;
  qty_used: number | null;
  material_id: string | null;
  materials: { name: string; unit: string | null } | null;
}

interface DbMaterial {
  id: string;
  name: string;
  unit: string | null;
}

function parseDateParam(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw.length === 10 ? raw + 'T12:00:00' : raw);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();
}

export default function EditarRubroScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string; projectId: string; name: string; contractor: string;
    code: string; status: RubroStatus; startDate: string; endDate: string;
  }>();

  const rubroId   = Array.isArray(params.id)        ? params.id[0]        : params.id;
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;

  // Edit form state
  const [name,       setName]       = useState(params.name       ?? '');
  const [contractor, setContractor] = useState(params.contractor ?? '');
  const [code,       setCode]       = useState(params.code       ?? '');
  const [status,     setStatus]     = useState<RubroStatus>(params.status ?? 'sin_iniciar');
  const [startDate,  setStartDate]  = useState<Date | null>(parseDateParam(params.startDate));
  const [endDate,    setEndDate]    = useState<Date | null>(parseDateParam(params.endDate));
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Hitos state
  const [hitos,           setHitos]           = useState<DbHito[]>([]);
  const [materials,       setMaterials]       = useState<DbMaterial[]>([]);
  const [hitoSheet,       setHitoSheet]       = useState(false);
  const [hitoName,        setHitoName]        = useState('');
  const [hitoDate,        setHitoDate]        = useState<Date | null>(null);
  const [hitoMaterialId,  setHitoMaterialId]  = useState<string | null>(null);
  const [hitoQty,         setHitoQty]         = useState('');
  const [savingHito,      setSavingHito]       = useState(false);

  const canSave      = name.trim().length > 0;
  const canSaveHito  = hitoName.trim().length > 0;

  useEffect(() => {
    if (!rubroId) return;
    Promise.all([
      supabase.from('hitos').select('id, name, date, done, qty_used, material_id, materials(name, unit)')
        .eq('rubro_id', rubroId).order('created_at'),
      supabase.from('materials').select('id, name, unit')
        .eq('rubro_id', rubroId).order('name'),
    ]).then(([hitosRes, matsRes]) => {
      setHitos((hitosRes.data as DbHito[]) ?? []);
      setMaterials((matsRes.data as DbMaterial[]) ?? []);
    });
  }, [rubroId]);

  async function handleSave() {
    if (!canSave || !rubroId) return;
    setLoading(true);
    setError(null);

    const finalCode = code.trim() || `RB-${String(Math.floor(Math.random() * 900) + 100)}`;
    const prevStatus = (params.status ?? 'sin_iniciar') as RubroStatus;
    const today = new Date().toISOString().slice(0, 10);

    const dateCapture: { actual_start_date?: string; actual_end_date?: string | null } = {};
    if (prevStatus !== 'en_curso' && prevStatus !== 'completada' && status === 'en_curso') {
      dateCapture.actual_start_date = today;
    }
    if (prevStatus !== 'completada' && status === 'completada') {
      dateCapture.actual_end_date = today;
      if (prevStatus === 'sin_iniciar') dateCapture.actual_start_date = today;
    }
    if (prevStatus === 'completada' && status !== 'completada') {
      dateCapture.actual_end_date = null;
    }

    const { error: dbError } = await supabase.from('rubros').update({
      name: name.trim(), contractor: contractor.trim() || null,
      code: finalCode, status,
      start_date: startDate ? startDate.toISOString().slice(0, 10) : null,
      end_date:   endDate   ? endDate.toISOString().slice(0, 10)   : null,
      ...dateCapture,
    }).eq('id', rubroId);

    setLoading(false);
    if (dbError) { setError('No se pudo guardar. Intentá de nuevo.'); return; }
    router.back();
  }

  function handleDelete() {
    Alert.alert('Eliminar rubro', `¿Eliminar "${name}"? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const { error: dbError } = await supabase.from('rubros').delete().eq('id', rubroId);
          if (dbError) { Alert.alert('Error', 'No se pudo eliminar el rubro.'); return; }
          router.back();
          router.back();
        },
      },
    ]);
  }

  async function handleToggleHito(hito: DbHito) {
    const newDone = !hito.done;
    setHitos(prev => prev.map(h => h.id === hito.id ? { ...h, done: newDone } : h));
    await supabase.from('hitos').update({ done: newDone }).eq('id', hito.id);
  }

  async function handleAddHito() {
    if (!canSaveHito || !rubroId || !projectId) return;
    setSavingHito(true);

    const { data, error: dbError } = await supabase.from('hitos').insert({
      rubro_id:    rubroId,
      project_id:  projectId,
      name:        hitoName.trim(),
      date:        hitoDate ? hitoDate.toISOString().slice(0, 10) : null,
      material_id: hitoMaterialId || null,
      qty_used:    hitoQty ? parseFloat(hitoQty) : null,
    }).select('id, name, date, done, qty_used, material_id, materials(name, unit)').single();

    setSavingHito(false);
    if (dbError || !data) return;

    setHitos(prev => [...prev, data as DbHito]);
    setHitoSheet(false);
    setHitoName('');
    setHitoDate(null);
    setHitoMaterialId(null);
    setHitoQty('');
  }

  async function handleDeleteHito(id: string) {
    setHitos(prev => prev.filter(h => h.id !== id));
    await supabase.from('hitos').delete().eq('id', id);
  }

  const selectedMaterial = materials.find(m => m.id === hitoMaterialId) ?? null;

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
            style={s.input} value={name} onChangeText={setName}
            placeholder="Ej. Instalaciones Eléctricas"
            placeholderTextColor={colors.faint} selectionColor={colors.arena} returnKeyType="next"
          />
        </View>

        {/* Contratista */}
        <View style={s.field}>
          <View style={s.fieldLabelRow}>
            <Text style={s.fieldLabel}>CONTRATISTA</Text>
            <Text style={s.fieldBadge}>aparece en informes</Text>
          </View>
          <TextInput
            style={s.input} value={contractor} onChangeText={setContractor}
            placeholder="Ej. Electro Sur S.A."
            placeholderTextColor={colors.faint} selectionColor={colors.arena} returnKeyType="next"
          />
        </View>

        {/* Código */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>CÓDIGO <Text style={s.fieldOptional}>(opcional)</Text></Text>
          <TextInput
            style={s.input} value={code} onChangeText={setCode}
            placeholder="Ej. RB-001"
            placeholderTextColor={colors.faint} selectionColor={colors.arena}
            autoCapitalize="characters" returnKeyType="done"
          />
        </View>

        {/* Fechas */}
        <View style={s.field}>
          <DateField label="FECHA DE INICIO" value={startDate} onChange={setStartDate}
            placeholder="Seleccionar fecha" maximumDate={endDate ?? undefined} />
        </View>
        <View style={s.field}>
          <DateField label="FECHA DE FIN" value={endDate} onChange={setEndDate}
            placeholder="Seleccionar fecha" minimumDate={startDate ?? undefined} />
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

        {/* CTA */}
        <View style={s.ctaBlock}>
          <TouchableOpacity
            style={[s.btnPrimary, (!canSave || loading) && s.btnPrimaryDisabled]}
            onPress={handleSave} activeOpacity={0.85} disabled={!canSave || loading}
          >
            {loading
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={s.btnPrimaryText}>Guardar cambios</Text>
            }
          </TouchableOpacity>
        </View>

        {/* ── Hitos ───────────────────────────────────────────── */}
        <View style={s.hitosDivider}>
          <Text style={s.hitosDividerLabel}>HITOS</Text>
          <View style={s.hitosDividerLine} />
        </View>

        {hitos.length === 0 ? (
          <View style={s.hitosEmpty}>
            <Text style={s.hitosEmptyText}>Sin hitos registrados</Text>
          </View>
        ) : (
          <View style={s.hitosList}>
            {hitos.map((h) => (
              <View key={h.id} style={s.hitoRow}>
                <TouchableOpacity onPress={() => handleToggleHito(h)} activeOpacity={0.7} hitSlop={8}>
                  <Feather
                    name={h.done ? 'check-circle' : 'circle'}
                    size={20}
                    color={h.done ? colors.success : colors.border}
                  />
                </TouchableOpacity>

                <View style={s.hitoBody}>
                  <Text style={[s.hitoName, h.done && s.hitoNameDone]}>{h.name}</Text>
                  <View style={s.hitoMeta}>
                    {h.date && (
                      <Text style={s.hitoMetaText}>{formatDate(h.date)}</Text>
                    )}
                    {h.materials && h.qty_used != null && (
                      <>
                        {h.date && <Text style={s.hitoMetaDot}>·</Text>}
                        <Text style={s.hitoMetaText}>
                          {h.qty_used} {h.materials.unit ?? ''} {h.materials.name}
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                <TouchableOpacity onPress={() => handleDeleteHito(h.id)} activeOpacity={0.7} hitSlop={8}>
                  <Feather name="x" size={15} color={colors.faint} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={s.addHitoBtn} onPress={() => setHitoSheet(true)} activeOpacity={0.8}>
          <Feather name="plus" size={15} color={colors.arena} />
          <Text style={s.addHitoBtnText}>Agregar hito</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Sheet: nuevo hito ───────────────────────────────── */}
      <BottomSheet visible={hitoSheet} onClose={() => setHitoSheet(false)} avoidKeyboard>
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Nuevo hito</Text>

          {/* Nombre */}
          <View style={s.sheetField}>
            <Text style={s.sheetLabel}>NOMBRE</Text>
            <TextInput
              style={s.sheetInput}
              value={hitoName} onChangeText={setHitoName}
              placeholder="Ej. Hormigonado de losa"
              placeholderTextColor={colors.faint} selectionColor={colors.arena}
              autoFocus returnKeyType="next"
            />
          </View>

          {/* Fecha */}
          <View style={s.sheetField}>
            <DateField label="FECHA" value={hitoDate} onChange={setHitoDate} placeholder="Sin fecha" />
          </View>

          {/* Material */}
          {materials.length > 0 && (
            <View style={s.sheetField}>
              <Text style={s.sheetLabel}>MATERIAL USADO <Text style={s.sheetOptional}>(opcional)</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.matChipRow}>
                <TouchableOpacity
                  style={[s.matChip, hitoMaterialId === null && s.matChipActive]}
                  onPress={() => { setHitoMaterialId(null); setHitoQty(''); }}
                  activeOpacity={0.75}
                >
                  <Text style={[s.matChipText, hitoMaterialId === null && s.matChipTextActive]}>Ninguno</Text>
                </TouchableOpacity>
                {materials.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    style={[s.matChip, hitoMaterialId === m.id && s.matChipActive]}
                    onPress={() => setHitoMaterialId(m.id)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.matChipText, hitoMaterialId === m.id && s.matChipTextActive]} numberOfLines={1}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Cantidad (solo si hay material seleccionado) */}
          {hitoMaterialId && selectedMaterial && (
            <View style={s.sheetField}>
              <Text style={s.sheetLabel}>CANTIDAD {selectedMaterial.unit ? `(${selectedMaterial.unit})` : ''}</Text>
              <TextInput
                style={s.sheetInput}
                value={hitoQty} onChangeText={setHitoQty}
                placeholder="0"
                placeholderTextColor={colors.faint} selectionColor={colors.arena}
                keyboardType="decimal-pad"
              />
            </View>
          )}

          <TouchableOpacity
            style={[s.sheetBtn, (!canSaveHito || savingHito) && s.sheetBtnDisabled]}
            onPress={handleAddHito} activeOpacity={0.85}
            disabled={!canSaveHito || savingHito}
          >
            {savingHito
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={s.sheetBtnText}>Guardar hito</Text>
            }
          </TouchableOpacity>
        </View>
      </BottomSheet>
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
  circleBtnDestructive: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  topLabel: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },

  codeRow: { paddingHorizontal: spacing.xl },
  codeText: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gris },

  field: { paddingHorizontal: spacing.xl },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  fieldLabel: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gris, fontWeight: '700', marginBottom: spacing.sm },
  fieldOptional: { color: colors.faint, textTransform: 'none', letterSpacing: 0 },
  fieldBadge: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 0.5, color: colors.arena, textTransform: 'uppercase', marginBottom: spacing.sm },
  input: {
    height: 52, borderRadius: 16, backgroundColor: colors.panel,
    paddingHorizontal: spacing.md, fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  errorText: { paddingHorizontal: spacing.xl, fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error },

  ctaBlock: { paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryDisabled: { opacity: 0.35 },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },

  // ── Hitos ──
  hitosDivider: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  hitosDividerLabel: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.gris, flexShrink: 0 },
  hitosDividerLine: { flex: 1, height: 1, backgroundColor: colors.border },

  hitosEmpty: { paddingHorizontal: spacing.xl },
  hitosEmptyText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.faint },

  hitosList: { paddingHorizontal: spacing.xl, gap: 0 },
  hitoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  hitoBody: { flex: 1, gap: 3 },
  hitoName: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema },
  hitoNameDone: { color: colors.gris, textDecorationLine: 'line-through' },
  hitoMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  hitoMetaText: { fontFamily: fonts.mono.regular, fontSize: 10, color: colors.gris, letterSpacing: 0.3 },
  hitoMetaDot: { fontFamily: fonts.mono.regular, fontSize: 10, color: colors.faint },

  addHitoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  addHitoBtnText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.arena },

  // ── Sheet ──
  sheet: {
    backgroundColor: colors.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl, paddingBottom: 36, paddingTop: 12, gap: spacing.lg,
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: 4 },
  sheetTitle: { fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema, letterSpacing: -0.3 },
  sheetField: { gap: 0 },
  sheetLabel: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.gris, fontWeight: '700', marginBottom: spacing.sm },
  sheetOptional: { color: colors.faint, textTransform: 'none', letterSpacing: 0 },
  sheetInput: {
    height: 52, borderRadius: 16, backgroundColor: colors.chip,
    paddingHorizontal: spacing.md, fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema,
  },
  matChipRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: 4 },
  matChip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
  matChipActive: { backgroundColor: colors.crema },
  matChipText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.gris },
  matChipTextActive: { color: '#FFFFFF' },
  sheetBtn: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  sheetBtnDisabled: { opacity: 0.35 },
  sheetBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
