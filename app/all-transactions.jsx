import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import ShareTransactionCard from '../components/ShareTransactionCard';
import { useAuth } from '../authContext/authContext';
import { db as firestore } from '../firebaseConfig/config';
import {
  getClients,
  getRecentActivity,
  insertTransaction,
  insertSale,
} from '../utils/database';
import { syncOutbox } from '../utils/syncEngine';

// ─── Filter options ───
const FILTERS = [
  { key: 'today', label: 'Hoy' },
  { key: 'week',  label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'all',   label: 'Todo' },
];

// ─── Helper: formato de moneda ───
const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

// ─── Helper: formato de fecha completa ───
function formatTxDate(ts, fallback) {
  if (!ts) return fallback || '';
  const date = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(date.getTime())) return fallback || '';
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── Filter helper ───
function filterByDate(txs, filter) {
  const now = new Date();
  return txs.filter((tx) => {
    const d = tx._date instanceof Date ? tx._date : new Date(tx.createdAt);
    if (filter === 'today') {
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth()   === now.getMonth()    &&
             d.getDate()    === now.getDate();
    }
    if (filter === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (filter === 'month') {
      return d.getFullYear() === now.getFullYear() &&
             d.getMonth()   === now.getMonth();
    }
    return true; // 'all'
  });
}

// ─── Helper: relative time in Spanish ───
function timeAgo(ts) {
  if (!ts) return '';
  const date = ts instanceof Date ? ts : new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function AllTransactionsScreen() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('today');

  // Estado para modal de detalle de transacción al contado
  const [selectedTx, setSelectedTx] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Estado para modal de opciones (3 puntos) y compartir
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [selectedTxForOptions, setSelectedTxForOptions] = useState(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharingTx, setSharingTx] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const cardRef = useRef(null);

  const filtered = useMemo(() => filterByDate(transactions, activeFilter), [transactions, activeFilter]);

  // ─── Cargar desde SQLite + sincronizar Firebase en background ───
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let unsubscribes = [];

    const loadFromSQLite = async () => {
      // Usar getRecentActivity que combina transacciones + ventas
      const rows = await getRecentActivity(user.uid, 300);
      const hydrated = rows.map((row) => ({
        ...row,
        _date: new Date(row.createdAt),
      }));
      if (isMounted) {
        setTransactions(hydrated);
        setLoading(false);
      }
    };

    const syncFromFirebase = async () => {
      // 2. Intentar sincronizar outbox
      syncOutbox().catch(console.error);

      // 3. Escuchar Firebase para sincronizar datos de otros dispositivos
      const clients = await getClients(user.uid);

      clients.forEach((client) => {
        try {
          const txQ = query(
            collection(firestore, 'users', user.uid, 'clients', client.id, 'transactions'),
            orderBy('createdAt', 'desc')
          );
          const unsub = onSnapshot(txQ, async (snap) => {
            if (!isMounted) return;
            for (const docSnap of snap.docs) {
              const data = docSnap.data();
              await insertTransaction(user.uid, {
                id: docSnap.id,
                clientId: client.id,
                type: data.type,
                amount: data.amount,
                title: data.title || data.description || '',
                description: data.description || '',
                date: data.createdAt?.toDate
                  ? data.createdAt.toDate().toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '',
                createdAt: data.createdAt?.toMillis?.() || Date.now(),
              });
            }
            await loadFromSQLite();
          }, (err) => {
            console.warn('[AllTx] Firebase listener offline for client', client.id, err.code);
          });
          unsubscribes.push(unsub);
        } catch (e) {
          console.warn('[AllTx] Firebase listener error:', e);
        }
      });
    };

    const init = async () => {
      await loadFromSQLite();
      syncFromFirebase().catch(console.error);
    };

    init();

    // Escuchar cambios locales
    const sub = DeviceEventEmitter.addListener('local-db-changed', loadFromSQLite);
    const subSales = DeviceEventEmitter.addListener('sales-db-changed', loadFromSQLite);

    return () => {
      isMounted = false;
      unsubscribes.forEach((fn) => fn());
      sub.remove();
      subSales.remove();
    };
  }, [user]);

  const openShareModal = (tx) => {
    setOptionsModalVisible(false);
    setSharingTx(tx);
    setTimeout(() => setShareModalVisible(true), 150);
  };

  const handleShare = async () => {
    if (!cardRef.current) {
      if (sharingTx) {
        const text = `Comprobante LogiPay\nCliente: ${sharingTx.clientName || 'Venta al contado'}\nMonto: $${sharingTx.amount?.toFixed(2)}\nFecha: ${formatTxDate(sharingTx.createdAt, sharingTx.date)}`;
        Share.share({ message: text });
      }
      return;
    }
    setIsCapturing(true);
    try {
      const uri = await cardRef.current.capture();
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Compartir comprobante de transacción',
        });
      } else {
        const text = `Comprobante LogiPay\nCliente: ${sharingTx?.clientName || 'Venta al contado'}\nMonto: $${sharingTx?.amount?.toFixed(2)}`;
        Share.share({ message: text });
      }
    } catch (e) {
      console.error('[AllTx] Error al compartir:', e);
      if (sharingTx) {
        const text = `Comprobante LogiPay\nCliente: ${sharingTx.clientName || 'Venta al contado'}\nMonto: $${sharingTx.amount?.toFixed(2)}`;
        Share.share({ message: text }).catch(() => {});
      }
    } finally {
      setIsCapturing(false);
    }
  };

  const renderItem = ({ item }) => {
    let isInvoice = false;
    let invoicePreview = null;
    const rawDesc = item.rawDescription || item.description;

    if (rawDesc) {
      try {
        const parsed = JSON.parse(rawDesc);
        if (parsed && parsed.isInvoice && Array.isArray(parsed.items)) {
          isInvoice = true;
          invoicePreview = `🛒 ` + parsed.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ');
        }
      } catch (e) {}
    }

    const isSale = item.type === 'sale';
    const isPayment = item.type === 'payment';

    const palette = isInvoice
      ? { bg: '#FFF8EC', icon: '#FF9500', text: '#FF9500' }
      : isSale
      ? { bg: '#FFF8EC', icon: '#FF9500', text: '#FF9500' }
      : isPayment
      ? { bg: '#E8F9EE', icon: '#34C759', text: '#34C759' }
      : { bg: '#FDECEA', icon: '#FF3B30', text: '#FF3B30' };

    const iconName = isInvoice
      ? 'receipt'
      : isSale
      ? 'cart'
      : isPayment ? 'add-circle' : 'remove-circle';

    const badgeLabel = isInvoice ? 'Factura' : isSale ? 'Venta' : isPayment ? 'Abono' : 'Cargo';
    const amountPrefix = (isSale || !item.clientId) ? '' : isPayment ? '+' : '-';

    const title = item.clientName || (item.clientId ? 'Sin nombre' : 'Venta al contado');

    const subtitle = isInvoice
      ? invoicePreview
      : isSale
      ? `🛒 ${item.description || item.productName || 'Producto'}`
      : (item.title || item.description || '—');

    return (
      <TouchableOpacity
        style={styles.activityItem}
        activeOpacity={0.7}
        onPress={() => {
          setSelectedTxForOptions(item);
          setOptionsModalVisible(true);
        }}
      >
        <View style={[styles.activityIconBg, { backgroundColor: palette.bg }]}>
          <Ionicons name={iconName} size={22} color={palette.icon} />
        </View>

        <View style={styles.activityInfo}>
          <Text style={styles.activityText} numberOfLines={1}>{title}</Text>
          <Text style={styles.activityDescription} numberOfLines={1}>{subtitle}</Text>
          <Text style={styles.activityTime}>{timeAgo(item.createdAt)}</Text>
        </View>

        <View style={styles.amountContainer}>
          <Text style={[styles.activityAmount, { color: palette.text }]}>
            {amountPrefix}${item.amount?.toFixed(2) || '0.00'}
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: palette.bg }]}>
            <Text style={[styles.typeText, { color: palette.text }]}>{badgeLabel}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.threeDotsButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => {
            setSelectedTxForOptions(item);
            setOptionsModalVisible(true);
          }}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#8E8E93" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Facturas y Movimientos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ─── Filter Tabs ─── */}
      <View style={styles.filterWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterPill, activeFilter === f.key && styles.filterPillActive]}
              onPress={() => setActiveFilter(f.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.filterPillText, activeFilter === f.key && styles.filterPillTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4C669F" />
          <Text style={styles.loadingText}>Cargando transacciones...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={80} color="#C7C7CC" />
          <Text style={styles.emptyText}>Sin movimientos</Text>
          <Text style={styles.emptySubText}>No hay transacciones para este período</Text>
        </View>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <FlashList
            data={filtered}
            renderItem={renderItem}
            estimatedItemSize={90}
            contentContainerStyle={{ paddingBottom: 20, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      {/* ── Modal de Opciones (3 Puntos) ── */}
      <Modal
        visible={optionsModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setOptionsModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setOptionsModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.optionsModalContent}>
            {selectedTxForOptions && (() => {
              const hasClient = Boolean(selectedTxForOptions.clientId && selectedTxForOptions.clientId !== 'global');
              const clientName = selectedTxForOptions.clientName || (hasClient ? 'Sin nombre' : 'Venta al contado');
              const txTitle = selectedTxForOptions.title || selectedTxForOptions.description || 'Transacción';

              return (
                <>
                  <View style={styles.optionsHeader}>
                    <View style={styles.optionsHeaderLeft}>
                      <Text style={styles.optionsHeaderTitle} numberOfLines={1}>{clientName}</Text>
                      <Text style={styles.optionsHeaderSub} numberOfLines={1}>{txTitle}</Text>
                    </View>
                    <Text style={styles.optionsHeaderAmount}>
                      ${selectedTxForOptions.amount?.toFixed(2) || '0.00'}
                    </Text>
                  </View>

                  <View style={styles.optionsDivider} />

                  {/* Opción Ver Perfil con icono de redirección (si es cliente) */}
                  {hasClient && (
                    <TouchableOpacity
                      style={styles.optionRow}
                      onPress={() => {
                        setOptionsModalVisible(false);
                        router.push(`/${selectedTxForOptions.clientId}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.optionIconBg, { backgroundColor: '#EBF3FF' }]}>
                        <Ionicons name="open-outline" size={20} color="#007AFF" />
                      </View>
                      <View style={styles.optionTextCol}>
                        <Text style={styles.optionTitle}>Ver perfil de usuario</Text>
                        <Text style={styles.optionSub}>Ir al perfil de {clientName}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                    </TouchableOpacity>
                  )}

                  {/* Opción Ver detalles */}
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                      setOptionsModalVisible(false);
                      setSelectedTx(selectedTxForOptions);
                      setModalVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.optionIconBg, { backgroundColor: '#F0F4FF' }]}>
                      <Ionicons name="document-text-outline" size={20} color="#4C669F" />
                    </View>
                    <View style={styles.optionTextCol}>
                      <Text style={styles.optionTitle}>Ver detalles</Text>
                      <Text style={styles.optionSub}>Ver desglose e información del movimiento</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                  </TouchableOpacity>

                  {/* Opción Compartir */}
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => openShareModal(selectedTxForOptions)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.optionIconBg, { backgroundColor: '#E8F9EE' }]}>
                      <Ionicons name="share-outline" size={20} color="#34C759" />
                    </View>
                    <View style={styles.optionTextCol}>
                      <Text style={styles.optionTitle}>Compartir</Text>
                      <Text style={styles.optionSub}>Enviar comprobante por WhatsApp u otras apps</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.cancelOptionsBtn}
                    onPress={() => setOptionsModalVisible(false)}
                  >
                    <Text style={styles.cancelOptionsText}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal de Compartir Comprobante ── */}
      <Modal
        visible={shareModalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShareModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShareModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.shareModalContent}>
            <View style={[styles.shareModalHeader, { justifyContent: 'flex-end' }]}>
              <TouchableOpacity
                onPress={() => setShareModalVisible(false)}
                style={styles.closeIconButton}
              >
                <Ionicons name="close" size={20} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.cardPreviewContainer}>
              <ViewShot ref={cardRef} options={{ format: 'png', quality: 0.9 }}>
                <ShareTransactionCard
                  transaction={sharingTx}
                  clientName={sharingTx?.clientName || (sharingTx?.clientId ? 'Sin nombre' : 'Venta al contado')}
                />
              </ViewShot>
            </View>

            <View style={styles.shareActions}>
              <TouchableOpacity
                style={styles.shareCancelBtn}
                onPress={() => setShareModalVisible(false)}
              >
                <Text style={styles.shareCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareConfirmBtn}
                onPress={handleShare}
                disabled={isCapturing}
              >
                {isCapturing ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="share-outline" size={20} color="white" />
                    <Text style={styles.shareConfirmText}>Compartir</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal de detalle de transacción al contado ── */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            {selectedTx && (() => {
              let parsedInvoice = null;
              const rawDesc = selectedTx.rawDescription || selectedTx.description;
              if (rawDesc) {
                try {
                  const p = JSON.parse(rawDesc);
                  if (p && p.isInvoice && Array.isArray(p.items)) {
                    parsedInvoice = p;
                  }
                } catch (e) {}
              }

              const isInvoice = Boolean(parsedInvoice);
              const isSale = selectedTx.type === 'sale';
              const isPayment = selectedTx.type === 'payment';

              const palette = isInvoice || isSale
                ? { bg: '#FFF8EC', icon: '#FF9500', text: '#FF9500' }
                : isPayment
                ? { bg: '#E8F9EE', icon: '#34C759', text: '#34C759' }
                : { bg: '#FDECEA', icon: '#FF3B30', text: '#FF3B30' };

              const iconName = isInvoice
                ? 'receipt'
                : isSale
                ? 'cart'
                : isPayment ? 'add-circle' : 'remove-circle';

              const displayTitle = selectedTx.clientName || (selectedTx.clientId ? 'Sin nombre' : 'Venta al contado');
              const subtitleText = selectedTx.title || selectedTx.description || 'Detalle de transacción';

              return (
                <>
                  {/* Header con icono y título */}
                  <View style={styles.modalHeaderRow}>
                    <View style={[styles.modalIconBg, { backgroundColor: palette.bg }]}>
                      <Ionicons name={iconName} size={24} color={palette.icon} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTxTitle}>{subtitleText}</Text>
                      <Text style={styles.modalTxDate}>
                        {formatTxDate(selectedTx.createdAt, selectedTx.date)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setModalVisible(false)}
                      style={styles.closeIconButton}
                    >
                      <Ionicons name="close" size={20} color="#8E8E93" />
                    </TouchableOpacity>
                  </View>

                  {/* Badge de cliente / tipo */}
                  <View style={styles.clientTagRow}>
                    <Ionicons name="cash-outline" size={16} color="#4C669F" />
                    <Text style={styles.clientTagText}>{displayTitle}</Text>
                  </View>

                  {/* Detalle o Factura */}
                  {isInvoice ? (
                    <View style={styles.invoiceBox}>
                      <Text style={styles.invoiceBoxHeader}>
                        Productos comprados ({parsedInvoice.items.length})
                      </Text>
                      <ScrollView style={styles.invoiceScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {parsedInvoice.items.map((item, idx) => (
                          <View key={idx} style={styles.invoiceRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.invoiceItemName}>{item.productName}</Text>
                              <Text style={styles.invoiceItemSub}>
                                {item.quantity} x ${formatCurrency(item.unitPrice)}
                              </Text>
                            </View>
                            <Text style={styles.invoiceItemTotal}>
                              ${formatCurrency(item.totalAmount)}
                            </Text>
                          </View>
                        ))}
                      </ScrollView>
                      <View style={styles.invoiceTotalRow}>
                        <Text style={styles.invoiceTotalLabel}>Total Venta</Text>
                        <Text style={styles.invoiceTotalAmount}>
                          ${formatCurrency(selectedTx.amount)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.simpleDetailBox}>
                      <Text style={styles.detailLabel}>Monto de la transacción</Text>
                      <Text style={[styles.detailAmountText, { color: palette.text }]}>
                        ${formatCurrency(selectedTx.amount)}
                      </Text>
                      {selectedTx.description && selectedTx.description !== selectedTx.title && (
                        <View style={{ marginTop: 12, width: '100%' }}>
                          <Text style={styles.detailLabel}>Descripción</Text>
                          <Text style={styles.detailDescriptionText}>{selectedTx.description}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Botón Cerrar */}
                  <TouchableOpacity
                    style={styles.closeModalBtn}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.closeModalBtnText}>Cerrar</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#F2F2F7',
  },
  filterWrapper: {
    paddingVertical: 8,
    backgroundColor: '#F2F2F7',
  },
  filterRow: {
    paddingHorizontal: 20,
    gap: 8,
    flexDirection: 'row',
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  filterPillActive: {
    backgroundColor: '#4C669F',
    borderColor: '#4C669F',
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 20,
  },
  emptySubText: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
  },
  activityIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityInfo: {
    flex: 1,
    marginLeft: 12,
  },
  activityText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1F4B',
  },
  activityDescription: {
    fontSize: 13,
    color: '#636366',
    marginTop: 2,
  },
  activityTime: {
    fontSize: 11,
    color: '#AEAEB2',
    marginTop: 4,
  },
  amountContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityAmount: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  /* ── Estilos para Modal de Detalle ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 450,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalIconBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  modalTxTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  modalTxDate: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  closeIconButton: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  clientTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F4FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 16,
    alignSelf: 'flex-start',
    gap: 6,
  },
  clientTagText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4C669F',
  },
  invoiceBox: {
    backgroundColor: '#F9F9FB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  invoiceBoxHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  invoiceScroll: {
    maxHeight: 220,
    marginBottom: 10,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFF4',
  },
  invoiceItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  invoiceItemSub: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  invoiceItemTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  invoiceTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1.5,
    borderTopColor: '#E5E5EA',
  },
  invoiceTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  invoiceTotalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FF9500',
  },
  simpleDetailBox: {
    backgroundColor: '#F9F9FB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
  },
  detailAmountText: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 6,
  },
  detailDescriptionText: {
    fontSize: 15,
    color: '#1C1C1E',
    marginTop: 4,
  },
  closeModalBtn: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeModalBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  threeDotsButton: {
    padding: 6,
    marginLeft: 6,
    borderRadius: 16,
  },
  /* ── Estilos Modal de Opciones (3 Puntos) ── */
  optionsModalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    width: '100%',
    maxWidth: 450,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  optionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
  },
  optionsHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  optionsHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  optionsHeaderSub: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  optionsHeaderAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  optionsDivider: {
    height: 1,
    backgroundColor: '#E5E5EA',
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 6,
  },
  optionIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  optionSub: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  cancelOptionsBtn: {
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
  },
  cancelOptionsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  /* ── Estilos Modal de Compartir ── */
  shareModalContent: {
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    width: '100%',
    maxWidth: 450,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    alignItems: 'center',
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 16,
  },
  shareModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  cardPreviewContainer: {
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  shareActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  shareCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  shareCancelText: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '600',
  },
  shareConfirmBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#4C669F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareConfirmText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '700',
  },
});
