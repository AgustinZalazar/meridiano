import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, spacing, fonts } from '../constants/theme';

type ChangeType = 'material' | 'plazo' | 'alcance' | 'otro';
type Priority = 'alta' | 'media' | 'baja';

const CHANGE_TYPES: { value: ChangeType; label: string; icon: string }[] = [
  { value: 'material', label: 'Material', icon: 'package' },
  { value: 'plazo', label: 'Plazo', icon: 'calendar' },
  { value: 'alcance', label: 'Alcance', icon: 'maximize-2' },
  { value: 'otro', label: 'Otro', icon: 'more-horizontal' },
];

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'alta', label: 'Alta', color: '#C0392B' },
  { value: 'media', label: 'Media', color: colors.arena },
  { value: 'baja', label: 'Baja', color: colors.gris },
];

type FeatherIconName = React.ComponentProps<typeof Feather>['name'];

export default function SolicitudCambioScreen() {
  const router = useRouter();
  const [type, setType] = useState<ChangeType>('material');
  const [priority, setPriority] = useState<Priority>('media');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState('');

  const canSend = description.length > 10;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Feather name="x" size={16} color={colors.crema} />
          </TouchableOpacity>
        </View>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>NUEVA SOLICITUD</Text>
          <Text style={styles.heading}>Solicitud{'\n'}de cambio</Text>
        </View>

        <View style={styles.form}>
          {/* Type */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>TIPO DE CAMBIO</Text>
            <View style={styles.typeGrid}>
              {CHANGE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.typeCard, type === t.value && styles.typeCardActive]}
                  onPress={() => setType(t.value)}
                  activeOpacity={0.8}
                >
                  <Feather
                    name={t.icon as FeatherIconName}
                    size={18}
                    color={type === t.value ? '#FFFFFF' : colors.gris}
                  />
                  <Text style={[styles.typeLabel, type === t.value && styles.typeLabelActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>PRIORIDAD</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.priorityBtn,
                    priority === p.value && { backgroundColor: p.color, borderColor: p.color },
                  ]}
                  onPress={() => setPriority(p.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.priorityText, priority === p.value && styles.priorityTextActive]}>
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>DESCRIPCIÓN</Text>
            <View style={styles.textArea}>
              <TextInput
                style={styles.textInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Describí el cambio solicitado…"
                placeholderTextColor={colors.faint}
                multiline
                numberOfLines={4}
                selectionColor={colors.crema}
              />
            </View>
          </View>

          {/* Impact */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>IMPACTO EN COSTO / PLAZO</Text>
            <View style={styles.textArea}>
              <TextInput
                style={styles.textInput}
                value={impact}
                onChangeText={setImpact}
                placeholder="Ej. +3 días, +$120.000 materiales…"
                placeholderTextColor={colors.faint}
                multiline
                numberOfLines={2}
                selectionColor={colors.crema}
              />
            </View>
          </View>
        </View>

        <View style={styles.cta}>
          <TouchableOpacity
            style={[styles.btnPrimary, !canSend && styles.btnPrimaryDisabled]}
            disabled={!canSend}
            activeOpacity={0.85}
            onPress={() => router.back()}
          >
            <Text style={styles.btnPrimaryText}>Enviar solicitud</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCancel} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.btnCancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.tinta,
  },
  scroll: {
    paddingBottom: 48,
  },
  topBar: {
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
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: 4,
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
  form: {
    paddingHorizontal: spacing.xl,
    gap: spacing.xl,
  },
  field: {
    gap: spacing.sm,
  },
  fieldLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.gris,
    fontWeight: '700',
  },
  typeGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  typeCard: {
    flex: 1,
    height: 72,
    borderRadius: 18,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#12151A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  typeCardActive: {
    backgroundColor: colors.crema,
  },
  typeLabel: {
    fontFamily: fonts.archivo.bold,
    fontSize: 11.5,
    color: colors.gris,
  },
  typeLabelActive: {
    color: '#FFFFFF',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityBtn: {
    flex: 1,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 13,
    color: colors.crema,
  },
  priorityTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  textInput: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 14,
    color: colors.crema,
    minHeight: 64,
    lineHeight: 21,
  },
  cta: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  btnPrimary: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.crema,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryDisabled: {
    backgroundColor: colors.faint,
  },
  btnPrimaryText: {
    fontFamily: fonts.archivo.bold,
    fontSize: 15,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  btnCancel: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontFamily: fonts.archivo.semibold,
    fontSize: 14,
    color: colors.gris,
    textDecorationLine: 'underline',
  },
});
