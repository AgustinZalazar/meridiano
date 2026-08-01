import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../../constants/theme';
import { useStudio } from '../../lib/use-studio';

interface PendingItem {
  description: string;
  trade?: string;
  frameNote?: string;
  imageUri?: string;
}

interface Sector {
  name: string;
  items: PendingItem[];
}

const MOCK_REPORT = {
  date: '22 JUL 2026',
  rubro: 'RB-002 · Instalaciones Eléctricas',
  project: 'Edificio Costanera Norte',
  duration: '4:32 min · 54 frames',
  sectors: [
    {
      name: 'Hall de Entrada — PB',
      items: [
        {
          description: 'Cableado del tablero principal sin terminar, faltan conectar 3 circuitos identificados con cinta azul.',
          trade: 'ELECTRICISTA',
          frameNote: 'Frame 4 · t=0:18',
          imageUri: 'https://picsum.photos/id/1048/128/104',
        },
        {
          description: 'Luminaria central pendiente de instalación, el soporte está colocado pero la campana no llegó a obra.',
          frameNote: 'Frame 7 · t=0:31',
          imageUri: 'https://picsum.photos/id/1005/128/104',
        },
      ],
    },
    {
      name: 'Piso 3 — Depto 3A',
      items: [
        {
          description: 'Tomacorrientes del living sin cubrir, hay 4 cajas abiertas que necesitan tapas.',
          trade: 'ELECTRICISTA',
          frameNote: 'Frame 18 · t=1:22',
          imageUri: 'https://picsum.photos/id/366/128/104',
        },
        {
          description: 'Interruptor de la habitación principal colocado al revés, la posición de encendido es hacia abajo.',
          frameNote: 'Frame 23 · t=1:48',
          imageUri: 'https://picsum.photos/id/1036/128/104',
        },
        {
          description: 'Falta pasar el cable del split en la habitación secundaria, el ducto está listo pero sin cable.',
          trade: 'ELECTRICISTA',
          frameNote: 'Frame 27 · t=2:05',
          imageUri: 'https://picsum.photos/id/1053/128/104',
        },
      ],
    },
    {
      name: 'Piso 3 — Depto 3B',
      items: [
        {
          description: 'Caja de pase en el pasillo sin tapón, riesgo de ingreso de roedores.',
          frameNote: 'Frame 31 · t=2:24',
          imageUri: 'https://picsum.photos/id/1071/128/104',
        },
      ],
    },
    {
      name: 'Azotea',
      items: [
        {
          description: 'Tablero de medidores sin cerrar, acceso libre a bornes con tensión.',
          trade: 'ELECTRICISTA',
          frameNote: 'Frame 47 · t=3:42',
          imageUri: 'https://picsum.photos/id/42/128/104',
        },
        {
          description: 'Pararrayos pendiente de conexión a tierra.',
          frameNote: 'Frame 51 · t=3:58',
          imageUri: 'https://picsum.photos/id/1074/128/104',
        },
      ],
    },
  ] as Sector[],
};

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

