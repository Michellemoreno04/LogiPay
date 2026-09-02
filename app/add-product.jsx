import { Ionicons } from '@expo/vector-icons';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  DeviceEventEmitter,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../authContext/authContext';
import { useLocalData } from '../context/LocalDataContext';
import {
  createProduct,
  editProduct as editProductService,
} from '../utils/productService';

const CATEGORIES = [
  { id: 'alimentos', label: 'Alimentos', icon: 'fast-food-outline', color: '#FF9500' },
  { id: 'bebidas', label: 'Bebidas', icon: 'wine-outline', color: '#007AFF' },
  { id: 'electronica', label: 'Electrónica', icon: 'hardware-chip-outline', color: '#5856D6' },
  { id: 'ropa', label: 'Ropa', icon: 'shirt-outline', color: '#FF2D55' },
  { id: 'hogar', label: 'Hogar', icon: 'home-outline', color: '#34C759' },
  { id: 'salud', label: 'Salud', icon: 'medkit-outline', color: '#FF3B30' },
  { id: 'cosmeticos', label: 'Cosméticos', icon: 'sparkles-outline', color: '#AF52DE' },
  { id: 'herramientas', label: 'Herramientas', icon: 'construct-outline', color: '#8E8E93' },
  { id: 'juguetes', label: 'Juguetes', icon: 'game-controller-outline', color: '#FFD60A' },
  { id: 'otros', label: 'Otros', icon: 'ellipsis-horizontal-circle-outline', color: '#6C6C70' },
];

