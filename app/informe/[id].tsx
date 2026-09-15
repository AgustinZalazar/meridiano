import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Image,
  ActivityIndicator, Alert, Modal, TextInput, Animated, Easing,
} from 'react-native';
import { BottomSheet } from '../../components/BottomSheet';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fonts } from '../../constants/theme';
import { useStudio } from '../../lib/use-studio';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Report {
  id: string;
  type: string;
  mode: string;
  note: string | null;
  transcription: string | null;
  ai_summary: string | null;
  foto_url: string | null;
  status: string;
  created_at: string;
  projects: { name: string; image_url: string | null; logo_url: string | null } | null;
  rubros: { name: string; code?: string } | null;
}

interface PendingItem {
  id: string;
  description: string;
  trade: string | null;
  status: string;
  source: string;
  image_path: string | null;
  frame_id: string | null;
}

interface ReportFrame {
  id: string;
  storage_path: string;
  timestamp_sec: number;
  visual_description: string | null;
  order_index: number;
  signedUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function groupByTrade(items: PendingItem[]): { trade: string; items: PendingItem[] }[] {
  const map = new Map<string, PendingItem[]>();
  for (const item of items) {
    const key = item.trade ?? 'General';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([trade, items]) => ({ trade, items }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label.toUpperCase()}</Text>
    </View>
  );
}

function ItemCard({ item, frameUrl, imageUri, uploading, onPickImage, onImagePress, onReplaceFrame, matchingFrames }: {
  item: PendingItem;
  frameUrl?: string;
  imageUri?: string;
  uploading: boolean;
  onPickImage: () => void;
  onImagePress: (uri: string) => void;
  onReplaceFrame: () => void;
  matchingFrames: boolean;
}) {
  const displayUrl = frameUrl ?? imageUri;

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemDot} />
      <View style={styles.itemBody}>
        <Text style={styles.itemDescription}>{item.description}</Text>
        {item.trade && (
          <View style={{ marginTop: 4 }}>
            <Chip label={item.trade} />
          </View>
        )}

        {/* Video frame (AI-matched) */}
        {frameUrl ? (
          <View style={styles.itemImageWrap}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress(frameUrl)}>
              <Image source={{ uri: frameUrl }} style={styles.itemImage} resizeMode="contain" />
            </TouchableOpacity>
            <View style={styles.itemFrameActions}>
              <View style={styles.itemFrameBadge}>
                <Feather name="video" size={9} color={colors.gris} />
                <Text style={styles.itemFrameBadgeText}>Captura IA</Text>
              </View>
              <TouchableOpacity style={styles.itemReplaceBtn} onPress={onReplaceFrame} activeOpacity={0.8}>
                <Feather name="refresh-cw" size={10} color={colors.gris} />
                <Text style={styles.itemReplaceBtnText}>Reemplazar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : matchingFrames ? (
          <View style={styles.itemMatchingRow}>
            <ActivityIndicator size="small" color={colors.gris} />
            <Text style={styles.itemMatchingText}>Buscando captura…</Text>
          </View>
        ) : null}

        {/* Manual photo (independent from frame) */}
        {imageUri ? (
          <View style={styles.itemImageWrap}>
            <TouchableOpacity activeOpacity={0.9} onPress={() => onImagePress(imageUri)}>
              <Image source={{ uri: imageUri }} style={styles.itemImage} resizeMode="cover" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.itemReplaceBtn} onPress={onPickImage} activeOpacity={0.8} disabled={uploading}>
              {uploading
                ? <ActivityIndicator size="small" color={colors.gris} />
                : <><Feather name="camera" size={10} color={colors.gris} /><Text style={styles.itemReplaceBtnText}>Reemplazar foto</Text></>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.itemAddImageBtn} onPress={onPickImage} activeOpacity={0.8} disabled={uploading}>
            {uploading
              ? <ActivityIndicator size="small" color={colors.gris} />
              : <><Feather name="camera" size={12} color={colors.gris} /><Text style={styles.itemAddImageText}>Agregar foto</Text></>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function TradeGroup({ trade, items, index, itemImages, frameUrls, uploadingId, matchingFrames, onPickImage, onImagePress, onReplaceFrame }: {
  trade: string;
  items: PendingItem[];
  index: number;
  itemImages: Record<string, string>;
  frameUrls: Record<string, string>;
  uploadingId: string | null;
  matchingFrames: boolean;
  onPickImage: (itemId: string) => void;
  onImagePress: (uri: string) => void;
  onReplaceFrame: (itemId: string) => void;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.delay(index * 65),
      Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{
      opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
      transform: [
        { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
        { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
      ],
    }}>
    <View style={styles.sectorBlock}>
      <View style={styles.sectorHeader}>
        <Text style={styles.sectorName}>{trade}</Text>
        <Text style={styles.sectorCount}>{items.length}</Text>
      </View>
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          frameUrl={item.frame_id ? frameUrls[item.frame_id] : undefined}
          imageUri={itemImages[item.id]}
          uploading={uploadingId === item.id}
          matchingFrames={matchingFrames}
          onPickImage={() => onPickImage(item.id)}
          onImagePress={onImagePress}
          onReplaceFrame={() => onReplaceFrame(item.id)}
        />
      ))}
    </View>
    </Animated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function InformeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { studio } = useStudio();

  const [report, setReport] = useState<Report | null>(null);
  const [items, setItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [changeSheetVisible, setChangeSheetVisible] = useState(false);
  const [changeRequest, setChangeRequest] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string; description: string } | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [itemImages, setItemImages] = useState<Record<string, string>>({});
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [frames, setFrames] = useState<ReportFrame[]>([]);
  const [frameUrls, setFrameUrls] = useState<Record<string, string>>({});
  const [matchingFrames, setMatchingFrames] = useState(false);
  const [framePickerItemId, setFramePickerItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!id || id === 'demo') { setLoading(false); return; }
    fetchReport();
  }, [id]);

