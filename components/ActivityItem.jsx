import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import ShareTransactionCard from './ShareTransactionCard';

// ─── Helper: relative time in Spanish ───
function timeAgo(date) {
  if (!date) return '';
  const dateObj = date instanceof Date ? date : new Date(date);
  if (isNaN(dateObj.getTime())) return '';
  const now = new Date();
  const diffMs = now - dateObj;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Hace un momento';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHr < 24) return `Hace ${diffHr} hora${diffHr > 1 ? 's' : ''}`;
  if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
  return dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

// ─── Helper: fecha formateada completa ───
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

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function ActivityItem({ item }) {
  const [modalVisible, setModalVisible] = useState(false);
  const [optionsModalVisible, setOptionsModalVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const cardRef = useRef(null);

  let isInvoice = false;
  let invoicePreview = null;
  let parsedInvoice = null;
  const rawDesc = item.rawDescription || item.description;

  if (rawDesc) {
    try {
      const parsed = JSON.parse(rawDesc);
      if (parsed && parsed.isInvoice && Array.isArray(parsed.items)) {
        isInvoice = true;
        parsedInvoice = parsed;
        invoicePreview = `🛒 ` + parsed.items.map((i) => `${i.quantity}x ${i.productName}`).join(', ');
      }
    } catch (e) {}
  }

  let isPayment = item.type === 'payment';
  const isSale = item.type === 'sale';

  let badgeLabel = isInvoice ? 'Factura' : isSale ? 'Venta' : isPayment ? 'Abono' : 'Cargo';
  let amountPrefix = (isSale || !item.clientId) ? '' : isPayment ? '+' : '-';

  if (item.clientId === 'global') {
    const isIncrease = item.type === 'increase' || item.type === 'debt';
    if (isIncrease) {
      isPayment = true;
      badgeLabel = 'Abono';
      amountPrefix = '+';
    } else if (item.type !== 'sale') {
      isPayment = false;
      badgeLabel = 'Resta';
      amountPrefix = '-';
    }
  }

  // Color palette per type
  const palette = isInvoice
    ? { bg: '#FFF8EC', icon: '#FF9500', text: '#FF9500' }
    : isSale
    ? { bg: '#FFF8EC', icon: '#FF9500', text: '#FF9500' }
    : isPayment
    ? { bg: '#ECFDF3', icon: '#34C759', text: '#34C759' }
    : { bg: '#FFF1F0', icon: '#FF3B30', text: '#FF3B30' };

  const iconName = isInvoice
    ? 'receipt'
    : isSale
    ? 'cart'
    : isPayment
    ? 'arrow-up-circle'
    : 'arrow-down-circle';

  const clientTitle = item.clientName || (item.clientId === 'global' ? 'Ajuste de Saldo' : item.clientId ? 'Sin nombre' : 'Venta al contado');
  const hasClient = Boolean(item.clientId && item.clientId !== 'global');

  const openShareModal = () => {
    setOptionsModalVisible(false);
    setTimeout(() => setShareModalVisible(true), 150);
  };

  const handleShare = async () => {
    if (!cardRef.current) {
      const text = `Comprobante LogiPay\nCliente: ${clientTitle}\nMonto: $${numberFormatter.format(item.amount)}\nFecha: ${formatTxDate(item.createdAt || item._date, item.date)}`;
      Share.share({ message: text });
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
        const text = `Comprobante LogiPay\nCliente: ${clientTitle}\nMonto: $${numberFormatter.format(item.amount)}`;
        Share.share({ message: text });
      }
    } catch (e) {
      console.error('[ActivityItem] Error al compartir:', e);
      const text = `Comprobante LogiPay\nCliente: ${clientTitle}\nMonto: $${numberFormatter.format(item.amount)}`;
      Share.share({ message: text }).catch(() => {});
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.activityItem}
        activeOpacity={0.65}
        onPress={() => setOptionsModalVisible(true)}
      >
        <View style={[styles.activityIconBg, { backgroundColor: palette.bg }]}>
          <Ionicons name={iconName} size={22} color={palette.icon} />
        </View>

        <View style={styles.activityInfo}>
          <Text style={styles.activityText} numberOfLines={1}>
            {clientTitle}
          </Text>
          <Text style={styles.activityDescription} numberOfLines={1}>
            {isInvoice
              ? invoicePreview
              : isSale
              ? `🛒 ${item.description || item.productName || 'Producto'}`
              : item.description}
          </Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={11} color="#AEAEB2" />
            <Text style={styles.activityTime}>{timeAgo(item._date || item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.amountContainer}>
          <Text style={[styles.activityAmount, { color: palette.text }]}>
            {amountPrefix}${numberFormatter.format(item.amount) || '0.00'}
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: palette.bg }]}>
            <Text style={[styles.typeText, { color: palette.text }]}>
              {badgeLabel}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.threeDotsButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => setOptionsModalVisible(true)}
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#8E8E93" />
        </TouchableOpacity>
      </TouchableOpacity>

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
            <View style={styles.optionsHeader}>
              <View style={styles.optionsHeaderLeft}>
                <Text style={styles.optionsHeaderTitle} numberOfLines={1}>{clientTitle}</Text>
                <Text style={styles.optionsHeaderSub} numberOfLines={1}>
                  {item.title || item.description || 'Transacción'}
                </Text>
              </View>
              <Text style={styles.optionsHeaderAmount}>
                ${numberFormatter.format(item.amount)}
              </Text>
            </View>

            <View style={styles.optionsDivider} />

            {/* Opción Ver Perfil con icono de redirección si pertenece a cliente */}
            {hasClient && (
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => {
                  setOptionsModalVisible(false);
                  router.push(`/${item.clientId}`);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.optionIconBg, { backgroundColor: '#EBF3FF' }]}>
                  <Ionicons name="open-outline" size={20} color="#007AFF" />
                </View>
                <View style={styles.optionTextCol}>
                  <Text style={styles.optionTitle}>Ver perfil de usuario</Text>
                  <Text style={styles.optionSub}>Ir al perfil de {clientTitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
              </TouchableOpacity>
            )}

            {/* Opción Ver detalles */}
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                setOptionsModalVisible(false);
                if (item.clientId === 'global' && item.type !== 'sale' && !parsedInvoice) {
                  Alert.alert('Detalle del Ajuste', item.description || 'Ajuste de saldo');
                } else {
                  setModalVisible(true);
                }
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
              onPress={openShareModal}
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
                  transaction={item}
                  clientName={clientTitle}
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
            {/* Header con icono y título */}
            <View style={styles.modalHeaderRow}>
              <View style={[styles.modalIconBg, { backgroundColor: palette.bg }]}>
                <Ionicons name={iconName} size={24} color={palette.icon} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTxTitle}>
                  {item.title || (isInvoice ? 'Factura de compra' : item.description || 'Venta')}
                </Text>
                <Text style={styles.modalTxDate}>
                  {formatTxDate(item.createdAt || item._date, item.date)}
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
              <Text style={styles.clientTagText}>{clientTitle}</Text>
            </View>

            {/* Detalle o Factura */}
            {isInvoice && parsedInvoice ? (
              <View style={styles.invoiceBox}>
                <Text style={styles.invoiceBoxHeader}>
                  Productos comprados ({parsedInvoice.items.length})
                </Text>
                <ScrollView style={styles.invoiceScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {parsedInvoice.items.map((prod, idx) => (
                    <View key={idx} style={styles.invoiceRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.invoiceItemName}>{prod.productName}</Text>
                        <Text style={styles.invoiceItemSub}>
                          {prod.quantity} x ${numberFormatter.format(prod.unitPrice)}
                        </Text>
                      </View>
                      <Text style={styles.invoiceItemTotal}>
                        ${numberFormatter.format(prod.totalAmount)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
                <View style={styles.invoiceTotalRow}>
                  <Text style={styles.invoiceTotalLabel}>Total Venta</Text>
                  <Text style={styles.invoiceTotalAmount}>
                    ${numberFormatter.format(item.amount)}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.simpleDetailBox}>
                <Text style={styles.detailLabel}>Monto de la transacción</Text>
                <Text style={[styles.detailAmountText, { color: palette.text }]}>
                  ${numberFormatter.format(item.amount)}
                </Text>
                {item.description && item.description !== item.title && (
                  <View style={{ marginTop: 12, width: '100%' }}>
                    <Text style={styles.detailLabel}>Descripción</Text>
                    <Text style={styles.detailDescriptionText}>{item.description}</Text>
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
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#4C669F',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
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
    letterSpacing: -0.2,
  },
  activityDescription: {
    fontSize: 13,
    color: '#636366',
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  activityTime: {
    fontSize: 11,
    color: '#AEAEB2',
    fontWeight: '500',
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

  /* ── Modal de Detalle ── */
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
