import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fonts } from '../constants/theme';

export function formatObraDate(date: Date): string {
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface DateFieldProps {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
}

export function DateField({ label, value, onChange, placeholder = 'Seleccionar fecha', minimumDate, maximumDate }: DateFieldProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value ?? new Date());

  function handleChange(_: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      setOpen(false);
      if (date) onChange(date);
    } else {
      if (date) setTempDate(date);
    }
  }

  function handleConfirm() {
    onChange(tempDate);
    setOpen(false);
  }

  return (
    <View style={s.wrapper}>
      <Text style={s.label}>{label}</Text>
      <TouchableOpacity style={s.field} onPress={() => setOpen(true)} activeOpacity={0.75}>
        <Text style={value ? s.value : s.placeholder} numberOfLines={1}>
          {value ? formatObraDate(value) : placeholder}
        </Text>
        <Feather name="calendar" size={16} color={colors.gris} />
      </TouchableOpacity>

      {/* Android: native dialog, no wrapper needed */}
      {Platform.OS === 'android' && open && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display="default"
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}

      {/* iOS: bottom sheet with spinner */}
      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={s.sheetWrapper}>
            <TouchableOpacity style={s.backdrop} onPress={() => setOpen(false)} activeOpacity={1} />
            <View style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
              <View style={s.handle} />
              <View style={s.sheetHeader}>
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                  <Text style={s.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={s.sheetTitle}>{label}</Text>
                <TouchableOpacity onPress={handleConfirm} hitSlop={12}>
                  <Text style={s.confirmText}>Listo</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={s.spinner}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  label: {
    fontFamily: fonts.mono.regular, fontSize: 10, letterSpacing: 1.2,
    textTransform: 'uppercase', color: colors.gris, fontWeight: '700',
  },
  field: {
    height: 52, borderRadius: 16, backgroundColor: colors.panel,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    shadowColor: '#12151A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  value: { fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.crema, flex: 1 },
  placeholder: { fontFamily: fonts.archivo.semibold, fontSize: 15, color: colors.faint, flex: 1 },

  // Bottom sheet (iOS)
  sheetWrapper: { flex: 1, backgroundColor: 'rgba(18,21,26,0.45)' },
  backdrop: { flex: 1 },
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
    paddingHorizontal: spacing.xl, marginBottom: spacing.sm,
  },
  sheetTitle: { fontFamily: fonts.archivo.bold, fontSize: 15, color: colors.crema },
  cancelText: { fontFamily: fonts.archivo.semibold, fontSize: 14, color: colors.gris },
  confirmText: { fontFamily: fonts.archivo.bold, fontSize: 14, color: colors.arena },
  spinner: { height: 180 },
});
