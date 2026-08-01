import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  Modal, FlatList, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, spacing, fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';

type Mode = 'video' | 'foto';
type ReportType = 'contratistas' | 'oficina';

// ─── SearchPicker ─────────────────────────────────────────────────────────────

interface SearchPickerProps {
  label: string;
  placeholder: string;
  value: string | null;
  items: string[];
  onSelect: (item: string) => void;
  disabled?: boolean;
}

function SearchPicker({ label, placeholder, value, items, onSelect, disabled }: SearchPickerProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? items.filter((i) => i.toLowerCase().includes(query.toLowerCase()))
    : items;

  function handleSelect(item: string) {
    onSelect(item);
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      <TouchableOpacity
        style={[s.pickerField, disabled && s.pickerFieldDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={disabled ? 1 : 0.75}
      >
        <Text style={value ? s.pickerValue : s.pickerPlaceholder} numberOfLines={1}>
          {value ?? placeholder}
        </Text>
        {!disabled && <Feather name="chevron-down" size={16} color={colors.gris} />}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => { setOpen(false); setQuery(''); }}>
        <View style={s.sheetWrapper}>
          <TouchableOpacity style={s.backdrop} onPress={() => { setOpen(false); setQuery(''); }} activeOpacity={1} />
          <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
            {/* Handle */}
            <View style={s.handle} />

            {/* Header */}
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => { setOpen(false); setQuery(''); }} hitSlop={12}>
                <Feather name="x" size={18} color={colors.gris} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={s.searchRow}>
              <Feather name="search" size={15} color={colors.gris} />
              <TextInput
                style={s.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar…"
                placeholderTextColor={colors.faint}
                autoFocus
                selectionColor={colors.arena}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                  <Feather name="x-circle" size={15} color={colors.gris} />
                </TouchableOpacity>
              )}
            </View>

            {/* List */}
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              style={s.sheetList}
              renderItem={({ item }) => {
                const selected = item === value;
                return (
                  <TouchableOpacity
                    style={[s.sheetItem, selected && s.sheetItemSelected]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.sheetItemText, selected && s.sheetItemTextSelected]}>
                      {item}
                    </Text>
                    {selected && <Feather name="check" size={15} color={colors.arena} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={s.emptySearch}>
                  <Text style={s.emptySearchText}>Sin resultados para "{query}"</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── LockedField ──────────────────────────────────────────────────────────────

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.lockedField}>
        <Text style={s.pickerValue} numberOfLines={1}>{value}</Text>
        <Feather name="lock" size={13} color={colors.faint} />
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NuevaGrabacionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ projectId?: string; projectName?: string; rubroName?: string; rubroId?: string }>();

  const lockedProjectId = params.projectId ?? null;
  const lockedProjectName = params.projectName ?? null;
  const lockedRubroName = params.rubroName ?? null;
  const lockedRubroId = params.rubroId ?? null;

  const [mode, setMode] = useState<Mode>('video');
  const [reportType, setReportType] = useState<ReportType>('contratistas');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(lockedProjectId ?? null);
  const [selectedRubro, setSelectedRubro] = useState<string | null>(lockedRubroName ?? null);
  const [selectedRubroId, setSelectedRubroId] = useState<string | null>(lockedRubroId ?? null);
  const [note, setNote] = useState('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [dbProjects, setDbProjects] = useState<{ id: string; name: string }[]>([]);
  const [dbRubros, setDbRubros] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from('projects').select('id, name').then(({ data }) => setDbProjects(data ?? []));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) { setDbRubros([]); return; }
    supabase.from('rubros').select('id, name').eq('project_id', selectedProjectId)
      .then(({ data }) => setDbRubros(data ?? []));
  }, [selectedProjectId]);

  const selectedProjectName = dbProjects.find((p) => p.id === selectedProjectId)?.name ?? null;
  const projectNames = dbProjects.map((p) => p.name);
  const rubroNames = dbRubros.map((r) => r.name);

  const canContinue = selectedProjectId && selectedRubro && (
    mode === 'video' ? videoUri !== null : photoUri !== null
  );

  function handleSelectProject(name: string) {
    const p = dbProjects.find((p) => p.name === name);
    if (p) { setSelectedProjectId(p.id); setSelectedRubro(null); setSelectedRubroId(null); }
  }

  function handleSelectRubro(name: string) {
    const r = dbRubros.find((r) => r.name === name);
    if (r) { setSelectedRubro(r.name); setSelectedRubroId(r.id); }
  }

  async function handleRecordVideo() {
    const camPerm = await ImagePicker.requestCameraPermissionsAsync();
    if (camPerm.status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara y el micrófono para grabar videos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 600,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setVideoUri(result.assets[0].uri);
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara para tomar fotos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  async function handlePickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === 'foto' ? ['images'] : ['videos'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      if (mode === 'foto') setPhotoUri(result.assets[0].uri);
      else setVideoUri(result.assets[0].uri);
    }
  }

  async function handlePickFromFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      type: mode === 'foto' ? 'image/*' : 'video/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets.length > 0) {
      if (mode === 'foto') setPhotoUri(result.assets[0].uri);
      else setVideoUri(result.assets[0].uri);
    }
  }

  function handleContinue() {
    if (mode === 'foto' && photoUri) {
      router.push({
        pathname: '/editar-foto',
        params: { uri: photoUri, project: selectedProjectId ?? '', rubro: selectedRubro ?? '', type: reportType },
      });
    } else if (videoUri) {
      router.replace({
        pathname: '/procesando',
        params: {
          mode: 'video',
          type: reportType,
          videoUri,
          projectId: selectedProjectId ?? '',
          rubroId: selectedRubroId ?? '',
          note: note.trim(),
        },
      });
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top row */}
        <View style={s.topRow}>
          <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="x" size={16} color={colors.crema} />
          </TouchableOpacity>
          <Text style={s.topLabel}>{selectedRubro ?? 'Nuevo informe'}</Text>
          <View style={{ width: 42 }} />
        </View>

        {/* Mode toggle */}
        <View style={s.modeToggle}>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'video' && s.modeBtnActive]}
            onPress={() => { setMode('video'); setPhotoUri(null); }}
            activeOpacity={0.8}
          >
            <Feather name="video" size={14} color={mode === 'video' ? '#FFFFFF' : colors.gris} />
            <Text style={[s.modeBtnText, mode === 'video' && s.modeBtnTextActive]}>Video</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.modeBtn, mode === 'foto' && s.modeBtnActive]}
            onPress={() => { setMode('foto'); setVideoUri(null); }}
            activeOpacity={0.8}
          >
            <Feather name="camera" size={14} color={mode === 'foto' ? '#FFFFFF' : colors.gris} />
            <Text style={[s.modeBtnText, mode === 'foto' && s.modeBtnTextActive]}>Foto</Text>
          </TouchableOpacity>
        </View>

        {/* Capture zone */}
        {mode === 'video' ? (
          <TouchableOpacity style={s.captureZone} onPress={handleRecordVideo} activeOpacity={0.85}>
            <View style={[s.captureCircle, videoUri && s.captureCircleDone]}>
              <Feather name={videoUri ? 'check' : 'video'} size={26} color="#FFFFFF" />
            </View>
            <Text style={s.captureTitle}>{videoUri ? 'Video grabado' : 'Grabar recorrido'}</Text>
            <Text style={s.captureHint}>{videoUri ? 'Toca para volver a grabar' : 'Toca para abrir la cámara'}</Text>
          </TouchableOpacity>
        ) : photoUri ? (
          <TouchableOpacity style={s.photoPreviewWrap} onPress={handleTakePhoto} activeOpacity={0.9}>
            <Image source={{ uri: photoUri }} style={s.photoPreview} resizeMode="cover" />
            <View style={s.photoRetakeOverlay}>
              <Feather name="refresh-cw" size={18} color="#FFFFFF" />
              <Text style={s.photoRetakeText}>Retomar</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.captureZone} onPress={handleTakePhoto} activeOpacity={0.85}>
            <View style={s.captureCircle}>
              <Feather name="camera" size={26} color="#FFFFFF" />
            </View>
            <Text style={s.captureTitle}>Tomar foto</Text>
            <Text style={s.captureHint}>Toca para abrir la cámara</Text>
          </TouchableOpacity>
        )}

        {/* Gallery / files */}
        <View style={s.pickRow}>
          <TouchableOpacity style={[s.pickBtn, { flex: 1 }]} onPress={handlePickFromGallery} activeOpacity={0.85}>
            <Feather name="image" size={16} color={colors.crema} />
            <Text style={s.pickBtnText}>Galería</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.pickBtn, { flex: 1 }]} onPress={handlePickFromFiles} activeOpacity={0.85}>
            <Feather name="folder" size={16} color={colors.crema} />
            <Text style={s.pickBtnText}>Archivos</Text>
          </TouchableOpacity>
        </View>

        {/* Project */}
        {lockedProjectId && lockedProjectName ? (
          <LockedField label="PROYECTO" value={lockedProjectName} />
        ) : (
          <SearchPicker
            label="PROYECTO"
            placeholder="Seleccionar proyecto…"
            value={selectedProjectName}
            items={projectNames}
            onSelect={handleSelectProject}
          />
        )}

        {/* Obra */}
        {lockedRubroName ? (
          <LockedField label="RUBRO" value={lockedRubroName} />
        ) : (
          <SearchPicker
            label="RUBRO"
            placeholder={selectedProjectId ? 'Seleccionar rubro…' : 'Primero elegí un proyecto'}
            value={selectedRubro}
            items={rubroNames}
            onSelect={handleSelectRubro}
            disabled={!selectedProjectId}
          />
        )}

        {/* Report type */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>TIPO DE INFORME</Text>
          <View style={s.optionsList}>
            {([
              { key: 'contratistas', label: 'Informe contratistas', sub: 'Para los gremios en obra' },
              { key: 'oficina',      label: 'Observación oficina técnica', sub: 'Para el equipo de proyecto' },
            ] as { key: ReportType; label: string; sub: string }[]).map((t) => (
              <TouchableOpacity
                key={t.key}
                style={[s.option, reportType === t.key && s.optionSelected]}
                onPress={() => setReportType(t.key)}
                activeOpacity={0.8}
              >
                <View style={[s.optionDot, reportType === t.key && s.optionDotActive]} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionText, reportType === t.key && s.optionTextActive]}>{t.label}</Text>
                  <Text style={s.optionSub}>{t.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Note */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>NOTA OPCIONAL</Text>
          <View style={s.noteField}>
            <TextInput
              style={s.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Ej. revisar humedad en muro sur…"
              placeholderTextColor={colors.faint}
              multiline
              numberOfLines={3}
              selectionColor={colors.crema}
            />
          </View>
        </View>

        {/* CTA */}
        <View style={s.ctaBlock}>
          <TouchableOpacity
            style={[s.btnPrimary, !canContinue && s.btnPrimaryDisabled]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={!canContinue}
          >
            <Text style={s.btnPrimaryText}>
              {mode === 'foto' ? 'Anotar foto  →' : 'Procesar informe  →'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  scrollContent: { paddingBottom: 40, gap: spacing.lg },

  topRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  topLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },

  modeToggle: {
    flexDirection: 'row', marginHorizontal: spacing.xl,
    backgroundColor: colors.chip, borderRadius: 24, padding: 4, gap: 4,
  },
  modeBtn: {
    flex: 1, height: 42, borderRadius: 21, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  modeBtnActive: { backgroundColor: colors.crema },
  modeBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.gris },
  modeBtnTextActive: { color: '#FFFFFF' },

  captureZone: {
    marginHorizontal: spacing.xl, height: 220, borderRadius: 28,
    backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  captureCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  captureCircleDone: {
    backgroundColor: 'rgba(74,180,120,0.35)',
  },
  captureTitle: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF' },
  captureHint: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 0.6,
    textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontWeight: '700',
  },

  photoPreviewWrap: { marginHorizontal: spacing.xl, height: 220, borderRadius: 28, overflow: 'hidden' },
  photoPreview: { width: '100%', height: '100%' },
  photoRetakeOverlay: {
    position: 'absolute', bottom: 14, right: 14,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(18,21,26,0.65)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  photoRetakeText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: '#FFFFFF' },

  pickRow: {
    flexDirection: 'row', marginHorizontal: spacing.xl, gap: spacing.sm,
  },
  pickBtn: {
    height: 52, borderRadius: 26,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.panel,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  pickBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema },

  section: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },

  // Compact trigger field
  pickerField: {
    height: 52, borderRadius: 16, backgroundColor: colors.panel,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  pickerFieldDisabled: { opacity: 0.45 },
  pickerValue: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema, flex: 1 },
  pickerPlaceholder: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.faint, flex: 1 },

  // Locked field (pre-filled from navigation)
  lockedField: {
    height: 52, borderRadius: 16, backgroundColor: colors.panel,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3, borderLeftColor: colors.arena,
  },

  // Bottom sheet modal
  sheetWrapper: { flex: 1, backgroundColor: 'rgba(18,21,26,0.45)' },
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12, maxHeight: '82%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, marginBottom: spacing.md,
  },
  sheetTitle: { fontFamily: fonts.archivo.bold, fontSize: 16, color: colors.crema },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    marginHorizontal: spacing.xl, marginBottom: spacing.sm,
    height: 44, borderRadius: 14, backgroundColor: colors.chip,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    flex: 1, fontFamily: fonts.archivo.semibold, fontSize: 14,
    color: colors.crema, paddingVertical: 0,
  },

  sheetList: { flexGrow: 0 },
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetItemSelected: { backgroundColor: 'rgba(217,119,87,0.06)' },
  sheetItemText: { fontFamily: fonts.archivo.semibold, fontSize: 14.5, color: colors.crema },
  sheetItemTextSelected: { fontFamily: fonts.archivo.bold, color: colors.arena },

  emptySearch: { paddingVertical: 32, alignItems: 'center' },
  emptySearchText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.gris },

  // Report type (kept as inline toggle — only 2 opciones, escala bien)
  optionsList: {
    borderRadius: 20, backgroundColor: colors.panel, overflow: 'hidden',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  optionSelected: { backgroundColor: 'rgba(217,119,87,0.07)', borderLeftWidth: 3, borderLeftColor: colors.arena },
  optionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.faint },
  optionDotActive: { backgroundColor: colors.arena },
  optionText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema },
  optionTextActive: { fontFamily: fonts.archivo.bold, color: colors.crema },
  optionSub: { fontFamily: fonts.archivo.semibold, fontSize: 11.5, color: colors.gris, marginTop: 1 },

  noteField: { borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  noteInput: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema, minHeight: 60 },

  ctaBlock: { paddingHorizontal: spacing.xl },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryDisabled: { backgroundColor: colors.faint },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
