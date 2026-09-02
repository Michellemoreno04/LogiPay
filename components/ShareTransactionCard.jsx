import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../authContext/authContext';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

const formatDate = (dateValue) => {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Componente visual de tarjeta/factura para compartir una transacción.
 * Incluye la información del negocio ingresada por el usuario en business-type.jsx.
 *
 * Props:
 *   - transaction: objeto de transacción
 *   - clientName: string con el nombre del cliente (opcional)
 *   - innerRef: ref que apunta al View raíz (para capturar con viewShot)
 */
export default function ShareTransactionCard({ transaction, clientName, innerRef }) {
  const auth = useAuth();
  const userData = auth?.userData;

  if (!transaction) return null;

  const isPayment = transaction.type === 'payment';
  const isSale = transaction.type === 'sale';

  // Extraer items de factura si están presentes
  let invoiceItems = null;
  const rawDesc = transaction.rawDescription || transaction.description;
  if (rawDesc) {
    try {
      const parsed = JSON.parse(rawDesc);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        invoiceItems = parsed.items;
      }
    } catch (e) { }
  }
  if (!invoiceItems && Array.isArray(transaction.items) && transaction.items.length > 0) {
    invoiceItems = transaction.items;
  }

  const headerTitle = transaction.title || (
    invoiceItems
      ? 'Factura de Venta'
      : isSale
        ? 'Orden de Venta'
        : isPayment
          ? 'Comprobante de Pago'
          : 'Comprobante de Transacción'
  );

  const dateStr = formatDate(transaction.createdAt || transaction._date || transaction.date);

  return (
    <View ref={innerRef} style={styles.wrapper} collapsable={false}>
      <View style={styles.cardSheet}>
        {/* Header en azul claro con fecha y hora debajo del título */}
        <LinearGradient
          colors={['#EBF3FF', '#DCEBFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.modalHeader}
        >
          <View style={styles.headerLeftContainer}>
            <Ionicons
              name={isSale || invoiceItems ? 'cart' : isPayment ? 'checkmark-circle' : 'receipt'}
              size={24}
              color="#4C669F"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>
                {headerTitle}
              </Text>

            </View>
          </View>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>LogiPay</Text>
          </View>
        </LinearGradient>
        <View style={{ paddingHorizontal: 20, paddingTop: 8, alignItems: 'flex-end' }}>
          {dateStr ? (
            <Text style={[styles.modalHeaderSubtitle, { textAlign: 'right' }]}>{dateStr}</Text>
          ) : null}
        </View>

        <View style={styles.modalBody}>
          {/* Información del Negocio (sin fondo blanco, N/A si no existe dato) */}
          <View style={styles.businessHeaderBox}>
            <Text style={styles.businessNameText}>{userData?.businessName || 'N/A'}</Text>
            <Text style={styles.businessInfoText}>RNC / ID: {userData?.businessRnc || 'N/A'}</Text>
            <Text style={styles.businessInfoText}>Dirección: {userData?.businessAddress || 'N/A'}</Text>
            <Text style={styles.businessInfoText}>Teléfono: {userData?.businessPhone || 'N/A'}</Text>
          </View>

          {/* Desglose del pedido / factura */}
          <Text style={styles.fieldLabel}>Desglose de la factura</Text>
          <View style={styles.orderSummaryBox}>
            {invoiceItems && invoiceItems.length > 0 ? (
              invoiceItems.map((item, index) => {
                const qty = item.quantity || 1;
                const name = item.productName || item.name || 'Producto';
                const unitPrice = parseFloat(item.unitPrice || item.price || 0);
                const total = item.totalAmount !== undefined ? item.totalAmount : qty * unitPrice;
                return (
                  <View key={index} style={styles.orderSummaryRow}>
                    <Text style={styles.orderItemName} numberOfLines={1}>
                      {qty}x {name}
                    </Text>
                    <Text style={styles.orderItemSubtotal}>
                      ${formatCurrency(total)}
                    </Text>
                  </View>
                );
              })
            ) : (
              <View style={styles.orderSummaryRow}>
                <Text style={styles.orderItemName} numberOfLines={2}>
                  {transaction.title || transaction.description || 'Concepto general'}
                </Text>
                <Text style={styles.orderItemSubtotal}>
                  ${formatCurrency(transaction.amount)}
                </Text>
              </View>
            )}

            <View style={styles.orderSummaryDivider} />

            <View style={styles.orderSummaryTotalRow}>
              <Text style={styles.orderTotalLabel}>Monto total</Text>
              <Text style={styles.orderTotalValue}>
                ${formatCurrency(transaction.amount)}
              </Text>
            </View>
          </View>

          {/* Pie de comprobante */}
          <View style={styles.footerRow}>
            {userData?.invoiceFooter ? (
              <Text style={styles.invoiceFooterMessage}>{userData.invoiceFooter}</Text>
            ) : (
              <View />
            )}
            <Text style={styles.footerRightText}>Comprobante oficial LogiPay</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 360,
    backgroundColor: 'transparent',
  },
  cardSheet: {
    backgroundColor: '#F5F7FF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D6E4FF',
  },
  headerLeftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A1F4B',
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4C669F',
    marginTop: 2,
  },
  badgeContainer: {
    backgroundColor: '#4C669F',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  modalBody: {
    padding: 20,
  },
  businessHeaderBox: {
    paddingHorizontal: 2,
    marginBottom: 16,
  },
  businessNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1A1F4B',
    marginBottom: 4,
  },
  businessInfoText: {
    fontSize: 12,
    color: '#6068A0',
    fontWeight: '500',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6068A0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  orderSummaryBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E0E4F5',
    marginBottom: 14,
  },
  orderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1F4B',
    flex: 1,
    marginRight: 10,
  },
  orderItemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4C669F',
  },
  orderSummaryDivider: {
    height: 1,
    backgroundColor: '#F0F2F8',
    marginVertical: 8,
  },
  orderSummaryTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  orderTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1F4B',
  },
  orderTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#2D8C5A',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  invoiceFooterMessage: {
    fontSize: 11,
    fontStyle: 'italic',
    color: '#6068A0',
    flex: 1,
    marginRight: 8,
  },
  footerRightText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6068A0',
  },
});




