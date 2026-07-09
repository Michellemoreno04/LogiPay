import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProductModal from '../../components/modales/ProductModal';
import { useLocalData } from '../../context/LocalDataContext';
import { useAuth } from '../../authContext/authContext';
import { createProduct, deleteProduct, editProduct as editProductService } from '../../utils/productService';

export default function ProductsScreen() {
  const { user } = useAuth();
  const {
    products,
    loadingProducts,
    addProductOptimistic,
    editProductOptimistic,
    deleteProductOptimistic,
  } = useLocalData();

  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);

  const fabScale = useRef(new Animated.Value(1)).current;

  const filteredProducts = products.filter((p) =>
    (p.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setModalVisible(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setModalVisible(true);
  };

  const handleSave = async ({ name, price, description, stock }) => {
    if (!user) return;
    setSavingProduct(true);
    try {
      if (editingProduct) {
        // Editar
        await editProductService({
          uid: user.uid,
          productId: editingProduct.id,
          name,
          price,
          description,
          stock,
        });
        editProductOptimistic({ productId: editingProduct.id, name, price, description, stock });
      } else {
        // Crear
        const { productId } = await createProduct({ uid: user.uid, name, price, description, stock });
        addProductOptimistic({ productId, name, price, description, stock });
      }
      DeviceEventEmitter.emit('products-db-changed');
      setModalVisible(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el producto. Intenta de nuevo.');
      console.error(e);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDelete = (product) => {
    Alert.alert(
      'Eliminar Producto',
      `¿Seguro que quieres eliminar "${product.name}"? También se eliminarán sus ventas registradas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProduct({ uid: user.uid, productId: product.id });
              deleteProductOptimistic(product.id);
              DeviceEventEmitter.emit('products-db-changed');
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar el producto.');
            }
          },
        },
      ]
    );
  };

  const pressFab = () => {
    Animated.sequence([
      Animated.spring(fabScale, { toValue: 0.9, useNativeDriver: true, tension: 200 }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    handleOpenCreate();
  };

  const renderProduct = ({ item }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => router.push(`/product/${item.id}`)}
      activeOpacity={0.88}
    >
      <View style={styles.productCardLeft}>
        <LinearGradient
          colors={['#E8EEFF', '#D0D8FF']}
          style={styles.productAvatar}
        >
          <Ionicons name="cube" size={24} color="#4C669F" />
        </LinearGradient>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          {item.description ? (
            <Text style={styles.productDesc} numberOfLines={1}>{item.description}</Text>
          ) : null}
          <View style={styles.tagsRow}>
            {item.stock >= 0 && (
              <View style={[styles.tag, item.stock === 0 && styles.tagRed]}>
                <Ionicons name="layers-outline" size={11} color={item.stock > 0 ? '#4C669F' : '#FF3B30'} />
                <Text style={[styles.tagText, item.stock === 0 && styles.tagTextRed]}>
                  {item.stock > 0 ? `Stock: ${item.stock}` : 'Sin stock'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <View style={styles.productCardRight}>
        <Text style={styles.productPrice}>${parseFloat(item.price || 0).toFixed(2)}</Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => handleOpenEdit(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="create-outline" size={18} color="#4C669F" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ─── Header Gradient ─── */}
        <LinearGradient
          colors={['#1A1F4B', '#2D3A8C', '#4C669F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.headerLabel}>Gestión de</Text>
              <Text style={styles.headerTitle}>Mis Productos</Text>
            </View>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{products.length}</Text>
            </View>
          </View>

          {/* Search inside header */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color="rgba(255,255,255,0.6)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar productos..."
              placeholderTextColor="rgba(255,255,255,0.45)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>

        {/* ─── List ─── */}
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={renderProduct}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            filteredProducts.length > 0 ? (
              <Text style={styles.sectionLabel}>
                {filteredProducts.length} producto{filteredProducts.length !== 1 ? 's' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <LinearGradient
                colors={['#E8EEFF', '#D0D8FF']}
                style={styles.emptyIconBg}
              >
                <Ionicons name="cube-outline" size={48} color="#4C669F" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'Sin resultados' : 'Aún no tienes productos'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? `No encontramos productos con "${searchQuery}"`
                  : 'Crea tu primer producto y empieza a registrar ventas'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity style={styles.emptyBtn} onPress={handleOpenCreate}>
                  <LinearGradient
                    colors={['#4C669F', '#2D3A8C']}
                    style={styles.emptyBtnGradient}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.emptyBtnText}>Crear producto</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      </SafeAreaView>

      {/* ─── FAB ─── */}
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: fabScale }] }]}>
        <TouchableOpacity style={styles.fabButton} onPress={pressFab} activeOpacity={0.85}>
          <LinearGradient
            colors={['#4C669F', '#3B5998', '#192f6a']}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* ─── Modals ─── */}
      <ProductModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
        editProduct={editingProduct}
        loading={savingProduct}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F8' },

  // Header
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? 16 : 0,
    paddingBottom: 24,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -40,
    right: -50,
  },
  decorCircle2: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
    bottom: -20,
    left: -30,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    zIndex: 1,
  },
  headerLabel: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerBadgeText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
    zIndex: 1,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#fff', fontWeight: '500' },

  // List
  listContent: { padding: 16, paddingBottom: 110 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Product card
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  productCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  productAvatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '700', color: '#1A1F4B', marginBottom: 2 },
  productDesc: { fontSize: 13, color: '#8E8E93', marginBottom: 6 },
  tagsRow: { flexDirection: 'row', gap: 6 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8EEFF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagRed: { backgroundColor: '#FFECEC' },
  tagText: { fontSize: 11, fontWeight: '600', color: '#4C669F' },
  tagTextRed: { color: '#FF3B30' },
  productCardRight: { alignItems: 'flex-end', gap: 8 },
  productPrice: { fontSize: 18, fontWeight: '800', color: '#2D3A8C' },
  cardActions: { flexDirection: 'row', gap: 10 },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconBg: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1A1F4B', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  emptyBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#2D3A8C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  emptyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // FAB
  fabContainer: { position: 'absolute', bottom: 28, right: 24 },
  fabButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    overflow: 'hidden',
    shadowColor: '#192f6a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
