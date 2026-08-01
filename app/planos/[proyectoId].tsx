import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';

interface Plano {
  id: string;
  name: string;
  type: string;
  date: string;
  imageUri: string;
}

const MOCK_PLANOS: Record<string, { projectName: string; planos: Plano[] }> = {
  '1': {
    projectName: 'Torre Palermo',
    planos: [
      { id: 'p1', name: 'Planta Baja', type: 'ARQUITECTURA', date: 'Actualizado 15/07/2026', imageUri: 'https://picsum.photos/id/180/300/200' },
      { id: 'p2', name: 'Planta Tipo — Pisos 1-8', type: 'ARQUITECTURA', date: 'Actualizado 10/07/2026', imageUri: 'https://picsum.photos/id/188/300/200' },
      { id: 'p3', name: 'Instalación Eléctrica PB', type: 'INSTALACIONES', date: 'Actualizado 08/07/2026', imageUri: 'https://picsum.photos/id/193/300/200' },
      { id: 'p4', name: 'Instalación Sanitaria', type: 'INSTALACIONES', date: 'Actualizado 02/07/2026', imageUri: 'https://picsum.photos/id/201/300/200' },
      { id: 'p5', name: 'Estructura Cimentación', type: 'ESTRUCTURA', date: 'Actualizado 28/06/2026', imageUri: 'https://picsum.photos/id/206/300/200' },
    ],
  },
  '2': {
    projectName: 'Residencial Nordelta',
    planos: [
      { id: 'p6', name: 'Planta General', type: 'ARQUITECTURA', date: 'Actualizado 12/07/2026', imageUri: 'https://picsum.photos/id/211/300/200' },
      { id: 'p7', name: 'Planta de Techos', type: 'ARQUITECTURA', date: 'Actualizado 09/07/2026', imageUri: 'https://picsum.photos/id/214/300/200' },
    ],
  },
};

function PlanoCard({ plano, onPress }: { plano: Plano; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.thumbnail}>
        <Image source={{ uri: plano.imageUri }} style={styles.thumbnailImage} resizeMode="cover" />
        <View style={styles.typeTag}>
          <Text style={styles.typeTagText}>{plano.type}</Text>
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{plano.name}</Text>
        <Text style={styles.cardDate}>{plano.date}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function PlanosScreen() {
  const router = useRouter();
  const { proyectoId } = useLocalSearchParams<{ proyectoId: string }>();
  const data = MOCK_PLANOS[proyectoId ?? '1'] ?? MOCK_PLANOS['1'];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={18} color={colors.crema} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.circleBtn} activeOpacity={0.8}>
          <Feather name="upload" size={16} color={colors.crema} />
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>PROYECTO</Text>
        <Text style={styles.heading}>Planos</Text>
        <Text style={styles.subheading}>{data.projectName}</Text>
      </View>

      <FlatList
        data={data.planos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PlanoCard plano={item} onPress={() => router.push(`/plano/${item.id}`)} />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        numColumns={2}
        columnWrapperStyle={styles.row}
      />
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
    paddingBottom: spacing.xs,
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
  titleBlock: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 2,
  },
  eyebrow: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    color: colors.gris,
    fontWeight: '700',
  },
  heading: {
    fontFamily: fonts.archivo.bold,
    fontSize: 28,
    color: colors.crema,
    letterSpacing: -0.7,
    lineHeight: 34,
    marginTop: 4,
  },
  subheading: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 14,
    color: colors.gris,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 40,
    gap: 12,
  },
  row: {
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: colors.panel,
    overflow: 'hidden',
    shadowColor: '#12151A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  thumbnail: {
    height: 110,
    backgroundColor: colors.chip,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  typeTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(18,21,26,0.6)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  typeTagText: {
    fontFamily: fonts.mono.regular,
    fontSize: 8.5,
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  cardInfo: {
    padding: 12,
    gap: 3,
  },
  cardName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 13,
    color: colors.crema,
    lineHeight: 18,
  },
  cardDate: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: colors.gris,
    letterSpacing: 0.3,
  },
});