  async function fetchReport() {
    setLoading(true);
    const [reportRes, itemsRes, framesRes] = await Promise.all([
      supabase.from('reports').select('id, type, mode, note, transcription, ai_summary, foto_url, status, created_at, projects(name, image_url, logo_url), rubros(name, code)').eq('id', id).single<Report>(),
      supabase.from('pending_items').select('id, description, trade, status, source, image_path, frame_id').eq('report_id', id).order('created_at'),
      supabase.from('report_frames').select('id, storage_path, timestamp_sec, visual_description, order_index').eq('report_id', id).order('order_index'),
    ]);

    const reportData = reportRes.data;
    if (reportData) setReport(reportData);

    const fetchedItems = (itemsRes.data as PendingItem[]) ?? [];
    setItems(fetchedItems);

    // Load all frames + signed URLs
    const fetchedFrames = (framesRes.data as ReportFrame[]) ?? [];
    if (fetchedFrames.length > 0) {
      const urlMap: Record<string, string> = {};
      await Promise.all(
        fetchedFrames.map(async (frame) => {
          const { data } = await supabase.storage
            .from('report-frames')
            .createSignedUrl(frame.storage_path, 3600);
          if (data?.signedUrl) urlMap[frame.id] = data.signedUrl;
        })
      );
      setFrameUrls(urlMap);
      setFrames(fetchedFrames.map((f) => ({ ...f, signedUrl: urlMap[f.id] })));

      // Auto-trigger frame matching if mode=video and no items have frame_id yet
      const hasNoMatches = fetchedItems.every((item) => !item.frame_id);
      if (reportData?.mode === 'video' && hasNoMatches && fetchedItems.length > 0) {
        matchFramesToItems();
      }
    }

    // Build signed URLs for manually uploaded item images
    const imageMap: Record<string, string> = {};
    await Promise.all(
      fetchedItems
        .filter((item) => item.image_path)
        .map(async (item) => {
          const { data } = await supabase.storage
            .from('item-images')
            .createSignedUrl(item.image_path!, 3600);
          if (data?.signedUrl) imageMap[item.id] = data.signedUrl;
        })
    );
    setItemImages(imageMap);

    setLoading(false);
  }

  async function matchFramesToItems() {
    if (!id || id === 'demo') return;
    setMatchingFrames(true);
    try {
      const { error } = await supabase.functions.invoke('match-frames-to-items', {
        body: { report_id: id },
      });
      if (error) throw error;
      // Reload items to get updated frame_ids
      const { data } = await supabase
        .from('pending_items')
        .select('id, description, trade, status, source, image_path, frame_id')
        .eq('report_id', id)
        .order('created_at');
      if (data) setItems(data as PendingItem[]);
    } catch (e: any) {
      // Silent fail — user can retry manually
      console.warn('[match-frames]', e.message);
    } finally {
      setMatchingFrames(false);
    }
  }

