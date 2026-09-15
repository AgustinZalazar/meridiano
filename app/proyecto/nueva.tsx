import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, fonts } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth-context';
import { useStudio } from '../../lib/use-studio';
import { DateField } from '../../components/DateField';
import { uploadProjectImage } from '../../lib/upload-image';

// ─── Types ────────────────────────────────────────────────────────────────────

type PropertyType = 'edificio' | 'casa' | 'local_comercial' | 'oficina' | 'nave_industrial' | 'otro';
type TipoObra     = 'obra_nueva' | 'refaccion' | 'ampliacion' | 'demolicion' | 'otro';

const PROPERTY_TYPE_OPTIONS: { value: PropertyType; label: string; icon: string }[] = [
  { value: 'edificio',        label: 'Edificio', icon: 'layers'         },
  { value: 'casa',            label: 'Casa',     icon: 'home'           },
  { value: 'local_comercial', label: 'Local',    icon: 'shopping-bag'   },
  { value: 'oficina',         label: 'Oficina',  icon: 'briefcase'      },
  { value: 'nave_industrial', label: 'Nave',     icon: 'package'        },
  { value: 'otro',            label: 'Otro',     icon: 'more-horizontal'},
];

const TIPO_OBRA_OPTIONS: { value: TipoObra; label: string }[] = [
  { value: 'obra_nueva', label: 'Obra nueva' },
  { value: 'refaccion',  label: 'Refacción'  },
  { value: 'ampliacion', label: 'Ampliación' },
  { value: 'demolicion', label: 'Demolición' },
  { value: 'otro',       label: 'Otro'       },
];

const AMENITY_OPTIONS: { id: string; label: string }[] = [
  { id: 'pileta',     label: 'Pileta'     },
  { id: 'quincho',    label: 'Quincho'    },
  { id: 'gym',        label: 'Gym'        },
  { id: 'sum',        label: 'SUM'        },
  { id: 'jardin',     label: 'Jardín'     },
  { id: 'terraza',    label: 'Terraza'    },
  { id: 'solarium',   label: 'Solarium'   },
  { id: 'laundry',    label: 'Laundry'    },
  { id: 'bauleras',   label: 'Bauleras'   },
  { id: 'porteria',   label: 'Portería'   },
  { id: 'vigilancia', label: 'Vigilancia' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function strNum(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function NumberField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.fieldRow}>
        <TextInput
          style={styles.fieldInput}
          value={value} onChangeText={onChange}
          placeholder={placeholder ?? '—'} placeholderTextColor={colors.faint}
          keyboardType="decimal-pad" selectionColor={colors.arena} returnKeyType="done"
        />
      </View>
    </View>
  );
}

