import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';

interface Marker {
  id: string;
  x: number;
  y: number;
  label: string;
  status: 'pendiente' | 'resuelto';
}

const MOCK_MARKERS: Marker[] = [
  { id: '1', x: 0.22, y: 0.35, label: 'Tablero sin cerrar', status: 'pendiente' },
  { id: '2', x: 0.55, y: 0.48, label: 'Cableado incompleto', status: 'pendiente' },
  { id: '3', x: 0.72, y: 0.25, label: 'Luminaria colocada', status: 'resuelto' },
  { id: '4', x: 0.38, y: 0.68, label: 'Tomacorrientes sin tapar', status: 'pendiente' },
];

const PLANO_IMAGE = 'https://picsum.photos/id/180/1200/800';

export default function VisorPlanoScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);

  const IMAGE_W = 340;
  const IMAGE_H = 226;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={18} color={colors.crema} />
        </TouchableOpacity>
        <View style={styles.topCenter}>
          <Text style={styles.topTitle}>Planta Baja</Text>
          <Text style={styles.topSub}>Torre Palermo</Text>
        </View>
        <TouchableOpacity style={styles.circleBtn} activeOpacity={0.8}>
          <Feather name="share-2" size={16} color={colors.crema} />
        </TouchableOpacity>
      </View>

      {/* Plan viewer */}
      <View style={styles.viewerWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.viewerScroll}
          bounces
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.viewerScrollV}
            bounces
          >
            <View style={{ width: IMAGE_W, height: IMAGE_H }}>
              <Image
                source={{ uri: PLANO_IMAGE }}
                style={{ width: IMAGE_W, height: IMAGE_H }}
                resizeMode="cover"
              />
              {MOCK_MARKERS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.marker,
                    {
                      left: m.x * IMAGE_W - 13,
                      top: m.y * IMAGE_H - 13,
                    },
                    m.status === 'resuelto' && styles.markerResuelto,
                    selectedMarker === m.id && styles.markerSelected,
                  ]}
                  onPress={() => setSelectedMarker(selectedMarker === m.id ? null : m.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.markerText}>{m.id}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </ScrollView>
      </View>

      {/* Marker list */}
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetLabel}>MARCADORES — {MOCK_MARKERS.length} ÍTEMS</Text>
        <ScrollView showsVerticalScrollIndicator={false} style={styles.markerList}>
          {MOCK_MARKERS.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.markerRow, selectedMarker === m.id && styles.markerRowActive]}
              onPress={() => setSelectedMarker(selectedMarker === m.id ? null : m.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.markerBadge, m.status === 'resuelto' && styles.markerBadgeResuelto]}>
                <Text style={styles.markerBadgeText}>{m.id}</Text>
              </View>
              <Text style={styles.markerLabel} numberOfLines={1}>{m.label}</Text>
              {m.status === 'resuelto' ? (
                <Feather name="check-circle" size={16} color={colors.success} />
              ) : (
                <Feather name="circle" size={16} color={colors.faint} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.tinta,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  circleBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#12151A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 14,
    elevation: 4,
  },
  topCenter: {
    alignItems: 'center',
    gap: 1,
  },
  topTitle: {
    fontFamily: fonts.archivo.bold,
    fontSize: 16,
    color: colors.crema,
    letterSpacing: -0.2,
  },
  topSub: {
    fontFamily: fonts.mono.regular,
    fontSize: 9.5,
    color: colors.gris,
    letterSpacing: 0.4,
  },
  viewerWrap: {
    marginHorizontal: spacing.xl,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.chip,
    flex: 1,
    maxHeight: 260,
  },
  viewerScroll: {
    flexGrow: 1,
  },
  viewerScrollV: {
    flexGrow: 1,
  },
  marker: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerResuelto: {
    backgroundColor: colors.success,
  },
  markerSelected: {
    transform: [{ scale: 1.2 }],
  },
  markerText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  sheet: {
    marginTop: spacing.lg,
    flex: 1,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  sheetLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.gris,
    fontWeight: '700',
  },
  markerList: {
    flex: 1,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  markerRowActive: {
    backgroundColor: 'rgba(217,119,87,0.05)',
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  markerBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  markerBadgeResuelto: {
    backgroundColor: colors.success,
  },
  markerBadgeText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  markerLabel: {
    flex: 1,
    fontFamily: fonts.archivo.semibold,
    fontSize: 14,
    color: colors.crema,
  },
});