  async function handleAssignFrame(itemId: string, frameId: string) {
    await supabase.from('pending_items').update({ frame_id: frameId }).eq('id', itemId);
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, frame_id: frameId } : item));
    setFramePickerItemId(null);
  }

  async function handleRemoveFrame(itemId: string) {
    await supabase.from('pending_items').update({ frame_id: null }).eq('id', itemId);
    setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, frame_id: null } : item));
  }

  async function handlePickItemImage(itemId: string) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para agregar fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    setUploadingImageId(itemId);
    try {
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const storagePath = `${id}/${itemId}_${Date.now()}.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const chars = atob(base64);
      const bytes = new Uint8Array(chars.length);
      for (let i = 0; i < chars.length; i++) bytes[i] = chars.charCodeAt(i);

      const { error: uploadErr } = await supabase.storage
        .from('item-images')
        .upload(storagePath, bytes.buffer, { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);

      await supabase.from('pending_items').update({ image_path: storagePath }).eq('id', itemId);

      const { data: signedData } = await supabase.storage
        .from('item-images')
        .createSignedUrl(storagePath, 3600);

      if (signedData?.signedUrl) {
        setItemImages((prev) => ({ ...prev, [itemId]: signedData.signedUrl }));
        setItems((prev) => prev.map((item) => item.id === itemId ? { ...item, image_path: storagePath } : item));
      }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo subir la imagen.');
    } finally {
      setUploadingImageId(null);
    }
  }

  function buildHtml(fotoBase64?: string | null, itemImagesBase64?: Record<string, string>, frameImagesBase64?: Record<string, string>, frameSignedUrls?: Record<string, string>): string {
    if (!report) return '';
    const isOf = report.type === 'oficina';
    const dateStr = formatDate(report.created_at);
    const projectName = escHtml(report.projects?.name ?? '—');
    const rubroStr = escHtml([report.rubros?.code, report.rubros?.name].filter(Boolean).join(' · ') || '—');
    const studioName = escHtml(studio?.name ?? '');
    const logoUrl = studio?.logo_url?.startsWith('https://') ? studio.logo_url : '';
    const projectLogoUrl = report.projects?.logo_url?.startsWith('https://') ? report.projects.logo_url : '';
    const fotoAnnotatedUrl = fotoBase64
      ? `data:image/png;base64,${fotoBase64}`
      : (report.foto_url?.startsWith('https://') ? report.foto_url : '');

    const itemCards = items.map((item) => {
      // Priority: video frame > manual photo; fall back to signed URL if base64 unavailable
      const frameBase64 = item.frame_id ? frameImagesBase64?.[item.frame_id] : undefined;
      const frameUrl   = item.frame_id ? frameSignedUrls?.[item.frame_id] : undefined;
      const manualBase64 = itemImagesBase64?.[item.id];
      const frameSrc = frameBase64 ? `data:image/jpeg;base64,${frameBase64}` : (frameUrl ?? '');
      const imgHtml = frameSrc
        ? `<img class="item-img" src="${escHtml(frameSrc)}" /><div class="item-img-label">Captura del video</div>`
        : manualBase64
          ? `<img class="item-img" src="data:image/jpeg;base64,${manualBase64}" />`
          : '';
      return `
  <div class="item-card">
    <div class="item-meta">
      <span class="item-trade">${escHtml(item.trade ?? 'General')}</span>
      <span class="item-status">${escHtml(item.status)}</span>
    </div>
    <div class="item-desc">${escHtml(item.description)}</div>
    ${imgHtml}
  </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; padding: 40px; font-size: 12px; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #D97757; padding-bottom: 16px; margin-bottom: 24px; }
  .brand-row { display: flex; align-items: center; gap: 12px; }
  .logo-img { width: 44px; height: 44px; border-radius: 10px; object-fit: contain; }
  .brand { font-size: 18px; font-weight: 700; letter-spacing: -0.5px; color: #12151A; }
  .studio-name { font-size: 11px; color: #888; margin-top: 2px; }
  .meta { text-align: right; font-size: 10px; color: #888; line-height: 1.6; }
  .subtitle { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 24px; }
  .summary { background: #F7F4EE; border-radius: 8px; padding: 16px; margin-bottom: 24px; display: flex; gap: 24px; }
  .summary-item { flex: 1; }
  .summary-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 3px; }
  .summary-value { font-size: 13px; font-weight: 700; color: #12151A; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 20px;
    background: ${isOf ? 'rgba(91,127,212,0.12)' : 'rgba(217,119,87,0.12)'}; color: ${isOf ? '#3A5FB0' : '#C05A30'}; }
  .note { margin-bottom: 20px; padding: 12px 16px; border-left: 3px solid #D97757; background: #FFFBF8; font-style: italic; color: #555; }
  .foto-section { margin-bottom: 24px; }
  .foto-label { font-size: 9px; text-transform: uppercase; letter-spacing: 1.2px; color: #888; margin-bottom: 8px; font-weight: 700; }
  .foto-img { width: 100%; max-height: 320px; object-fit: contain; border-radius: 8px; display: block; border: 1px solid #EEE; }
  .project-title-row { display: flex; align-items: center; gap: 14px; margin-bottom: 4px; }
  .project-logo { width: 48px; height: 48px; border-radius: 10px; object-fit: contain; background: #F7F4EE; flex-shrink: 0; }
  .title { font-size: 22px; font-weight: 700; color: #12151A; letter-spacing: -0.5px; }
  .items-section { margin-top: 8px; display: flex; flex-direction: column; gap: 12px; }
  .item-card { border: 1px solid #EDEBE6; border-radius: 8px; padding: 12px 14px; break-inside: avoid; }
  .item-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .item-trade { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #888; }
  .item-status { font-size: 9px; text-transform: capitalize; color: #AAA; }
  .item-desc { font-size: 12px; color: #12151A; line-height: 1.55; }
  .item-img { width: 100%; max-height: 240px; object-fit: contain; border-radius: 6px; margin-top: 10px; display: block; border: 1px solid #EEE; background: #F5F5F3; }
  .item-img-label { font-size: 8px; color: #AAA; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; font-size: 9px; color: #aaa; text-align: center; letter-spacing: 0.5px; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="header">
    <div class="brand-row">
      ${logoUrl ? `<img class="logo-img" src="${logoUrl}" />` : ''}
      <div>
        <div class="brand">MERIDIANO</div>
        ${studioName ? `<div class="studio-name">${studioName}</div>` : ''}
      </div>
    </div>
    <div class="meta">
      <div>${dateStr}</div>
      <div>${projectName}</div>
      <div>${rubroStr}</div>
    </div>
  </div>

  <div class="project-title-row">
    ${projectLogoUrl ? `<img class="project-logo" src="${projectLogoUrl}" />` : ''}
    <div class="title">${isOf ? 'Observación Oficina Técnica' : 'Informe de Contratistas'}</div>
  </div>
  <div class="subtitle">${projectName}</div>
  <div class="badge">${isOf ? 'Oficina técnica' : 'Contratistas'}</div>

  <div class="summary">
    <div class="summary-item">
      <div class="summary-label">Pendientes</div>
      <div class="summary-value">${items.length}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Proyecto</div>
      <div class="summary-value">${projectName}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Rubro</div>
      <div class="summary-value">${rubroStr}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Fecha</div>
      <div class="summary-value">${dateStr}</div>
    </div>
  </div>

  ${report.note ? `<div class="note">"${escHtml(report.note)}"</div>` : ''}

  ${fotoAnnotatedUrl ? `
  <div class="foto-section">
    <div class="foto-label">FOTO CON INDICACIONES</div>
    <img class="foto-img" src="${fotoAnnotatedUrl}" />
  </div>` : ''}

  <div class="items-section">
    ${itemCards}
  </div>

  <div class="footer">Generado por MERIDIANO · Análisis por GPT-4o · ${dateStr}</div>
</body>
</html>`;
  }

  async function handleExportPDF() {
    if (!report) return;
    setExporting(true);
    try {
      // Download foto anotada
      let fotoBase64: string | null = null;
      if (report.foto_url?.startsWith('https://')) {
        try {
          const tmpPath = `${FileSystem.cacheDirectory}foto_pdf_${Date.now()}.png`;
          const dl = await FileSystem.downloadAsync(report.foto_url, tmpPath);
          if (dl.status === 200) {
            fotoBase64 = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
          }
        } catch { /* skip */ }
      }

      // Download manual item images as base64
      const itemImagesBase64: Record<string, string> = {};
      await Promise.all(
        Object.entries(itemImages).map(async ([itemId, uri]) => {
          try {
            const tmpPath = `${FileSystem.cacheDirectory}item_img_${itemId}_${Date.now()}.jpg`;
            const dl = await FileSystem.downloadAsync(uri, tmpPath);
            if (dl.status === 200) {
              itemImagesBase64[itemId] = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
            }
          } catch { /* skip */ }
        })
      );

      // Download video frames as base64 (only frames actually used by items)
      const usedFrameIds = new Set(items.filter((i) => i.frame_id).map((i) => i.frame_id!));
      const frameImagesBase64: Record<string, string> = {};
      await Promise.all(
        [...usedFrameIds].map(async (frameId) => {
          const uri = frameUrls[frameId];
          if (!uri) return;
          try {
            const tmpPath = `${FileSystem.cacheDirectory}frame_${frameId}_${Date.now()}.jpg`;
            const dl = await FileSystem.downloadAsync(uri, tmpPath);
            if (dl.status === 200) {
              frameImagesBase64[frameId] = await FileSystem.readAsStringAsync(dl.uri, { encoding: FileSystem.EncodingType.Base64 });
            }
          } catch { /* skip */ }
        })
      );

      const { uri } = await Print.printToFileAsync({ html: buildHtml(fotoBase64, itemImagesBase64, frameImagesBase64, frameUrls), base64: false });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Exportar informe' });
    } catch {
      Alert.alert('Error', 'No se pudo generar el PDF.');
    } finally {
      setExporting(false);
    }
  }

  async function saveItemDescription() {
    if (!editingItem || !editText.trim()) return;
    setSavingEdit(true);
    try {
      await supabase.from('pending_items').update({ description: editText.trim() }).eq('id', editingItem.id);
      setItems((prev) => prev.map((item) => item.id === editingItem.id ? { ...item, description: editText.trim() } : item));
      setEditingItem(null);
    } catch {}
    setSavingEdit(false);
  }

  async function handleRequestChange() {
    if (!changeRequest.trim() || !report) return;
    setRequesting(true);
    try {
      const { error } = await supabase.functions.invoke('revise-report', {
        body: { report_id: id, instructions: changeRequest.trim() },
      });
      if (error) throw error;
      setChangeSheetVisible(false);
      setChangeRequest('');
      await fetchReport();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'No se pudo procesar el cambio.');
    } finally {
      setRequesting(false);
    }
  }

  const isOficina = report?.type === 'oficina';
  const typeLabel = isOficina ? 'Observación oficina técnica' : 'Informe contratistas';
  const groups = groupByTrade(items);
  const rubroLabel = [report?.rubros?.code, report?.rubros?.name].filter(Boolean).join(' · ');
  const isDemoMode = !id || id === 'demo';

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.crema} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={18} color={colors.crema} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          {report && (
            <Text style={styles.topEyebrow}>
              {formatDate(report.created_at)}{rubroLabel ? ` · ${rubroLabel}` : ''}
            </Text>
          )}
          <Text style={styles.topTitle}>Informe</Text>
        </View>
        <TouchableOpacity style={styles.circleBtn} onPress={() => setPreviewVisible(true)} activeOpacity={0.8} disabled={!report}>
          <Feather name="file-text" size={16} color={report ? colors.crema : colors.faint} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Summary card */}
        <View style={styles.summaryCard}>
          {studio && (
            <View style={styles.studioBrand}>
              <TouchableOpacity
                style={styles.studioLogoSlot}
                activeOpacity={studio.logo_url ? 0.75 : 1}
                onPress={() => studio.logo_url && setLightboxUri(studio.logo_url)}
                disabled={!studio.logo_url}
              >
                {studio.logo_url
                  ? <Image source={{ uri: studio.logo_url }} style={styles.studioLogoImage} />
                  : <Text style={styles.studioLogoInitials}>
                      {studio.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </Text>
                }
              </TouchableOpacity>
              <Text style={styles.studioNameText}>{studio.name}</Text>
            </View>
          )}
          <View style={[styles.typeChip, isOficina && styles.typeChipOficina]}>
            <Feather name={isOficina ? 'briefcase' : 'tool'} size={10} color={isOficina ? '#5B7FD4' : colors.arena} />
            <Text style={[styles.typeChipText, isOficina && styles.typeChipTextOficina]}>{typeLabel}</Text>
          </View>
          <Text style={styles.summaryProject}>{report?.projects?.name ?? '—'}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <Feather name="alert-circle" size={11} color={colors.arena} />
              <Text style={[styles.summaryChipText, { color: colors.arena }]}>{items.length} pendiente{items.length !== 1 ? 's' : ''}</Text>
            </View>
            {report?.ai_summary && (
              <View style={styles.summaryChip}>
                <Feather name="cpu" size={11} color={colors.gris} />
                <Text style={styles.summaryChipText}>IA</Text>
              </View>
            )}
          </View>
          {report?.note && (
            <Text style={styles.noteText}>"{report.note}"</Text>
          )}
        </View>

        {/* Foto anotada (modo foto) */}
        {report?.foto_url && (
          <View style={styles.fotoBlock}>
            <Text style={styles.fotoLabel}>FOTO CON INDICACIONES</Text>
            <TouchableOpacity activeOpacity={0.9} onPress={() => setLightboxUri(report.foto_url!)}>
              <Image source={{ uri: report.foto_url }} style={styles.fotoImage} resizeMode="contain" />
            </TouchableOpacity>
          </View>
        )}

        {/* Pending items grouped by trade — each with its own image */}
        {groups.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="check-circle" size={28} color={colors.faint} />
            <Text style={styles.emptyText}>
              {report?.status === 'processing' ? 'Procesando informe…' : 'Sin pendientes detectados'}
            </Text>
          </View>
        ) : (
          groups.map((g, i) => (
            <TradeGroup
              key={g.trade}
              trade={g.trade}
              items={g.items}
              index={i}
              itemImages={itemImages}
              frameUrls={frameUrls}
              uploadingId={uploadingImageId}
              matchingFrames={matchingFrames}
              onPickImage={handlePickItemImage}
              onImagePress={setLightboxUri}
              onReplaceFrame={setFramePickerItemId}
            />
          ))
        )}

        {/* Actions */}
        <View style={styles.actionsArea}>
          <TouchableOpacity
            style={styles.btnPrimary}
            activeOpacity={0.85}
            onPress={() => setPreviewVisible(true)}
            disabled={!report}
          >
            <Feather name="file-text" size={15} color="#FFFFFF" />
            <Text style={styles.btnPrimaryText}>Vista previa del PDF</Text>
          </TouchableOpacity>

          {!isDemoMode && (
            <TouchableOpacity
              style={styles.btnSecondary}
              activeOpacity={0.85}
              onPress={() => setChangeSheetVisible(true)}
            >
              <Feather name="edit-2" size={15} color={colors.crema} />
              <Text style={styles.btnSecondaryText}>Solicitar cambios a la IA</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footer}>Generado por MERIDIANO · Análisis por GPT-4o</Text>
      </ScrollView>

      {/* ── PDF Preview Modal ─────────────────────────────────────────── */}
      <Modal
        visible={previewVisible}
        animationType="slide"
        onRequestClose={() => setPreviewVisible(false)}
      >
        <SafeAreaView style={styles.previewSafe} edges={['top']}>
          <View style={styles.previewHeader}>
            <TouchableOpacity style={styles.previewCloseBtn} onPress={() => setPreviewVisible(false)} activeOpacity={0.7}>
              <Feather name="x" size={16} color={colors.crema} />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>Vista previa</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView style={styles.previewScroll} contentContainerStyle={styles.previewScrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.pdfPage}>
              {/* PDF header */}
              <View style={styles.pdfPageHeader}>
                <View style={styles.pdfBrandRow}>
                  {studio?.logo_url ? (
                    <TouchableOpacity activeOpacity={0.85} onPress={() => setLightboxUri(studio.logo_url!)}>
                      <Image source={{ uri: studio.logo_url }} style={styles.pdfLogo} />
                    </TouchableOpacity>
                  ) : null}
                  <View>
                    <Text style={styles.pdfBrandName}>MERIDIANO</Text>
                    {studio?.name ? <Text style={styles.pdfStudioName}>{studio.name}</Text> : null}
                  </View>
                </View>
                <View style={styles.pdfMetaBlock}>
                  {report && <Text style={styles.pdfMetaText}>{formatDate(report.created_at)}</Text>}
                  {report?.projects?.name && <Text style={styles.pdfMetaText}>{report.projects.name}</Text>}
                </View>
              </View>
              <View style={styles.pdfHeaderDivider} />

              {/* Title */}
              <View style={styles.pdfTitleRow}>
                {report?.projects?.logo_url ? (
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setLightboxUri(report.projects!.logo_url!)}>
                    <Image source={{ uri: report.projects.logo_url }} style={styles.pdfProjectLogo} resizeMode="contain" />
                  </TouchableOpacity>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.pdfDocTitle}>
                    {isOficina ? 'Observación Oficina Técnica' : 'Informe de Contratistas'}
                  </Text>
                  <Text style={styles.pdfDocSubtitle}>{report?.projects?.name ?? '—'}</Text>
                </View>
              </View>

              {/* Badge */}
              <View style={[styles.pdfBadge, isOficina && styles.pdfBadgeOficina]}>
                <Text style={[styles.pdfBadgeText, isOficina && styles.pdfBadgeTextOficina]}>
                  {isOficina ? 'Oficina técnica' : 'Contratistas'}
                </Text>
              </View>

              {/* Summary row */}
              <View style={styles.pdfSummary}>
                {[
                  { label: 'Pendientes', value: String(items.length) },
                  { label: 'Proyecto', value: report?.projects?.name ?? '—' },
                  { label: 'Rubro', value: rubroLabel || '—' },
                ].map((s) => (
                  <View key={s.label} style={styles.pdfSummaryItem}>
                    <Text style={styles.pdfSummaryLabel}>{s.label}</Text>
                    <Text style={styles.pdfSummaryValue} numberOfLines={1}>{s.value}</Text>
                  </View>
                ))}
              </View>

              {/* Note */}
              {report?.note && (
                <View style={styles.pdfNote}>
                  <Text style={styles.pdfNoteText}>"{report.note}"</Text>
                </View>
              )}

              {/* Foto anotada */}
              {report?.foto_url && (
                <View style={styles.pdfFotoSection}>
                  <Text style={styles.pdfFotoLabel}>FOTO CON INDICACIONES</Text>
                  <Image source={{ uri: report.foto_url }} style={styles.pdfFotoImg} resizeMode="contain" />
                </View>
              )}

              {/* Items — each with image below */}
              <View style={styles.pdfItemsSection}>
                {items.map((item, i) => (
                  <View key={item.id}>
                    {/* Row — tap to edit */}
                    <TouchableOpacity
                      style={[styles.pdfItemRow, i % 2 === 1 && styles.pdfItemRowAlt]}
                      onPress={() => { setEditingItem({ id: item.id, description: item.description }); setEditText(item.description); }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.pdfItemTop}>
                        <Text style={styles.pdfTdTrade}>{item.trade ?? '—'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.pdfTdStatus}>{item.status}</Text>
                          <Feather name="edit-2" size={8} color="#CCC" />
                        </View>
                      </View>
                      <Text style={styles.pdfTdDesc}>{item.description}</Text>
                    </TouchableOpacity>

                    {/* Frame image (AI-matched) */}
                    {item.frame_id && frameUrls[item.frame_id] ? (
                      <View style={styles.pdfItemImageWrap}>
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setLightboxUri(frameUrls[item.frame_id!])}>
                          <Image source={{ uri: frameUrls[item.frame_id] }} style={styles.pdfItemImage} resizeMode="contain" />
                        </TouchableOpacity>
                        <View style={styles.pdfItemFrameRow}>
                          <View style={styles.itemFrameBadge}>
                            <Feather name="video" size={9} color={colors.gris} />
                            <Text style={styles.itemFrameBadgeText}>Captura IA</Text>
                          </View>
                          <TouchableOpacity onPress={() => setFramePickerItemId(item.id)} activeOpacity={0.8}>
                            <Text style={styles.itemReplaceBtnText}>Reemplazar</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    {/* Manual photo */}
                    {itemImages[item.id] ? (
                      <View style={styles.pdfItemImageWrap}>
                        <TouchableOpacity activeOpacity={0.9} onPress={() => setLightboxUri(itemImages[item.id])}>
                          <Image source={{ uri: itemImages[item.id] }} style={styles.pdfItemImage} resizeMode="cover" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.pdfItemReplaceBtn}
                          onPress={() => handlePickItemImage(item.id)}
                          activeOpacity={0.8}
                          disabled={uploadingImageId === item.id}
                        >
                          {uploadingImageId === item.id
                            ? <ActivityIndicator size="small" color={colors.gris} />
                            : <><Feather name="refresh-cw" size={10} color={colors.gris} /><Text style={styles.itemReplaceBtnText}>Reemplazar</Text></>
                          }
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.pdfItemAddBtn}
                        onPress={() => handlePickItemImage(item.id)}
                        activeOpacity={0.8}
                        disabled={uploadingImageId === item.id}
                      >
                        {uploadingImageId === item.id
                          ? <ActivityIndicator size="small" color={colors.gris} />
                          : <><Feather name="camera" size={12} color={colors.gris} /><Text style={styles.itemAddImageText}>Agregar foto</Text></>
                        }
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {items.length === 0 && (
                  <View style={styles.pdfEmptyRow}>
                    <Text style={styles.pdfEmptyText}>Sin pendientes</Text>
                  </View>
                )}
              </View>

              {/* Footer */}
              <View style={styles.pdfFooterDivider} />
              <Text style={styles.pdfFooterText}>Generado por MERIDIANO · Análisis por GPT-4o</Text>
            </View>
          </ScrollView>

          {/* Bottom actions */}
          <View style={styles.previewActions}>
            {!isDemoMode && (
              <TouchableOpacity
                style={styles.previewBtnSecondary}
                activeOpacity={0.85}
                onPress={() => { setPreviewVisible(false); setChangeSheetVisible(true); }}
              >
                <Feather name="edit-2" size={14} color={colors.crema} />
                <Text style={styles.previewBtnSecondaryText}>Solicitar cambios</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.previewBtnPrimary, exporting && { opacity: 0.6 }]}
              activeOpacity={0.85}
              onPress={handleExportPDF}
              disabled={exporting}
            >
              {exporting
                ? <ActivityIndicator color="#FFF" size="small" />
                : <>
                    <Feather name="share-2" size={14} color="#FFF" />
                    <Text style={styles.previewBtnPrimaryText}>Compartir PDF</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* ── Change Request Sheet ──────────────────────────────────────── */}
      <BottomSheet visible={changeSheetVisible} onClose={() => setChangeSheetVisible(false)} avoidKeyboard>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Solicitar cambios</Text>
              <Text style={styles.sheetSubtitle}>La IA revisará y ajustará el informe</Text>
            </View>
            <TouchableOpacity onPress={() => setChangeSheetVisible(false)} activeOpacity={0.7}>
              <Feather name="x" size={18} color={colors.gris} />
            </TouchableOpacity>
          </View>

          <View style={styles.sheetInputWrap}>
            <TextInput
              style={styles.sheetInput}
              value={changeRequest}
              onChangeText={setChangeRequest}
              placeholder="Ej: El ítem del tablero eléctrico ya fue resuelto. Agregar observación sobre humedad en muro norte..."
              placeholderTextColor={colors.faint}
              multiline
              numberOfLines={5}
              selectionColor={colors.arena}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.sheetBtn, (!changeRequest.trim() || requesting) && styles.sheetBtnDisabled]}
            onPress={handleRequestChange}
            activeOpacity={0.85}
            disabled={!changeRequest.trim() || requesting}
          >
            {requesting
              ? <ActivityIndicator color="#FFF" size="small" />
              : <>
                  <Feather name="cpu" size={15} color="#FFF" />
                  <Text style={styles.sheetBtnText}>Aplicar cambios con IA</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* ── Frame Picker Sheet ───────────────────────────────────── */}
      <BottomSheet visible={!!framePickerItemId} onClose={() => setFramePickerItemId(null)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Elegir captura</Text>
              <Text style={styles.sheetSubtitle}>Seleccioná el frame que mejor representa este pendiente</Text>
            </View>
            <TouchableOpacity onPress={() => setFramePickerItemId(null)} activeOpacity={0.7}>
              <Feather name="x" size={18} color={colors.gris} />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.framePickerRow}
          >
            {/* Option: no frame */}
            <TouchableOpacity
              style={styles.framePickerNoFrame}
              onPress={() => { if (framePickerItemId) handleRemoveFrame(framePickerItemId); }}
              activeOpacity={0.8}
            >
              <Feather name="x-circle" size={20} color={colors.gris} />
              <Text style={styles.framePickerNoFrameText}>Sin captura</Text>
            </TouchableOpacity>
            {frames.map((frame) => {
              const uri = frameUrls[frame.id];
              if (!uri) return null;
              const currentItem = items.find((i) => i.id === framePickerItemId);
              const isSelected = currentItem?.frame_id === frame.id;
              return (
                <TouchableOpacity
                  key={frame.id}
                  style={[styles.framePickerThumb, isSelected && styles.framePickerThumbSelected]}
                  onPress={() => { if (framePickerItemId) handleAssignFrame(framePickerItemId, frame.id); }}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri }} style={styles.framePickerImg} resizeMode="cover" />
                  <Text style={styles.framePickerSec}>{frame.timestamp_sec}s</Text>
                  {isSelected && (
                    <View style={styles.framePickerCheckBadge}>
                      <Feather name="check" size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {frames.length > 0 && (
            <TouchableOpacity
              style={[styles.sheetBtn, matchingFrames && { opacity: 0.5 }]}
              onPress={() => { setFramePickerItemId(null); matchFramesToItems(); }}
              disabled={matchingFrames}
              activeOpacity={0.85}
            >
              {matchingFrames
                ? <ActivityIndicator color="#FFF" size="small" />
                : <><Feather name="cpu" size={15} color="#FFF" /><Text style={styles.sheetBtnText}>Re-analizar con IA</Text></>
              }
            </TouchableOpacity>
          )}
        </View>
      </BottomSheet>

      {/* ── Lightbox ──────────────────────────────────────────────── */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <TouchableOpacity style={styles.lightboxBg} activeOpacity={1} onPress={() => setLightboxUri(null)}>
          {!!lightboxUri && (
            <Image source={{ uri: lightboxUri }} style={styles.lightboxImg} resizeMode="contain" />
          )}
        </TouchableOpacity>
      </Modal>

      {/* ── Edit Description Sheet ────────────────────────────────── */}
      <BottomSheet visible={!!editingItem} onClose={() => setEditingItem(null)} avoidKeyboard>
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Editar pendiente</Text>
              <Text style={styles.sheetSubtitle}>El cambio se guarda en el informe</Text>
            </View>
            <TouchableOpacity onPress={() => setEditingItem(null)} activeOpacity={0.7}>
              <Feather name="x" size={18} color={colors.gris} />
            </TouchableOpacity>
          </View>
          <View style={styles.sheetInputWrap}>
            <TextInput
              style={styles.sheetInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              numberOfLines={4}
              selectionColor={colors.arena}
              autoFocus
              textAlignVertical="top"
            />
          </View>
          <TouchableOpacity
            style={[styles.sheetBtn, (!editText.trim() || savingEdit) && styles.sheetBtnDisabled]}
            onPress={saveItemDescription}
            disabled={!editText.trim() || savingEdit}
            activeOpacity={0.85}
          >
            {savingEdit
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.sheetBtnText}>Guardar cambio</Text>
            }
          </TouchableOpacity>
        </View>
      </BottomSheet>

    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  topBarCenter: { alignItems: 'center', gap: 2, flex: 1, paddingHorizontal: spacing.sm },
  topEyebrow: {
    fontFamily: fonts.mono.regular, fontSize: 9, letterSpacing: 0.8,
    textTransform: 'uppercase', color: colors.gris, textAlign: 'center',
  },
  topTitle: { fontFamily: fonts.archivo.bold, fontSize: 17, color: colors.crema, letterSpacing: -0.3 },

  scrollContent: { paddingBottom: 48, gap: spacing.lg },

  summaryCard: {
    marginHorizontal: spacing.xl, backgroundColor: colors.panel,
    borderRadius: 20, padding: 18, gap: 10,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2,
  },
  studioBrand: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 2,
  },
  studioLogoSlot: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: colors.chip,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  studioLogoImage: { width: '100%', height: '100%' },
  studioLogoInitials: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.crema, letterSpacing: -0.3 },
  studioNameText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.gris, letterSpacing: -0.1 },

  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    height: 24, paddingHorizontal: 10, borderRadius: 12, backgroundColor: 'rgba(217,119,87,0.10)',
  },
  typeChipOficina: { backgroundColor: 'rgba(91,127,212,0.10)' },
  typeChipText: { fontFamily: fonts.archivo.bold, fontSize: 10, letterSpacing: 0.2, color: colors.arena },
  typeChipTextOficina: { color: '#5B7FD4' },

  summaryProject: { fontFamily: fonts.archivo.bold, fontSize: 17, color: colors.crema, letterSpacing: -0.3 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  summaryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: colors.chip,
  },
  summaryChipText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.gris },
  noteText: {
    fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.gris,
    fontStyle: 'italic', lineHeight: 18,
  },

  fotoBlock: { marginHorizontal: spacing.xl, gap: 8 },
  fotoLabel: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  fotoImage: {
    width: '100%', aspectRatio: 4 / 3, borderRadius: 16,
    backgroundColor: colors.chip,
  },

  sectorBlock: { paddingHorizontal: spacing.xl, gap: 10 },
  sectorHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 2,
  },
  sectorName: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema, letterSpacing: -0.2 },
  sectorCount: { fontFamily: fonts.mono.regular, fontSize: 10, color: colors.gris, letterSpacing: 0.5 },

  itemCard: {
    flexDirection: 'row', gap: 12,
    backgroundColor: colors.panel, borderRadius: 16, padding: 14,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  itemDot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.arena,
    marginTop: 6, flexShrink: 0,
  },
  itemBody: { flex: 1, gap: 6 },
  itemDescription: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.crema, lineHeight: 19 },

  itemImageWrap: { gap: 6 },
  itemImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: colors.chip },
  itemReplaceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    height: 26, paddingHorizontal: 10, borderRadius: 13,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.tinta,
  },
  itemReplaceBtnText: { fontFamily: fonts.archivo.bold, fontSize: 10, color: colors.gris },
  itemAddImageBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    height: 26, paddingHorizontal: 10, borderRadius: 13,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', backgroundColor: colors.tinta,
  },
  itemAddImageText: { fontFamily: fonts.archivo.bold, fontSize: 10, color: colors.gris },

  chip: {
    height: 22, borderRadius: 11, paddingHorizontal: 8,
    backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
  },
  chipText: { fontFamily: fonts.archivo.bold, fontSize: 9, letterSpacing: 0.3, color: colors.crema },

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  emptyText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.faint },

  actionsArea: { marginHorizontal: spacing.xl, gap: spacing.sm },
  btnPrimary: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: '#FFFFFF' },
  btnSecondary: {
    height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
  },
  btnSecondaryText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.crema },

  footer: {
    fontFamily: fonts.mono.regular, fontSize: 9.5, letterSpacing: 0.4,
    textTransform: 'uppercase', color: colors.faint, textAlign: 'center', paddingHorizontal: spacing.xl,
  },

  // ── Preview modal ────────────────────────────────────────────────
  previewSafe: { flex: 1, backgroundColor: '#ECEAE4' },
  previewHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    backgroundColor: colors.tinta,
  },
  previewCloseBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  previewTitle: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  previewScroll: { flex: 1 },
  previewScrollContent: { padding: 16, paddingBottom: 32 },

  pdfPage: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  pdfPageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  pdfBrandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pdfLogo: { width: 40, height: 40, borderRadius: 8 },
  pdfBrandName: { fontFamily: fonts.archivo.bold, fontSize: 16, color: '#12151A', letterSpacing: -0.4 },
  pdfStudioName: { fontFamily: fonts.archivo.semibold, fontSize: 11, color: '#888', marginTop: 1 },
  pdfMetaBlock: { alignItems: 'flex-end', gap: 2 },
  pdfMetaText: { fontFamily: fonts.archivo.semibold, fontSize: 10, color: '#888' },
  pdfHeaderDivider: { height: 2, backgroundColor: '#D97757', marginBottom: 16 },

  pdfDocTitle: { fontFamily: fonts.archivo.bold, fontSize: 18, color: '#12151A', letterSpacing: -0.4, marginBottom: 3 },
  pdfDocSubtitle: { fontFamily: fonts.archivo.semibold, fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },

  pdfBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 16,
    backgroundColor: 'rgba(217,119,87,0.12)',
  },
  pdfBadgeOficina: { backgroundColor: 'rgba(91,127,212,0.12)' },
  pdfBadgeText: { fontFamily: fonts.archivo.bold, fontSize: 9, letterSpacing: 0.4, color: '#C05A30' },
  pdfBadgeTextOficina: { color: '#3A5FB0' },

  pdfSummary: { flexDirection: 'row', backgroundColor: '#F7F4EE', borderRadius: 8, padding: 12, marginBottom: 18, gap: 8 },
  pdfSummaryItem: { flex: 1 },
  pdfSummaryLabel: { fontFamily: fonts.mono.regular, fontSize: 8, letterSpacing: 0.8, textTransform: 'uppercase', color: '#888', marginBottom: 3 },
  pdfSummaryValue: { fontFamily: fonts.archivo.bold, fontSize: 12, color: '#12151A' },

  pdfNote: { borderLeftWidth: 3, borderLeftColor: '#D97757', paddingLeft: 12, paddingVertical: 8, backgroundColor: '#FFFBF8', borderRadius: 4, marginBottom: 14 },
  pdfNoteText: { fontFamily: fonts.archivo.semibold, fontSize: 11, color: '#555', fontStyle: 'italic' },

  pdfFotoSection: { marginVertical: 14 },
  pdfFotoLabel: { fontFamily: fonts.mono.regular, fontSize: 8, letterSpacing: 1, textTransform: 'uppercase', color: '#888', marginBottom: 8, fontWeight: '700' },
  pdfFotoImg: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: '#F0EDE8' },

  pdfTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 3 },
  pdfProjectLogo: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F0EDE8', flexShrink: 0 },

  // Items list in preview
  pdfItemsSection: { gap: 2, marginTop: 8 },
  pdfItemRow: {
    paddingHorizontal: 10, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F0EDE8',
  },
  pdfItemRowAlt: { backgroundColor: '#FAFAFA' },
  pdfItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pdfTdTrade: { fontFamily: fonts.archivo.bold, fontSize: 9, color: '#888', textTransform: 'uppercase', letterSpacing: 0.4 },
  pdfTdStatus: { fontFamily: fonts.archivo.semibold, fontSize: 9, color: '#AAA', textTransform: 'capitalize' },
  pdfTdDesc: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: '#12151A', lineHeight: 17 },

  pdfItemImageWrap: { marginHorizontal: 10, marginBottom: 6, gap: 6 },
  pdfItemFrameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  pdfItemImage: { width: '100%', aspectRatio: 16 / 9, borderRadius: 8, backgroundColor: '#F0EDE8' },
  pdfItemReplaceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    height: 24, paddingHorizontal: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.tinta,
  },
  pdfItemAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    height: 24, paddingHorizontal: 10, borderRadius: 12, marginHorizontal: 10, marginBottom: 6,
    borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed',
  },

  pdfEmptyRow: { paddingVertical: 20, alignItems: 'center' },
  pdfEmptyText: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: '#AAA' },

  pdfFooterDivider: { height: 1, backgroundColor: '#EEE', marginTop: 20, marginBottom: 10 },
  pdfFooterText: { fontFamily: fonts.archivo.semibold, fontSize: 8.5, color: '#AAA', textAlign: 'center', letterSpacing: 0.4, textTransform: 'uppercase' },

  previewActions: {
    flexDirection: 'row', gap: spacing.sm,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    backgroundColor: colors.tinta, borderTopWidth: 1, borderTopColor: colors.border,
  },
  previewBtnSecondary: {
    flex: 1, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: colors.panel, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  previewBtnSecondaryText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema },
  previewBtnPrimary: {
    flex: 1, height: 50, borderRadius: 25, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  previewBtnPrimaryText: { fontFamily: fonts.archivo.bold, fontSize: 13, color: '#FFFFFF' },

  // ── Change request sheet ─────────────────────────────────────────
  sheet: {
    backgroundColor: colors.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl, paddingBottom: 36, paddingTop: 12, gap: spacing.lg,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 4,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: fonts.archivo.bold, fontSize: 18, color: colors.crema, letterSpacing: -0.3 },
  sheetSubtitle: { fontFamily: fonts.archivo.semibold, fontSize: 12, color: colors.gris, marginTop: 3 },

  sheetInputWrap: {
    backgroundColor: colors.chip, borderRadius: 18,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  sheetInput: {
    fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.crema,
    minHeight: 100, textAlignVertical: 'top',
  },
  sheetBtn: {
    height: 54, borderRadius: 27, backgroundColor: colors.crema,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  sheetBtnDisabled: { opacity: 0.35 },
  sheetBtnText: { fontFamily: fonts.archivo.bold, fontSize: 15, color: '#FFFFFF', letterSpacing: 0.1 },

  // ── Frame matching status ────────────────────────────────────────
  itemFrameActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  itemFrameBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    height: 20, paddingHorizontal: 7, borderRadius: 10, backgroundColor: colors.chip,
  },
  itemFrameBadgeText: { fontFamily: fonts.mono.regular, fontSize: 9, color: colors.gris, letterSpacing: 0.3 },
  itemMatchingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6 },
  itemMatchingText: { fontFamily: fonts.archivo.semibold, fontSize: 11, color: colors.faint },

  // ── Frame picker ─────────────────────────────────────────────────
  framePickerRow: { flexDirection: 'row', gap: 10, paddingVertical: 4 },
  framePickerNoFrame: {
    width: 90, height: 64, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4, flexShrink: 0,
  },
  framePickerNoFrameText: { fontFamily: fonts.archivo.bold, fontSize: 9, color: colors.gris },
  framePickerThumb: {
    width: 120, height: 80, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
    borderWidth: 2, borderColor: 'transparent',
  },
  framePickerThumbSelected: { borderColor: colors.arena },
  framePickerImg: { width: '100%', height: '100%' },
  framePickerSec: {
    position: 'absolute', bottom: 4, left: 6,
    fontFamily: fonts.mono.regular, fontSize: 9, color: '#FFF',
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
  },
  framePickerCheckBadge: {
    position: 'absolute', top: 4, right: 4,
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.arena,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Lightbox ─────────────────────────────────────────────────────
  lightboxBg: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center', justifyContent: 'center',
  },
  lightboxImg: { width: '100%', height: '80%' },
});
