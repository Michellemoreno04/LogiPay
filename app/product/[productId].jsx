import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  DeviceEventEmitter,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SaleModal from '../../components/modales/SaleModal';
import { useLocalData } from '../../context/LocalDataContext';
import { useAuth } from '../../authContext/authContext';
import { deleteSale, recordSale } from '../../utils/productService';
import { getSalesByProduct } from '../../utils/database';

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams();
  const { user, userData, updateLocalUserData } = useAuth();
  const { products, clients, addSaleOptimistic, deleteSaleOptimistic, addTransactionOptimistic } = useLocalData();


  const product = products.find((p) => p.id === productId);

  const [sales, setSales] = useState([]);
  const [loadingSales, setLoadingSales] = useState(true);
  const [saleModalVisible, setSaleModalVisible] = useState(false);
  const [savingSale, setSavingSale] = useState(false);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const loadSales = async () => {
    if (!user || !productId) return;
    try {
      const data = await getSalesByProduct(user.uid, productId);
      setSales(data);
    } catch (e) {
      console.error('Error loading sales:', e);
    } finally {
      setLoadingSales(false);
    }
  };

  useEffect(() => {
    loadSales();
    const sub = DeviceEventEmitter.addListener('products-db-changed', loadSales);
    return () => sub.remove();
  }, [user, productId]);

  const handleRecordSale = async ({ clientId, clientName, quantity, unitPrice }) => {
    if (!user) return;
    setSavingSale(true);
    try {
      const result = await recordSale({
        uid: user.uid,
        productId,
        productName: product?.name || '',
        clientId,
        clientName,
        quantity,
        unitPrice,
      });

      // Actualización optimista de la venta (activity feed + stock)
      addSaleOptimistic({
        saleId: result.saleId,
        productId,
        clientId,
        clientName,
        quantity,
        unitPrice,
        totalAmount: result.totalAmount,
        date: result.date,
        newStock: result.newStock,
        productName: product?.name || '',
      });

      // Actualización optimista de la transacción de deuda del cliente
      // (actualiza balance del cliente en memoria)
      addTransactionOptimistic({
        txId: result.txId,
        clientId,
        clientName,
        type: 'debt',
        amount: result.totalAmount,
        title: `Compra: ${product?.name || 'Producto'}`,
        description: `Compra: ${product?.name || 'Producto'}`,
      });

      // Actualizar totalDebt en AuthContext inmediatamente
      // (esto actualiza el 'Monto total por cobrar' en home sin reiniciar)
      updateLocalUserData({
        totalDebt: (userData?.totalDebt || 0) + result.totalAmount,
      });

      DeviceEventEmitter.emit('products-db-changed');
      setSaleModalVisible(false);
      await loadSales();
    } catch (e) {
      Alert.alert('Error', 'No se pudo registrar la venta. Intenta de nuevo.');
      console.error(e);
    } finally {
      setSavingSale(false);
    }
  };


  const handleDeleteSale = (sale) => {
    Alert.alert(
      'Eliminar Venta',
      `¿Eliminar la venta de ${sale.quantity} unidad${sale.quantity !== 1 ? 'es' : ''} a ${sale.clientName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSale({ uid: user.uid, productId, saleId: sale.id, quantity: sale.quantity, clientId: sale.clientId, totalAmount: sale.totalAmount });
              deleteSaleOptimistic({ saleId: sale.id, productId, quantity: sale.quantity });
              if (updateLocalUserData && sale.totalAmount) {
                updateLocalUserData({ totalDebt: (userData?.totalDebt || 0) - sale.totalAmount });
              }
              DeviceEventEmitter.emit('products-db-changed');
              DeviceEventEmitter.emit('local-db-changed');
              await loadSales();
            } catch (e) {
              Alert.alert('Error', 'No se pudo eliminar la venta.');
            }
          },
        },
      ]
    );
  };

  const totalRevenue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalUnitsSold = sales.reduce((sum, s) => sum + (s.quantity || 0), 0);

  if (!product) {
    return (
      <View style={styles.notFoundContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#C0C0C8" />
        <Text style={styles.notFoundText}>Producto no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Text style={styles.backLinkText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderSaleItem = ({ item }) => (
    <View style={styles.saleCard}>
      <View style={styles.saleAvatarWrap}>
        <Text style={styles.saleAvatarText}>{(item.clientName || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={styles.saleInfo}>
        <Text style={styles.saleClientName}>{item.clientName}</Text>
        <Text style={styles.saleDate}>{item.date}</Text>
        <View style={styles.saleTagRow}>
          <View style={styles.saleTag}>
            <Ionicons name="layers" size={11} color="#2D8C5A" />
            <Text style={styles.saleTagText}>{item.quantity} unidad{item.quantity !== 1 ? 'es' : ''}</Text>
          </View>
        </View>
      </View>
      <View style={styles.salePriceCol}>
        <Text style={styles.saleTotalAmount}>${parseFloat(item.totalAmount || 0).toFixed(2)}</Text>
        <Text style={styles.saleUnitPrice}>${parseFloat(item.unitPrice || 0).toFixed(2)}/u</Text>
        <TouchableOpacity
          onPress={() => handleDeleteSale(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.saleDeleteBtn}
        >
          <Ionicons name="trash-outline" size={15} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ─── Header ─── */}
        <LinearGradient
          colors={['#1A1F4B', '#2D3A8C', '#4C669F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>

          <Animated.View
            style={[styles.headerContent, { opacity: headerOpacity, transform: [{ translateY: headerSlide }] }]}
          >
            <View style={styles.productIconBig}>
              <Ionicons name="cube" size={32} color="#4C669F" />
            </View>
            <Text style={styles.productNameHeader} numberOfLines={2}>{product.name}</Text>
            {product.description ? (
              <Text style={styles.productDescHeader}>{product.description}</Text>
            ) : null}

            {/* Chips */}
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Ionicons name="pricetag" size={13} color="#A8C0FF" />
                <Text style={styles.chipText}>${parseFloat(product.price || 0).toFixed(2)}</Text>
              </View>
              {product.stock >= 0 && (
                <View style={[styles.chip, product.stock === 0 && styles.chipRed]}>
                  <Ionicons name="layers" size={13} color={product.stock > 0 ? '#A8C0FF' : '#FF8A80'} />
                  <Text style={[styles.chipText, product.stock === 0 && styles.chipTextRed]}>
                    Stock: {product.stock}
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </LinearGradient>

        {/* ─── Stats ─── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="cash-outline" size={20} color="#2D8C5A" />
            <Text style={styles.statAmount}>${totalRevenue.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Ingreso total</Text>
          </View>
          <View style={[styles.statCard, styles.statCardCenter]}>
            <Ionicons name="cart-outline" size={20} color="#4C669F" />
            <Text style={styles.statAmount}>{sales.length}</Text>
            <Text style={styles.statLabel}>Ventas</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="layers-outline" size={20} color="#FF6B35" />
            <Text style={styles.statAmount}>{totalUnitsSold}</Text>
            <Text style={styles.statLabel}>Unidades</Text>
          </View>
        </View>

        {/* ─── Register Sale Button ─── */}
        <TouchableOpacity
          style={styles.registerSaleBtn}
          onPress={() => setSaleModalVisible(true)}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={['#2D8C5A', '#1A4B2F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.registerSaleBtnGradient}
          >
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.registerSaleBtnText}>Registrar Venta</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* ─── Sales list ─── */}
        <FlatList
          data={sales}
          keyExtractor={(item) => item.id}
          renderItem={renderSaleItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            sales.length > 0 ? (
              <Text style={styles.sectionLabel}>
                Historial de ventas ({sales.length})
              </Text>
            ) : null
          }
          ListEmptyComponent={
            !loadingSales ? (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={['#E8F5EE', '#C8EDD8']}
                  style={styles.emptyIconBg}
                >
                  <Ionicons name="receipt-outline" size={40} color="#2D8C5A" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>Sin ventas aún</Text>
                <Text style={styles.emptySubtitle}>
                  Registra la primera venta de este producto
                </Text>
              </View>
            ) : null
          }
        />
      </SafeAreaView>

      {/* ─── Sale Modal ─── */}
      <SaleModal
        visible={saleModalVisible}
        onClose={() => setSaleModalVisible(false)}
        onSave={handleRecordSale}
        product={product}
        clients={clients}
        loading={savingSale}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F2F8' },

  // Not found
  notFoundContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundText: { fontSize: 18, color: '#6068A0', fontWeight: '600' },
  backLink: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#E8EEFF', borderRadius: 12 },
  backLinkText: { color: '#4C669F', fontWeight: '600' },

  // Header
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? 16 : 0,
    paddingBottom: 28,
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  headerContent: { alignItems: 'center', zIndex: 1 },
  productIconBig: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  productNameHeader: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  productDescHeader: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    marginBottom: 14,
  },
  chipsRow: { flexDirection: 'row', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipRed: { backgroundColor: 'rgba(255,80,80,0.2)' },
  chipText: { fontSize: 13, fontWeight: '700', color: '#C8D6FF' },
  chipTextRed: { color: '#FF8A80' },

  // Stats
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: -18,
    gap: 10,
    zIndex: 10,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  statCardCenter: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#F0F2F8',
  },
  statAmount: { fontSize: 20, fontWeight: '800', color: '#1A1F4B' },
  statLabel: { fontSize: 11, color: '#8E8E93', fontWeight: '600', textTransform: 'uppercase' },

  // Register sale button
  registerSaleBtn: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#1A4B2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  registerSaleBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  registerSaleBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // Sale card
  saleCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 3,
  },
  saleAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8EEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saleAvatarText: { fontSize: 18, fontWeight: '800', color: '#4C669F' },
  saleInfo: { flex: 1 },
  saleClientName: { fontSize: 15, fontWeight: '700', color: '#1A1F4B', marginBottom: 2 },
  saleDate: { fontSize: 12, color: '#8E8E93', marginBottom: 6 },
  saleTagRow: { flexDirection: 'row' },
  saleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  saleTagText: { fontSize: 11, fontWeight: '600', color: '#2D8C5A' },
  salePriceCol: { alignItems: 'flex-end', gap: 4 },
  saleTotalAmount: { fontSize: 16, fontWeight: '800', color: '#1A4B2F' },
  saleUnitPrice: { fontSize: 12, color: '#8E8E93' },
  saleDeleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty
  emptyState: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 32 },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1A1F4B', marginBottom: 6, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#8E8E93', textAlign: 'center', lineHeight: 20 },
});
