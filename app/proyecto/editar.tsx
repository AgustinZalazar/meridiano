import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image, Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { DateField } from '../../components/DateField';
import { uploadProjectImage } from '../../lib/upload-image';

function parseDateParam(s: string | undefined | string[]): Date | null {
  if (!s || s === '') return null;
  const str = Array.isArray(s) ? s[0] : s;
  const d = new Date(str + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export default function EditarProyectoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { id, name: initName, image_url: initImageUrl, start_date: initStart, end_date: initEnd } =
    useLocalSearchParams<{ id: string; name: string; image_url?: string; start_date?: string; end_date?: string }>();

  const [name, setName] = useState(Array.isArray(initName) ? initName[0] : (initName ?? ''));
  const [startDate, setStartDate] = useState<Date | null>(parseDateParam(initStart));
  const [endDate, setEndDate] = useState<Date | null>(parseDateParam(initEnd));
  const [imageUri, setImageUri] = useState<string | null>(
    Array.isArray(initImageUrl) ? initImageUrl[0] : (initImageUrl || null)
  );
  const [pickedBase64, setPickedBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const projectId = Array.isArray(id) ? id[0] : id;
  const canSave = name.trim().length > 0;
  const isRemoteImage = imageUri?.startsWith('http');

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setPickedBase64(result.assets[0].base64 ?? null);
    }
  }

  async function handleSave() {
    if (!canSave || !session) return;
    setLoading(true);
    setError(null);

    let finalImageUrl: string | null = isRemoteImage ? imageUri : null;
    if (!isRemoteImage && imageUri && pickedBase64) {
      finalImageUrl = await uploadProjectImage(session.user.id, imageUri, pickedBase64);
    }

    const { error: dbError } = await supabase
      .from('projects')
      .update({
        name: name.trim(),
        image_url: finalImageUrl,
        start_date: startDate ? startDate.toISOString().slice(0, 10) : null,
        end_date: endDate ? endDate.toISOString().slice(0, 10) : null,
      })
      .eq('id', projectId);

    setLoading(false);
    if (dbError) {
      setError('No se pudo guardar. Intentá de nuevo.');
      return;
    }
    router.back();
  }

  function handleDelete() {
    Alert.alert(
      'Eliminar proyecto',
      'Se eliminarán todos los rubros y pendientes asociados. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            await supabase.from('projects').delete().eq('id', projectId);
            router.back();
            router.back();
          },
        },
      ]
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.handle} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={18} color={colors.crema} />
        </TouchableOpacity>
        <Text style={styles.title}>Editar proyecto</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || loading) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.saveBtnText}>Guardar</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Image picker */}
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.85}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Feather name="image" size={24} color={colors.faint} />
              <Text style={styles.imagePlaceholderText}>Agregar foto de portada</Text>
            </View>
          )}
          <View style={styles.imageEditBadge}>
            <Feather name="camera" size={13} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Nombre */}
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>NOMBRE DEL PROYECTO</Text>
          <View style={styles.fieldRow}>
            <TextInput
              style={styles.fieldInput}
              value={name}
              onChangeText={setName}
              placeholder="Ej: Torre Palermo"
              placeholderTextColor={colors.faint}
              autoCapitalize="words"
              autoCorrect={false}
              selectionColor={colors.arena}
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Fechas */}
        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <DateField
              label="INICIO ESPERADO"
              value={startDate}
              onChange={setStartDate}
              placeholder="Seleccionar"
              maximumDate={endDate ?? undefined}
            />
          </View>
          <View style={styles.dateDivider} />
          <View style={styles.dateCol}>
            <DateField
              label="FIN ESPERADO"
              value={endDate}
              onChange={setEndDate}
              placeholder="Seleccionar"
              minimumDate={startDate ?? undefined}
            />
          </View>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Delete */}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={handleDelete}
          disabled={deleting}
          activeOpacity={0.8}
        >
          {deleting
            ? <ActivityIndicator color={colors.error} size="small" />
            : <>
                <Feather name="trash-2" size={15} color={colors.error} />
                <Text style={styles.deleteBtnText}>Eliminar proyecto</Text>
              </>
          }
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.panel },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginTop: 10, marginBottom: 6,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontFamily: fonts.archivo.bold, fontSize: 16, color: colors.crema, letterSpacing: -0.3 },
  saveBtn: {
    height: 36, paddingHorizontal: 18, borderRadius: 18, backgroundColor: colors.crema,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: { fontFamily: fonts.archivo.bold, fontSize: 13.5, color: '#FFFFFF' },
  scroll: { flex: 1 },
  form: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.xl },

  imagePicker: {
    height: 160, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.chip,
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  imagePlaceholderText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.faint },
  imageEditBadge: {
    position: 'absolute', bottom: 10, right: 10,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(18,21,26,0.6)',
    alignItems: 'center', justifyContent: 'center',
  },

  field: { gap: 8 },
  fieldLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  fieldRow: { borderBottomWidth: 1.5, borderBottomColor: colors.border, paddingBottom: spacing.sm },
  fieldInput: { fontFamily: fonts.archivo.semibold, fontSize: 18, color: colors.crema, paddingVertical: 8 },
  datesRow: { flexDirection: 'row', alignItems: 'flex-start' },
  dateCol: { flex: 1 },
  dateDivider: { width: spacing.md },
  errorText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error },

  deleteBtn: {
    height: 54, borderRadius: 27, borderWidth: 1.5,
    borderColor: 'rgba(220,60,60,0.2)',
    backgroundColor: 'rgba(220,60,60,0.06)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: spacing.md,
  },
  deleteBtnText: { fontFamily: fonts.archivo.bold, fontSize: 14.5, color: colors.error },
});
