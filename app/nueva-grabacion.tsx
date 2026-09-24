import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image,
  FlatList, Alert,
} from 'react-native';
import { BottomSheet } from '../components/BottomSheet';
import { ProjectPlaceholder } from '../components/ProjectPlaceholder';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, spacing, fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';

type Mode = 'video' | 'foto';
type ReportType = 'contratistas' | 'oficina';

type PropertyType = 'edificio' | 'casa' | 'local_comercial' | 'oficina' | 'nave_industrial' | 'otro';

interface DbProject {
  id: string;
  name: string;
  image_url: string | null;
  rubros: { status: string }[];
  property_type: PropertyType | null;
  pisos: number | null;
}

// ─── ProjectPickerSheet ───────────────────────────────────────────────────────

function ProjectPickerSheet({
  visible, projects, selectedId, onSelect, onClose, onCreateNew,
}: {
  visible: boolean;
  projects: DbProject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onCreateNew: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const showSearch = projects.length > 5;
  const filtered = query.trim()
    ? projects.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : projects;

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} avoidKeyboard>
      <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.handle} />

        <View style={s.sheetHeader}>
          <Text style={s.sheetTitle}>Proyecto</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={12}>
            <Feather name="x" size={18} color={colors.gris} />
          </TouchableOpacity>
        </View>

        {showSearch && (
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
        )}

        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          keyboardShouldPersistTaps="handled"
          style={s.sheetList}
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            const activeCount = item.rubros.filter((r) => r.status === 'en_curso').length;
            return (
              <TouchableOpacity
                style={[s.projectItem, selected && s.projectItemSelected]}
                onPress={() => { onSelect(item.id); setQuery(''); }}
                activeOpacity={0.7}
              >
                <View style={s.projectThumb}>
                  {item.image_url
                    ? <Image source={{ uri: item.image_url }} style={s.projectThumbImg} />
                    : <ProjectPlaceholder variant="card" />
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.projectName, selected && s.projectNameSelected]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={s.projectMeta}>
                    {activeCount > 0
                      ? `${activeCount} rubro${activeCount > 1 ? 's' : ''} en curso`
                      : 'Sin rubros activos'
                    }
                  </Text>
                </View>
                {selected
                  ? <Feather name="check" size={15} color={colors.arena} />
                  : <Feather name="chevron-right" size={16} color={colors.faint} />
                }
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={s.emptyStateText}>
                {query ? `Sin resultados para "${query}"` : 'No tenés proyectos todavía'}
              </Text>
            </View>
          }
          ListFooterComponent={
            <TouchableOpacity style={s.createRow} onPress={onCreateNew} activeOpacity={0.7}>
              <Feather name="plus-circle" size={16} color={colors.arena} />
              <Text style={s.createRowText}>Crear proyecto nuevo</Text>
            </TouchableOpacity>
          }
        />
      </View>
    </BottomSheet>
  );
}

// ─── SearchPicker (rubros — lista simple) ─────────────────────────────────────

