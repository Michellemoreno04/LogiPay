import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  FlatList,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import { SnappySpringConfig, TourProvider, TourZone, useTour } from 'react-native-lumen';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
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
  const [menuProduct, setMenuProduct] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0 });

  // Scanner state
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'upc-a', 'upc-e', 'code-128', 'code-39', 'code-93', 'qr', 'pdf-417', 'aztec', 'data-matrix'],
    onCodeScanned: (codes) => {
      if (scanned) return;
      const first = codes[0];
      if (first?.value) handleBarCodeScanned({ data: first.value });
    },
  });

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
    if (!hasPermission) {
      const granted = await requestPermission();
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

      const parsedQty = parseFloat(quantity) || 1;
      const parsedPrice = parseFloat(unitPrice) || 0;
      const isCash = !clientId;
      const effectiveClientName = clientName || (isCash ? 'Venta al contado' : (clients?.find((c) => c.id === clientId)?.name || 'Sin nombre'));
      const txTitle = `Compra: ${selectedProductForSale.name || 'Producto'}`;
      const txDescription = JSON.stringify({
        isInvoice: true,
        items: [{
          productId: selectedProductForSale.id,
          productName: selectedProductForSale.name || 'Producto',
          quantity: parsedQty,
          unitPrice: parsedPrice,
          totalAmount: result.totalAmount,
        }],
        totalAmount: result.totalAmount,
      });

      addSaleOptimistic({
        saleId: result.saleId,
        productId: selectedProductForSale.id,
        clientId: clientId || '',
        clientName: effectiveClientName,
        quantity: parsedQty,
        unitPrice: parsedPrice,
        buyPrice: result.buyPrice,
        totalAmount: result.totalAmount,
        date: result.date,
        newStock: result.newStock,
        productName: selectedProductForSale.name || '',
      });

      addTransactionOptimistic({
        txId: result.txId,
        clientId: clientId || null,
        clientName: effectiveClientName,
        type: isCash ? 'sale' : 'debt',
        amount: result.totalAmount,
        title: txTitle,
        description: txTitle,
        rawDescription: txDescription,
      });

      if (updateLocalUserData && !isCash) {
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

  const { width, height } = useWindowDimensions();
  const numColumns = width >= 768 ? 4 : (width >= 550 ? 3 : 2);
  const cardGap = 12;
  const horizontalPadding = 16;
  const cardWidth = Math.floor((width - (horizontalPadding * 2) - (cardGap * (numColumns - 1))) / numColumns);

  const renderProduct = ({ item }) => {
    const isOutOfStock = (item.stock !== undefined && item.stock !== null) && item.stock <= 0;
    const categoryInfo = CATEGORIES.find((c) => c.id === item.category);

    return (
      <View style={{ width: cardWidth }}>
        <TouchableOpacity
          style={[styles.productCard, { width: cardWidth }]}
          onPress={() => router.push(`/product/${item.id}`)}
          activeOpacity={0.9}
        >
          {/* Top bar on card: Stock Tag & 3-dots menu */}
          <View style={styles.cardHeaderRow}>
            {item.stock !== undefined && item.stock !== null ? (
              <View style={[styles.stockBadge, isOutOfStock ? styles.stockBadgeRed : styles.stockBadgeBlue]}>
                <Text style={[styles.stockBadgeText, isOutOfStock && styles.stockBadgeTextRed]}>
                  {isOutOfStock ? 'Agotado' : `${item.stock} disp.`}
                </Text>
              </View>
            ) : (
              <View />
            )}

            <TouchableOpacity
              style={styles.cardActionIcon}
              onPress={(e) => {
                const { pageX, pageY } = e.nativeEvent;
                setMenuAnchor({ x: pageX, y: pageY });
                setMenuProduct(item);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.6}
            >
              <Ionicons name="ellipsis-vertical" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Product Image (Takes full width of the card) */}
          <View style={styles.cardImageWrapper}>
            {item.photoUri ? (
              <Image
                source={{ uri: item.photoUri }}
                style={styles.cardProductImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={['#F0F4FF', '#E2E8F8']}
                style={styles.cardImagePlaceholder}
              >
                <Ionicons
                  name={categoryInfo?.icon || 'cube-outline'}
                  size={40}
                  color={categoryInfo?.color || '#4C669F'}
                />
              </LinearGradient>
            )}
          </View>

          {/* Info Container */}
          <View style={styles.cardInfoContainer}>
            {/* Category Pill Slot */}
            <View style={styles.categoryPillContainer}>
              {categoryInfo && categoryInfo.id !== 'todos' ? (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText} numberOfLines={1}>
                    {categoryInfo.label}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Product Name & Subtitle */}
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>

            <Text style={styles.cardSubtitle} numberOfLines={1}>
              {item.description || ''}
            </Text>

            {/* Bottom Price Row */}
            <View style={styles.cardBottomRow}>
              <Text style={styles.cardPrice}>
                ${parseFloat(item.price || 0).toFixed(2)}
              </Text>
              {item.buyPrice && parseFloat(item.buyPrice) > 0 ? (
                <Text style={styles.cardCostPrice}>
                  Costo: ${parseFloat(item.buyPrice).toFixed(2)}
                </Text>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* ─── Floating Options Dropdown Modal ─── */}
      <Modal
        visible={!!menuProduct}
        transparent
        animationType="none"
        onRequestClose={() => setMenuProduct(null)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuProduct(null)}>
          <View style={styles.dropdownModalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.dropdownMenuFloating,
                  {
                    top: Math.min(menuAnchor.y + 8, height - 130),
                    left: Math.max(16, Math.min(menuAnchor.x - 120, width - 150)),
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.dropdownMenuItem}
                  onPress={() => {
                    const prod = menuProduct;
                    setMenuProduct(null);
                    if (prod) handleOpenEdit(prod);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={16} color="#2D3A8C" />
                  <Text style={styles.dropdownMenuText}>Editar</Text>
                </TouchableOpacity>

                <View style={styles.dropdownMenuDivider} />

                <TouchableOpacity
                  style={styles.dropdownMenuItem}
                  onPress={() => {
                    const prod = menuProduct;
                    setMenuProduct(null);
                    if (prod) handleDelete(prod);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                  <Text style={[styles.dropdownMenuText, { color: '#FF3B30' }]}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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
        key={numColumns}
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={numColumns}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={() => {
          if (menuProduct) setMenuProduct(null);
        }}
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 160,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Square Product Card
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    height: 280,
    borderWidth: 1,
    borderColor: '#EBF0F5',
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 26,
  },
  stockBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  stockBadgeBlue: {
    backgroundColor: '#E8F1FD',
  },
  stockBadgeRed: {
    backgroundColor: '#FFEAEA',
  },
  stockBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2B6CB0',
  },
  stockBadgeTextRed: {
    color: '#E53E3E',
  },
  cardActionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageWrapper: {
    width: '100%',
    height: 115,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  cardProductImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfoContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  categoryPillContainer: {
    height: 20,
    justifyContent: 'center',
  },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4A5568',
    textTransform: 'capitalize',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A202C',
    lineHeight: 17,
    height: 34,
    marginTop: 2,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#718096',
    height: 16,
    lineHeight: 16,
  },
  cardBottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',

  },
  cardPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1A202C',
    letterSpacing: -0.3,
  },
  cardCostPrice: {
    fontSize: 10.5,
    color: '#A0AEC0',
    fontWeight: '500',
  },

  // Dropdown Menu
  dropdownModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  dropdownMenuFloating: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 4,
    width: 140,
    shadowColor: '#1A1F4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#ECEEF4',
  },
  dropdownMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dropdownMenuDivider: {
    height: 1,
    backgroundColor: '#F0F2F7',
    marginHorizontal: 8,
  },
  dropdownMenuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
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