function TypeChip({ label, icon, active, onPress }: {
  label: string; icon?: string; active: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.typeChip, active && styles.typeChipActive]}
      onPress={onPress} activeOpacity={0.75}
    >
      {icon ? <Feather name={icon as any} size={13} color={active ? '#FFF' : colors.gris} /> : null}
      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AmenityChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.amenityChip, active && styles.amenityChipActive]}
      onPress={onPress} activeOpacity={0.75}
    >
      <Text style={[styles.amenityChipText, active && styles.amenityChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NuevoProyectoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { studio } = useStudio();

  // Basic fields
  const [name, setName]           = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate]     = useState<Date | null>(null);
  const [imageUri, setImageUri]   = useState<string | null>(null);
  const [pickedBase64, setPickedBase64] = useState<string | null>(null);

  // Property profile
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [tipoObra, setTipoObra]         = useState<TipoObra | null>(null);
  const [m2Cubiertos, setM2Cubiertos]   = useState('');
  const [m2Totales, setM2Totales]       = useState('');
  const [m2Terreno, setM2Terreno]       = useState('');
  const [pisos, setPisos]               = useState('');
  const [unidades, setUnidades]         = useState('');
  const [dormitorios, setDormitorios]   = useState('');
  const [banos, setBanos]               = useState('');
  const [ambientes, setAmbientes]       = useState('');
  const [cocheras, setCocheras]         = useState('');
  const [amenities, setAmenities]       = useState<string[]>([]);
  const [direccion, setDireccion]       = useState('');
  const [comitente, setComitente]       = useState('');
  const [anioProyecto, setAnioProyecto] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const canSave    = name.trim().length > 0;
  const isEdificio = propertyType === 'edificio';
  const isCasa     = propertyType === 'casa';

  function toggleAmenity(id: string) {
    setAmenities((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, aspect: [16, 9], quality: 0.8, base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setPickedBase64(result.assets[0].base64 ?? null);
    }
  }

  async function handleCreate() {
    if (!canSave || !session || !studio) return;
    setLoading(true);
    setError(null);

    let imageUrl: string | null = null;
    if (imageUri && pickedBase64) {
      imageUrl = await uploadProjectImage(session.user.id, imageUri, pickedBase64);
    }

    const { error: dbError } = await supabase.from('projects').insert({
      name:           name.trim(),
      created_by:     session.user.id,
      studio_id:      studio?.id ?? null,
      image_url:      imageUrl,
      start_date:     startDate ? startDate.toISOString().slice(0, 10) : null,
      end_date:       endDate   ? endDate.toISOString().slice(0, 10)   : null,
      // Property profile
      property_type:  propertyType,
      tipo_obra:      tipoObra,
      m2_cubiertos:   strNum(m2Cubiertos),
      m2_totales:     strNum(m2Totales),
      m2_terreno:     strNum(m2Terreno),
      pisos:          strNum(pisos),
      unidades:       strNum(unidades),
      dormitorios:    strNum(dormitorios),
      banos:          strNum(banos),
      ambientes:      strNum(ambientes),
      cocheras:       strNum(cocheras),
      amenities,
      direccion:      direccion.trim() || null,
      comitente:      comitente.trim() || null,
      anio_proyecto:  strNum(anioProyecto),
    });

    setLoading(false);
    if (dbError) { setError('No se pudo crear el proyecto. Intentá de nuevo.'); return; }
    router.back();
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.handle} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="x" size={18} color={colors.crema} />
        </TouchableOpacity>
        <Text style={styles.title}>Nuevo proyecto</Text>
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || loading) && styles.saveBtnDisabled]}
          onPress={handleCreate} disabled={!canSave || loading} activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Text style={styles.saveBtnText}>Crear</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.form, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Portada */}
        <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.85}>
          {imageUri
            ? <Image source={{ uri: imageUri }} style={styles.imagePreview} />
            : <View style={styles.imagePlaceholder}>
                <Feather name="image" size={24} color={colors.faint} />
                <Text style={styles.imagePlaceholderText}>Agregar foto de portada</Text>
              </View>
          }
          <View style={styles.imageEditBadge}><Feather name="camera" size={13} color="#FFF" /></View>
        </TouchableOpacity>

        {/* Nombre */}
        <View style={styles.field}>
          <FieldLabel>NOMBRE DEL PROYECTO</FieldLabel>
          <View style={styles.fieldRow}>
            <TextInput
              style={styles.fieldInput}
              value={name} onChangeText={setName}
              placeholder="Ej: Torre Palermo" placeholderTextColor={colors.faint}
              autoCapitalize="words" autoCorrect={false} autoFocus
              selectionColor={colors.arena} returnKeyType="done"
            />
          </View>
        </View>

        {/* Comitente */}
        <View style={styles.field}>
          <FieldLabel>COMITENTE / PROPIETARIO</FieldLabel>
          <View style={styles.fieldRow}>
            <TextInput
              style={styles.fieldInput}
              value={comitente} onChangeText={setComitente}
              placeholder="Nombre del cliente u organización" placeholderTextColor={colors.faint}
              autoCapitalize="words" selectionColor={colors.arena} returnKeyType="done"
            />
          </View>
        </View>

        {/* Dirección */}
        <View style={styles.field}>
          <FieldLabel>DIRECCIÓN DE LA OBRA</FieldLabel>
          <View style={styles.fieldRow}>
            <TextInput
              style={styles.fieldInput}
              value={direccion} onChangeText={setDireccion}
              placeholder="Calle, número, localidad" placeholderTextColor={colors.faint}
              autoCapitalize="words" selectionColor={colors.arena} returnKeyType="done"
            />
          </View>
        </View>

        {/* Fechas */}
        <View style={styles.datesRow}>
          <View style={styles.dateCol}>
            <DateField label="INICIO ESPERADO" value={startDate} onChange={setStartDate}
              placeholder="Seleccionar" maximumDate={endDate ?? undefined} />
          </View>
          <View style={styles.dateDivider} />
          <View style={styles.dateCol}>
            <DateField label="FIN ESPERADO" value={endDate} onChange={setEndDate}
              placeholder="Seleccionar" minimumDate={startDate ?? undefined} />
          </View>
        </View>

        {/* ── PERFIL DE PROPIEDAD ── */}
        <View style={styles.separator} />
        <Text style={styles.sectionLabel}>PERFIL DE PROPIEDAD</Text>

        {/* Tipo de propiedad */}
        <View style={styles.field}>
          <FieldLabel>TIPO DE PROPIEDAD</FieldLabel>
          <View style={styles.chipWrap}>
            {PROPERTY_TYPE_OPTIONS.map((opt) => (
              <TypeChip
                key={opt.value} label={opt.label} icon={opt.icon}
                active={propertyType === opt.value}
                onPress={() => setPropertyType(opt.value === propertyType ? null : opt.value)}
              />
            ))}
          </View>
        </View>

        {/* Tipo de obra */}
        <View style={styles.field}>
          <FieldLabel>TIPO DE OBRA</FieldLabel>
          <View style={styles.chipWrap}>
            {TIPO_OBRA_OPTIONS.map((opt) => (
              <TypeChip
                key={opt.value} label={opt.label}
                active={tipoObra === opt.value}
                onPress={() => setTipoObra(opt.value === tipoObra ? null : opt.value)}
              />
            ))}
          </View>
        </View>

        {/* Metros */}
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <NumberField label="M² CUBIERTOS" value={m2Cubiertos} onChange={setM2Cubiertos} placeholder="0" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="M² TOTALES" value={m2Totales} onChange={setM2Totales} placeholder="0" />
          </View>
        </View>
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <NumberField label="M² TERRENO" value={m2Terreno} onChange={setM2Terreno} placeholder="0" />
          </View>
          <View style={{ flex: 1 }}>
            <NumberField label="AÑO DE PROYECTO" value={anioProyecto} onChange={setAnioProyecto} placeholder="2024" />
          </View>
        </View>

        {/* Edificio */}
        {isEdificio && (
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <NumberField label="PISOS" value={pisos} onChange={setPisos} placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField label="UNIDADES TOTALES" value={unidades} onChange={setUnidades} placeholder="0" />
            </View>
          </View>
        )}

        {/* Casa */}
        {isCasa && (
          <View style={styles.row3}>
            <View style={{ flex: 1 }}>
              <NumberField label="AMBIENTES" value={ambientes} onChange={setAmbientes} placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField label="DORMITORIOS" value={dormitorios} onChange={setDormitorios} placeholder="0" />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField label="BAÑOS" value={banos} onChange={setBanos} placeholder="0" />
            </View>
          </View>
        )}

        {/* Cocheras */}
        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <NumberField label="COCHERAS" value={cocheras} onChange={setCocheras} placeholder="0" />
          </View>
          <View style={{ flex: 1 }} />
        </View>

        {/* Amenities */}
        <View style={styles.field}>
          <FieldLabel>AMENITIES</FieldLabel>
          <View style={styles.chipWrap}>
            {AMENITY_OPTIONS.map((opt) => (
              <AmenityChip
                key={opt.id} label={opt.label}
                active={amenities.includes(opt.id)}
                onPress={() => toggleAmenity(opt.id)}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.simLink} onPress={() => router.push('/simulacion')} activeOpacity={0.7}>
          <Feather name="zap" size={12} color={colors.arena} />
          <Text style={styles.simLinkText}>Simular duración y materiales</Text>
          <Feather name="chevron-right" size={12} color={colors.faint} />
        </TouchableOpacity>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  imagePicker: { height: 160, borderRadius: 20, overflow: 'hidden', backgroundColor: colors.chip },
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

  separator: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
  sectionLabel: {
    fontFamily: fonts.archivo.bold, fontSize: 13, color: colors.crema,
    letterSpacing: -0.1, marginBottom: -8,
  },

  row2: { flexDirection: 'row', gap: spacing.lg },
  row3: { flexDirection: 'row', gap: spacing.sm },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 34, paddingHorizontal: 12, borderRadius: 17,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.tinta,
  },
  typeChipActive: { backgroundColor: colors.crema, borderColor: colors.crema },
  typeChipText: { fontFamily: fonts.archivo.bold, fontSize: 12, color: colors.gris },
  typeChipTextActive: { color: '#FFFFFF' },

  amenityChip: {
    height: 30, paddingHorizontal: 12, borderRadius: 15,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.tinta,
    alignItems: 'center', justifyContent: 'center',
  },
  amenityChipActive: { backgroundColor: 'rgba(217,119,87,0.12)', borderColor: colors.arena },
  amenityChipText: { fontFamily: fonts.archivo.bold, fontSize: 11, color: colors.gris },
  amenityChipTextActive: { color: colors.arena },

  simLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing.sm },
  simLinkText: { flex: 1, fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.gris },
  errorText: { fontFamily: fonts.archivo.semibold, fontSize: 13, color: colors.error },
});