function SearchPicker({ label, placeholder, value, items, onSelect, disabled }: {
  label: string;
  placeholder: string;
  value: string | null;
  items: string[];
  onSelect: (item: string) => void;
  disabled?: boolean;
}) {
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

      <BottomSheet visible={open} onClose={() => { setOpen(false); setQuery(''); }}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
          <View style={s.handle} />
          <View style={s.sheetHeader}>
            <Text style={s.sheetTitle}>{label}</Text>
            <TouchableOpacity onPress={() => { setOpen(false); setQuery(''); }} hitSlop={12}>
              <Feather name="x" size={18} color={colors.gris} />
            </TouchableOpacity>
          </View>

          {items.length > 5 && (
            <View style={s.searchRow}>
              <Feather name="search" size={15} color={colors.gris} />
              <TextInput
                style={s.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar…"
                placeholderTextColor={colors.faint}
                selectionColor={colors.arena}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                  <Feather name="x-circle" size={15} color={colors.gris} />
                </TouchableOpacity>
              )}
            </View>
          )}

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
              <View style={s.emptyState}>
                <Text style={s.emptyStateText}>
                  {query ? `Sin resultados para "${query}"` : 'Sin rubros en este proyecto'}
                </Text>
              </View>
            }
          />
        </View>
      </BottomSheet>
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
  const params = useLocalSearchParams<{
    projectId?: string; projectName?: string; rubroName?: string; rubroId?: string;
    returnToInformeDia?: string;
  }>();

  const lockedProjectId          = params.projectId          ?? null;
  const lockedProjectName        = params.projectName        ?? null;
  const lockedRubroName          = params.rubroName          ?? null;
  const lockedRubroId            = params.rubroId            ?? null;
  const lockedReturnToInformeDia = params.returnToInformeDia ?? null;

  const [mode, setMode]             = useState<Mode>('video');
  const [reportType, setReportType] = useState<ReportType>('contratistas');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(lockedProjectId);
  const [selectedRubro, setSelectedRubro]         = useState<string | null>(lockedRubroName);
  const [selectedRubroId, setSelectedRubroId]     = useState<string | null>(lockedRubroId);
  const [note, setNote]     = useState('');
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [locationFloor, setLocationFloor] = useState<string | null>(null);
  const [locationUnit, setLocationUnit]   = useState('');

  const [dbProjects, setDbProjects] = useState<DbProject[]>([]);
  const [dbRubros, setDbRubros]     = useState<{ id: string; name: string }[]>([]);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  const [floorSheetOpen, setFloorSheetOpen]     = useState(false);

  useEffect(() => {
    supabase
      .from('projects')
      .select('id, name, image_url, rubros(status), property_type, pisos')
      .then(({ data }) => setDbProjects((data ?? []) as DbProject[]));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) { setDbRubros([]); return; }
    supabase.from('rubros').select('id, name').eq('project_id', selectedProjectId)
      .then(({ data }) => setDbRubros(data ?? []));
  }, [selectedProjectId]);

  const selectedProject     = dbProjects.find((p) => p.id === selectedProjectId) ?? null;
  const selectedProjectName = selectedProject?.name ?? null;
  const rubroNames          = dbRubros.map((r) => r.name);

  const propertyType = selectedProject?.property_type ?? null;
  const pisos        = selectedProject?.pisos ?? null;

  // Floor options: PB + 1°..pisos°
  const floorOptions: string[] | null = pisos
    ? ['PB', ...Array.from({ length: pisos }, (_, i) => `${i + 1}°`)]
    : null;

  // Location labels by property type
  const locationConfig: Record<PropertyType, { sectionLabel: string; floorLabel: string; unitLabel: string; unitPlaceholder: string; hasUnit: boolean }> = {
    edificio:        { sectionLabel: 'PISO Y UNIDAD',   floorLabel: 'PISO',  unitLabel: 'DEPTO / UF',  unitPlaceholder: 'Ej. 4B',      hasUnit: true  },
    local_comercial: { sectionLabel: 'PISO Y LOCAL',    floorLabel: 'PISO',  unitLabel: 'LOCAL N°',    unitPlaceholder: 'Ej. 12',      hasUnit: true  },
    oficina:         { sectionLabel: 'PISO Y OFICINA',  floorLabel: 'PISO',  unitLabel: 'OFICINA N°',  unitPlaceholder: 'Ej. 204',     hasUnit: true  },
    nave_industrial: { sectionLabel: 'SECTOR',          floorLabel: 'SECTOR',unitLabel: 'MÓDULO',      unitPlaceholder: 'Ej. Módulo A',hasUnit: true  },
    casa:            { sectionLabel: 'SECTOR / ZONA',   floorLabel: 'ZONA',  unitLabel: '',            unitPlaceholder: '',            hasUnit: false },
    otro:            { sectionLabel: 'SECTOR / ZONA',   floorLabel: 'ZONA',  unitLabel: '',            unitPlaceholder: '',            hasUnit: false },
  };

  const locCfg = propertyType ? locationConfig[propertyType] : null;
  // For nave/casa/otro, the "floor" is actually a free-text sector — no floor options list
  const isFloorType = propertyType === 'edificio' || propertyType === 'local_comercial' || propertyType === 'oficina';

  function buildLocation(): string | null {
    const parts: string[] = [];
    if (locationFloor?.trim()) parts.push(isFloorType ? `Piso ${locationFloor}` : locationFloor.trim());
    if (locationUnit.trim()) parts.push(locationUnit.trim());
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  const canContinue = selectedProjectId && selectedRubro && (
    mode === 'video' ? videoUri !== null : photoUri !== null
  );

  function handleSelectProject(id: string) {
    setSelectedProjectId(id);
    setSelectedRubro(null);
    setSelectedRubroId(null);
    setLocationFloor(null);
    setLocationUnit('');
  }

  function handleSelectRubro(name: string) {
    const r = dbRubros.find((r) => r.name === name);
    if (r) { setSelectedRubro(r.name); setSelectedRubroId(r.id); }
  }

  async function handleRecordVideo() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara y el micrófono para grabar videos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      videoMaxDuration: 600,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) setVideoUri(result.assets[0].uri);
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
    const location = buildLocation() ?? '';
    if (mode === 'foto' && photoUri) {
      router.push({
        pathname: '/editar-foto',
        params: {
          uri: photoUri,
          project: selectedProjectId ?? '',
          rubro: selectedRubro ?? '',
          rubroId: selectedRubroId ?? '',
          type: reportType,
          location,
          returnToInformeDia: lockedReturnToInformeDia ?? '',
          projectName: selectedProjectName ?? '',
        },
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
          location,
          returnToInformeDia: lockedReturnToInformeDia ?? '',
          rubroName: selectedRubro ?? '',
          projectName: selectedProjectName ?? '',
        },
      });
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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

        {/* Project picker */}
        {lockedProjectId && lockedProjectName ? (
          <LockedField label="PROYECTO" value={lockedProjectName} />
        ) : (
          <View style={s.section}>
            <Text style={s.sectionLabel}>PROYECTO</Text>
            <TouchableOpacity
              style={s.pickerField}
              onPress={() => setProjectSheetOpen(true)}
              activeOpacity={0.75}
            >
              <Text style={selectedProjectName ? s.pickerValue : s.pickerPlaceholder} numberOfLines={1}>
                {selectedProjectName ?? 'Seleccionar proyecto…'}
              </Text>
              <Feather name="chevron-down" size={16} color={colors.gris} />
            </TouchableOpacity>
            <ProjectPickerSheet
              visible={projectSheetOpen}
              projects={dbProjects}
              selectedId={selectedProjectId}
              onSelect={(id) => { handleSelectProject(id); setProjectSheetOpen(false); }}
              onClose={() => setProjectSheetOpen(false)}
              onCreateNew={() => { setProjectSheetOpen(false); router.push('/(tabs)'); }}
            />
          </View>
        )}

        {/* Rubro picker */}
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

        {/* Location fields — shown when project has a property_type */}
        {locCfg && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>{locCfg.sectionLabel}</Text>

            {/* Floor / Sector */}
            {isFloorType ? (
              floorOptions ? (
                // Picker sheet for known number of floors
                <>
                  <TouchableOpacity
                    style={s.pickerField}
                    onPress={() => setFloorSheetOpen(true)}
                    activeOpacity={0.75}
                  >
                    <Text style={locationFloor ? s.pickerValue : s.pickerPlaceholder} numberOfLines={1}>
                      {locationFloor ?? 'Seleccionar piso…'}
                    </Text>
                    <Feather name="chevron-down" size={16} color={colors.gris} />
                  </TouchableOpacity>
                  <BottomSheet visible={floorSheetOpen} onClose={() => setFloorSheetOpen(false)}>
                    <View style={[s.sheet, { paddingBottom: 32 }]}>
                      <View style={s.handle} />
                      <View style={s.sheetHeader}>
                        <Text style={s.sheetTitle}>{locCfg.floorLabel}</Text>
                        <TouchableOpacity onPress={() => setFloorSheetOpen(false)} hitSlop={12}>
                          <Feather name="x" size={18} color={colors.gris} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, paddingBottom: 8 }}>
                        {floorOptions.map((opt) => {
                          const sel = locationFloor === opt;
                          return (
                            <TouchableOpacity
                              key={opt}
                              style={[s.floorChip, sel && s.floorChipSelected]}
                              onPress={() => { setLocationFloor(opt); setFloorSheetOpen(false); }}
                              activeOpacity={0.75}
                            >
                              <Text style={[s.floorChipText, sel && s.floorChipTextSelected]}>{opt}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </BottomSheet>
                </>
              ) : (
                // Text input for unknown number of floors
                <View style={s.pickerField}>
                  <TextInput
                    style={[s.pickerValue, { flex: 1 }]}
                    value={locationFloor ?? ''}
                    onChangeText={setLocationFloor}
                    placeholder="Ej. 3° / PB"
                    placeholderTextColor={colors.faint}
                    selectionColor={colors.arena}
                  />
                </View>
              )
            ) : (
              // Sector / Zona free text
              <View style={s.pickerField}>
                <TextInput
                  style={[s.pickerValue, { flex: 1 }]}
                  value={locationFloor ?? ''}
                  onChangeText={setLocationFloor}
                  placeholder={propertyType === 'nave_industrial' ? 'Ej. Sector A' : 'Ej. Jardín / Primer piso'}
                  placeholderTextColor={colors.faint}
                  selectionColor={colors.arena}
                />
              </View>
            )}

            {/* Unit / Depto / Módulo */}
            {locCfg.hasUnit && (
              <View style={[s.pickerField, { marginTop: 8 }]}>
                <TextInput
                  style={[s.pickerValue, { flex: 1 }]}
                  value={locationUnit}
                  onChangeText={setLocationUnit}
                  placeholder={locCfg.unitPlaceholder}
                  placeholderTextColor={colors.faint}
                  selectionColor={colors.arena}
                  autoCapitalize="characters"
                />
                {locationUnit.length > 0 && (
                  <TouchableOpacity onPress={() => setLocationUnit('')} hitSlop={8}>
                    <Feather name="x" size={14} color={colors.faint} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* Report type */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>TIPO DE INFORME</Text>
          <View style={s.typeGrid}>
            {([
              { key: 'contratistas', label: 'Contratistas',    sub: 'Para los gremios\nen obra',          icon: 'tool'      },
              { key: 'oficina',      label: 'Oficina técnica', sub: 'Para el equipo\nde proyecto',        icon: 'clipboard' },
            ] as { key: ReportType; label: string; sub: string; icon: string }[]).map((t) => {
              const active = reportType === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[s.typeCard, active && s.typeCardSelected]}
                  onPress={() => setReportType(t.key)}
                  activeOpacity={0.8}
                >
                  <View style={[s.typeIconWrap, active && s.typeIconWrapSelected]}>
                    <Feather name={t.icon as any} size={18} color={active ? colors.arena : colors.gris} />
                  </View>
                  <Text style={[s.typeLabel, active && s.typeLabelSelected]}>{t.label}</Text>
                  <Text style={s.typeSub}>{t.sub}</Text>
                </TouchableOpacity>
              );
            })}
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
              {mode === 'foto'
                ? 'Anotar foto  →'
                : lockedReturnToInformeDia
                  ? 'Agregar al informe del día  →'
                  : 'Procesar informe  →'
              }
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
  captureCircleDone: { backgroundColor: 'rgba(74,180,120,0.35)' },
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

  pickRow: { flexDirection: 'row', marginHorizontal: spacing.xl, gap: spacing.sm },
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

  pickerField: {
    height: 52, borderRadius: 16, backgroundColor: colors.panel,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  pickerFieldDisabled: { opacity: 0.45 },
  pickerValue: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema, flex: 1 },
  pickerPlaceholder: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.faint, flex: 1 },

  lockedField: {
    height: 52, borderRadius: 16, backgroundColor: colors.panel,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3, borderLeftColor: colors.arena,
  },

  // Bottom sheet
  sheet: {
    backgroundColor: colors.panel,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingTop: 12,
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

  sheetList: { flexGrow: 0, maxHeight: 360 },

  // Project picker rows (rich cards)
  projectItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  projectItemSelected: { backgroundColor: 'rgba(217,119,87,0.06)' },
  projectThumb: { width: 44, height: 44, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.chip },
  projectThumbImg: { width: '100%', height: '100%' },
  projectName: { fontFamily: fonts.archivo.semibold, fontSize: 14.5, color: colors.crema },
  projectNameSelected: { fontFamily: fonts.archivo.bold, color: colors.arena },
  projectMeta: { fontFamily: fonts.archivo.semibold, fontSize: 11.5, color: colors.gris, marginTop: 2 },

  // Simple text picker rows (rubros)
  sheetItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sheetItemSelected: { backgroundColor: 'rgba(217,119,87,0.06)' },
  sheetItemText: { fontFamily: fonts.archivo.semibold, fontSize: 14.5, color: colors.crema },
  sheetItemTextSelected: { fontFamily: fonts.archivo.bold, color: colors.arena },

  // Empty state + create row
  emptyState: { paddingVertical: 32, alignItems: 'center' },
  emptyStateText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.gris },
  createRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: 16,
  },
  createRowText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.arena },

  // Floor chips
  floorChip: {
    height: 38, minWidth: 48, paddingHorizontal: 14, borderRadius: 12,
    backgroundColor: colors.panel, borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  floorChipSelected: { backgroundColor: 'rgba(217,119,87,0.08)', borderColor: colors.arena },
  floorChipText: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.gris },
  floorChipTextSelected: { color: colors.arena },

  // Report type
  typeGrid: { flexDirection: 'row', gap: 12 },
  typeCard: {
    flex: 1, borderRadius: 20, backgroundColor: colors.panel,
    padding: spacing.md, gap: 8,
    borderWidth: 1.5, borderColor: colors.border,
  },
  typeCardSelected: {
    backgroundColor: 'rgba(217,119,87,0.04)',
    borderColor: colors.arena,
  },
  typeIconWrap: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center',
  },
  typeIconWrapSelected: { backgroundColor: 'rgba(217,119,87,0.12)' },
  typeLabel: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema, letterSpacing: -0.2 },
  typeLabelSelected: { color: colors.arena },
  typeSub: { fontFamily: fonts.archivo.semibold, fontSize: 11.5, color: colors.gris, lineHeight: 16 },

  noteField: { borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  noteInput: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema, minHeight: 60 },

  ctaBlock: { paddingHorizontal: spacing.xl },
  btnPrimary: { height: 54, borderRadius: 27, backgroundColor: colors.crema, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryDisabled: { backgroundColor: colors.faint },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.2 },
});
