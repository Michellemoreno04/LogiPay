import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAlert } from '../../context/AlertContext';

/**
 * Modal para registrar una venta de un producto.
 * Props:
 *  - visible: bool
 *  - onClose: () => void
 *  - onSave: ({ clientId, clientName, quantity }) => void
 *  - product: objeto producto { name, price, stock }
 *  - clients: lista de clientes del contexto
 *  - loading: bool
 */
export default function SaleModal({ visible, onClose, onSave, product, clients = [], loading = false }) {
  const [selectedClient, setSelectedClient] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [showClientPicker, setShowClientPicker] = useState(false);

  const { showAlert } = useAlert();

  const slideAnim = useRef(new Animated.Value(700)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedClient(null);
      setQuantity('1');
      setSearchQuery('');
      setShowClientPicker(false);
      keyboardOffset.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 700, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(keyboardOffset, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  // Subir/bajar el sheet cuando aparece/desaparece el teclado
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e) => {
      Animated.timing(keyboardOffset, {
        toValue: -e.endCoordinates.height,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: true,
      }).start();
    };
    const onHide = (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e.duration || 250 : 200,
        useNativeDriver: true,
      }).start();
    };

    const subShow = Keyboard.addListener(showEvent, onShow);
    const subHide = Keyboard.addListener(hideEvent, onHide);
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);


  const parsedQty = parseFloat(quantity) || 0;
  const unitPrice = product?.price ?? 0;
  const total = parsedQty * unitPrice;
  const stockOk = product?.stock < 0 || parsedQty <= (product?.stock ?? 0);
  const isValid = selectedClient && parsedQty > 0 && stockOk;

  const filteredClients = clients.filter((c) =>
    (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.phone || '').includes(searchQuery)
  );

  const handleSave = () => {
    if (!isValid) return;
    try {
      onSave({
        clientId: selectedClient.id,
        clientName: selectedClient.name,
        quantity: parsedQty,
        unitPrice,
      });
      showAlert("Venta registrada exitosamente", "success");
    } catch (error) {
      showAlert("Error al registrar la venta", "error");
    }


  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }, { translateY: keyboardOffset }] },
        ]}
      >
        {/* Header */}
        <LinearGradient
          colors={['#1A4B2F', '#2D8C5A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="cart" size={22} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Registrar Venta</Text>
              {product && (
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {product.name} · ${unitPrice.toFixed(2)}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </LinearGradient>

        <View style={styles.body}>
          {/* Stock badge */}
          {product?.stock >= 0 && (
            <View style={styles.stockBadgeRow}>
              <View style={[styles.stockBadge, product.stock === 0 && styles.stockBadgeEmpty]}>
                <Ionicons
                  name="layers"
                  size={14}
                  color={product.stock > 0 ? '#2D8C5A' : '#FF3B30'}
                />
                <Text style={[styles.stockBadgeText, product.stock === 0 && styles.stockBadgeTextEmpty]}>
                  {product.stock > 0 ? `${product.stock} en stock` : 'Sin stock'}
                </Text>
              </View>
            </View>
          )}

          {/* Seleccionar cliente */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Cliente *</Text>
            <TouchableOpacity
              style={styles.clientPickerBtn}
              onPress={() => setShowClientPicker((v) => !v)}
              activeOpacity={0.85}
            >
              <Ionicons name="person-circle-outline" size={20} color="#4C669F" style={{ marginRight: 10 }} />
              <Text style={[styles.clientPickerText, !selectedClient && styles.placeholderText]}>
                {selectedClient ? selectedClient.name : 'Seleccionar cliente...'}
              </Text>
              <Ionicons
                name={showClientPicker ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#8E8E93"
              />
            </TouchableOpacity>


          </View>

          {/* Cantidad */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Cantidad *</Text>
            <View style={styles.quantityRow}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => String(Math.max(1, (parseFloat(q) || 1) - 1)))}
              >
                <Ionicons name="remove" size={22} color="#4C669F" />
              </TouchableOpacity>
              <View style={styles.qtyInputWrapper}>
                <TextInput
                  style={styles.qtyInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="decimal-pad"
                  textAlign="center"
                />
              </View>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity((q) => String((parseFloat(q) || 0) + 1))}
              >
                <Ionicons name="add" size={22} color="#4C669F" />
              </TouchableOpacity>
            </View>
            {product?.stock >= 0 && parsedQty > product.stock && (
              <Text style={styles.stockWarning}>⚠️ Cantidad supera el stock disponible</Text>
            )}
          </View>

          {/* Total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total de la venta</Text>
            <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
            <Text style={styles.totalDetail}>
              {parsedQty} × ${unitPrice.toFixed(2)}
            </Text>
          </View>

          {/* Botones */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={loading}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={!isValid || loading}
            >
              <LinearGradient
                colors={isValid ? ['#2D8C5A', '#1A4B2F'] : ['#C0C0C8', '#A0A0A8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveBtnGradient}
              >
                <Ionicons name="cart" size={20} color="#fff" />
                <Text style={styles.saveText}>Confirmar Venta</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Overlay para la búsqueda de cliente */}
      {showClientPicker && (
        <KeyboardAvoidingView
          style={styles.clientPickerOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.clientPickerModal}>
            <View style={styles.clientPickerHeader}>
              <Text style={styles.clientPickerTitle}>Seleccionar Cliente</Text>
              <TouchableOpacity onPress={() => setShowClientPicker(false)} style={styles.clientPickerClose}>
                <Ionicons name="close" size={24} color="#1A1F4B" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchWrapper}>
              <Ionicons name="search" size={18} color="#8E8E93" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar cliente..."
                placeholderTextColor="#C0C0C8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredClients}
              keyExtractor={(item) => item.id}
              style={styles.clientList}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyClients}>No se encontraron clientes</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.clientOption,
                    selectedClient?.id === item.id && styles.clientOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedClient(item);
                    setShowClientPicker(false);
                    setSearchQuery('');
                  }}
                >
                  <View style={styles.clientOptionAvatar}>
                    <Text style={styles.clientOptionAvatarText}>
                      {(item.name || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientOptionName}>{item.name}</Text>
                    {item.phone ? (
                      <Text style={styles.clientOptionPhone}>{item.phone}</Text>
                    ) : null}
                  </View>
                  {selectedClient?.id === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#2D8C5A" />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </Modal>
  );
}


const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,30,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#F5F7FF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 20 },
  stockBadgeRow: { flexDirection: 'row', marginBottom: 16 },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  stockBadgeEmpty: { backgroundColor: '#FFECEC' },
  stockBadgeText: { fontSize: 13, fontWeight: '600', color: '#2D8C5A' },
  stockBadgeTextEmpty: { color: '#FF3B30' },
  fieldGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#4A4A6A', marginBottom: 8 },
  clientPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
    paddingHorizontal: 14,
    height: 52,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  clientPickerText: { flex: 1, fontSize: 16, color: '#1A1F4B', fontWeight: '500' },
  placeholderText: { color: '#C0C0C8', fontWeight: '400' },
  clientPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,30,0.6)',
    justifyContent: 'center',
    padding: 20,
    zIndex: 100,
    elevation: 10,
  },
  clientPickerModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  clientPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  clientPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1F4B',
  },
  clientPickerClose: {
    padding: 4,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#F5F7FF',
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1F4B',
  },
  clientList: {
    maxHeight: 300,
  },
  emptyClients: { textAlign: 'center', color: '#8E8E93', padding: 16, fontSize: 14 },
  clientOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  clientOptionSelected: { backgroundColor: '#EDF5F2' },
  clientOptionAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientOptionAvatarText: { fontSize: 16, fontWeight: '700', color: '#4C669F' },
  clientOptionName: { fontSize: 15, fontWeight: '600', color: '#1A1F4B' },
  clientOptionPhone: { fontSize: 13, color: '#8E8E93', marginTop: 1 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInputWrapper: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: { fontSize: 22, fontWeight: '700', color: '#1A1F4B', width: '100%' },
  stockWarning: { fontSize: 13, color: '#FF6B35', marginTop: 6, fontWeight: '500' },
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  totalLabel: { fontSize: 13, color: '#8E8E93', fontWeight: '600', marginBottom: 4 },
  totalAmount: { fontSize: 34, fontWeight: '800', color: '#1A4B2F', letterSpacing: -0.5 },
  totalDetail: { fontSize: 13, color: '#8E8E93', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  cancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#D0D4E8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: '#6068A0' },
  saveBtn: {
    flex: 2,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1A4B2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnDisabled: { shadowOpacity: 0, elevation: 0 },
  saveBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
