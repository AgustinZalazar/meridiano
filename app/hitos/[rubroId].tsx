import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { DateField } from '../../components/DateField';
import { supabase } from '../../lib/supabase';

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

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();
}

export default function HitosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ rubroId: string; rubroName: string; projectId: string }>();
  const rubroId   = Array.isArray(params.rubroId)   ? params.rubroId[0]   : params.rubroId;
  const projectId = Array.isArray(params.projectId) ? params.projectId[0] : params.projectId;
  const rubroName = Array.isArray(params.rubroName) ? params.rubroName[0] : params.rubroName;

  const [hitos,          setHitos]          = useState<DbHito[]>([]);
  const [materials,      setMaterials]      = useState<DbMaterial[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [hitoSheet,      setHitoSheet]      = useState(false);
  const [hitoName,       setHitoName]       = useState('');
  const [hitoDate,       setHitoDate]       = useState<Date | null>(null);
  const [hitoMaterialId, setHitoMaterialId] = useState<string | null>(null);
  const [hitoQty,        setHitoQty]        = useState('');
  const [savingHito,     setSavingHito]     = useState(false);

  const canSaveHito = hitoName.trim().length > 0;
  const selectedMaterial = materials.find(m => m.id === hitoMaterialId) ?? null;

  useEffect(() => {
    if (!rubroId) return;
    Promise.all([
      supabase.from('hitos')
        .select('id, name, date, done, qty_used, material_id, materials(name, unit)')
        .eq('rubro_id', rubroId).order('date', { ascending: true, nullsFirst: false }),
      supabase.from('materials')
        .select('id, name, unit').eq('rubro_id', rubroId).order('name'),
    ]).then(([hitosRes, matsRes]) => {
      setHitos((hitosRes.data as DbHito[]) ?? []);
      setMaterials((matsRes.data as DbMaterial[]) ?? []);
      setLoading(false);
    });
  }, [rubroId]);

  async function handleToggle(hito: DbHito) {
    const newDone = !hito.done;
    setHitos(prev => prev.map(h => h.id === hito.id ? { ...h, done: newDone } : h));
    await supabase.from('hitos').update({ done: newDone }).eq('id', hito.id);
  }

  async function handleDelete(id: string) {
    setHitos(prev => prev.filter(h => h.id !== id));
    await supabase.from('hitos').delete().eq('id', id);
  }

  function openSheet() {
    setHitoName('');
    setHitoDate(null);
    setHitoMaterialId(null);
    setHitoQty('');
    setHitoSheet(true);
  }

  async function handleAdd() {
    if (!canSaveHito || !rubroId || !projectId) return;
    setSavingHito(true);

    const { data, error } = await supabase.from('hitos').insert({
      rubro_id:    rubroId,
      project_id:  projectId,
      name:        hitoName.trim(),
      date:        hitoDate ? hitoDate.toISOString().slice(0, 10) : null,
      material_id: hitoMaterialId || null,
      qty_used:    hitoQty ? parseFloat(hitoQty) : null,
    }).select('id, name, date, done, qty_used, material_id, materials(name, unit)').single();

    setSavingHito(false);
    if (error || !data) return;

    setHitos(prev => [...prev, data as DbHito]);
    setHitoSheet(false);
  }

  const done  = hitos.filter(h => h.done).length;
  const total = hitos.length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>

      {/* Top bar */}
      <View style={s.topRow}>
        <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={16} color={colors.crema} />
        </TouchableOpacity>
        <View style={s.topCenter}>
          <Text style={s.topLabel} numberOfLines={1}>Hitos</Text>
          {rubroName ? <Text style={s.topSub} numberOfLines={1}>{rubroName}</Text> : null}
        </View>
        <TouchableOpacity style={[s.circleBtn, s.circleBtnAccent]} onPress={openSheet} activeOpacity={0.8}>
          <Feather name="plus" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Progress */}
      {total > 0 && (
        <View style={s.progressWrap}>
          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: `${Math.round((done / total) * 100)}%` }]} />
          </View>
          <Text style={s.progressText}>{done}/{total} completados</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {loading ? (
          <ActivityIndicator color={colors.gris} style={{ marginTop: 40 }} />
        ) : hitos.length === 0 ? (
          <View style={s.empty}>
            <Feather name="check-square" size={32} color={colors.faint} />
            <Text style={s.emptyTitle}>Sin hitos todavía</Text>
            <Text style={s.emptyHint}>Los hitos registran cuándo se hizo cada actividad y qué material usó.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={openSheet} activeOpacity={0.85}>
              <Feather name="plus" size={14} color="#FFFFFF" />
              <Text style={s.emptyBtnText}>Agregar primer hito</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.list}>
            {hitos.map((h) => (
              <View key={h.id} style={s.hitoCard}>
                <TouchableOpacity onPress={() => handleToggle(h)} activeOpacity={0.7} hitSlop={8}>
                  <Feather
                    name={h.done ? 'check-circle' : 'circle'}
                    size={22}
                    color={h.done ? colors.success : colors.border}
                  />
                </TouchableOpacity>

                <View style={s.hitoBody}>
                  <Text style={[s.hitoName, h.done && s.hitoNameDone]}>{h.name}</Text>
                  <View style={s.hitoMeta}>
                    {h.date && (
                      <View style={s.metaChip}>
                        <Feather name="calendar" size={10} color={colors.gris} />
                        <Text style={s.metaChipText}>{formatDate(h.date)}</Text>
                      </View>
                    )}
                    {h.materials && h.qty_used != null && (
                      <View style={s.metaChip}>
                        <Feather name="package" size={10} color={colors.gris} />
                        <Text style={s.metaChipText}>
                          {h.qty_used} {h.materials.unit ?? ''} · {h.materials.name}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity onPress={() => handleDelete(h.id)} activeOpacity={0.7} hitSlop={8}>
                  <Feather name="trash-2" size={14} color={colors.faint} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sheet: nuevo hito */}
      <BottomSheet visible={hitoSheet} onClose={() => setHitoSheet(false)} avoidKeyboard>
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Nuevo hito</Text>

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

          <View style={s.sheetField}>
            <DateField label="FECHA" value={hitoDate} onChange={setHitoDate} placeholder="Sin fecha" />
          </View>

          {materials.length > 0 && (
            <View style={s.sheetField}>
              <Text style={s.sheetLabel}>MATERIAL USADO <Text style={s.sheetOptional}>(opcional)</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.matRow}>
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

          {hitoMaterialId && selectedMaterial && (
            <View style={s.sheetField}>
              <Text style={s.sheetLabel}>CANTIDAD{selectedMaterial.unit ? ` (${selectedMaterial.unit})` : ''}</Text>
              <TextInput
                style={s.sheetInput}
                value={hitoQty} onChangeText={setHitoQty}
                placeholder="0" placeholderTextColor={colors.faint}
                selectionColor={colors.arena} keyboardType="decimal-pad"
              />
            </View>
          )}

          <TouchableOpacity
            style={[s.sheetBtn, (!canSaveHito || savingHito) && s.sheetBtnDisabled]}
            onPress={handleAdd} activeOpacity={0.85}
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

  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  circleBtnAccent: { backgroundColor: colors.crema, shadowColor: colors.crema, shadowOpacity: 0.25 },
  topCenter: { flex: 1, alignItems: 'center', gap: 2, marginHorizontal: spacing.sm },
  topLabel: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  topSub: { fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 0.4, color: colors.gris },

  progressWrap: {
    paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, gap: 6,
    flexDirection: 'row', alignItems: 'center',
  },
  progressBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: colors.success },
  progressText: { fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.3, color: colors.gris, minWidth: 80, textAlign: 'right' },

  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: 48 },

  empty: { alignItems: 'center', marginTop: 60, gap: 12, paddingHorizontal: spacing.xl },
  emptyTitle: { fontFamily: fonts.archivo.bold, fontSize: 16, color: colors.crema },
  emptyHint: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.gris, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 44, paddingHorizontal: 22, borderRadius: 22,
    backgroundColor: colors.crema, marginTop: spacing.sm,
  },
  emptyBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: '#FFFFFF' },

  list: { gap: 0 },
  hitoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  hitoBody: { flex: 1, gap: 6 },
  hitoName: { fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema, lineHeight: 20 },
  hitoNameDone: { color: colors.gris, textDecorationLine: 'line-through' },
  hitoMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.chip, borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  metaChipText: { fontFamily: fonts.mono.regular, fontSize: 10, color: colors.gris, letterSpacing: 0.2 },

  // Sheet
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
  matRow: { flexDirection: 'row', gap: spacing.sm, paddingRight: 4 },
  matChip: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
  matChipActive: { backgroundColor: colors.crema },
  matChipText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.gris },
  matChipTextActive: { color: '#FFFFFF' },
  sheetBtn: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  sheetBtnDisabled: { opacity: 0.35 },
  sheetBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
