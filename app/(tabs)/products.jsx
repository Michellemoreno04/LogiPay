import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  FlatList,
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
import { SnappySpringConfig, TourProvider, TourZone, useTour } from 'react-native-lumen';
import { useAuth } from '../../authContext/authContext';
import SaleModal from '../../components/modales/SaleModal';
import { useLocalData } from '../../context/LocalDataContext';
import { getSalesByProduct } from '../../utils/database';
import { deleteProduct, recordSale } from '../../utils/productService';

const CATEGORIES = [
  { id: 'todos', label: 'Todos', icon: 'apps-outline', color: '#4C669F' },
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




export default function ProductsScreen() {
  return (
    <TourProvider
      stepsOrder={['step-1', 'step-2']}
      config={{ springConfig: SnappySpringConfig, enableGlow: true, preventInteraction: true, labels: { finish: 'Entendido' } }}
    >
      <ProductsScreenContent />
    </TourProvider>
  );
}

function ProductsScreenContent() {
  const { user, userData, updateLocalUserData } = useAuth();
  const { start, currentStep } = useTour();
  const {
    products,
    loadingProducts,
    addProductOptimistic,
    editProductOptimistic,
    deleteProductOptimistic,
    clients,
    addSaleOptimistic,
    addTransactionOptimistic,
  } = useLocalData();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');

  // Scanner state
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // Sale Modal state
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState(null);
  const [savingSale, setSavingSale] = useState(false);

  const fabScale = useRef(new Animated.Value(1)).current;
  const scanFabScale = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  const filteredProducts = products.filter((p) => {
    const matchesSearch = (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'todos' || (p.category || '') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  useEffect(() => {
    const checkTour = async () => {
      if (!user) return;

      try {
        const hasSeenTour = await AsyncStorage.getItem(`hasCreateProductTour_${user.uid}`);
        if (hasSeenTour !== 'true') {

          setTimeout(() => {
            start();
            AsyncStorage.setItem(`hasCreateProductTour_${user.uid}`, 'true');
          }, 1000);

        }
      } catch (error) {
        console.error('Error handling tour status:', error);
      }
    };

    checkTour();
  }, [user, start]);

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

  const handleOpenCreate = () => {
    router.push('/add-product');
  };

  const handleOpenEdit = (product) => {
    router.push({
      pathname: '/add-product',
      params: {
        productId: product.id,
        name: product.name || '',
        price: product.price != null ? String(product.price) : '',
        description: product.description || '',
        stock: product.stock >= 0 ? String(product.stock) : '',
        barcode: product.barcode || '',
        buyPrice: product.buyPrice || '',
        category: product.category || '',
        photoUri: product.photoUri || '',
      },
    });
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
              const sales = await getSalesByProduct(user.uid, product.id);
              let debtToRevert = 0;
              sales.forEach(s => debtToRevert += (s.totalAmount || 0));

              await deleteProduct({ uid: user.uid, productId: product.id });
              deleteProductOptimistic(product.id);

              if (updateLocalUserData && debtToRevert > 0) {
                updateLocalUserData({ totalDebt: (userData?.totalDebt || 0) - debtToRevert });
              }

              DeviceEventEmitter.emit('products-db-changed');
              DeviceEventEmitter.emit('local-db-changed');
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

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const { granted } = await requestCameraPermission();
      if (!granted) {
        Alert.alert('Permiso denegado', 'Necesitamos acceso a tu cámara para escanear productos.');
        return;
      }
    }
    setTorchOn(false);
    setScanned(false);
    setScannerVisible(true);
  };

  const pressScanFab = () => {
    Animated.sequence([
      Animated.spring(scanFabScale, { toValue: 0.9, useNativeDriver: true, tension: 200 }),
      Animated.spring(scanFabScale, { toValue: 1, useNativeDriver: true, tension: 200 }),
    ]).start();
    router.push('/quick-scan');
  };

  const handleBarCodeScanned = ({ data }) => {
    if (scanned) return;
    setScanned(true);
    Vibration.vibrate(200);
    setScannerVisible(false);
    setTorchOn(false);

    const matchedProduct = products.find(
      (p) => p.barcode && String(p.barcode).trim() === String(data).trim()
    );

    if (matchedProduct) {
      setSelectedProductForSale(matchedProduct);
      setSaleModalVisible(true);
    } else {
      Alert.alert(
        'Producto no encontrado',
        `No existe ningún producto guardado con el código de barras: ${data}`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Agregar producto y vender',
            onPress: () => {
              router.push({
                pathname: '/add-product',
                params: { barcode: data },
              });
            },
          },
        ]
      );
    }
  };

  const handleRecordSale = async ({ clientId, clientName, quantity, unitPrice }) => {
    if (!user || !selectedProductForSale) return;
    setSavingSale(true);
    try {
      const result = await recordSale({
        uid: user.uid,
        productId: selectedProductForSale.id,
        productName: selectedProductForSale.name || '',
        clientId,
        clientName,
        quantity,
        unitPrice,
      });

      addSaleOptimistic({
        saleId: result.saleId,
        productId: selectedProductForSale.id,
        clientId,
        clientName,
        quantity,
        unitPrice,
        buyPrice: result.buyPrice,
        totalAmount: result.totalAmount,
        date: result.date,
        newStock: result.newStock,
        productName: selectedProductForSale.name || '',
      });

      addTransactionOptimistic({
        txId: result.txId,
        clientId,
        clientName,
        type: 'debt',
        amount: result.totalAmount,
        title: `Compra: ${selectedProductForSale.name || 'Producto'}`,
        description: `Compra: ${selectedProductForSale.name || 'Producto'}`,
      });

      if (updateLocalUserData) {
        updateLocalUserData({
          totalDebt: (userData?.totalDebt || 0) + result.totalAmount,
        });
      }

      DeviceEventEmitter.emit('products-db-changed');
      DeviceEventEmitter.emit('local-db-changed');
      setSaleModalVisible(false);
      setSelectedProductForSale(null);
    } catch (e) {
      Alert.alert('Error', 'No se pudo registrar la venta. Intenta de nuevo.');
      console.error(e);
    } finally {
      setSavingSale(false);
    }
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

      {/* ─── Category Filter Bar ─── */}
      <View style={styles.categoryBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBarContent}
        >
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            // Only show category if it's 'todos' or has products in that category
            const hasProducts = cat.id === 'todos' || products.some((p) => (p.category || '') === cat.id);
            if (!hasProducts) return null;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  isActive && { backgroundColor: cat.color, borderColor: cat.color },
                ]}
                onPress={() => setSelectedCategory(cat.id)}
                activeOpacity={0.75}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={isActive ? '#fff' : cat.color}
                />
                <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

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

      {/* ─── FAB Container ─── */}
      <View style={styles.fabContainer}>
        {/* Scanner FAB (above Add Product) */}
        <Animated.View style={{ transform: [{ scale: scanFabScale }] }}>
          <TourZone
            stepKey="step-2"
            name="Escanear Producto"
            description="Presiona aquí para escanear el código de barras de un producto y registrar una venta rápidamente."
            order={2}
            borderRadius={28}
          >
            <TouchableOpacity style={styles.scanFabButton} onPress={pressScanFab} activeOpacity={0.85}>
              <LinearGradient
                colors={['#2D8C5A', '#1A4B2F']}
                style={styles.fabGradient}
              >
                <MaterialCommunityIcons name="barcode-scan" size={24} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </TourZone>
        </Animated.View>

        {/* Add Product FAB */}
        <Animated.View style={{ transform: [{ scale: fabScale }] }}>
          <TourZone
            stepKey="step-1"
            name="Crear Producto"
            description="Aquí puedes crear los productos que estarás vendiendo."
            order={1}
            borderRadius={31}
          >
            <TouchableOpacity style={styles.fabButton} onPress={pressFab} activeOpacity={0.85}>
              <LinearGradient
                colors={['#4C669F', '#3B5998', '#192f6a']}
                style={styles.fabGradient}
              >
                <Ionicons name="add" size={28} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </TourZone>
        </Animated.View>
      </View>

      {/* ─── Scanner Modal ─── */}
      <Modal
        visible={scannerVisible}
        animationType="slide"
        onRequestClose={() => { setScannerVisible(false); setTorchOn(false); }}
      >
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            facing="back"
            enableTorch={torchOn}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'code93', 'qr', 'pdf417', 'aztec', 'datamatrix'],
            }}
          />
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
              <Text style={styles.scanHint}>Enfoca el código de barras para escanear y vender</Text>
              <TouchableOpacity
                style={styles.scanCancelBtn}
                onPress={() => { setScannerVisible(false); setTorchOn(false); }}
              >
                <Text style={styles.scanCancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Sale Modal ─── */}
      <SaleModal
        visible={saleModalVisible}
        onClose={() => {
          setSaleModalVisible(false);
          setSelectedProductForSale(null);
        }}
        onSave={handleRecordSale}
        product={selectedProductForSale}
        clients={clients}
        loading={savingSale}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F8' },

  // Header
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? 50 : 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -40,
    right: -60,
  },
  decorCircle2: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
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

  // Category bar
  categoryBarWrapper: {
    backgroundColor: '#F0F2F8',
    paddingTop: 14,
    paddingBottom: 2,
  },
  categoryBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E0E4F0',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },
  categoryChipTextActive: {
    color: '#fff',
  },

  // List
  listContent: { padding: 16, paddingBottom: 160 },
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
  fabContainer: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    alignItems: 'center',
    gap: 14,
  },
  scanFabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#1A4B2F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
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

  // Scanner Modal
  scannerContainer: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  scanOverlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 50, paddingRight: 20 },
  torchBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  torchBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  scanOverlayMiddle: { flexDirection: 'row', height: 240 },
  scanOverlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  scanOverlayBottom: { flex: 1.2, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', justifyContent: 'center', gap: 20, paddingTop: 20 },
  scanFrame: { width: 240, height: 240, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#2D8C5A', borderWidth: 3.5 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  scanLine: { position: 'absolute', top: 0, left: 4, right: 4, height: 2, backgroundColor: '#2D8C5A', borderRadius: 1, shadowColor: '#2D8C5A', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 },
  scanHint: { fontSize: 14, color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontWeight: '500', paddingHorizontal: 32 },
  scanCancelBtn: { paddingHorizontal: 32, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  scanCancelText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

