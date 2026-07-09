import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

/**
 * Modal para crear o editar un producto.
 * Props:
 *  - visible: bool
 *  - onClose: () => void
 *  - onSave: ({ name, price, description, stock }) => void
 *  - editProduct: objeto producto existente (null si es creación)
 *  - loading: bool
 */
export default function ProductModal({ visible, onClose, onSave, editProduct = null, loading = false }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [stock, setStock] = useState('');

  const slideAnim = useRef(new Animated.Value(600)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Cargar datos si estamos editando
      if (editProduct) {
        setName(editProduct.name || '');
        setPrice(editProduct.price != null ? String(editProduct.price) : '');
        setDescription(editProduct.description || '');
        setStock(editProduct.stock >= 0 ? String(editProduct.stock) : '');
      } else {
        setName('');
        setPrice('');
        setDescription('');
        setStock('');
      }
      keyboardOffset.setValue(0);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Keyboard.dismiss();
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 280, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(keyboardOffset, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, editProduct]);

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


  const handleSave = () => {
    if (!name.trim()) return;
    if (!price.trim() || isNaN(parseFloat(price))) return;
    onSave({ name: name.trim(), price, description: description.trim(), stock: stock.trim() });
  };

  const isValid = name.trim().length > 0 && price.trim().length > 0 && !isNaN(parseFloat(price));

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
            colors={['#1A1F4B', '#2D3A8C']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerIcon}>
                <Ionicons name={editProduct ? 'create' : 'cube'} size={22} color="#fff" />
              </View>
              <Text style={styles.headerTitle}>
                {editProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Nombre */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Nombre del producto *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="cube-outline" size={18} color="#4C669F" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ej. Camiseta talla M"
                  placeholderTextColor="#C0C0C8"
                  value={name}
                  onChangeText={setName}
                  maxLength={80}
                />
              </View>
            </View>

            {/* Precio */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Precio unitario *</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={[styles.input, styles.inputWithSymbol]}
                  placeholder="0.00"
                  placeholderTextColor="#C0C0C8"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Descripción */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Descripción <Text style={styles.optional}>(opcional)</Text></Text>
              <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ej. Color azul, algodón 100%..."
                  placeholderTextColor="#C0C0C8"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  maxLength={200}
                />
              </View>
            </View>

            {/* Stock */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Stock disponible <Text style={styles.optional}>(opcional, déjalo vacío si no manejas inventario)</Text>
              </Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="layers-outline" size={18} color="#4C669F" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ej. 50"
                  placeholderTextColor="#C0C0C8"
                  value={stock}
                  onChangeText={setStock}
                  keyboardType="decimal-pad"
                />
              </View>
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
                  colors={isValid ? ['#4C669F', '#2D3A8C'] : ['#C0C0C8', '#A0A0A8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}
                >
                  <Ionicons name={editProduct ? 'checkmark' : 'add'} size={20} color="#fff" />
                  <Text style={styles.saveText}>{editProduct ? 'Guardar' : 'Crear Producto'}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
      </Animated.View>
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
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A4A6A',
    marginBottom: 8,
    letterSpacing: 0.1,
  },
  optional: {
    fontSize: 12,
    fontWeight: '400',
    color: '#9090A8',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
    paddingHorizontal: 14,
    minHeight: 52,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  textAreaWrapper: {
    alignItems: 'flex-start',
    paddingVertical: 12,
    minHeight: 80,
  },
  inputIcon: {
    marginRight: 10,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4C669F',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1A1F4B',
    fontWeight: '500',
  },
  inputWithSymbol: {
    flex: 1,
  },
  textArea: {
    textAlignVertical: 'top',
    minHeight: 56,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
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
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6068A0',
  },
  saveBtn: {
    flex: 2,
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#2D3A8C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  saveBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