export default function AddProductScreen() {
  const { user } = useAuth();
  const { addProductOptimistic, editProductOptimistic } = useLocalData();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const isEditing = !!params.productId;

  const [name, setName] = useState(params.name || '');
  const [barcode, setBarcode] = useState(params.barcode || '');
  const [buyPrice, setBuyPrice] = useState(params.buyPrice || '');
  const [sellPrice, setSellPrice] = useState(params.price || '');
  const [description, setDescription] = useState(params.description || '');
  const [stock, setStock] = useState(
    params.stock !== undefined && params.stock !== '-1' ? params.stock : ''
  );
  const [category, setCategory] = useState(params.category || '');
  const [photoUri, setPhotoUri] = useState(params.photoUri || null);

  const [saving, setSaving] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13','ean-8','upc-a','upc-e','code-128','code-39','code-93','qr','pdf-417','aztec','data-matrix'],
    onCodeScanned: (codes) => {
      if (scanned) return;
      const first = codes[0];
      if (first?.value) handleBarCodeScanned({ data: first.value });
    },
  });

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(0.97)).current;

  const selectedCategoryObj = CATEGORIES.find((cat) => cat.id === category);

  useEffect(() => {
    Animated.spring(headerScale, { toValue: 1, tension: 80, friction: 10, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (!scannerVisible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scannerVisible]);

  const handlePickPhoto = () => {
    Alert.alert('Foto del producto', 'Selecciona una opción', [
      {
        text: 'Galería',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      {
        text: 'Cámara',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara.'); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!result.canceled) setPhotoUri(result.assets[0].uri);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const openScanner = async () => {
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara para escanear.'); return; }
    }
    setTorchOn(false);
    setScanned(false);
    setScannerVisible(true);
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(200);
    setBarcode(data);
    setScannerVisible(false);
    setTorchOn(false);
  };

  const isValid = name.trim().length > 0 && sellPrice.trim().length > 0 && !isNaN(parseFloat(sellPrice));

  const handleSave = async () => {
    if (!user || !isValid) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        price: sellPrice,
        description: description.trim(),
        stock: stock.trim(),
        barcode: barcode.trim(),
        buyPrice: buyPrice.trim(),
        category,
        photoUri: photoUri || '',
      };
      if (isEditing) {
        await editProductService({ uid: user.uid, productId: params.productId, ...payload });
        editProductOptimistic({ productId: params.productId, ...payload });
      } else {
        const { productId } = await createProduct({ uid: user.uid, ...payload });
        addProductOptimistic({ productId, ...payload });
      }
      DeviceEventEmitter.emit('products-db-changed');
      router.back();
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el producto. Intenta de nuevo.');
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={['#1A1F4B', '#2D3A8C', '#4C669F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top + 12 }]}
        >
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>
            <Animated.View style={{ transform: [{ scale: headerScale }] }}>
              <Text style={styles.headerTitle}>{isEditing ? 'Editar Producto' : 'Nuevo Producto'}</Text>
            </Animated.View>
            <View style={[styles.backBtn, { opacity: 0 }]} pointerEvents="none" />
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Photo */}
          <View style={styles.photoPicker}>
            <TouchableOpacity style={styles.photoTouchable} onPress={handlePickPhoto} activeOpacity={0.8}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoImage} />
              ) : (
                <LinearGradient colors={['#E8EEFF', '#D0D8FF']} style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={36} color="#4C669F" />
                  <Text style={styles.photoPlaceholderText}>Agregar foto</Text>
                </LinearGradient>
              )}
              <View style={styles.photoEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
          </View>

          {/* Nombre */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nombre del producto *</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="cube-outline" size={18} color="#4C669F" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Ej. Cerveza, Leche, Camisa..." placeholderTextColor="#B0B0C8" value={name} onChangeText={setName} maxLength={80} />
            </View>
          </View>

          {/* Código de barras */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>ID / Código de barras</Text>
            <View style={[styles.inputWrapper, barcode ? styles.inputWrapperSuccess : null]}>
              <Ionicons
                name={barcode ? "barcode" : "barcode-outline"}
                size={18}
                color={barcode ? "#34C759" : "#4C669F"}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Ej. 7501055300427"
                placeholderTextColor="#B0B0C8"
                value={barcode}
                onChangeText={setBarcode}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[styles.scanIconBtn, barcode ? styles.scanIconBtnSuccess : null]}
                onPress={openScanner}
              >
                <Ionicons
                  name={barcode ? "checkmark-circle" : "scan-outline"}
                  size={22}
                  color={barcode ? "#34C759" : "#4C669F"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Precios */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Precio de compra</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.prefixText}>$</Text>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="0.00" placeholderTextColor="#B0B0C8" value={buyPrice} onChangeText={setBuyPrice} keyboardType="decimal-pad" />
                </View>
              </View>
            </View>
            <View style={styles.rowSpacer} />
            <View style={{ flex: 1 }}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Precio de venta *</Text>
                <View style={styles.inputWrapper}>
                  <Text style={styles.prefixText}>$</Text>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="0.00" placeholderTextColor="#B0B0C8" value={sellPrice} onChangeText={setSellPrice} keyboardType="decimal-pad" />
                </View>
              </View>
            </View>
          </View>

          {/* Categoría (Menú desplegable con Radio Buttons) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Categoría</Text>
            <TouchableOpacity
              style={styles.dropdownHeader}
              onPress={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
              activeOpacity={0.8}
            >
              <View style={styles.dropdownSelectedLeft}>
                {selectedCategoryObj ? (
                  <>
                    <View style={[styles.categoryIconCircle, { backgroundColor: selectedCategoryObj.color + '20' }]}>
                      <Ionicons name={selectedCategoryObj.icon} size={18} color={selectedCategoryObj.color} />
                    </View>
                    <Text style={styles.dropdownSelectedText}>{selectedCategoryObj.label}</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="grid-outline" size={18} color="#4C669F" style={styles.inputIcon} />
                    <Text style={styles.dropdownPlaceholder}>Selecciona una categoría</Text>
                  </>
                )}
              </View>
              <Ionicons
                name={categoryDropdownOpen ? "chevron-up" : "chevron-down"}
                size={20}
                color="#4C669F"
              />
            </TouchableOpacity>

            {categoryDropdownOpen && (
              <View style={styles.dropdownMenu}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.dropdownItem, isSelected && styles.dropdownItemSelected]}
                      onPress={() => {
                        setCategory(isSelected ? '' : cat.id);
                        setCategoryDropdownOpen(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.dropdownItemLeft}>
                        <Ionicons
                          name={isSelected ? "radio-button-on" : "radio-button-off"}
                          size={20}
                          color={isSelected ? "#4C669F" : "#B0B0C8"}
                        />
                        <View style={[styles.categoryIconCircle, { backgroundColor: cat.color + '20' }]}>
                          <Ionicons name={cat.icon} size={16} color={cat.color} />
                        </View>
                        <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                          {cat.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color="#4C669F" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Stock */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Stock disponible (opcional)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="layers-outline" size={18} color="#4C669F" style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Déjalo vacío si no manejas inventario" placeholderTextColor="#B0B0C8" value={stock} onChangeText={setStock} keyboardType="decimal-pad" />
            </View>
          </View>

          {/* Descripción */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Descripción (opcional)</Text>
            <View style={[styles.inputWrapper, { alignItems: 'flex-start', paddingVertical: 12 }]}>
              <Ionicons name="document-text-outline" size={18} color="#4C669F" style={[styles.inputIcon, { marginTop: 2 }]} />
              <TextInput style={[styles.input, styles.textArea]} placeholder="Agrega una descripción del producto..." placeholderTextColor="#B0B0C8" value={description} onChangeText={setDescription} multiline numberOfLines={3} maxLength={300} textAlignVertical="top" />
            </View>
          </View>

          {/* Save */}
          <TouchableOpacity
            style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isValid || saving}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isValid ? ['#4C669F', '#2D3A8C'] : ['#C0C0C8', '#A0A0A8']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name={isEditing ? 'checkmark-circle' : 'add-circle'} size={22} color="#fff" />
                  <Text style={styles.saveBtnText}>{isEditing ? 'Guardar cambios' : 'Crear Producto'}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Barcode Scanner Modal */}
      <Modal visible={scannerVisible} animationType="slide" onRequestClose={() => { setScannerVisible(false); setTorchOn(false); }}>
        <View style={styles.scannerContainer}>
          {device ? (
            <Camera
              style={StyleSheet.absoluteFillObject}
              device={device}
              isActive={scannerVisible}
              torch={torchOn ? 'on' : 'off'}
              codeScanner={codeScanner}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }]}>
              <Text style={{ color: '#fff' }}>No se encontró cámara</Text>
            </View>
          )}
          <View style={styles.scannerOverlay}>
            <View style={styles.scanOverlayTop}>
              <TouchableOpacity
                style={styles.torchBtn}
                onPress={() => setTorchOn(!torchOn)}
                activeOpacity={0.7}
              >
                <Ionicons name={torchOn ? "flash" : "flash-outline"} size={20} color={torchOn ? "#FFD60A" : "#fff"} />
                <Text style={styles.torchBtnText}>{torchOn ? 'Flash ON' : 'Flash OFF'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.scanOverlayMiddle}>
              <View style={styles.scanOverlaySide} />
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <Animated.View
                  style={[
                    styles.scanLine,
                    { transform: [{ translateY: scanLineAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 220] }) }] },
                  ]}
                />
              </View>
              <View style={styles.scanOverlaySide} />
            </View>
            <View style={styles.scanOverlayBottom}>
              <Text style={styles.scanHint}>Enfoca el código de barras dentro del recuadro</Text>
              <TouchableOpacity style={styles.scanCancelBtn} onPress={() => { setScannerVisible(false); setTorchOn(false); }}>
                <Text style={styles.scanCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F8' },
  header: { paddingBottom: 20, paddingHorizontal: 20, overflow: 'hidden' },
  decorCircle1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)', top: -40, right: -60 },
  decorCircle2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.04)', bottom: -20, left: -30 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  scrollView: { flex: 1 },
  body: { padding: 20 },
  photoPicker: { alignItems: 'center', marginBottom: 28 },
  photoTouchable: { position: 'relative' },
  photoImage: { width: 110, height: 110, borderRadius: 22, borderWidth: 2, borderColor: '#D0D8FF' },
  photoPlaceholder: { width: 110, height: 110, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoPlaceholderText: { fontSize: 12, fontWeight: '600', color: '#4C669F' },
  photoEditBadge: { position: 'absolute', bottom: -4, right: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: '#4C669F', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F0F2F8' },
  fieldGroup: { marginBottom: 18 },
  label: { fontSize: 12, fontWeight: '700', color: '#6068A0', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E0E4F5', paddingHorizontal: 14, minHeight: 52, shadowColor: '#4C669F', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  inputWrapperSuccess: { borderColor: '#34C759', backgroundColor: '#F4FBF6' },
  inputIcon: { marginRight: 10 },
  prefixText: { fontSize: 17, fontWeight: '700', color: '#4C669F', marginRight: 6 },
  input: { flex: 1, fontSize: 15, color: '#1A1F4B', fontWeight: '500' },
  textArea: { minHeight: 72, paddingTop: 4 },
  scanIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8EEFF', alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  scanIconBtnSuccess: { backgroundColor: '#E8F8EE' },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  rowSpacer: { width: 12 },
  dropdownHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E0E4F5', paddingHorizontal: 14, height: 52, shadowColor: '#4C669F', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  dropdownSelectedLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  dropdownSelectedText: { fontSize: 15, fontWeight: '600', color: '#1A1F4B' },
  dropdownPlaceholder: { fontSize: 15, fontWeight: '500', color: '#B0B0C8' },
  categoryIconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dropdownMenu: { marginTop: 8, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#E0E4F5', overflow: 'hidden', shadowColor: '#4C669F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0F2F8' },
  dropdownItemSelected: { backgroundColor: '#F4F7FF' },
  dropdownItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dropdownItemText: { fontSize: 14, fontWeight: '500', color: '#4A4A6A' },
  dropdownItemTextSelected: { fontWeight: '700', color: '#4C669F' },
  saveBtn: { borderRadius: 16, overflow: 'hidden', marginTop: 4, shadowColor: '#2D3A8C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  saveBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  saveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56 },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  scanOverlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 50, paddingRight: 20 },
  torchBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  torchBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  scanOverlayMiddle: { flexDirection: 'row', height: 240 },
  scanOverlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  scanOverlayBottom: { flex: 1.2, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 20 },
  scanFrame: { width: 240, height: 240, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#4C669F', borderWidth: 3.5 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanLine: { position: 'absolute', top: 0, left: 4, right: 4, height: 2, backgroundColor: '#4C669F', borderRadius: 1, shadowColor: '#4C669F', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 },
  scanHint: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontWeight: '500', paddingHorizontal: 32 },
  scanCancelBtn: { paddingHorizontal: 32, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  scanCancelText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

