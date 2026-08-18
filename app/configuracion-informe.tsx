import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fonts } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useStudio } from '../lib/use-studio';

export default function ConfiguracionInformeScreen() {
  const router = useRouter();
  const { studio, isAdmin, refetch } = useStudio();
  const [uploading, setUploading] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);

  async function handleLogoUpload() {
    if (!studio || !isAdmin) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      base64: true,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      if (!asset.base64) throw new Error('No se pudo leer la imagen');
      const ext = (asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg').replace(/\?.*$/, '');
      const path = `${studio.id}/logo.${ext}`;

      const binaryString = atob(asset.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const { error: uploadError } = await supabase.storage
        .from('studio-logos')
        .upload(path, bytes, { contentType: `image/${ext}`, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('studio-logos').getPublicUrl(path);
      await supabase.from('studios').update({ logo_url: `${publicUrl}?v=${Date.now()}` }).eq('id', studio.id);
      await refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Error', `No se pudo subir el logo.\n${msg}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveLogo() {
    if (!studio || !isAdmin) return;
    Alert.alert('Quitar logo', '¿Querés quitar el logo del estudio de los informes?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar', style: 'destructive', onPress: async () => {
          await supabase.from('studios').update({ logo_url: null }).eq('id', studio.id);
          await refetch();
        },
      },
    ]);
  }

  const logoUrl = studio?.logo_url;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={18} color={colors.crema} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topEyebrow}>AJUSTES</Text>
          <Text style={styles.topTitle}>Logo del informe</Text>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Preview del encabezado */}
        <View style={styles.previewSection}>
          <Text style={styles.sectionLabel}>PREVISUALIZACIÓN DEL ENCABEZADO</Text>
          <View style={styles.headerPreview}>
            <View style={styles.headerPreviewLeft}>
              {logoUrl ? (
                <TouchableOpacity activeOpacity={0.85} onPress={() => setLightboxUri(logoUrl)}>
                  <Image source={{ uri: logoUrl }} style={styles.previewLogo} resizeMode="contain" />
                </TouchableOpacity>
              ) : (
                <View style={styles.previewLogoPlaceholder}>
                  <Feather name="image" size={16} color={colors.faint} />
                </View>
              )}
              <View>
                <Text style={styles.previewBrand}>MERIDIANO</Text>
                {studio?.name ? <Text style={styles.previewStudio}>{studio.name}</Text> : null}
              </View>
            </View>
            <View style={styles.headerPreviewRight}>
              <Text style={styles.previewMeta}>01 AGO 2026</Text>
              <Text style={styles.previewMeta}>Proyecto ejemplo</Text>
            </View>
          </View>
          <View style={styles.headerAccentLine} />
          <Text style={styles.previewNote}>Así aparece el encabezado en los PDFs exportados</Text>
        </View>

        {/* Logo del estudio */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOGO DEL ESTUDIO</Text>
          <Text style={styles.sectionSubtitle}>
            Aparece en el encabezado de todos los informes PDF generados con este estudio
          </Text>

          <View style={styles.logoCard}>
            <TouchableOpacity
              style={styles.logoSlot}
              onPress={() => logoUrl && setLightboxUri(logoUrl)}
              activeOpacity={logoUrl ? 0.8 : 1}
              disabled={!logoUrl}
            >
              {uploading ? (
                <ActivityIndicator color={colors.gris} />
              ) : logoUrl ? (
                <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
              ) : (
                <View style={styles.logoEmpty}>
                  <Feather name="image" size={22} color={colors.faint} />
                  <Text style={styles.logoEmptyText}>Sin logo</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.logoActions}>
              {isAdmin ? (
                <>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={handleLogoUpload}
                    disabled={uploading}
                    activeOpacity={0.8}
                  >
                    <Feather name="upload" size={14} color={colors.crema} />
                    <Text style={styles.actionBtnText}>{logoUrl ? 'Cambiar logo' : 'Subir logo'}</Text>
                  </TouchableOpacity>
                  {logoUrl && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnDestructive]}
                      onPress={handleRemoveLogo}
                      activeOpacity={0.8}
                    >
                      <Feather name="trash-2" size={14} color={colors.error} />
                      <Text style={[styles.actionBtnText, { color: colors.error }]}>Quitar logo</Text>
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <Text style={styles.noPermissionText}>Solo los admins pueden cambiar el logo</Text>
              )}
            </View>
          </View>
        </View>

        {/* Logo del proyecto */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LOGO DEL PROYECTO</Text>
          <Text style={styles.sectionSubtitle}>
            Cada proyecto puede tener su propio logo que aparece junto al título en el informe. Se configura al editar el proyecto.
          </Text>
          <View style={styles.infoCard}>
            <Feather name="info" size={14} color={colors.gris} />
            <Text style={styles.infoText}>
              Para agregar o cambiar el logo de un proyecto, abrí el proyecto → menú → Editar proyecto → Logo del proyecto
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* Lightbox */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity style={styles.lightboxBg} activeOpacity={1} onPress={() => setLightboxUri(null)}>
          {!!lightboxUri && (
            <Image source={{ uri: lightboxUri }} style={styles.lightboxImg} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.tinta },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  circleBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  topCenter: { alignItems: 'center', gap: 1 },
  topEyebrow: { fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.gris },
  topTitle: { fontFamily: fonts.archivo.bold, fontSize: 16, color: colors.crema, letterSpacing: -0.2 },

  scroll: { paddingBottom: 60, gap: spacing.xl },

  section: { paddingHorizontal: spacing.xl, gap: spacing.md },
  previewSection: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  sectionLabel: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  sectionSubtitle: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.faint, lineHeight: 18 },

  // Header preview
  headerPreview: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  headerPreviewLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerPreviewRight: { alignItems: 'flex-end', gap: 2 },
  previewLogo: { width: 36, height: 36, borderRadius: 8 },
  previewLogoPlaceholder: {
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: '#F0EDE8', alignItems: 'center', justifyContent: 'center',
  },
  previewBrand: { fontFamily: fonts.archivo.bold, fontSize: 14, color: '#12151A', letterSpacing: -0.3 },
  previewStudio: { fontFamily: fonts.archivo.semibold, fontSize: 10, color: '#888' },
  previewMeta: { fontFamily: fonts.archivo.semibold, fontSize: 9, color: '#AAA' },
  headerAccentLine: { height: 2, backgroundColor: '#D97757', borderRadius: 1 },
  previewNote: { fontFamily: fonts.mono.regular, fontSize: 9.5, color: colors.faint, textAlign: 'center', letterSpacing: 0.3 },

  // Logo card
  logoCard: {
    backgroundColor: colors.panel, borderRadius: 20, padding: 18, gap: 16,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2,
  },
  logoSlot: {
    width: 80, height: 80, borderRadius: 18, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  logoImage: { width: '100%', height: '100%' },
  logoEmpty: { alignItems: 'center', gap: 5 },
  logoEmptyText: { fontFamily: fonts.archivo.semibold, fontSize: 10, color: colors.faint },
  logoActions: { flex: 1, gap: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    height: 38, paddingHorizontal: 14, borderRadius: 19,
    backgroundColor: colors.chip,
  },
  actionBtnDestructive: { backgroundColor: 'rgba(220,60,60,0.08)' },
  actionBtnText: { fontFamily: fonts.archivo.bold, fontSize: 12.5, color: colors.crema },
  noPermissionText: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.faint, fontStyle: 'italic' },

  // Info card
  infoCard: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.panel,
    borderRadius: 14, padding: 14, alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontFamily: fonts.archivo.semibold, fontSize: 12.5, color: colors.gris, lineHeight: 18 },

  // Lightbox
  lightboxBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxImg: { width: '100%', height: '80%' },
});
