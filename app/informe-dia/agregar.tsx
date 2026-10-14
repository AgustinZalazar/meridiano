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
import * as FileSystem from 'expo-file-system/legacy';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as Network from 'expo-network';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useStudio } from '../../lib/use-studio';
import { useToast } from '../../lib/toast';
import { getVideoMime } from '../../utils/video';

type MediaMode = 'foto' | 'video';

export default function AgregarMediaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ reportId: string; rubroName: string; defaultMode?: string }>();
  const { studio, loading: studioLoading } = useStudio();

  const reportId   = Array.isArray(params.reportId)   ? params.reportId[0]   : params.reportId;
  const rubroName  = Array.isArray(params.rubroName)  ? params.rubroName[0]  : params.rubroName;
  const defaultMode = (Array.isArray(params.defaultMode) ? params.defaultMode[0] : params.defaultMode) === 'video' ? 'video' : 'foto';

  const toast = useToast();

  const [mode, setMode]         = useState<MediaMode>(defaultMode as MediaMode);
  const [uri, setUri]           = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [uploadLabel, setUploadLabel] = useState('Subiendo…');

  async function handlePickGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === 'foto' ? ['images'] : ['videos'],
      quality: 0.85,
      videoMaxDuration: 180,
    });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
      setFileName(result.assets[0].fileName ?? null);
    }
  }

  async function handleCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Necesitamos acceso a la cámara para continuar.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: mode === 'foto' ? ['images'] : ['videos'],
      quality: 0.85,
      allowsEditing: false,
      videoMaxDuration: 180,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
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

  function handleAnnotateFoto() {
    if (!uri || !reportId) return;
    router.replace({
      pathname: '/editar-foto',
      params: {
        uri,
        project: '', rubro: '', rubroId: '', type: 'contratistas', location: '',
        dailyReportId: reportId,
        dailyNote: note.trim(),
      },
    });
  }

  async function handleSaveVideo() {
    if (!reportId || !uri || !studio) return;
    setSaving(true);

    try {
      const netState = await Network.getNetworkStateAsync();
      if (!netState.isConnected) throw new Error('Sin conexión a internet. Verificá tu red e intentá de nuevo.');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión activa');

      const ALLOWED_VID_EXTS = ['mp4', 'mov', 'avi', 'mkv', '3gp', 'webm'];
      const rawExt   = uri.split('.').pop()?.toLowerCase() ?? '';
      const ext      = ALLOWED_VID_EXTS.includes(rawExt) ? rawExt : 'mp4';
      const videoMime = getVideoMime(ext);

      // Copy video to cache first — resolves content:// URIs on Android so
      // VideoThumbnails can access the file as a plain file:// path
      const cacheDir  = `${FileSystem.cacheDirectory ?? ''}daily_uploads/`;
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
      const localPath = `${cacheDir}${Date.now()}.${ext}`;
      await FileSystem.copyAsync({ from: uri, to: localPath });

      // Pre-flight size check — reject before hitting the server limit
      const MAX_VIDEO_BYTES = 49 * 1024 * 1024; // 49 MB (Supabase free tier limit is 50 MB)
      const fileInfo = await FileSystem.getInfoAsync(localPath);
      if (fileInfo.exists && (fileInfo as any).size > MAX_VIDEO_BYTES) {
        FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});
        throw new Error('El video supera el límite de 50 MB. Grabá un clip más corto e intentá de nuevo.');
      }

      // Extract thumbnail from the cached local file
      setUploadLabel('Extrayendo captura…');
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(localPath, { time: 1000 });

      // Upload thumbnail to storage
      const thumbPath   = `${studio.id}/daily/${reportId}/thumb_${Date.now()}.jpg`;
      const thumbUploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/processing/${thumbPath}`;

      const thumbCacheDir = `${FileSystem.cacheDirectory ?? ''}daily_thumbs/`;
      await FileSystem.makeDirectoryAsync(thumbCacheDir, { intermediates: true });
      const thumbLocalPath = `${thumbCacheDir}${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: thumbUri, to: thumbLocalPath });

      setUploadLabel('Subiendo captura…');
      const thumbTask = FileSystem.createUploadTask(
        thumbUploadUrl, thumbLocalPath,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'image/jpeg',
            'x-upsert': 'true',
          },
        },
      );
      const thumbResult = await thumbTask.uploadAsync();
      FileSystem.deleteAsync(thumbLocalPath, { idempotent: true }).catch(() => {});

      if (!thumbResult || thumbResult.status >= 300) {
        if (__DEV__) console.error('[thumb upload]', thumbResult?.status, thumbResult?.body);
        throw new Error(`No se pudo subir la captura del video (${thumbResult?.status ?? 'sin respuesta'}).`);
      }

      const thumbUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/processing/${thumbPath}`;

      const storagePath = `${studio.id}/daily/${reportId}/${Date.now()}.${ext}`;
      const uploadUrl   = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/processing/${storagePath}`;

      setUploadLabel('Subiendo video…');
      const uploadTask = FileSystem.createUploadTask(
        uploadUrl, localPath,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': videoMime,
            'x-upsert': 'true',
          },
        },
      );
      const result = await uploadTask.uploadAsync();
      FileSystem.deleteAsync(localPath, { idempotent: true }).catch(() => {});

      if (!result || result.status >= 300) {
        if (__DEV__) console.error('[video upload]', result?.status, result?.body);
        if (result?.status === 413) throw new Error('El video supera el límite de 50 MB. Grabá un clip más corto e intentá de nuevo.');
        throw new Error(`No se pudo subir el video (${result?.status ?? 'sin respuesta'}): ${result?.body ?? 'sin detalle'}`);
      }

      setUploadLabel('Guardando…');

      const { error } = await supabase.from('report_media').insert({
        report_id:  reportId,
        type:       'video',
        uri:        thumbUrl,
        video_path: storagePath,
        note:       note.trim() || null,
      });

      if (error) throw new Error('No se pudo guardar el elemento.');
      router.back();
    } catch (e: any) {
      toast.error(e.message ?? 'Ocurrió un error inesperado.');
    } finally {
      setSaving(false);
    }
  }

  const canActFoto  = !!uri && mode === 'foto';
  const canSave     = !!uri && mode === 'video' && !saving && !studioLoading && !!studio;

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
              <TouchableOpacity style={[s.pickBtn, { flex: 1.2 }]} onPress={handleCamera} activeOpacity={0.8}>
                <Feather name={mode === 'foto' ? 'camera' : 'video'} size={16} color={colors.crema} />
                <Text style={s.pickBtnText}>Cámara</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pickBtn, { flex: 1 }]} onPress={handlePickGallery} activeOpacity={0.8}>
                <Feather name="image" size={16} color={colors.crema} />
                <Text style={s.pickBtnText}>Galería</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pickBtn, { flex: 1 }]} onPress={handlePickFiles} activeOpacity={0.8}>
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
          {mode === 'foto' ? (
            <TouchableOpacity
              style={[s.saveBtn, !canActFoto && { opacity: 0.4 }]}
              onPress={handleAnnotateFoto}
              disabled={!canActFoto}
              activeOpacity={0.85}
            >
              <Feather name="edit-2" size={16} color="#FFF" />
              <Text style={s.saveBtnText}>Anotar y agregar  →</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.saveBtn, !canSave && { opacity: 0.4 }]}
              onPress={handleSaveVideo}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              {saving
                ? <><ActivityIndicator color="#FFF" size="small" /><Text style={s.saveBtnText}>{uploadLabel}</Text></>
                : <>
                    <Feather name="plus-circle" size={16} color="#FFF" />
                    <Text style={s.saveBtnText}>Agregar al informe</Text>
                  </>
              }
            </TouchableOpacity>
          )}
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
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  saveBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFF' },
});
