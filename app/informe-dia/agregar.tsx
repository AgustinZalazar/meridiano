import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

type MediaMode = 'foto' | 'video';

export default function AgregarMediaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ reportId: string; rubroName: string }>();

  const reportId = Array.isArray(params.reportId) ? params.reportId[0] : params.reportId;
  const rubroName = Array.isArray(params.rubroName) ? params.rubroName[0] : params.rubroName;

  const [mode, setMode]       = useState<MediaMode>('foto');
  const [uri, setUri]         = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [note, setNote]       = useState('');
  const [saving, setSaving]   = useState(false);

  async function handlePickGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === 'foto'
        ? ImagePicker.MediaTypeOptions.Images
        : ImagePicker.MediaTypeOptions.Videos,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
      setFileName(result.assets[0].fileName ?? null);
    }
  }

  async function handlePickFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      type: mode === 'foto' ? 'image/*' : 'video/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
      setFileName(result.assets[0].name);
    }
  }

  async function handleSave() {
    if (!reportId) return;
    setSaving(true);

    const { error } = await supabase
      .from('report_media')
      .insert({
        report_id: reportId,
        type:      mode,
        uri:       uri ?? null,
        note:      note.trim() || null,
      });

    setSaving(false);

    if (error) {
      Alert.alert('Error', 'No se pudo guardar el elemento.');
      return;
    }
    router.back();
  }

  const canSave = !!uri && !saving;

  return (
    <View style={[s.safe, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <TouchableOpacity style={s.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="x" size={16} color={colors.crema} />
          </TouchableOpacity>
          <View style={s.topMeta}>
            <Text style={s.topEyebrow}>AGREGAR AL INFORME</Text>
            <Text style={s.topTitle} numberOfLines={1}>{rubroName ?? 'Rubro'}</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>

        {/* Modo */}
        <View style={s.section}>
          <Text style={s.label}>TIPO</Text>
          <View style={s.modeToggle}>
            <TouchableOpacity
              style={[s.modeBtn, mode === 'foto' && s.modeBtnActive]}
              onPress={() => { setMode('foto'); setUri(null); setFileName(null); }}
              activeOpacity={0.8}
            >
              <Feather name="image" size={15} color={mode === 'foto' ? '#FFF' : colors.gris} />
              <Text style={[s.modeBtnText, mode === 'foto' && s.modeBtnTextActive]}>Foto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeBtn, mode === 'video' && s.modeBtnActive]}
              onPress={() => { setMode('video'); setUri(null); setFileName(null); }}
              activeOpacity={0.8}
            >
              <Feather name="video" size={15} color={mode === 'video' ? '#FFF' : colors.gris} />
              <Text style={[s.modeBtnText, mode === 'video' && s.modeBtnTextActive]}>Video</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Archivo seleccionado */}
        {uri ? (
          <View style={s.section}>
            <View style={s.selectedFile}>
              <Feather name={mode === 'foto' ? 'image' : 'video'} size={18} color={colors.success} />
              <Text style={s.selectedFileName} numberOfLines={1}>{fileName ?? 'Archivo seleccionado'}</Text>
              <TouchableOpacity onPress={() => { setUri(null); setFileName(null); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={15} color={colors.gris} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.section}>
            <Text style={s.label}>ARCHIVO</Text>
            <View style={s.pickRow}>
              <TouchableOpacity style={s.pickBtn} onPress={handlePickGallery} activeOpacity={0.8}>
                <Feather name="image" size={16} color={colors.crema} />
                <Text style={s.pickBtnText}>Galería</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.pickBtn} onPress={handlePickFiles} activeOpacity={0.8}>
                <Feather name="folder" size={16} color={colors.crema} />
                <Text style={s.pickBtnText}>Archivos</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Nota */}
        <View style={s.section}>
          <Text style={s.label}>NOTA <Text style={s.labelOptional}>(opcional)</Text></Text>
          <TextInput
            style={s.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Describí qué se ve en este archivo…"
            placeholderTextColor={colors.faint}
            selectionColor={colors.arena}
            multiline
            returnKeyType="done"
            blurOnSubmit
          />
        </View>

        {/* CTA */}
        <View style={s.ctaBlock}>
          <TouchableOpacity
            style={[s.saveBtn, !canSave && { opacity: 0.4 }]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#FFF" size="small" />
              : <>
                  <Feather name="plus-circle" size={16} color="#FFF" />
                  <Text style={s.saveBtnText}>Agregar al informe</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  scroll: { gap: spacing.lg },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xs,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  topMeta: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  topEyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 1.4,
    textTransform: 'uppercase', color: colors.gris,
  },
  topTitle: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema, marginTop: 2 },

  section: { paddingHorizontal: spacing.xl },

  label: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
    marginBottom: spacing.sm,
  },
  labelOptional: { color: colors.faint, textTransform: 'none', letterSpacing: 0 },

  modeToggle: {
    flexDirection: 'row', backgroundColor: colors.chip, borderRadius: 22,
    padding: 4, gap: 4,
  },
  modeBtn: {
    flex: 1, height: 44, borderRadius: 20, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  modeBtnActive: { backgroundColor: colors.crema },
  modeBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.gris },
  modeBtnTextActive: { color: '#FFF' },

  selectedFile: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(74,124,89,0.10)', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(74,124,89,0.2)',
    padding: 14,
  },
  selectedFileName: {
    flex: 1, fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.success,
  },

  pickRow: { flexDirection: 'row', gap: spacing.sm },
  pickBtn: {
    flex: 1, height: 52, borderRadius: 16, backgroundColor: colors.panel,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  pickBtnText: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: colors.crema },

  noteInput: {
    minHeight: 90, borderRadius: 16, backgroundColor: colors.panel,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema,
    textAlignVertical: 'top',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },

  ctaBlock: { paddingHorizontal: spacing.xl, marginTop: spacing.sm },
  saveBtn: {
    height: 54, borderRadius: 27, backgroundColor: colors.arena,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  saveBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFF' },
});