function ItemCard({ item }: { item: PendingItem }) {
  return (
    <View style={styles.itemCard}>
      <View style={styles.imageSlot}>
        {item.imageUri && (
          <Image source={{ uri: item.imageUri }} style={styles.slotImage} />
        )}
      </View>
      <View style={styles.itemBody}>
        <Text style={styles.itemDescription}>{item.description}</Text>
        <View style={styles.itemMeta}>
          {item.trade && <Chip label={item.trade} />}
          {item.frameNote && (
            <Text style={styles.frameNote}>{item.frameNote}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

function SectorBlock({ sector, showAll }: { sector: Sector; showAll: boolean }) {
  const visible = showAll ? sector.items : sector.items.slice(0, 2);

  return (
    <View style={styles.sectorBlock}>
      <View style={styles.sectorHeader}>
        <Text style={styles.sectorName}>{sector.name}</Text>
        <Text style={styles.sectorCount}>{sector.items.length}</Text>
      </View>
      {visible.map((item, i) => (
        <ItemCard key={i} item={item} />
      ))}
    </View>
  );
}

export default function InformeScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const { studio } = useStudio();
  const isOficina = type === 'oficina';
  const typeLabel = isOficina ? 'Observación oficina técnica' : 'Informe contratistas';
  const totalPendientes = MOCK_REPORT.sectors.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="arrow-left" size={18} color={colors.crema} />
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.topEyebrow}>{MOCK_REPORT.date} · {MOCK_REPORT.rubro}</Text>
          <Text style={styles.topTitle}>Informe</Text>
        </View>
        <TouchableOpacity style={styles.circleBtn} activeOpacity={0.8}>
          <Feather name="share-2" size={16} color={colors.crema} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Summary card */}
        <View style={styles.summaryCard}>
          {studio && (
            <View style={styles.studioBrand}>
              <View style={styles.studioLogoSlot}>
                {studio.logo_url
                  ? <Image source={{ uri: studio.logo_url }} style={styles.studioLogoImage} />
                  : <Text style={styles.studioLogoInitials}>
                      {studio.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                    </Text>
                }
              </View>
              <Text style={styles.studioNameText}>{studio.name}</Text>
            </View>
          )}
          <View style={[styles.typeChip, isOficina && styles.typeChipOficina]}>
            <Feather name={isOficina ? 'briefcase' : 'tool'} size={10} color={isOficina ? '#5B7FD4' : colors.arena} />
            <Text style={[styles.typeChipText, isOficina && styles.typeChipTextOficina]}>{typeLabel}</Text>
          </View>
          <Text style={styles.summaryProject}>{MOCK_REPORT.project}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <Feather name="alert-circle" size={11} color={colors.arena} />
              <Text style={[styles.summaryChipText, { color: colors.arena }]}>{totalPendientes} pendientes</Text>
            </View>
            <View style={styles.summaryChip}>
              <Feather name="video" size={11} color={colors.gris} />
              <Text style={styles.summaryChipText}>{MOCK_REPORT.duration}</Text>
            </View>
          </View>
        </View>

        {/* Sectors */}
        {MOCK_REPORT.sectors.map((sector, i) => (
          <SectorBlock key={i} sector={sector} showAll={i === 0} />
        ))}

        {/* Export area */}
        <View style={styles.exportArea}>
          <TouchableOpacity style={styles.btnSecondary} activeOpacity={0.85}>
            <Feather name="file" size={15} color={colors.crema} />
            <Text style={styles.btnSecondaryText}>Exportar PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnPrimary} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>Ver todos  →</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>Generado por MERIDIANO · Análisis por GPT-4o</Text>
      </ScrollView>
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
  topBarCenter: {
    alignItems: 'center',
    gap: 2,
  },
  topEyebrow: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.gris,
  },
  topTitle: {
    fontFamily: fonts.archivo.bold,
    fontSize: 17,
    color: colors.crema,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingBottom: 48,
    gap: spacing.lg,
  },
  summaryCard: {
    marginHorizontal: spacing.xl,
    backgroundColor: colors.panel,
    borderRadius: 20,
    padding: 18,
    gap: 10,
    shadowColor: '#12151A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  studioBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 2,
  },
  studioLogoSlot: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  studioLogoImage: {
    width: '100%',
    height: '100%',
  },
  studioLogoInitials: {
    fontFamily: fonts.archivo.bold,
    fontSize: 11,
    color: colors.crema,
    letterSpacing: -0.3,
  },
  studioNameText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 13,
    color: colors.gris,
    letterSpacing: -0.1,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(217,119,87,0.10)',
  },
  typeChipOficina: {
    backgroundColor: 'rgba(91,127,212,0.10)',
  },
  typeChipText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 10,
    letterSpacing: 0.2,
    color: colors.arena,
  },
  typeChipTextOficina: {
    color: '#5B7FD4',
  },

  summaryProject: {
    fontFamily: fonts.archivo.bold,
    fontSize: 17,
    color: colors.crema,
    letterSpacing: -0.3,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: colors.chip,
  },
  summaryChipText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 11,
    color: colors.gris,
  },
  sectorBlock: {
    paddingHorizontal: spacing.xl,
    gap: 10,
  },
  sectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 2,
  },
  sectorName: {
    fontFamily: fonts.archivo.bold,
    fontSize: 15,
    color: colors.crema,
    letterSpacing: -0.2,
  },
  sectorCount: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: colors.gris,
    letterSpacing: 0.5,
  },
  itemCard: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: colors.panel,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#12151A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  imageSlot: {
    width: 64,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.chip,
    flexShrink: 0,
    overflow: 'hidden',
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  itemBody: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  itemDescription: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 13,
    color: colors.crema,
    lineHeight: 19,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 9,
    backgroundColor: colors.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 9.5,
    letterSpacing: 0.3,
    color: colors.crema,
  },
  frameNote: {
    fontFamily: fonts.mono.regular,
    fontSize: 9.5,
    color: colors.gris,
    letterSpacing: 0.3,
  },
  exportArea: {
    marginHorizontal: spacing.xl,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  btnSecondary: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  btnSecondaryText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14,
    color: colors.crema,
  },
  btnPrimary: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 14,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  footer: {
    fontFamily: fonts.mono.regular,
    fontSize: 9.5,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.faint,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
});
